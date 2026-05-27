import { insightsRepository, type TrendBy } from "../repositories/insights.js";
import { cache } from "../lib/cache.js";
import env from "../config/env.js";

const RATES_TTL = 86_400; // 24 h
const INSIGHTS_TTL = 600; // 10 min
const TREND_TTL = 600; // 10 min

const insightsCacheKey = (country?: string) => `insights:${country ?? "all"}`;

const trendCacheKey = (
	country?: string,
	trendBy?: string,
	yearFilter?: string,
	monthFilter?: string,
) =>
	`trend:${country ?? "all"}:${trendBy ?? "year"}:${yearFilter ?? ""}:${monthFilter ?? ""}`;

const COUNTRY_CURRENCY: Record<string, string> = {
	India: "INR",
	USA: "USD",
	UK: "GBP",
	Germany: "EUR",
	France: "EUR",
	Japan: "JPY",
	Brazil: "BRL",
	Canada: "CAD",
	Australia: "AUD",
	Singapore: "SGD",
};

type Rates = Record<string, number>;

async function getExchangeRates(): Promise<Rates> {
	const KEY = "exg_rates:INR";
	const hit = await cache.get<Rates>(KEY);
	if (hit) return hit;

	const res = await fetch(
		`https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/INR`,
	);
	const json = (await res.json()) as { conversion_rates: Rates };
	await cache.set(KEY, json.conversion_rates, RATES_TTL);
	return json.conversion_rates;
}

function toINR(salary: number, country: string, rates: Rates): number {
	const code = COUNTRY_CURRENCY[country] ?? "INR";
	if (code === "INR") return salary;
	return salary / (rates[code] ?? 1);
}

export const insightsService = {
	// Main dashboard data — KPIs + salary/headcount charts.
	// Does NOT include hiring trend (served by its own endpoint).
	async getInsights(country?: string) {
		const KEY = insightsCacheKey(country);
		const cached = await cache.get<object>(KEY);
		if (cached) return cached;

		const currency = country ? (COUNTRY_CURRENCY[country] ?? "INR") : "INR";

		let result: object;

		if (country) {
			// ── Single-country path ──────────────────────────────────────────────────
			// All aggregation done in PostgreSQL; Node.js receives ~10–20 rows total.
			const [{ kpi, maxEmp, minEmp, deptGroups }, headcountByCountry] =
				await Promise.all([
					insightsRepository.getInsightsSingleCountry(country),
					insightsRepository.getHeadcountByCountry(),
				]);

			const n = kpi._count.id;

			const avgSalaryByDepartment = deptGroups.map((d) => ({
				department: d.department,
				avg: Math.round(d._avg.salary ?? 0),
			})); // already sorted department ASC by Prisma

			const headcountByDepartment = deptGroups
				.map((d) => ({
					department: d.department,
					count: d._count.id,
					pct: Math.round((d._count.id / (n || 1)) * 100),
				}))
				.sort((a, b) => b.count - a.count);

			result = {
				currency,
				kpi: {
					totalEmployees: n,
					avgSalary: Math.round(kpi._avg.salary ?? 0),
					maxSalary: maxEmp
						? {
								value: Math.round(maxEmp.salary),
								role: maxEmp.role,
								department: maxEmp.department,
							}
						: null,
					minSalary: minEmp
						? {
								value: Math.round(minEmp.salary),
								role: minEmp.role,
								department: minEmp.department,
							}
						: null,
				},
				avgSalaryByDepartment,
				headcountByCountry,
				headcountByDepartment,
			};
		} else {
			// ── All-countries path ───────────────────────────────────────────────────
			// DB returns ~50 aggregated rows; INR conversion runs on those rows, not
			// on every individual employee.
			const rates = await getExchangeRates();
			const [
				{ countryStats, deptStats, maxPerCountry, minPerCountry },
				headcountByCountry,
			] = await Promise.all([
				insightsRepository.getInsightsAllCountries(),
				insightsRepository.getHeadcountByCountry(),
			]);

			const n = countryStats.reduce((s, r) => s + r._count.id, 0);

			// Global average in INR: convert each country's salary sum, then divide
			const totalSumINR = countryStats.reduce(
				(s, r) => s + toINR(r._sum.salary ?? 0, r.country, rates),
				0,
			);
			const avgSalary = Math.round(n ? totalSumINR / n : 0);

			// Global max/min: one candidate per country → convert → pick winner
			const maxEmp = n
				? maxPerCountry
						.map((e) => ({
							...e,
							salaryINR: toINR(e.salary, e.country, rates),
						}))
						.reduce((a, b) => (b.salaryINR > a.salaryINR ? b : a))
				: null;
			const minEmp = n
				? minPerCountry
						.map((e) => ({
							...e,
							salaryINR: toINR(e.salary, e.country, rates),
						}))
						.reduce((a, b) => (b.salaryINR < a.salaryINR ? b : a))
				: null;

			// Dept avg in INR: aggregate per-country-dept sums then group by dept
			const deptMap = new Map<string, { sumINR: number; count: number }>();
			for (const r of deptStats) {
				const prev = deptMap.get(r.department) ?? { sumINR: 0, count: 0 };
				deptMap.set(r.department, {
					sumINR: prev.sumINR + toINR(r._sum.salary ?? 0, r.country, rates),
					count: prev.count + r._count.id,
				});
			}
			const avgSalaryByDepartment = [...deptMap.entries()]
				.map(([department, { sumINR, count }]) => ({
					department,
					avg: Math.round(sumINR / count),
				}))
				.sort((a, b) => a.department.localeCompare(b.department));

			// Dept headcount: same deptStats, just sum counts per dept
			const deptCountMap = new Map<string, number>();
			for (const r of deptStats)
				deptCountMap.set(
					r.department,
					(deptCountMap.get(r.department) ?? 0) + r._count.id,
				);
			const headcountByDepartment = [...deptCountMap.entries()]
				.map(([department, count]) => ({
					department,
					count,
					pct: Math.round((count / (n || 1)) * 100),
				}))
				.sort((a, b) => b.count - a.count);

			result = {
				currency,
				kpi: {
					totalEmployees: n,
					avgSalary,
					maxSalary: maxEmp
						? {
								value: Math.round(maxEmp.salaryINR),
								role: maxEmp.role,
								department: maxEmp.department,
							}
						: null,
					minSalary: minEmp
						? {
								value: Math.round(minEmp.salaryINR),
								role: minEmp.role,
								department: minEmp.department,
							}
						: null,
				},
				avgSalaryByDepartment,
				headcountByCountry,
				headcountByDepartment,
			};
		}

		await cache.set(KEY, result, INSIGHTS_TTL);
		return result;
	},

	// Hiring trend — served separately so drill-down re-fetches only this.
	async getHiringTrend(
		country?: string,
		trendBy: TrendBy = "year",
		yearFilter?: string,
		monthFilter?: string,
	) {
		const KEY = trendCacheKey(country, trendBy, yearFilter, monthFilter);
		const cached = await cache.get<object>(KEY);
		if (cached) return cached;

		const result = await insightsRepository.getHiringTrend(
			country,
			trendBy,
			yearFilter,
			monthFilter,
		);
		await cache.set(KEY, result, TREND_TTL);
		return result;
	},
};
