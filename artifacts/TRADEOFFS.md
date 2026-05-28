# Trade-offs

---

## Separate hiring-trend endpoint

**Decision:** `/api/insights/hiring-trend` is a separate endpoint rather than part of `/api/insights`.

**Why:** The drill-down interaction (Year → Month → Week) triggers multiple re-fetches as the user navigates. If trend data were bundled into the main insights response, every drill click would re-fetch KPIs, salary charts, and headcount data — all of which are unchanged. The separate endpoint means only the `HiringTrendChart` component re-fetches, keeping the rest of the page static.

**Trade-off:** One extra HTTP request on initial page load (two requests instead of one). Acceptable because both fire in parallel and the results are cached after the first load.

---

## All-countries INR conversion: per-employee vs per-aggregate

**Decision:** Convert per-country salary *sums* to INR, then derive averages — rather than converting individual employee salaries.

**Why:** Loading every employee record into Node.js to do per-row conversion is O(n) in both I/O and memory. Since the exchange rate is uniform per country, converting the sum is mathematically identical and runs on ~10 rows instead of ~100K.

**Trade-off:** Min/max salary in the all-countries view is found by selecting the top candidate *per country* (`DISTINCT ON`), then comparing those ~10 INR-converted values in JS. This is exact given the current schema — currency is derived from country, not stored per-employee. If that assumption ever changed, this approach would need revisiting.

---

## Redis pattern deletion vs targeted key deletion

**Decision:** On employee mutations, use `delByPattern("insights:*")` and `delByPattern("trend:*")` rather than computing exact cache keys to delete.

**Why:** The set of active cache keys depends on which country filters users have visited — that state is not tracked server-side. Computing exact keys at mutation time would require a separate tracking structure. Pattern deletion via `SCAN` is simpler and always correct.

**Trade-off:** `SCAN` iterates the keyspace on every mutation. At the scale of this application (~tens of cache keys) this is negligible. At very high key counts, maintaining an explicit set of active cache keys (e.g. in a Redis `SET`) and deleting them directly would be more efficient.

---

## Recharts over alternatives

**Decision:** Recharts over Chart.js, Victory, or Nivo.

**Why:** Recharts is built on React primitives — every chart element is a real React component. This makes conditional rendering (e.g. dots only at year/month drill level), custom tooltips, and click-through navigation straightforward without imperative DOM manipulation. Nivo has a similar model but ships a heavier bundle. Chart.js uses a `<canvas>` ref and requires imperative updates that fight React's declarative model.

**Trade-off:** Recharts' bundle is larger than a bare Canvas solution. For a data dashboard that already pays the Recharts cost once, this is amortised across all charts on the page.

---

## Drill-down animation via `key` increment

**Decision:** Animate chart transitions by incrementing a `chartKey` integer on each drill action, which forces React to unmount and remount the chart wrapper `<div>`. The `animate-chart-in` CSS keyframe fires automatically on mount.

**Why:** Recharts has no built-in transition API for data changes. Animating by updating data props produces no visual effect. Forcing a remount via a changed `key` is the idiomatic React way to retrigger mount-time effects like CSS animations.

**Trade-off:** A remount destroys and recreates all child DOM nodes on every drill navigation. For a lightweight `<div>` wrapping a Recharts SVG this is imperceptible, but the same pattern applied to a component with expensive initialisation would cause visible jank.

---

## `onMouseDown preventDefault` for focus-ring suppression

**Decision:** Wrap each chart in a `div` with `onMouseDown={(e) => e.preventDefault()}` to prevent the browser from setting focus on click, rather than relying on CSS `outline: none` or `tabIndex={-1}`.

**Why:** The browser commits focus during the `mousedown` phase, before CSS is applied. On some Chromium builds, `outline: none` and `tabIndex={-1}` do not suppress the UA stylesheet's `:focus-visible` ring — it is painted at the compositor level before the CSS cascade resolves. `preventDefault()` on `mousedown` stops the browser from ever initiating the focus, making the fix browser- and OS-agnostic.

**Trade-off:** `preventDefault` on `mousedown` suppresses focus for all clicks within that wrapper. `click` events still fire normally, so chart interactivity is unaffected. Text selection is also prevented (`select-none` is applied alongside), which is the correct behaviour for a non-text chart surface.

---

## Employee list not cached per filter

