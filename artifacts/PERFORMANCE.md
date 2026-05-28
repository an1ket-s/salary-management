# Performance

## Problem Statement

The original `/api/insights` implementation called `prisma.employee.findMany()` with no limit, pulling every employee row (salary, country, department, role) into Node.js and doing all aggregation — average, min, max, group-by-department — in JavaScript. At 10K employees this was measurable; at 100K it becomes a bottleneck in both DB I/O and Node.js heap.

Similarly, `/api/insights/hiring-trend` had no caching and its `WHERE` clauses used `EXTRACT(YEAR FROM "joiningDate")::int = N` — a function call the B-tree index cannot satisfy, forcing a sequential scan on every request.

---

## Optimisations Applied (in order)

### 1 — Database indexes + index-compatible predicates

Added to `schema.prisma`:

```prisma
@@index([joiningDate])           -- hiring trend GROUP BY scans
@@index([country, joiningDate])  -- filtered trend: country + date range
@@index([country, department])   -- dept aggregation with country filter
```

Replaced `EXTRACT()` predicates with date-range equivalents:

```sql
-- Before (function call, index-blind):
WHERE EXTRACT(YEAR FROM "joiningDate")::int = 2024

-- After (range predicate, index-eligible):
WHERE "joiningDate" >= '2024-01-01' AND "joiningDate" < '2025-01-01'
```

PostgreSQL can use a B-tree index for range comparisons but not for wrapped function calls. This change lets year/month-filtered trend queries use an index scan instead of a sequential scan.

---

### 2 — Redis caching for both endpoints

Both endpoints now follow the cache-aside pattern:

1. Check Redis → return immediately on hit (~1 ms)
2. On miss → compute result → write to Redis (TTL 10 min) → return

| Cache key                                         | TTL    |
| ------------------------------------------------- | ------ |
| `insights:{country\|"all"}`                       | 10 min |
| `trend:{country\|"all"}:{trendBy}:{year}:{month}` | 10 min |

Any employee `create`, `update`, or `remove` evicts stale data:

```typescript
await cache.delByPattern("insights:*");
await cache.delByPattern("trend:*");
```

Pattern deletion uses `SCAN` (non-blocking) not `KEYS` (which blocks the Redis event loop).

**Effect:** repeated page loads — the common case — cost one Redis GET instead of a full PostgreSQL query.

---

### 3 — SQL-side aggregation (biggest win)

Replaced the `findMany` full-table-scan with targeted aggregate queries. The DB now returns pre-aggregated rows; Node.js only formats the response.

**Single-country path — before vs after:**

|                             | Before                       | After                        |
| --------------------------- | ---------------------------- | ---------------------------- |
| Rows transferred to Node.js | N (all employees in country) | ~20 (aggregated)             |
| JS aggregation loops        | 5× O(n) reduce/map           | 0                            |
| DB queries                  | 1 `findMany` + 1 `groupBy`   | 4 parallel aggregate queries |

Queries run in `Promise.all`:

- `aggregate` → total count + avg salary (1 row)
- `findFirst ORDER BY salary DESC LIMIT 1` → max employee with role + dept (1 row)
- `findFirst ORDER BY salary ASC LIMIT 1` → min employee with role + dept (1 row)
- `groupBy department` → avg salary + headcount per dept (~10 rows)

**All-countries path — before vs after:**

|                             | Before            | After                            |
| --------------------------- | ----------------- | -------------------------------- |
| Rows transferred to Node.js | N (all employees) | ~80 (aggregated)                 |
| JS aggregation loops        | 5× O(n)           | O(n_countries × n_depts) ≈ O(50) |

Queries run in `Promise.all`:

- `groupBy country` → count + salary sum per country (~10 rows)
- `groupBy country, department` → count + salary sum per country+dept (~50 rows)
- `DISTINCT ON (country) ORDER BY salary DESC` → highest-paid employee per country (~10 rows)
- `DISTINCT ON (country) ORDER BY salary ASC` → lowest-paid employee per country (~10 rows)

INR conversion runs in JS on the ~80 aggregated rows, not on individual employee rows. The math is exact because the exchange rate is uniform per country:

```
sum_INR(country) = sum(salary_local) / rate  =  toINR(sum(salary_local), country, rates)
```

---

---

### 4 — GIN Trigram Indexes for employee name/email search

#### Problem

The employee list supports filtering by a free-text `search` parameter matched against `firstName`, `lastName`, and `email`. The Prisma query generates:

```sql
WHERE "firstName" ILIKE '%ali%'
   OR "lastName"  ILIKE '%ali%'
   OR "email"     ILIKE '%ali%'
```

