# AI Prompts Used

This project was built with [Claude Code](https://claude.ai/code) (Anthropic). The sections below document the key prompts that drove significant design or implementation decisions, along with what each one produced.

---

## Setup & Seeding

**Prompt:**

> "I want to build a salary management system. The setup page should let HR upload first and last name files, then seed the database with random employees."

**What it produced:**

- Two-step upload wizard (first names → last names → seed)
- `NameBank` table storing names by type (`FIRST` / `LAST`)
- `/api/names/upload` streaming line-by-line to avoid loading large files into memory
- `/api/seed` generating random employees by combining names from the bank
- Disabled "Seed Database" CTA until both files are uploaded

---

## Caching Strategy

**Prompt:**

> "Lets use redis for caching. Redis would be used in caching the employee details until they are changed or ttl. use node-redis. i have setup the database in cloud."

**What it produced:**

- `lib/redis.ts` — singleton `createClient` with error swallowing so Redis failure never crashes the API
- `lib/cache.ts` — `get / set / del / delByPattern` wrapper; all errors swallowed (cache is non-fatal)
- `emp:{email}` + `emp:ptr:{id}` dual-key pattern for O(1) lookup by either email or numeric ID without a DB hit
- Cache-aside in `employeesService.findById`, `create`, `update`, `remove`

---

## Insights Endpoint Design

**Prompt:**

> "Lets start implementing insights. Before that finalize the design, then move forward."

**What it produced:**

- Currency-normalisation design: all-countries view converts salaries to INR via exchange rate API; single-country view uses local currency as stored
- Decision to exclude `hiringTrend` from the main `/api/insights` payload (served by a separate endpoint)
- KPI card layout (Total Employees, Avg Salary, Highest Salary, Lowest Salary)
- Chart grid: `[Avg Salary/Dept col-2][Dept Donut col-1] / [Country Headcount col-1][Hiring Trend col-2]`
- `COUNTRY_CURRENCY` map and the `currency` field in every insights response

---

## Isolated Re-renders on Period Filter Change

**Prompt:**

> "On changing the trend by filter only the component must be rendered not the other components neither the page."

**What it produced:**

- Separate `/api/insights/hiring-trend` endpoint so drill-down re-fetches only affect the trend chart
- `HiringTrendChart` as a self-contained component owning its own `trendBy`, `data`, and `loading` state
- Changing the period filter or drill level never triggers a re-render of `InsightsPage` or sibling charts
- `api.insights.getHiringTrend(country, trendBy, year, month)` as a dedicated client-side call

---

## Drill-down Hiring Trend

**Prompt:**

> "By default in the Hiring trend lets show the yearwise data. On any year click then (fadein or fadeout or any type of animation) show month wise for that year, similarly on month click show the weekwise data."

**What it produced:**

- `DrillState` type: `{ level: "year" | "month" | "week"; year?: string; month?: string }`
- `chartKey` integer — incremented on every drill action, forcing a React remount of the chart wrapper, which retriggers the `animate-chart-in` CSS keyframe
- `animate-chart-in` utility in `globals.css`: `opacity 0→1` + `translate 0 8px→0` over 280 ms using the CSS individual `translate` property (not `transform` shorthand, to avoid conflicts with tw-animate-css)
- Clickable breadcrumb: All Years › 2024 › Jan 2024 — each segment navigates back up the drill stack
- `year` and `month` query params on the hiring-trend endpoint so the backend filters appropriately at each level
- `trendBy=week` label format: `IYYY-"W"IW` using `DATE_TRUNC` to avoid the `GROUP BY` function-dependency error

---

## Area Chart for All Drill Levels

**Prompt:**

> "Make the Year and monthwise area chart"

**What it produced:**

- Unified `<AreaChart>` for all three drill levels (replacing the previous `isLeaf ? AreaChart : BarChart` split)
- `strokeColor` varies by level: indigo (#6366F1) → violet (#8B5CF6) → dark indigo (#4F46E5)
- Dots shown at year/month (clickable), hidden at week (leaf)
- `handlePointClick` reads `chartData.activeLabel` (Recharts AreaChart's click event) rather than `entry.label` (BarChart)
- Tooltip "Click to drill down" hint visible at year/month, hidden at week

---

## Chart Click-through to Employees

**Prompt:**

> "Apart from Hiring trend chart, in the other charts on click redirect to the employees page with the query params. Lets say if i am clicking on HR bar, then redirect to the employees page with filters on department HR and country with the selected one in Insights page."

**What it produced:**

- `drillToEmployees(department)` helper using `useRouter` from `next/navigation` and `URLSearchParams`
- URL format: `/employees?department=HR&country=India` (country omitted when "All Countries" is selected)
- `Bar onClick` on the Avg Salary chart
- `Pie onClick` on the Department Donut chart
- "Click to view employees →" hint added to both tooltips
- `cursor-pointer` on bar elements; `cursor="pointer"` prop on the Pie component

---

## Focus Ring Suppression

**Prompt:**

> "When i am clicking on any chart then focus ring is appearing. This is not good for ui/ux. Fix this"

**What it produced (three iterations):**

1. CSS `outline: none` on `.recharts-wrapper:focus` / `.recharts-surface:focus` — insufficient; UA stylesheet wins on some Chromium builds
2. `tabIndex={-1}` on all chart components — insufficient; browser still sets focus on click for `-1` elements
3. `onMouseDown={(e) => e.preventDefault()}` on chart wrapper divs — definitive fix; prevents the browser from ever initiating focus during the `mousedown` phase, before any CSS is resolved

---

## Search Bar Optimizations

### FE + BE optimization audit

### Frontend debounce + minimum character threshold

**Prompt:**

> "In FE, add debounce on search bar. In search bar the minimum char must be 3. First impl FE then we will go to BE optimizations."

**What it produced:**

- `searchRef = useRef(appliedSearch)` — updated synchronously in `onChange` so the debounced callback always reads the latest value without capturing a stale closure
- `searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)` — stores the pending timer handle so every keystroke cancels the previous one
- Auto-trigger fires only when `trimmed.length === 0` (clear) or `trimmed.length >= 3`; 1–2 char inputs are held until Enter or the threshold is crossed
- `onKeyDown Enter` cancels any pending timer and calls `applyFilters()` immediately — users can bypass the debounce by pressing Enter

---

### Focus ring suppression (inputs, selects, modals)

**Prompts:**

> "focus rings are appearing on the search, dropdowns, Modal close icon and modal components. Fix this"
>
> "focus ring is still appearing on select and dropdown and modal input"

**What it produced (two iterations, three surfaces):**

**Attempt 1** — Added `focus-visible:ring-*` classes and global CSS rule:

```css
*:focus:not(:focus-visible) {
	outline: none;
	box-shadow: none;
}
```

Insufficient: Chrome always fires `:focus-visible` on `<input>` elements even on mouse click (per spec — inputs are deemed keyboard-navigable by UA heuristic), so ring classes still applied.

**Attempt 2 (final)** — Removed all ring utility classes entirely from the affected components:

- `web/components/ui/input.tsx` — stripped `focus-visible:ring-2`, `focus-visible:ring-offset-2`, `focus-visible:ring-ring`; kept only `focus:outline-none`
- `web/components/ui/select.tsx` — same removal on `SelectTrigger`
- `web/components/ui/dialog.tsx` — `DialogContent` gets `focus:outline-none` (suppresses Radix's auto-focus outline on open); close button changed from `focus:ring-2` to `focus-visible:ring-2` (keyboard-only ring)

---

### GIN trigram vs Full-Text Search design

**Prompt:**

> "Lets move to BE optimization for index, Suggest me would GIN trigram index be better on firstname and lastName. OR implementing full text search. Lets design first with the advantages, disadvantages and tradeoffs."

**What it produced:**

A structured decision matrix covering:

|                                 | GIN Trigram                  | Full-Text Search                       |
| ------------------------------- | ---------------------------- | -------------------------------------- |
| Partial match ("ali" → "Alice") | ✅ Yes                       | ❌ No (whole lexemes only)             |
| Query code changes required     | ✅ None (Prisma ILIKE works) | ❌ Raw SQL / `$$` operator             |
| Email field support             | ✅ Works naturally           | ❌ Tokenizes `@` and `.` as separators |
| Index size vs B-tree            | Larger (GIN)                 | Comparable (lexeme GIN)                |
| Min term length                 | 3 chars (trigram limit)      | No limit (but partial match broken)    |
| Relevance ranking               | ❌ Not built-in              | ✅ `ts_rank` available                 |

**Decision:** GIN trigram — substring matching is the primary requirement; FTS breaks it. See [TRADEOFFS.md](./TRADEOFFS.md) for the full rationale.

---

### GIN trigram index creation

**Prompt:**

> "Run trigram on firstname + lastName only Keep B-tree on email. Provide me the queries, i will run it. Along with provide me the validate index query."

**What it produced (then corrected):**

Initial recommendation: trigram on `firstName`/`lastName`; B-tree on `email`.

**Corrected after verification:** B-tree indexes are bypassed for case-insensitive `ILIKE` — the existing `email` unique constraint (a B-tree) was confirmed via `EXPLAIN ANALYZE` to still produce a sequential scan for `ILIKE '%alice%'`. Trigram index added to `email` as well.

**Final SQL delivered:**

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes
CREATE INDEX CONCURRENTLY emp_firstname_trgm
  ON "Employee" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_lastname_trgm
  ON "Employee" USING GIN ("lastName"  gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_email_trgm
  ON "Employee" USING GIN ("email"     gin_trgm_ops);

-- Verification: list indexes on Employee table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Employee';
```

---

### Backend minimum-length guard

**Prompt:**

> "check the code if the queries are correct and will trigger index search."

**What it produced:**

- Confirmed `buildWhere` in `repositories/employees.ts` uses `contains` + `mode: "insensitive"` — generates `ILIKE '%term%'` which correctly triggers GIN trigram indexes. No repository changes needed.
- Found missing minimum-length guard on BE: a 1- or 2-character search would reach the DB and trigger a seq scan (trigram indexes require ≥ 3 chars). Fixed by adding `.trim().min(3)` to the Zod schema in `controllers/employees.ts`:

```ts
search: z.string().trim().min(3).optional();
```

This rejects sub-3-char requests with HTTP 400 before they reach the repository layer.

---
