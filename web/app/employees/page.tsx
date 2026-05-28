"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/setup/Pagination";
import { api, type Employee } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
	Check,
	Copy,
	FilterX,
	Loader2,
	Pencil,
	Plus,
	Search,
	Trash2,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENCY: Record<string, string> = {
	India: "₹",
	USA: "$",
	UK: "£",
	Germany: "€",
	France: "€",
	Japan: "¥",
	Brazil: "R$",
	Canada: "CA$",
	Australia: "A$",
	Singapore: "S$",
};

const ROLES = [
	"Junior Engineer",
	"Engineer",
	"Senior Engineer",
	"Tech Lead",
	"Manager",
	"Senior Manager",
	"Director",
	"VP",
	"Analyst",
	"Designer",
];
const DEPARTMENTS = [
	"Engineering",
	"Product",
	"Design",
	"Analytics",
	"Finance",
	"HR",
	"Marketing",
	"Operations",
];
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

const SORT_OPTIONS = [
	{
		value: "createdAt_desc",
		label: "Newest first",
		by: "createdAt",
		order: "desc",
	},
	{
		value: "createdAt_asc",
		label: "Oldest first",
		by: "createdAt",
		order: "asc",
	},
	{
		value: "salary_desc",
		label: "Salary: High → Low",
		by: "salary",
		order: "desc",
	},
	{
		value: "salary_asc",
		label: "Salary: Low → High",
		by: "salary",
		order: "asc",
	},
	{
		value: "firstName_asc",
		label: "Name: A → Z",
		by: "firstName",
		order: "asc",
	},
	{
		value: "firstName_desc",
		label: "Name: Z → A",
		by: "firstName",
		order: "desc",
	},
];

const ROLE_COLORS: Record<string, string> = {
	"Junior Engineer": "bg-sky-100     text-sky-700",
	Engineer: "bg-indigo-100  text-indigo-700",
	"Senior Engineer": "bg-violet-100  text-violet-700",
	"Tech Lead": "bg-purple-100  text-purple-700",
	Manager: "bg-amber-100   text-amber-700",
	"Senior Manager": "bg-orange-100  text-orange-700",
	Director: "bg-rose-100    text-rose-700",
	VP: "bg-pink-100    text-pink-700",
	Analyst: "bg-teal-100    text-teal-700",
	Designer: "bg-emerald-100 text-emerald-700",
};

const LIMIT = 10;

const EMPTY_FORM = {
	firstName: "",
	lastName: "",
	phone: "",
	email: "",
	role: "",
	department: "",
	country: "",
	salary: "",
	joiningDate: "",
};

const DEFAULT_SORT = "createdAt_desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPageRange(current: number, total: number): (number | "…")[] {
	if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
	if (current <= 3) return [1, 2, 3, "…", total];
	if (current >= total - 2) return [1, "…", total - 2, total - 1, total];
	return [1, "…", current - 1, current, current + 1, "…", total];
}

