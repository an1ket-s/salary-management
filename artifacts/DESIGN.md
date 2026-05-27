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

#### Chart 3 — Salary Distribution by Role (Grouped Bar: Min / Avg / Max)

- **Type:** `BarChart` grouped — 3 bars per role (min, avg, max)
- **X-axis:** role name
- **Y-axis:** salary value
- **Bar fills:** `#93C5FD` (min) · `#6366F1` (avg) · `#1E40AF` (max)
- **Legend:** Min / Avg / Max inline colour swatches
- **Tooltip:** all three values for the hovered role
- **Data source:** `/api/insights` → `salaryRangeByRole[]`
- **Why:** avg alone hides spread; showing min/max reveals pay equity issues

---

#### Chart 4 — Hiring Trend (Area Chart — employees joined per month)

- **Type:** `AreaChart` (Recharts) — smoothed, single area
- **X-axis:** month label (e.g. "Jan 2024")
- **Y-axis:** number of employees joined
- **Area fill:** indigo gradient (`#6366F1` → transparent)
- **Stroke:** `#4F46E5`
- **Dot:** shown on hover only
- **Tooltip:** month + count joined
- **Data source:** `/api/insights` → `hiringTrend[]` (grouped by month from `joiningDate`)
- **Why:** reveals hiring velocity and seasonal patterns

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
[ Chart 1 — Avg Salary/Dept (bar)      ] [ Chart 5 — Dept Donut         ]
[ Chart 3 — Salary Range/Role (grouped)] [ Chart 2 — Count/Country (bar)]
[ Chart 4 — Hiring Trend (area) — full width                             ]
```

Grid: `grid-cols-3`, Charts 1 and 3 span `col-span-2`, Chart 4 spans `col-span-3`.

---

#### Backend endpoint: `GET /api/insights`

Response shape:

```json
{
	"data": {
		"kpi": {
			"totalEmployees": 10000,
			"avgSalary": 950000,
			"maxSalary": {
				"value": 5000000,
				"role": "VP",
				"department": "Engineering"
			},
			"minSalary": {
				"value": 120000,
				"role": "Junior Engineer",
				"department": "HR"
			}
		},
		"avgSalaryByDepartment": [{ "department": "Engineering", "avg": 1200000 }],
		"headcountByCountry": [{ "country": "India", "count": 3200, "pct": 32 }],
		"salaryRangeByRole": [
			{ "role": "Engineer", "min": 400000, "avg": 800000, "max": 2000000 }
		],
		"hiringTrend": [{ "month": "2024-01", "count": 120 }],
		"headcountByDepartment": [
			{ "department": "Engineering", "count": 2800, "pct": 28 }
		]
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
| Exchange rates | `exg_rates:{base_country}` | TTL: 24 h (rates don't change intra-day) |

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
