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
