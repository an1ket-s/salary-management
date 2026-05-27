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

| Cache key | TTL |
|---|---|
| `insights:{country\|"all"}` | 10 min |
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

| | Before | After |
|---|---|---|
| Rows transferred to Node.js | N (all employees in country) | ~20 (aggregated) |
| JS aggregation loops | 5× O(n) reduce/map | 0 |
| DB queries | 1 `findMany` + 1 `groupBy` | 4 parallel aggregate queries |

Queries run in `Promise.all`:
- `aggregate` → total count + avg salary (1 row)
- `findFirst ORDER BY salary DESC LIMIT 1` → max employee with role + dept (1 row)
- `findFirst ORDER BY salary ASC LIMIT 1` → min employee with role + dept (1 row)
- `groupBy department` → avg salary + headcount per dept (~10 rows)

**All-countries path — before vs after:**

| | Before | After |
|---|---|---|
| Rows transferred to Node.js | N (all employees) | ~80 (aggregated) |
| JS aggregation loops | 5× O(n) | O(n_countries × n_depts) ≈ O(50) |

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

## Summary

| Concern | Before | After |
|---|---|---|
| DB rows into Node.js (insights) | O(n employees) | O(n_countries × n_depts) ≈ 80 |
| Repeated load latency | Full DB query every time | ~1 ms Redis GET |
| Trend query index use | Sequential scan | Index scan (date-range predicate) |
| Stale cache after mutations | N/A (no cache) | Evicted on create / update / delete |
