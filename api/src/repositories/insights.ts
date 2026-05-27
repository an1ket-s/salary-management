import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";

export type TrendBy = "week" | "month" | "year";

export const insightsRepository = {
	// Single-country path: 4 parallel aggregate queries → ~10-20 rows total returned.
	// No full table scan into Node.js memory.
	async getInsightsSingleCountry(country: string) {
		const [kpi, maxEmp, minEmp, deptGroups] = await Promise.all([
			prisma.employee.aggregate({
				where: { country },
				_count: { id: true },
				_avg: { salary: true },
			}),
			prisma.employee.findFirst({
				where: { country },
				orderBy: { salary: "desc" },
				select: { salary: true, role: true, department: true },
			}),
			prisma.employee.findFirst({
				where: { country },
				orderBy: { salary: "asc" },
				select: { salary: true, role: true, department: true },
			}),
			prisma.employee.groupBy({
				by: ["department"],
				where: { country },
				_avg: { salary: true },
				_count: { id: true },
				orderBy: { department: "asc" },
			}),
		]);
		return { kpi, maxEmp, minEmp, deptGroups };
	},

	// All-countries path: aggregates at the country/dept level.
	// Returns ~50 rows total instead of every employee row.
	// The service handles INR conversion on these aggregates.
	async getInsightsAllCountries() {
		const [countryStats, deptStats, maxPerCountry, minPerCountry] =
			await Promise.all([
				prisma.employee.groupBy({
					by: ["country"],
					_count: { id: true },
					_sum: { salary: true },
				}),
				prisma.employee.groupBy({
					by: ["country", "department"],
					_count: { id: true },
					_sum: { salary: true },
				}),
				// One row per country: employee with the highest local salary
				prisma.$queryRaw<
					{
						country: string;
						salary: number;
						role: string;
						department: string;
					}[]
				>(
					Prisma.sql`
          SELECT DISTINCT ON (country) country, salary::float, role, department
          FROM "Employee"
          ORDER BY country, salary DESC
        `,
				),
				// One row per country: employee with the lowest local salary
				prisma.$queryRaw<
					{
						country: string;
						salary: number;
						role: string;
						department: string;
					}[]
				>(
					Prisma.sql`
          SELECT DISTINCT ON (country) country, salary::float, role, department
          FROM "Employee"
          ORDER BY country, salary ASC
        `,
				),
			]);
		return { countryStats, deptStats, maxPerCountry, minPerCountry };
	},

	async getHeadcountByCountry() {
		const rows = await prisma.employee.groupBy({
			by: ["country"],
			_count: { id: true },
			orderBy: { _count: { id: "desc" } },
		});
		const total = rows.reduce((sum, r) => sum + r._count.id, 0);
		return rows.map((r) => ({
			country: r.country,
			count: r._count.id,
			pct: Math.round((r._count.id / total) * 100),
		}));
	},

	async getHiringTrend(
		country?: string,
		trendBy: TrendBy = "year",
		yearFilter?: string,
		monthFilter?: string,
	) {
		const conds: Prisma.Sql[] = [];
		if (country) {
			conds.push(Prisma.sql`country = ${country}`);
		}
		if (yearFilter) {
			const y = parseInt(yearFilter, 10);
			conds.push(
				Prisma.sql`"joiningDate" >= ${new Date(`${y}-01-01`)}::timestamptz`,
			);
			conds.push(
				Prisma.sql`"joiningDate" <  ${new Date(`${y + 1}-01-01`)}::timestamptz`,
			);
		}
		if (monthFilter) {
			const [y, m] = monthFilter.split("-").map(Number);
			const start = new Date(y, m - 1, 1);
			const end = new Date(y, m, 1);
			conds.push(Prisma.sql`"joiningDate" >= ${start}::timestamptz`);
			conds.push(Prisma.sql`"joiningDate" <  ${end}::timestamptz`);
		}
		const where = conds.length
			? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}`
			: Prisma.sql``;

		const [labelExpr, groupExpr] =
			trendBy === "week"
				? [
						Prisma.sql`TO_CHAR(DATE_TRUNC('week', "joiningDate"), 'IYYY-"W"IW')`,
						Prisma.sql`DATE_TRUNC('week', "joiningDate")`,
					]
				: trendBy === "year"
					? [
							Prisma.sql`TO_CHAR(DATE_TRUNC('year', "joiningDate"), 'YYYY')`,
							Prisma.sql`DATE_TRUNC('year', "joiningDate")`,
						]
					: [
							Prisma.sql`TO_CHAR(DATE_TRUNC('month', "joiningDate"), 'YYYY-MM')`,
							Prisma.sql`DATE_TRUNC('month', "joiningDate")`,
						];

		return prisma.$queryRaw<Array<{ label: string; count: number }>>(
			Prisma.sql`
        SELECT ${labelExpr} AS label, COUNT(*)::int AS count
        FROM "Employee"
        ${where}
        GROUP BY ${groupExpr}
        ORDER BY ${groupExpr} ASC
      `,
		);
	},
};
