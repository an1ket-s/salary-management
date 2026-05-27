import { Fragment } from "react";
import { Separator } from "@/components/ui/separator";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((step, i) => (
        <Fragment key={step}>
          <div className={cn(
            "flex items-center gap-2.5",
            i === current ? "text-indigo-600" : i < current ? "text-emerald-600" : "text-slate-400"
          )}>
            {/* Circle */}
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              i === current && "bg-indigo-600 text-white shadow-[0_2px_8px_rgba(79,70,229,0.35)]",
              i <  current && "bg-emerald-500 text-white",
              i >  current && "bg-slate-200 text-slate-500"
            )}>
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {/* Label */}
            <span className={cn(
              "text-sm",
              i === current ? "font-semibold" : "font-normal"
            )}>
              {step}
            </span>
          </div>

          {i < steps.length - 1 && (
            <Separator className={cn(
              "flex-1",
              i < current ? "bg-emerald-300" : "bg-slate-200"
            )} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