Leading-wildcard `ILIKE` (the `%` before the term) cannot be satisfied by a B-tree index — the planner cannot seek to a known position in the index when the match can start anywhere in the string. At 10K employees this degrades to a full sequential scan on every keystroke.

The existing `email` column B-tree index (`Employee_email_key`, a unique constraint) was also bypassed because `ILIKE` is case-insensitive and B-tree indexes are case-sensitive.

**Verified via:**

```sql
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT id, email FROM "Employee"
WHERE email ILIKE '%alice%';
-- → Seq Scan on "Employee"  (cost=0.00..XXX rows=...)
```

#### Solution

Enabled the `pg_trgm` extension and added GIN trigram indexes on all three search columns:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY emp_firstname_trgm
  ON "Employee" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_lastname_trgm
  ON "Employee" USING GIN ("lastName"  gin_trgm_ops);

CREATE INDEX CONCURRENTLY emp_email_trgm
  ON "Employee" USING GIN ("email"     gin_trgm_ops);
```

A GIN trigram index stores every 3-character slice of each value. The query planner uses it for any `ILIKE '%term%'` where `term` is ≥ 3 characters — exactly how name/email search is used.

No query code was changed. Prisma's `contains` + `mode: "insensitive"` already produces the correct `ILIKE` form.

#### Minimum-length guard (FE + BE)

Trigram indexes are not effective for terms shorter than 3 characters — PostgreSQL falls back to a seq scan. To prevent short-term queries from hitting the DB:

**Frontend (`web/app/employees/page.tsx`):**

- 400 ms debounce on the search input — prevents a query on every keystroke
- Auto-trigger only fires when the trimmed value is empty (clear) or ≥ 3 characters; 1–2 character inputs are held until the user presses Enter or reaches 3 chars
- "Reset Filters" button (`FilterX` icon) clears search + all dropdowns + URL state in one action

**Backend (`api/src/controllers/employees.ts`):**

```ts
search: z.string().trim().min(3).optional();
```

Zod strips leading/trailing whitespace and rejects search terms shorter than 3 characters with a 400 response — the query never reaches the repository or the database.

#### Effect

| Concern                | Before                                  | After                            |
| ---------------------- | --------------------------------------- | -------------------------------- |
| Search query plan      | Sequential scan                         | GIN trigram index scan           |
| Requests per keystroke | 1 per keydown (~15 req for "alice")     | 1 after 400 ms idle, min 3 chars |
| Short-term DB hits     | Every 1–2 char input hits DB + seq scan | Blocked at Zod layer             |
| Email ILIKE index use  | Bypassed (B-tree, case-sensitive)       | Covered by `emp_email_trgm` GIN  |

---

### 5 — Winston structured logging for performance observability

Raw `console.log` output makes it hard to correlate slow requests, error rates, and DB behaviour across a running server. Winston replaces all `console.*` calls with structured, level-tagged, metadata-rich log entries.

#### What is logged and where

| Source          | Event                        | Level                     | Metadata                        |
| --------------- | ---------------------------- | ------------------------- | ------------------------------- |
| `requestLogger` | Every HTTP request           | `info` / `error`          | `method`, `url`, `status`, `ms` |
| `errorHandler`  | `AppError`                   | `error`                   | `statusCode`, `message`         |
| `errorHandler`  | Prisma P2002 / P2025         | `error`                   | Prisma `meta.target`            |
| `errorHandler`  | Unhandled errors             | `error`                   | `message`, `stack`              |
| `redis.ts`      | Connect / disconnect / error | `info` / `warn` / `error` | `error` message                 |
| `index.ts`      | Server startup               | `info`                    | port                            |

#### Duplicate log prevention

Prisma's own stdout logging is disabled (`log: []` on `PrismaClient`). Without this, a Prisma error would print twice — once from Prisma's internal logger and once from the Winston `errorHandler`. Disabling Prisma's error output ensures a single structured Winston log per event.

---

## Summary

| Concern                         | Before                           | After                                |
| ------------------------------- | -------------------------------- | ------------------------------------ |
| DB rows into Node.js (insights) | O(n employees)                   | O(n_countries × n_depts) ≈ 80        |
| Repeated load latency           | Full DB query every time         | ~1 ms Redis GET                      |
| Trend query index use           | Sequential scan                  | Index scan (date-range predicate)    |
| Stale cache after mutations     | N/A (no cache)                   | Evicted on create / update / delete  |
| Employee search query plan      | Sequential scan (ILIKE + B-tree) | GIN trigram index scan               |
| Search requests per keystroke   | 1 per keydown                    | 1 per 400 ms idle burst, min 3 chars |
| Short search terms hitting DB   | Always                           | Blocked by Zod `.trim().min(3)`      |
