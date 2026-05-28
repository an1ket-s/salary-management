"use client";

import { useRef, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Stepper } from "@/components/setup/Stepper";
import { api } from "@/lib/api";
import { Check, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const STEPS = ["Upload Name Files", "Seed Database"];

type FileStatus = "idle" | "uploading" | "done" | "error";
type SeedStatus = "idle" | "seeding" | "done" | "error";

const FILES = [
	{ label: "first_names.txt", type: "FIRST" as const },
	{ label: "last_names.txt", type: "LAST" as const },
];

export default function SetupPage() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [firstStatus, setFirstStatus] = useState<FileStatus>("idle");
	const [firstCount, setFirstCount] = useState(0);
	const [lastStatus, setLastStatus] = useState<FileStatus>("idle");
	const [lastCount, setLastCount] = useState(0);
	const [seedStatus, setSeedStatus] = useState<SeedStatus>("idle");
	const [inserted, setInserted] = useState(0);

	const firstRef = useRef<HTMLInputElement>(null);
	const lastRef = useRef<HTMLInputElement>(null);
	const refs = { FIRST: firstRef, LAST: lastRef };

	async function upload(file: File, type: "FIRST" | "LAST") {
		const setStatus = type === "FIRST" ? setFirstStatus : setLastStatus;
		const setCount = type === "FIRST" ? setFirstCount : setLastCount;
		setStatus("uploading");
		try {
			await api.names.upload(file, type);
			const stats = await api.names.stats();
			setCount(type === "FIRST" ? stats.data.firstNames : stats.data.lastNames);
			setStatus("done");
		} catch {
			setStatus("error");
		}
	}

	async function seed() {
		setSeedStatus("seeding");
		try {
			const res = await api.seed.run(firstCount);
			setInserted(res.data.inserted);
			setSeedStatus("done");
			router.push("/employees");
		} catch {
			setSeedStatus("error");
		}
	}

	const statuses = { FIRST: firstStatus, LAST: lastStatus };
	const counts = { FIRST: firstCount, LAST: lastCount };
	const bothDone = firstStatus === "done" && lastStatus === "done";

	return (
		<div className="mx-auto max-w-2xl space-y-6 py-2">
			<Stepper steps={STEPS} current={step} />

			{/* ── Step 0 — Upload ── */}
			{step === 0 && (
				<Card className="p-8">
					<CardHeader className="p-0 pb-6">
						<CardTitle className="text-2xl font-bold text-slate-900">
							Upload Name Files
						</CardTitle>
						<CardDescription className="text-sm text-slate-500 mt-1">
							Upload .txt files with one name per line. Supports 10,000+ names.
						</CardDescription>
					</CardHeader>

					<CardContent className="p-0 space-y-3">
						{FILES.map(({ label, type }) => {
							const status = statuses[type];
							const isDone = status === "done";
							const isUploading = status === "uploading";

							return (
								<div
									key={type}
									className={cn(
										"flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors",
										isDone
											? "border-2 border-indigo-500 bg-emerald-50"
											: "border-2 border-dashed border-slate-200 bg-white",
									)}
								>
									{/* Icon */}
									<div
										className={cn(
											"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
											isDone ? "bg-emerald-100" : "bg-indigo-100",
										)}
									>
										<FileText
											className={cn(
												"h-5 w-5",
												isDone ? "text-emerald-600" : "text-indigo-400",
											)}
										/>
									</div>

									{/* Name + status */}
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-slate-800">
											{label}
										</p>
										{isDone ? (
											<p className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
												<Check className="h-3 w-3" />
												{counts[type].toLocaleString()} names loaded
											</p>
										) : (
											<p className="text-xs text-slate-400 mt-0.5">
												Not uploaded yet
											</p>
										)}
									</div>

									{/* Hidden file input */}
									<input
										ref={refs[type]}
										type="file"
										accept=".txt"
										className="hidden"
										onChange={(e) => {
											const f = e.target.files?.[0];
											if (f) upload(f, type);
											e.target.value = "";
										}}
									/>

									{/* Action button */}
									<Button
										size="sm"
										variant={isDone ? "outline" : "default"}
										disabled={isUploading}
										onClick={() => refs[type].current?.click()}
										className={cn(
											"shrink-0",
											isDone
												? "border-indigo-300 text-indigo-600 hover:bg-indigo-50"
												: "bg-indigo-600 hover:bg-indigo-700 text-white",
										)}
									>
										{isUploading && (
											<Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
										)}
										{isUploading
											? "Uploading…"
											: isDone
												? "Re-upload"
												: "Choose file"}
									</Button>
								</div>
							);
						})}

						{/* Info banner */}
						{!bothDone && (
							<div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-600">
								Both files are required before proceeding.
							</div>
						)}

						{/* Next button */}
						<Button
							disabled={!bothDone}
							onClick={() => setStep(1)}
							className={cn(
								"w-full rounded-xl h-11 font-medium transition-colors",
								bothDone
									? "bg-indigo-600 hover:bg-indigo-700 text-white"
									: "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none",
							)}
						>
							Next: Seed Database →
						</Button>
					</CardContent>
				</Card>
			)}

			{/* ── Step 1 — Seed ── */}
			{step === 1 && (
				<Card className="p-8">
					<CardHeader className="p-0 pb-6">
						<CardTitle className="text-2xl font-bold text-slate-900">
							Seed Database
						</CardTitle>
						<CardDescription className="text-sm text-slate-500 mt-1">
							Generate {firstCount.toLocaleString()} employees from the uploaded name files.
						</CardDescription>
					</CardHeader>

					<CardContent className="p-0 space-y-4">
						{(seedStatus === "seeding" || seedStatus === "done") && (
							<Progress value={seedStatus === "done" ? 100 : 0} />
						)}
						{seedStatus === "done" && (
							<div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
								✓ {inserted.toLocaleString()} employees seeded successfully.
							</div>
						)}
						{seedStatus === "error" && (
							<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">
								Seeding failed. Please try again.
							</div>
						)}

						<Button
							onClick={seed}
							disabled={seedStatus === "seeding"}
							className="w-full rounded-xl h-11 font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
						>
							{seedStatus === "seeding" && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							{seedStatus === "seeding"
								? "Seeding…"
								: seedStatus === "done"
									? "Seed More Employees"
									: `Seed ${firstCount.toLocaleString()} Employees`}
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
