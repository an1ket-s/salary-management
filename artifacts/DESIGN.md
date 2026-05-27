# UI Design — Salary Management

Figma file: https://www.figma.com/design/tYQz0hky2aa4ayBa6Y2Vmk

## Pages

### 01 — Setup (Name File Upload)

The entry point before seeding. HR uploads `first_names.txt` and `last_names.txt`
via a two-step wizard. Files are streamed line-by-line on the server and batch-inserted
into a `NameBank` table. The "Seed Database" CTA is disabled until both files are uploaded.

Key elements:

- Step indicator (Upload Files → Seed Database)
- Two upload boxes: success state (file loaded + name count) and empty state (dashed border)
- Info banner explaining both files are required
- Disabled CTA button until both files present

### 02 — Employees

Full CRUD interface for the 10,000-employee dataset.

Key elements:

- Page header with total count badge and "Add Employee" button
- Filter bar: keyword search + Country / Department / Role dropdowns + Sort
- Paginated table: Name, Email, Role, Department, Country, Salary, Joining Date, Actions
- Row-level Edit (indigo) and Delete (red) buttons
- "Add Employee" modal with all form fields (firstName, lastName, phone, email, role, department, country, salary, joiningDate)

### 03 — Insights

Salary analytics dashboard for HR managers.  
**Charting library:** [Recharts](https://recharts.org) — React-native, composable, styled via props to match the indigo/slate palette.

---

#### KPI Cards (top row — 4 cards)

| Card            | Value                          | Sub-label                |
| --------------- | ------------------------------ | ------------------------ |
| Total Employees | count                          | "across all departments" |
| Average Salary  | formatted with currency symbol | "across all employees"   |
| Highest Salary  | formatted                      | role · department        |
| Lowest Salary   | formatted                      | role · department        |

Layout: `grid grid-cols-4` — each card uses the existing `Card` component with a coloured icon accent.

---

#### Chart 1 — Average Salary by Department (Bar Chart)

- **Type:** `BarChart` (Recharts) — vertical bars, one bar per department
- **X-axis:** department name
- **Y-axis:** average salary (formatted, no decimals)
- **Bar fill:** single indigo (`#6366F1`)
- **Tooltip:** department name + avg salary + "Click to view employees →"
- **Click behaviour:** navigates to `/employees?department=<dept>&country=<selected>`
- **Data source:** `/api/insights` → `avgSalaryByDepartment[]`
- **Why:** shows which departments are highest-paid at a glance; click-through lets HR drill into the actual people

---

#### Chart 2 — Employee Count by Country (Horizontal Bar Chart)

- **Type:** `BarChart` layout `"vertical"` (Recharts) — horizontal bars, one per country
- **Y-axis:** country name
- **X-axis:** employee count
- **Tooltip:** country + headcount + % of total
- **Data source:** `/api/insights` → `headcountByCountry[]`
- **Why:** geographic distribution is key for global HR teams

---

#### Chart 4 — Hiring Trend (Drill-down Area Chart)

- **Type:** `AreaChart` (Recharts) — smoothed, gradient fill, all three drill levels
- **Default view:** year-level (e.g. 2021, 2022, 2023, 2024)
- **Drill-down:** click a year → month view for that year; click a month → week view for that month
- **Animation:** `animate-chart-in` CSS keyframe (opacity + translate) fires on each drill transition via a `key` increment that re-mounts the chart wrapper
- **Breadcrumb:** All Years › 2024 › Jan 2024 — each crumb is clickable to navigate back up
- **Colour per level:** indigo (#6366F1) → violet (#8B5CF6) → dark indigo (#4F46E5)
- **Dots:** shown at year/month level (clickable points); hidden at week level (leaf)
- **Tooltip:** period label + count + "Click to drill down" hint (hidden at leaf level)
- **Data source:** `/api/insights/hiring-trend?trendBy=&year=&month=` (separate endpoint — changing the drill level only re-fetches this chart, not the whole page)
- **Why:** reveals hiring velocity and seasonal patterns at multiple granularities without overwhelming the default view

---

#### Chart 5 — Department Distribution (Donut Chart)

- **Type:** `PieChart` with `innerRadius` (donut) — Recharts
- **Slices:** one per department, cycling through an 8-colour palette (indigo → violet → sky → teal → amber → rose → emerald → orange)
- **Centre label:** total employee count (rendered via custom `<Label>` component)
- **Legend:** department name — positioned below
- **Tooltip:** department + count + % + "Click to view employees →"
- **Click behaviour:** navigates to `/employees?department=<dept>&country=<selected>`
- **Data source:** `/api/insights` → `headcountByDepartment[]`
- **Why:** quick proportion view; click-through mirrors Chart 1 for consistency

---

#### Layout

```
[ KPI ] [ KPI ] [ KPI ] [ KPI ]
[ Chart 1 — Avg Salary/Dept  col-2 ] [ Chart 5 — Dept Donut    col-1 ]
[ Chart 2 — Count/Country    col-1 ] [ Chart 4 — Hiring Trend  col-2 ]
```

Grid: `grid-cols-3`. Chart 1 and Chart 4 span `col-span-2`; Charts 2 and 5 span `col-span-1`.

---

#### Backend endpoints

**`GET /api/insights`**

| Param | Type | Default | Description |
|---|---|---|---|
| `country` | string | `""` (all) | Filter to one country. Empty = all countries, salaries normalised to INR. |

**Currency rules:**
- `country` is empty → convert all salaries to **INR** using the exchange-rate API (base: INR). Cached as `exg_rates:INR` for 24 h.
- `country` is set → return salaries in that **country's local currency** as stored in DB. No conversion.
- The response always includes a top-level `currency` string so the frontend never infers it.

| Country | Currency |
|---|---|
| India | INR |
| USA | USD |
| UK | GBP |
| Germany | EUR |
| France | EUR |
| Japan | JPY |
| Brazil | BRL |
| Canada | CAD |
| Australia | AUD |
| Singapore | SGD |

**Response shape:**

```json
{
  "data": {
    "currency": "INR",
    "kpi": {
      "totalEmployees": 10000,
      "avgSalary": 950000,
      "maxSalary": { "value": 5000000, "role": "VP", "department": "Engineering" },
      "minSalary": { "value": 120000, "role": "Analyst", "department": "HR" }
    },
    "avgSalaryByDepartment": [{ "department": "Engineering", "avg": 1200000 }],
    "headcountByCountry":    [{ "country": "India", "count": 3200, "pct": 32 }],
    "headcountByDepartment": [{ "department": "Engineering", "count": 2800, "pct": 28 }]
  }
}
```

Note: `hiringTrend` is **not** in this response — it is served by a separate endpoint so drill-down interactions only trigger a targeted re-fetch.

---

**`GET /api/insights/hiring-trend`**

| Param | Type | Default | Description |
|---|---|---|---|
| `country` | string | `""` | Filter to one country |
| `trendBy` | `week\|month\|year` | `year` | Grouping granularity |
| `year` | string | — | e.g. `"2024"` — filters to a specific year (used when `trendBy=month`) |
| `month` | string | — | e.g. `"2024-03"` — filters to a specific month (used when `trendBy=week`) |

**Response shape:**

```json
{ "data": [{ "label": "2024", "count": 412 }] }
```

---

## Caching

**Library:** `node-redis` — cloud-hosted Redis instance.

### Cache Keys

| Resource | Key pattern | TTL | Invalidated by |
|---|---|---|---|
| Employee record | `emp:{email}` | 1 h | Update or delete of that employee |
| Employee ID pointer | `emp:ptr:{id}` | 1 h | Same as above |
| Employee meta | `emp:meta` | 30 min | Employee create or delete |
| Exchange rates | `exg_rates:INR` | 24 h | TTL only (rates don't change intra-day) |
| Insights response | `insights:{country\|"all"}` | 10 min | Any employee mutation via `delByPattern("insights:*")` |
| Hiring trend response | `trend:{country\|"all"}:{trendBy}:{year}:{month}` | 10 min | Any employee mutation via `delByPattern("trend:*")` |

### Strategy

- **Employee records** — cached individually by email. ID-to-email pointer allows O(1) lookup by ID without a DB hit. Any mutation deletes only the affected keys.
- **Employee lists** — not cached per filter combination (too many permutations). List queries hit the DB directly but are fast due to indexed columns.
- **Exchange rates** — cached on first call, TTL-only invalidation. Rates are fetched from `exchangerate-api.com` (base: INR).
- **Insights & trend** — full response cached. Because any employee change can shift counts, averages, and joining-date distributions, all `insights:*` and `trend:*` keys are wiped on every mutation using `SCAN` + `DEL` (never `KEYS` — that blocks Redis).

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Browser                    │
│  Next.js 16 App Router  (port 3000)         │
│  React + Recharts + Tailwind v4             │
└────────────────────┬────────────────────────┘
                     │ fetch /api/*
┌────────────────────▼────────────────────────┐
│            Express API  (port 3001)         │
│                                             │
│  routes → controllers → services           │
│                    │            │           │
│             repositories    cache.ts        │
│                    │            │           │
│              Prisma ORM     node-redis      │
└──────────┬─────────┴────────────┬───────────┘
           │                      │
┌──────────▼──────────┐  ┌────────▼──────────┐
│  PostgreSQL (Prisma) │  │  Redis (cloud)    │
│  - Employee          │  │  emp:{email}      │
│  - NameBank          │  │  emp:ptr:{id}     │
└─────────────────────┘  │  emp:meta         │
                          │  exg_rates:INR    │
                          │  insights:{c}     │
                          │  trend:{c}:{t}:…  │
                          └───────────────────┘
```

### Request flow — cache hit (insights)

```
GET /api/insights?country=India
  → controller.get()
  → service.getInsights("India")
      → cache.get("insights:India")   ← Redis hit ~1 ms
      ← return cached result
```

### Request flow — cache miss (insights, single-country)

```
GET /api/insights?country=India
  → service.getInsights("India")
      → cache.get("insights:India")   ← miss
      → Promise.all([
          getInsightsSingleCountry()  → 4 SQL aggregate queries (~20 rows)
          getHeadcountByCountry()     → 1 groupBy query  (~10 rows)
        ])
      → format result
      → cache.set("insights:India", result, 600)
      ← return result
```

### Request flow — cache miss (insights, all-countries)

```
GET /api/insights
  → service.getInsights()
      → cache.get("insights:all")     ← miss
      → getExchangeRates()            ← Redis hit or external API call
      → Promise.all([
          getInsightsAllCountries()   → 4 groupBy/raw queries (~80 rows)
          getHeadcountByCountry()     → 1 groupBy query
        ])
      → INR conversion on ~80 rows (not ~100K rows)
      → cache.set("insights:all", result, 600)
      ← return result
```

---

## Further Reading

- [PERFORMANCE.md](./PERFORMANCE.md) — problem statement, all three optimisation steps, before/after comparisons
- [TRADEOFFS.md](./TRADEOFFS.md) — design decisions and their trade-offs
- [AI_PROMPTS.md](./AI_PROMPTS.md) — key prompts used with Claude Code and what each one produced