function formatSalary(salary: number, country: string) {
	return `${CURRENCY[country] ?? "$"}${salary.toLocaleString()}`;
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function toDateInput(iso: string) {
	return iso ? iso.split("T")[0] : "";
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	function copy() {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}
	return (
		<button
			onClick={copy}
			className="opacity-0 group-hover:opacity-100 ml-1.5 transition-opacity text-slate-300 hover:text-indigo-500"
		>
			{copied ? (
				<Check className="h-3 w-3 text-emerald-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</button>
	);
}

// ── Inner component (needs Suspense boundary for useSearchParams) ─────────────

function EmployeesContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// ── Applied filters (from URL — drive the API call) ────────────────────────
	const appliedSearch = searchParams.get("search") ?? "";
	const appliedCountry = searchParams.get("country") ?? "";
	const appliedDepartment = searchParams.get("department") ?? "";
	const appliedRole = searchParams.get("role") ?? "";
	const appliedSort = searchParams.get("sort") ?? DEFAULT_SORT;
	const appliedPage = Number(searchParams.get("page") ?? "1");

	// ── Draft filters (local — updated as user interacts, not yet applied) ──────
	const [draft, setDraft] = useState({
		search: appliedSearch,
		country: appliedCountry,
		department: appliedDepartment,
		role: appliedRole,
		sort: appliedSort,
	});

	// searchRef always holds the latest typed value so debounce/Enter callbacks
	// read the correct string even before React re-renders.
	const searchRef = useRef(appliedSearch);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync draft when URL changes (browser back / forward)
	useEffect(() => {
		const s = searchParams.get("search") ?? "";
		searchRef.current = s;
		setDraft({
			search: s,
			country: searchParams.get("country") ?? "",
			department: searchParams.get("department") ?? "",
			role: searchParams.get("role") ?? "",
			sort: searchParams.get("sort") ?? DEFAULT_SORT,
		});
	}, [searchParams]);

	// ── Data ───────────────────────────────────────────────────────────────────
	const [employees, setEmployees] = useState<Employee[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(0);
	const [loading, setLoading] = useState(true);

	const [meta, setMeta] = useState<{
		countries: string[];
		departments: string[];
		roles: string[];
	}>({ countries: [], departments: [], roles: [] });

	// ── Modals ─────────────────────────────────────────────────────────────────
	const [modalOpen, setModalOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Employee | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);

	// ── Form ───────────────────────────────────────────────────────────────────
	const [form, setForm] = useState(EMPTY_FORM);
	const [formError, setFormError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// ── Fetch ──────────────────────────────────────────────────────────────────

	const fetchEmployees = useCallback(async () => {
		setLoading(true);
		try {
			const opt = SORT_OPTIONS.find((o) => o.value === appliedSort)!;
			const res = await api.employees.list({
				page: appliedPage,
				limit: LIMIT,
				search: appliedSearch || undefined,
				country: appliedCountry || undefined,
				department: appliedDepartment || undefined,
				role: appliedRole || undefined,
				sortBy: opt.by,
				sortOrder: opt.order,
			});
			setEmployees(res.data);
			setTotal(res.total);
			setTotalPages(res.totalPages);
		} finally {
			setLoading(false);
		}
	}, [
		appliedSearch,
		appliedCountry,
		appliedDepartment,
		appliedRole,
		appliedSort,
		appliedPage,
	]);

	useEffect(() => {
		fetchEmployees();
	}, [fetchEmployees]);
	useEffect(() => {
		api.employees.meta().then((r) => setMeta(r.data));
	}, []);

	// ── Filter actions ─────────────────────────────────────────────────────────

	function applyFilters() {
		const params = new URLSearchParams();
		const trimmed = searchRef.current.trim();
		if (trimmed) params.set("search", trimmed);
		if (draft.country) params.set("country", draft.country);
		if (draft.department) params.set("department", draft.department);
		if (draft.role) params.set("role", draft.role);
		if (draft.sort !== DEFAULT_SORT) params.set("sort", draft.sort);
		// page resets to 1 on new filter apply — omit it from URL
		router.replace(`?${params.toString()}`);
	}

	function clearFilters() {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchRef.current = "";
		setDraft({
			search: "",
			country: "",
			department: "",
			role: "",
			sort: DEFAULT_SORT,
		});
		router.replace("?");
	}

	function goToPage(p: number) {
		const params = new URLSearchParams(searchParams.toString());
		if (p === 1) params.delete("page");
		else params.set("page", String(p));
		router.push(`?${params.toString()}`, { scroll: false });
	}

	// ── Modal helpers ──────────────────────────────────────────────────────────

	function openAdd() {
		setEditTarget(null);
		setForm(EMPTY_FORM);
		setFormError("");
		setModalOpen(true);
	}

	function openEdit(emp: Employee) {
		setEditTarget(emp);
		setForm({
			firstName: emp.firstName,
			lastName: emp.lastName,
			phone: emp.phone,
			email: emp.email,
			role: emp.role,
			department: emp.department,
			country: emp.country,
			salary: String(emp.salary),
			joiningDate: toDateInput(emp.joiningDate),
		});
		setFormError("");
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEditTarget(null);
	}

	// ── Submit ─────────────────────────────────────────────────────────────────

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError("");
		const {
			firstName,
			lastName,
			phone,
			email,
			role: r,
			department: d,
			country: c,
			salary: s,
			joiningDate,
		} = form;
		if (
			!firstName ||
			!lastName ||
			!phone ||
			!email ||
			!r ||
			!d ||
			!c ||
			!joiningDate
		) {
			setFormError("All fields are required.");
			return;
		}
		const salary = parseFloat(s);
		if (isNaN(salary) || salary <= 0) {
			setFormError("Salary must be a positive number.");
			return;
		}

		setSubmitting(true);
		try {
			const payload = {
				firstName,
				lastName,
				phone,
				email,
				role: r,
				department: d,
				country: c,
				salary,
				joiningDate: joiningDate + "T00:00:00.000Z",
			};
			if (editTarget) await api.employees.update(editTarget.id, payload);
			else await api.employees.create(payload);
			closeModal();
			fetchEmployees();
		} catch (err) {
			setFormError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	// ── Delete ─────────────────────────────────────────────────────────────────

	async function confirmDelete() {
		if (!deleteId) return;
		setDeleting(true);
		try {
			await api.employees.remove(deleteId);
			setDeleteId(null);
			fetchEmployees();
		} finally {
			setDeleting(false);
		}
	}

	// ── Render ─────────────────────────────────────────────────────────────────

	const from = total === 0 ? 0 : (appliedPage - 1) * LIMIT + 1;
	const to = Math.min(appliedPage * LIMIT, total);

	return (
		<div className="space-y-6">
			{/* ── Header ── */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-bold text-slate-900">Employees</h1>
					<Badge
						variant="secondary"
						className="px-2.5 py-0.5 text-sm font-semibold"
					>
						{total.toLocaleString()}
					</Badge>
				</div>
				<Button
					onClick={openAdd}
					className="bg-indigo-600 hover:bg-indigo-700 text-white"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Employee
				</Button>
			</div>

			{/* ── Filter bar ── */}
			<Card className="p-4">
				<div className="flex flex-wrap gap-3">
					<Input
						placeholder="Search name or email…"
						value={draft.search}
						onChange={(e) => {
							const val = e.target.value;
							searchRef.current = val;
							setDraft((d) => ({ ...d, search: val }));

							if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
							const trimmed = val.trim();
							if (trimmed.length === 0 || trimmed.length >= 3) {
								searchTimerRef.current = setTimeout(applyFilters, 400);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								if (searchTimerRef.current)
									clearTimeout(searchTimerRef.current);
								if (
									searchRef.current.length === 0 ||
									searchRef.current.length >= 3
								)
									applyFilters();
							}
						}}
						className="w-56"
					/>
					<Select
						value={draft.country || "__all"}
						onValueChange={(v) =>
							setDraft((d) => ({ ...d, country: v === "__all" ? "" : v }))
						}
					>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all">All Countries</SelectItem>
							{meta.countries.map((c) => (
								<SelectItem key={c} value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={draft.department || "__all"}
						onValueChange={(v) =>
							setDraft((d) => ({ ...d, department: v === "__all" ? "" : v }))
						}
					>
						<SelectTrigger className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all">All Departments</SelectItem>
							{meta.departments.map((dept) => (
								<SelectItem key={dept} value={dept}>
									{dept}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={draft.role || "__all"}
						onValueChange={(v) =>
							setDraft((d) => ({ ...d, role: v === "__all" ? "" : v }))
						}
					>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all">All Roles</SelectItem>
							{meta.roles.map((r) => (
								<SelectItem key={r} value={r}>
									{r}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={draft.sort}
						onValueChange={(v) => setDraft((d) => ({ ...d, sort: v }))}
					>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button
						onClick={applyFilters}
						className="bg-indigo-600 hover:bg-indigo-700 text-white"
					>
						<Search className="h-4 w-4" />
					</Button>
					<Button onClick={clearFilters} variant="outline">
						<FilterX className="h-4 w-4" />
						Reset Filters
					</Button>
				</div>
			</Card>

			{/* ── Table ── */}
			<Card className="overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="odd:bg-slate-50/70 even:bg-slate-50/70 hover:bg-slate-50/70">
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Department</TableHead>
							<TableHead>Country</TableHead>
							<TableHead>Salary</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							Array.from({ length: 8 }).map((_, i) => (
								<TableRow
									key={i}
									className="odd:bg-white even:bg-slate-100/60 hover:bg-white"
								>
									<TableCell>
										<Skeleton className="h-4 w-28" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-44" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-5 w-20 rounded-full" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-16" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-1.5">
											<Skeleton className="h-7 w-7 rounded-md" />
											<Skeleton className="h-7 w-7 rounded-md" />
										</div>
									</TableCell>
								</TableRow>
							))
						) : employees.length === 0 ? (
							<TableRow className="odd:bg-white even:bg-white hover:bg-white">
								<TableCell
									colSpan={8}
									className="py-20 text-center text-slate-400"
								>
									No employees found.
								</TableCell>
							</TableRow>
						) : (
							employees.map((emp) => (
								<TableRow key={emp.id}>
									<TableCell className="font-medium text-slate-900">
										{emp.firstName} {emp.lastName}
									</TableCell>
									<TableCell className="text-slate-500">
										<div className="group flex items-center">
											<span>{emp.email}</span>
											<CopyButton text={emp.email} />
										</div>
									</TableCell>
									<TableCell>
										<Badge
											className={cn(
												"text-xs font-medium border-0",
												ROLE_COLORS[emp.role] ?? "bg-slate-100 text-slate-700",
											)}
										>
											{emp.role}
										</Badge>
									</TableCell>
									<TableCell className="text-slate-600">
										{emp.department}
									</TableCell>
									<TableCell className="text-slate-600">
										{emp.country}
									</TableCell>
									<TableCell className="font-medium text-slate-900">
										{formatSalary(emp.salary, emp.country)}
									</TableCell>
									<TableCell className="text-slate-500">
										{formatDate(emp.joiningDate)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-1.5">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => openEdit(emp)}
												className="h-7 w-7 p-0 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
											>
												<Pencil className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => setDeleteId(emp.id)}
												className="h-7 w-7 p-0 text-slate-400 hover:bg-red-50 hover:text-red-500"
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>

				{total > 0 && (
					<Pagination
						page={appliedPage}
						onPageChange={goToPage}
						total={total}
						pageSize={LIMIT}
						from={from}
						to={to}
						totalPages={totalPages}
						getPageRange={getPageRange}
					/>
				)}
			</Card>

			{/* ── Add / Edit modal ── */}
			<Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editTarget ? "Edit Employee" : "Add Employee"}
						</DialogTitle>
					</DialogHeader>

					<form onSubmit={handleSubmit} className="space-y-4 pt-2">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="firstName">First Name</Label>
								<Input
									id="firstName"
									value={form.firstName}
									placeholder="Alice"
									onChange={(e) =>
										setForm((f) => ({ ...f, firstName: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="lastName">Last Name</Label>
								<Input
									id="lastName"
									value={form.lastName}
									placeholder="Smith"
									onChange={(e) =>
										setForm((f) => ({ ...f, lastName: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="phone">Phone</Label>
								<Input
									id="phone"
									value={form.phone}
									placeholder="+911234567890"
									onChange={(e) =>
										setForm((f) => ({ ...f, phone: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={form.email}
									placeholder="alice.smith@incubyte.com"
									onChange={(e) =>
										setForm((f) => ({ ...f, email: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Role</Label>
								<Select
									value={form.role || "__none"}
									onValueChange={(v) =>
										setForm((f) => ({ ...f, role: v === "__none" ? "" : v }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select role" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">Select role</SelectItem>
										{ROLES.map((r) => (
											<SelectItem key={r} value={r}>
												{r}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label>Department</Label>
								<Select
									value={form.department || "__none"}
									onValueChange={(v) =>
										setForm((f) => ({
											...f,
											department: v === "__none" ? "" : v,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select department" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">Select department</SelectItem>
										{DEPARTMENTS.map((d) => (
											<SelectItem key={d} value={d}>
												{d}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label>Country</Label>
								<Select
									value={form.country || "__none"}
									onValueChange={(v) =>
										setForm((f) => ({ ...f, country: v === "__none" ? "" : v }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select country" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">Select country</SelectItem>
										{COUNTRIES.map((c) => (
											<SelectItem key={c} value={c}>
												{c}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="salary">Salary</Label>
								<Input
									id="salary"
									type="number"
									min="1"
									value={form.salary}
									placeholder="1000000"
									onChange={(e) =>
										setForm((f) => ({ ...f, salary: e.target.value }))
									}
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="joiningDate">Joining Date</Label>
							<Input
								id="joiningDate"
								type="date"
								value={form.joiningDate}
								onChange={(e) =>
									setForm((f) => ({ ...f, joiningDate: e.target.value }))
								}
							/>
						</div>

						{formError && <p className="text-sm text-red-500">{formError}</p>}

						<DialogFooter>
							<Button type="button" variant="outline" onClick={closeModal}>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={submitting}
								className="bg-indigo-600 hover:bg-indigo-700 text-white"
							>
								{submitting && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								{editTarget ? "Save Changes" : "Add Employee"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* ── Delete confirm ── */}
			<Dialog
				open={deleteId !== null}
				onOpenChange={(open) => !open && setDeleteId(null)}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete Employee</DialogTitle>
					</DialogHeader>
					<p className="pt-2 text-sm text-slate-600">
						This action cannot be undone. The employee record will be
						permanently removed.
					</p>
					<DialogFooter className="pt-4">
						<Button variant="outline" onClick={() => setDeleteId(null)}>
							Cancel
						</Button>
						<Button
							onClick={confirmDelete}
							disabled={deleting}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							{deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── Page export (Suspense boundary required by useSearchParams) ───────────────

export default function EmployeesPage() {
	return (
		<Suspense>
			<EmployeesContent />
		</Suspense>
	);
}
