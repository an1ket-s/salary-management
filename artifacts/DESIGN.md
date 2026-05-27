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

#### Chart 1 — Average Salary by Department (Vertical Bar Chart)

- **Type:** `BarChart` (Recharts) — vertical bars, one bar per department
- **X-axis:** department name
- **Y-axis:** average salary (formatted, no decimals)
- **Bar fill:** single indigo (`#6366F1`) with opacity hover effect
- **Tooltip:** department name + avg salary in local format
- **Data source:** `/api/insights` → `avgSalaryByDepartment[]`
- **Why:** shows which departments are highest-paid at a glance

---

#### Chart 2 — Employee Count by Country (Horizontal Bar Chart)

- **Type:** `BarChart` layout `"vertical"` (Recharts) — horizontal bars, one per country
- **Y-axis:** country name
- **X-axis:** employee count
- **Bar fill:** colour-coded per country (10 distinct slate/indigo shades)
- **Tooltip:** country + headcount + % of total
- **Data source:** `/api/insights` → `headcountByCountry[]`
- **Why:** geographic distribution is key for global HR teams

---

#### Chart 4 — Hiring Trend (Area Chart)

- **Type:** `AreaChart` (Recharts) — smoothed, single area
- **X-axis:** period label — format depends on `trendBy` (see below)
- **Y-axis:** number of employees joined
- **Area fill:** indigo gradient (`#6366F1` → transparent)
- **Stroke:** `#4F46E5`
- **Dot:** shown on hover only
- **Tooltip:** period label + count joined
- **Data source:** `/api/insights?trendBy=` → `hiringTrend[]`
- **Period filter (toggle buttons — Week / Month / Year):**
  - `week`  → groups by ISO week; label format: `W3 '24`
  - `month` → groups by calendar month (default); label format: `Jan '24`
  - `year`  → groups by year; label format: `2024`
- **Why:** reveals hiring velocity and seasonal patterns at multiple granularities

---

#### Chart 5 — Department Distribution (Donut Chart)

- **Type:** `PieChart` with `innerRadius` (donut) — Recharts
- **Slices:** one per department, 8 slices total
- **Palette:** 8 distinct colours cycling through indigo → violet → sky → teal → amber → rose → emerald → orange
- **Centre label:** total employee count (rendered via custom label)
- **Legend:** department name + % — positioned to the right of the donut
- **Tooltip:** department + count + %
- **Data source:** `/api/insights` → `headcountByDepartment[]`
- **Why:** quick proportion view; complements Chart 2 (country) with an org-structure lens

---

#### Layout

```
[ KPI ] [ KPI ] [ KPI ] [ KPI ]
[ Chart 1 — Avg Salary/Dept (bar) col-2 ] [ Chart 5 — Dept Donut   col-1 ]
[ Chart 2 — Count/Country (bar)   col-1 ] [ Chart 4 — Hiring Trend col-2 ]
```

Grid: `grid-cols-3`. Chart 1 and Chart 4 span `col-span-2`; Charts 2 and 5 span `col-span-1`.

---

#### Backend endpoint: `GET /api/insights`

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `country` | string | `""` (all) | Filter insights to one country. Empty = all countries, salaries normalised to INR. |

**Currency rules:**
- `country` is empty → convert all salaries to **INR** using the exchange-rate API (base: INR). Cached as `exg_rates:INR` for 24 h.
- `country` is set → return salaries in that **country's local currency** as stored in DB. No conversion needed.
- The response always includes a top-level `currency` string so the frontend never has to infer it.

**Country → currency map (local currency codes):**

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

**Chart filter scope:**

| Chart | Responds to `?country=` |
|---|---|
| KPI cards | Yes |
| Chart 1 — Avg Salary/Dept | Yes |
| Chart 3 — Salary Range/Role | Yes |
| Chart 4 — Hiring Trend | Yes |
| Chart 5 — Dept Donut | Yes |
| Chart 2 — Headcount by Country | **No** — always shows all countries (it IS the geographic breakdown) |

**Response shape:**

```json
{
  "data": {
    "currency": "INR",
    "kpi": {
      "totalEmployees": 10000,
      "avgSalary": 950000,
      "maxSalary": { "value": 5000000, "role": "VP", "department": "Engineering" },
      "minSalary": { "value": 120000, "role": "Junior Engineer", "department": "HR" }
    },
    "avgSalaryByDepartment": [{ "department": "Engineering", "avg": 1200000 }],
    "headcountByCountry":    [{ "country": "India", "count": 3200, "pct": 32 }],
    "hiringTrend":           [{ "label": "2024-01", "count": 120 }],
    "headcountByDepartment": [{ "department": "Engineering", "count": 2800, "pct": 28 }]
  }
}
```

---

## Caching

**Library:** `node-redis` — cloud-hosted Redis instance.

### Cache Keys

| Resource | Key pattern | Invalidation |
|---|---|---|
| Employee | `emp:{email}` | On update or delete of that employee |
| Employee ID pointer | `emp:ptr:{id}` | Same as above |
| Employee meta (countries/depts/roles) | `emp:meta` | On employee create or delete; TTL 30 min |
| Exchange rates | `exg_rates:INR` | TTL: 24 h (rates don't change intra-day) |
| Insights response | `insights:{country\|"all"}` | TTL: 10 min |

**Strategy:**
- Employee data is cached per email. Any mutation (create / update / delete) deletes the matching key.
- Employee list queries are **not** individually cached per filter combination — the per-record `emp:{email}` cache is used for single-record lookups (e.g. edit pre-fill). List results hit the DB directly but are fast due to indexed columns.
- Exchange rates are cached on first `/api/insights` call with a 24-hour TTL; no manual invalidation needed.

---

## Design Decisions

- **Indigo (#4F46E5) as primary** — professional, distinguishable from common blue SaaS tools
- **Slate background (#F8FAFC)** — reduces eye strain on data-heavy pages
- **Disabled CTA on Setup** — prevents partial seeds; both files must be present
- **Salary displayed in local currency per row** — HR manages a global org; raw numbers without context are misleading
- **Range bars on department chart** — avg alone hides salary spread; min/max gives HR a fuller picture
- **Redis caching with `node-redis`** — cloud-hosted; employee lists cached by filter hash and invalidated on any mutation; exchange rates cached 24 h; insights cached 10 min per country filter