**Decision:** Employee list queries (with arbitrary search, sort, and filter combinations) hit the database directly rather than being cached.

**Why:** The number of possible filter permutations (search string × country × department × role × sort × page) is too large to cache individually without unbounded Redis growth. Per-record caching (`emp:{email}`) is used for single-record lookups (e.g. edit form pre-fill), where the cache hit rate is high.

**Trade-off:** List queries always hit PostgreSQL. Mitigated by the existing column indexes (`country`, `department`, `role`, `email`) which keep these queries fast even without a cache layer.

---

## GIN Trigram vs PostgreSQL Full-Text Search for employee name/email search

**Decision:** GIN trigram indexes (`pg_trgm`) on `firstName`, `lastName`, and `email` — not PostgreSQL Full-Text Search (FTS).

### Options considered

**Option A — GIN Trigram (`pg_trgm`):** Stores every 3-character slice of a string in a GIN index. Any `ILIKE '%term%'` query where `term` is ≥ 3 characters can use the index instead of a sequential scan.

**Option B — PostgreSQL Full-Text Search (FTS):** Pre-computes `tsvector` lexemes and queries with `tsquery`. Designed for natural-language document search.

| Dimension | GIN Trigram | Full-Text Search |
|---|---|---|
| **Partial-name match** (`"ali"` → `"Alice"`) | ✅ Yes — substring match on raw characters | ❌ No — matches whole lexemes only |
| **Query code changes** | ✅ None — Prisma `contains` + `insensitive` generates `ILIKE '%term%'` natively | ❌ Requires `to_tsvector` / `@@` operator; needs `$queryRaw` or `$queryRawUnsafe` |
| **ORM compatibility** | ✅ Fully compatible | ❌ Breaks ORM abstraction; loses type safety |
| **Email field support** | ✅ Treats email as an opaque string — correct behaviour | ❌ Tokenizes `@` and `.` as separators; `alice@company.com` → lexemes `alic`, `compani`, `com` |
| **Relevance ranking** | ❌ Not built-in | ✅ `ts_rank` available |
| **Stemming / stop-words** | ❌ Not applicable | ✅ Available (irrelevant for names) |
| **Index size** | Larger — GIN on raw trigrams (~1.5–3× column data) | Smaller — GIN on lexemes |
| **Min term length** | 3 characters (planner uses seq scan below this) | No hard minimum (but partial match is broken regardless) |
| **Extension required** | `pg_trgm` — one `CREATE EXTENSION` | None |
| **Maintenance overhead** | None after index creation | `tsvector` column must be kept in sync (trigger or Prisma middleware) |
| **Uniform across all columns** | ✅ Same index type for `firstName`, `lastName`, `email` | ❌ Email needs different dictionary (`simple`); still can't do prefix match without trigram |

### Decision rationale

GIN trigram was chosen because:

1. **It does not break partial-name matching** — the single most important requirement. FTS fails this outright.
2. **Zero query changes** — Prisma's existing `contains` + `insensitive` ORM calls generate `ILIKE '%term%'`, which the trigram index handles natively. No raw SQL, no schema changes, no ORM workarounds.
3. **Consistent treatment of all three columns** — one approach covers `firstName`, `lastName`, and `email`. FTS would need two mechanisms (or a degraded UX for email).
4. **Simplicity** — adding three `CREATE INDEX` statements is the entire implementation. FTS would require new columns, triggers or Prisma middleware to maintain `tsvector`, and raw SQL throughout the search path.

### Trade-offs accepted

| Trade-off | Mitigation |
|---|---|
| Larger index size (GIN vs B-tree) | Acceptable at ≤ 100K employees; index fits in shared_buffers |
| Seq scan for searches < 3 chars | Enforced as a hard minimum on both FE (UI + debounce) and BE (Zod `.trim().min(3)`), so these queries never reach the DB |
| `pg_trgm` extension required | One-time `CREATE EXTENSION` — no ongoing maintenance |
| No relevance ranking | Not needed; name/email lookups expect substring-match results, not ranked documents |

### Indexes created

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY emp_firstname_trgm
  ON "Employee" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_lastname_trgm
  ON "Employee" USING GIN ("lastName"  gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_email_trgm
  ON "Employee" USING GIN ("email"     gin_trgm_ops);
```

`CONCURRENTLY` keeps the table writable during index build — important for a live dataset.
