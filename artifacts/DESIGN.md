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

Key elements:
- Country filter in page header (scopes all charts)
- 4 stat cards: Total Employees, Average Salary, Minimum Salary, Maximum Salary
- Bar chart: Average salary by country (horizontal, colour-coded)
- Range chart: Min / Avg / Max salary by department
- Role breakdown table: avg salary per role with % vs global average badge
- Quick Summary card: headcount by country, median salary, top/bottom paying countries

## Design Decisions

- **Indigo (#4F46E5) as primary** — professional, distinguishable from common blue SaaS tools
- **Slate background (#F8FAFC)** — reduces eye strain on data-heavy pages
- **Disabled CTA on Setup** — prevents partial seeds; both files must be present
- **Salary displayed in local currency per row** — HR manages a global org; raw numbers without context are misleading
- **Range bars on department chart** — avg alone hides salary spread; min/max gives HR a fuller picture
