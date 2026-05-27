"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Label,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type InsightsData, type HiringTrendData } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
	ArrowDownRight,
	ArrowUpRight,
	ChevronRight,
	TrendingUp,
	Users,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

type TrendBy = "week" | "month" | "year";

const COUNTRIES = [
	"India",
	"USA",
	"UK",
	"Germany",
	"France",
	"Japan",
	"Brazil",
	"Canada",
	"Australia",
	"Singapore",
];

const CURRENCY_SYMBOL: Record<string, string> = {
	INR: "₹",
	USD: "$",
	GBP: "£",
	EUR: "€",
	JPY: "¥",
	BRL: "R$",
	CAD: "CA$",
	AUD: "A$",
	SGD: "S$",
};

const DEPT_COLORS = [
	"#6366F1",
	"#8B5CF6",
	"#0EA5E9",
	"#14B8A6",
	"#F59E0B",
	"#F43F5E",
	"#10B981",
	"#F97316",
];

const COUNTRY_COLORS = [
	"#6366F1",
	"#8B5CF6",
	"#0EA5E9",
	"#14B8A6",
	"#F59E0B",
	"#F43F5E",
	"#10B981",
	"#F97316",
	"#EF4444",
	"#EC4899",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sym(currency: string) {
	return CURRENCY_SYMBOL[currency] ?? currency;
}

function fmtCompact(v: number, currency: string) {
	const s = sym(currency);
	if (v >= 1_000_000) return `${s}${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `${s}${(v / 1_000).toFixed(0)}K`;
	return `${s}${v}`;
}

function fmtFull(v: number, currency: string) {
	return `${sym(currency)}${v.toLocaleString()}`;
}

// ── Shared chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({
	active,
	payload,
	label,
	currency,
	isSalary = false,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number; color: string }>;
	label?: string;
	currency: string;
	isSalary?: boolean;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
			<p className="mb-1.5 font-semibold text-slate-700">{label}</p>
			{payload.map((p, i) => (
				<p key={i} className="flex items-center gap-2">
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ background: p.color }}
					/>
					<span className="capitalize text-slate-500">{p.name}:</span>
					<span className="font-medium text-slate-800">
						{isSalary ? fmtFull(p.value, currency) : p.value.toLocaleString()}
					</span>
				</p>
			))}
		</div>
	);
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
	label,
	value,
	sub,
	icon,
	accent,
}: {
	label: string;
	value: string;
	sub: string;
	icon: React.ReactNode;
	accent: string;
}) {
	return (
		<Card className="p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-medium uppercase tracking-wide text-slate-400">
						{label}
					</p>
					<p className="mt-1.5 truncate text-2xl font-bold text-slate-900">
						{value}
					</p>
					<p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>
				</div>
				<div className={`shrink-0 rounded-lg p-2 ${accent}`}>{icon}</div>
			</div>
		</Card>
	);
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
	return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

// ── HiringTrendChart — drill-down: Year → Month → Week ───────────────────────

type DrillLevel = "year" | "month" | "week";

type DrillState = {
	level: DrillLevel;
	year?: string; // set when level is "month" or "week"
	month?: string; // set when level is "week" (format: "YYYY-MM")
};

function HiringTrendChart({ country }: { country: string }) {
	const [drill, setDrill] = useState<DrillState>({ level: "year" });
	const [data, setData] = useState<HiringTrendData | null>(null);
	const [loading, setLoading] = useState(true);
	const [chartKey, setChartKey] = useState(0); // increment → triggers animate-chart-in

	const load = useCallback(async (state: DrillState, c: string) => {
		setLoading(true);
		try {
			const res = await api.insights.getHiringTrend(
				c || undefined,
				state.level,
				state.level === "month" ? state.year : undefined,
				state.level === "week" ? state.month : undefined,
			);
			setData(res.data);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load(drill, country);
	}, [drill, country, load]);

	function navigate(next: DrillState) {
		setChartKey((k) => k + 1); // re-mounts chart wrapper → CSS animation fires
		setDrill(next);
	}

	// ── label formatters ──────────────────────────────────────────────────────
	function axisLabel(raw: string): string {
		if (drill.level === "year") return raw; // "2024"
		if (drill.level === "month") {
			const [, m] = raw.split("-");
			return new Date(2000, +m - 1).toLocaleDateString("en-US", {
				month: "short",
			}); // "Jan"
		}
		// week: "2024-W03" → "W3"
		return `W${parseInt(raw.split("-W")[1], 10)}`;
	}

	function tooltipLabel(raw: string): string {
		if (drill.level === "year") return raw;
		if (drill.level === "month") {
			const [y, m] = raw.split("-");
			return new Date(+y, +m - 1).toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			});
		}
		const [yr, wk] = raw.split("-W");
		return `W${parseInt(wk, 10)} · ${yr}`;
	}

	// ── area click handler ───────────────────────────────────────────────────
	function handlePointClick(chartData: any) {
		const label = chartData?.activeLabel as string | undefined;
		if (!label || drill.level === "week") return;
		if (drill.level === "year") navigate({ level: "month", year: label });
		if (drill.level === "month")
			navigate({ level: "week", year: drill.year, month: label });
	}

	// ── breadcrumb ───────────────────────────────────────────────────────────
	const crumbs: { label: string; state: DrillState }[] = [
		{ label: "All Years", state: { level: "year" } },
		...(drill.year
			? [
					{
						label: drill.year,
						state: { level: "month" as DrillLevel, year: drill.year },
					},
				]
			: []),
		...(drill.month
			? [
					{
						label: (() => {
							const [y, m] = drill.month!.split("-");
							return new Date(+y, +m - 1).toLocaleDateString("en-US", {
								month: "short",
								year: "numeric",
							});
						})(),
						state: {
							level: "week" as DrillLevel,
							year: drill.year,
							month: drill.month,
						},
					},
				]
			: []),
	];

	const isLeaf = drill.level === "week";
	const strokeColor =
		drill.level === "year"
			? "#6366F1"
			: drill.level === "month"
				? "#8B5CF6"
				: "#4F46E5";

	return (
		<Card className="col-span-3">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					{/* Breadcrumb */}
					<div className="flex items-center gap-1 text-sm">
						{crumbs.map((crumb, i) => {
							const isActive = i === crumbs.length - 1;
							return (
								<span key={i} className="flex items-center gap-1">
									{i > 0 && (
										<ChevronRight className="h-3.5 w-3.5 text-slate-300" />
									)}
									<button
										disabled={isActive}
										onClick={() => !isActive && navigate(crumb.state)}
										className={cn(
											"font-medium transition-colors",
											isActive
												? "cursor-default text-slate-800"
												: "text-slate-400 hover:text-indigo-600",
										)}
									>
										{crumb.label}
									</button>
								</span>
							);
						})}
					</div>
					{!isLeaf && (
						<p className="text-xs text-slate-400 select-none">
							Click a point to drill down ↓
						</p>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{/* key change re-mounts this div → animate-chart-in fires */}
				{/* onMouseDown preventDefault stops the browser setting focus → no focus ring */}
				<div
					key={chartKey}
					className="animate-chart-in select-none"
					onMouseDown={(e) => e.preventDefault()}
				>
					{loading ? (
						<ChartSkeleton height={260} />
					) : !data?.length ? (
						<div className="flex h-64 items-center justify-center text-sm text-slate-400">
							No data for this period
						</div>
					) : (
						/* Unified Area chart — all drill levels */
						<ResponsiveContainer width="100%" height={260}>
							<AreaChart
								data={data}
								margin={{
									top: 5,
									right: 10,
									left: 10,
									bottom: isLeaf ? 5 : 24,
								}}
								onClick={!isLeaf ? handlePointClick : undefined}
								className={!isLeaf ? "cursor-pointer" : undefined}
								tabIndex={-1}
							>
								<defs>
									<linearGradient id="hiringGrad" x1="0" y1="0" x2="0" y2="1">
										<stop
											offset="5%"
											stopColor={strokeColor}
											stopOpacity={0.25}
										/>
										<stop
											offset="95%"
											stopColor={strokeColor}
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#f1f5f9"
									vertical={false}
								/>
								<XAxis
									dataKey="label"
									tickFormatter={axisLabel}
									tick={{ fontSize: 11, fill: "#94a3b8" }}
									interval={isLeaf ? "preserveStartEnd" : 0}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: "#94a3b8" }}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip
									content={({ active, payload, label: l }: any) => {
										if (!active || !payload?.length) return null;
										return (
											<div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
												<p className="font-semibold text-slate-700">
													{l ? tooltipLabel(l) : ""}
												</p>
												<p className="text-slate-500">
													{payload[0].value} joined
												</p>
												{!isLeaf && (
													<p className="mt-1 text-indigo-400">
														Click to drill down
													</p>
												)}
											</div>
										);
									}}
								/>
								<Area
									type="monotone"
									dataKey="count"
									stroke={strokeColor}
									strokeWidth={2}
									fill="url(#hiringGrad)"
									dot={
										isLeaf
											? false
											: {
													r: 3,
													fill: strokeColor,
													stroke: "#fff",
													strokeWidth: 2,
												}
									}
									activeDot={{
										r: 5,
										fill: strokeColor,
										stroke: "#fff",
										strokeWidth: 2,
									}}
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ── InsightsPage ─────────────────────────────────────────────────────────────

export default function InsightsPage() {
	const router = useRouter();
	const [country, setCountry] = useState("");
	const [data, setData] = useState<InsightsData | null>(null);
	const [loading, setLoading] = useState(true);

	// Navigate to the employees list pre-filtered by department (+ country if set)
	function drillToEmployees(department: string) {
		const qs = new URLSearchParams({ department });
		if (country) qs.set("country", country);
		router.push(`/employees?${qs}`);
	}

	// Only depends on country — trendBy changes never trigger this
	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.insights.get(country || undefined);
			setData(res.data);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, [country]);

	useEffect(() => {
		load();
	}, [load]);

	const currency = data?.currency ?? "INR";

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Insights</h1>
					<p className="mt-0.5 text-sm text-slate-500">
						Salary analytics across your organisation
					</p>
				</div>
				<Select
					value={country || "__all"}
					onValueChange={(v) => setCountry(v === "__all" ? "" : v)}
				>
					<SelectTrigger className="w-44">
						<SelectValue placeholder="All Countries" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all">All Countries</SelectItem>
						{COUNTRIES.map((c) => (
							<SelectItem key={c} value={c}>
								{c}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* KPI row */}
			<div className="grid grid-cols-4 gap-4">
				{loading ? (
					Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))
				) : data ? (
					<>
						<KpiCard
							label="Total Employees"
							value={data.kpi.totalEmployees.toLocaleString()}
							sub="across all departments"
							icon={<Users className="h-4 w-4 text-indigo-500" />}
							accent="bg-indigo-50"
						/>
						<KpiCard
							label="Average Salary"
							value={fmtFull(data.kpi.avgSalary, currency)}
							sub="across all employees"
							icon={<TrendingUp className="h-4 w-4 text-violet-500" />}
							accent="bg-violet-50"
						/>
						<KpiCard
							label="Highest Salary"
							value={
								data.kpi.maxSalary
									? fmtFull(data.kpi.maxSalary.value, currency)
									: "—"
							}
							sub={
								data.kpi.maxSalary
									? `${data.kpi.maxSalary.role} · ${data.kpi.maxSalary.department}`
									: ""
							}
							icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
							accent="bg-emerald-50"
						/>
						<KpiCard
							label="Lowest Salary"
							value={
								data.kpi.minSalary
									? fmtFull(data.kpi.minSalary.value, currency)
									: "—"
							}
							sub={
								data.kpi.minSalary
									? `${data.kpi.minSalary.role} · ${data.kpi.minSalary.department}`
									: ""
							}
							icon={<ArrowDownRight className="h-4 w-4 text-amber-500" />}
							accent="bg-amber-50"
						/>
					</>
				) : null}
			</div>

			{/* Charts grid */}
			<div className="grid grid-cols-3 gap-4">
				{/* Chart 1 — Avg Salary by Department */}
				<Card className="col-span-2">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">
							Average Salary by Department
						</CardTitle>
					</CardHeader>
					<CardContent>
						{/* onMouseDown preventDefault stops browser from setting focus → no focus ring */}
						<div className="select-none" onMouseDown={(e) => e.preventDefault()}>
						{loading ? (
							<ChartSkeleton />
						) : data ? (
							<ResponsiveContainer width="100%" height={280}>
								<BarChart
									data={data.avgSalaryByDepartment}
									margin={{ top: 5, right: 10, left: 10, bottom: 48 }}
									tabIndex={-1}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#f1f5f9"
										vertical={false}
									/>
									<XAxis
										dataKey="department"
										tick={{ fontSize: 11, fill: "#94a3b8" }}
										angle={-30}
										textAnchor="end"
										interval={0}
									/>
									<YAxis
										tickFormatter={(v) => fmtCompact(v, currency)}
										tick={{ fontSize: 11, fill: "#94a3b8" }}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip
										cursor={{ fill: "#6366f115" }}
										content={({ active, payload, label: l }: any) => {
											if (!active || !payload?.length) return null;
											return (
												<div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
													<p className="font-semibold text-slate-700">{l}</p>
													<p className="text-slate-500">
														Avg: {fmtFull(payload[0].value, currency)}
													</p>
													<p className="mt-1 text-indigo-400">Click to view employees →</p>
												</div>
											);
										}}
									/>
									<Bar
										dataKey="avg"
										name="avg salary"
										fill="#6366F1"
										radius={[4, 4, 0, 0]}
										className="cursor-pointer"
										onClick={(entry: any) => drillToEmployees(entry.department)}
									/>
								</BarChart>
							</ResponsiveContainer>
						) : null}
						</div>
					</CardContent>
				</Card>

				{/* Chart 5 — Department Distribution Donut */}
				<Card className="col-span-1">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">
							Department Distribution
						</CardTitle>
					</CardHeader>
					<CardContent>
						{/* onMouseDown preventDefault stops browser from setting focus → no focus ring */}
						<div className="select-none" onMouseDown={(e) => e.preventDefault()}>
						{loading ? (
							<ChartSkeleton />
						) : data ? (
							<ResponsiveContainer width="100%" height={280}>
								<PieChart tabIndex={-1}>
									<Pie
										data={data.headcountByDepartment}
										dataKey="count"
										nameKey="department"
										innerRadius="50%"
										outerRadius="70%"
										paddingAngle={2}
										cursor="pointer"
										onClick={(entry: any) => drillToEmployees(entry.department)}
									>
										{data.headcountByDepartment.map((_, i) => (
											<Cell
												key={i}
												fill={DEPT_COLORS[i % DEPT_COLORS.length]}
												stroke="none"
											/>
										))}
										<Label
											content={({ viewBox }: any) => {
												const cx = (viewBox?.cx ?? 0) as number;
												const cy = (viewBox?.cy ?? 0) as number;
												return (
													<g>
														<text
															x={cx}
															y={cy - 6}
															textAnchor="middle"
															fill="#1e293b"
															fontSize={22}
															fontWeight={700}
														>
															{data.kpi.totalEmployees.toLocaleString()}
														</text>
														<text
															x={cx}
															y={cy + 14}
															textAnchor="middle"
															fill="#94a3b8"
															fontSize={10}
														>
															employees
														</text>
													</g>
												);
											}}
											position="center"
										/>
									</Pie>
									<Tooltip
										content={({ active, payload }: any) => {
											if (!active || !payload?.length) return null;
											const d = payload[0].payload as {
												department: string;
												count: number;
												pct: number;
											};
											return (
												<div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
													<p className="font-semibold text-slate-700">
														{d.department}
													</p>
													<p className="text-slate-500">
														{d.count.toLocaleString()} employees · {d.pct}%
													</p>
													<p className="mt-1 text-indigo-400">Click to view employees →</p>
												</div>
											);
										}}
									/>
									<Legend
										iconType="circle"
										iconSize={8}
										formatter={(value) => (
											<span className="text-xs text-slate-600">{value}</span>
										)}
									/>
								</PieChart>
							</ResponsiveContainer>
						) : null}
						</div>
					</CardContent>
				</Card>

				{/* Chart 4 — Hiring Trend (self-contained, isolated re-renders) */}
				<HiringTrendChart country={country} />
			</div>
		</div>
	);
}
