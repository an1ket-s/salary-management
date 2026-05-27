import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
	from: number;
	to: number;
	total: number;
	totalPages: number;
	page: number;
	setPage: (page: number) => void;
	getPageRange: (current: number, total: number) => (number | "…")[];
	pageSize: number;
};

export function Pagination(props: PaginationProps) {
	const { page, setPage, total, pageSize, from, to, totalPages, getPageRange } =
		props;
	return (
		<div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
			<span className="text-slate-400">
				Showing {from}–{to} of {total.toLocaleString()} employees
			</span>

			<div className="flex items-center gap-1">
				{/* Prev */}
				<button
					disabled={page === 1}
					onClick={() => setPage((p) => p - 1)}
					className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
				>
					<ChevronLeft className="h-4 w-4" /> Prev
				</button>

				{/* Page numbers */}
				{getPageRange(page, totalPages).map((p, i) =>
					p === "…" ? (
						<span
							key={`ellipsis-${i}`}
							className="w-8 text-center text-slate-400"
						>
							…
						</span>
					) : (
						<button
							key={p}
							onClick={() => setPage(p)}
							className={cn(
								"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
								p === page
									? "bg-indigo-600 text-white shadow-sm"
									: "text-slate-600 hover:bg-slate-100",
							)}
						>
							{p}
						</button>
					),
				)}

				{/* Next */}
				<button
					disabled={page === totalPages}
					onClick={() => setPage((p) => p + 1)}
					className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
				>
					Next <ChevronRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
