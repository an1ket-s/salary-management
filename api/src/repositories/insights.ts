import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";

export type TrendBy = "week" | "month" | "year";

export const insightsRepository = {
	async getEmployeeSlice(country?: string) {
		return prisma.employee.findMany({
			where: country ? { country } : undefined,
			select: {
				salary: true,
				country: true,
				department: true,
				role: true,
				joiningDate: true,
			},
		});
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
		yearFilter?: string, // e.g. "2024" — used when trendBy = "month"
		monthFilter?: string, // e.g. "2024-01" — used when trendBy = "week"
	) {
		// Build WHERE conditions
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
			const end = new Date(y, m, 1); // first day of next month
			conds.push(Prisma.sql`"joiningDate" >= ${start}::timestamptz`);
			conds.push(Prisma.sql`"joiningDate" <  ${end}::timestamptz`);
		}
		const where = conds.length
			? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}`
			: Prisma.sql``;

		// Build GROUP BY / ORDER BY expressions
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
