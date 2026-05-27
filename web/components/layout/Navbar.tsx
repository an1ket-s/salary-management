"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
	{ label: "Insights", href: "/insights" },
	{ label: "Employees", href: "/employees" },
	{ label: "Seed", href: "/setup" },
];

export function Navbar() {
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
				<Link
					href="/"
					className="text-xl font-bold text-indigo-600 tracking-tight"
				>
					SalaryMS
				</Link>
				<nav className="flex items-center gap-6">
					{links.map(({ label, href }) => {
						const active = pathname.startsWith(href);
						return (
							<Link
								key={href}
								href={href}
								className={cn(
									"relative pb-1 text-sm font-medium transition-colors",
									active
										? "text-indigo-600 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded after:bg-indigo-600"
										: "text-slate-500 hover:text-slate-800",
								)}
							>
								{label}
							</Link>
						);
					})}
				</nav>
			</div>
		</header>
	);
}
