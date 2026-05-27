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
