"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Stepper } from "@/components/setup/Stepper";
import { api } from "@/lib/api";

const STEPS = ["Upload Name Files", "Seed Database"];
const SEED_COUNT = 10_000;

type FileStatus = "idle" | "uploading" | "done" | "error";
type SeedStatus = "idle" | "seeding" | "done" | "error";

const FILES = [
  { label: "first_names.txt", type: "FIRST" as const },
  { label: "last_names.txt",  type: "LAST"  as const },
];

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [firstStatus, setFirstStatus] = useState<FileStatus>("idle");
  const [firstCount,  setFirstCount]  = useState(0);
  const [lastStatus,  setLastStatus]  = useState<FileStatus>("idle");
  const [lastCount,   setLastCount]   = useState(0);
  const [seedStatus,  setSeedStatus]  = useState<SeedStatus>("idle");
  const [inserted,    setInserted]    = useState(0);

  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef  = useRef<HTMLInputElement>(null);

  const refs = { FIRST: firstRef, LAST: lastRef };

  async function upload(file: File, type: "FIRST" | "LAST") {
    const setStatus = type === "FIRST" ? setFirstStatus : setLastStatus;
    const setCount  = type === "FIRST" ? setFirstCount  : setLastCount;
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
      const res = await api.seed.run(SEED_COUNT);
      setInserted(res.data.inserted);
      setSeedStatus("done");
    } catch {
      setSeedStatus("error");
    }
  }

  const statuses = { FIRST: firstStatus, LAST: lastStatus };
  const counts   = { FIRST: firstCount,  LAST: lastCount };
  const bothDone = firstStatus === "done" && lastStatus === "done";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Setup</h1>

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Name Files</CardTitle>
            <CardDescription>One name per line (.txt). Used to generate employee names.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {FILES.map(({ label, type }) => {
              const status = statuses[type];
              return (
                <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-slate-700">
                    {label}
                    {status === "done"  && <span className="ml-2 text-emerald-600">· {counts[type].toLocaleString()} names</span>}
                    {status === "error" && <span className="ml-2 text-red-500">· upload failed</span>}
                  </span>
                  <input
                    ref={refs[type]}
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, type); e.target.value = ""; }}
                  />
                  <Button
                    size="sm"
                    variant={status === "done" ? "outline" : "default"}
                    disabled={status === "uploading"}
                    onClick={() => refs[type].current?.click()}
                  >
                    {status === "uploading" ? "Uploading…" : status === "done" ? "Re-upload" : "Choose file"}
                  </Button>
                </div>
              );
            })}

            <div className="flex justify-end pt-1">
              <Button disabled={!bothDone} onClick={() => setStep(1)}>
                Next →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Seed Database</CardTitle>
            <CardDescription>
              Generate {SEED_COUNT.toLocaleString()} employees from the uploaded name files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(seedStatus === "seeding" || seedStatus === "done") && (
              <Progress value={seedStatus === "done" ? 100 : 0} />
            )}
            {seedStatus === "done" && (
              <p className="text-sm text-emerald-600">
                {inserted.toLocaleString()} employees seeded successfully.
              </p>
            )}
            {seedStatus === "error" && (
              <p className="text-sm text-red-500">Seeding failed. Please try again.</p>
            )}
            <Button onClick={seed} disabled={seedStatus === "seeding"} className="w-full">
              {seedStatus === "seeding" ? "Seeding…" : seedStatus === "done" ? "Seed More Employees" : "Seed 10,000 Employees"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
