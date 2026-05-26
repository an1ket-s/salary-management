import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <Fragment key={step}>
          <div className={cn("flex items-center gap-2 text-sm", i === current ? "font-medium text-indigo-600" : i < current ? "text-emerald-600" : "text-slate-400")}>
            <Badge
              variant={i < current ? "default" : "outline"}
              className={cn(
                "h-6 w-6 justify-center rounded-full p-0 text-xs",
                i === current && "border-indigo-600 bg-indigo-600 text-white",
                i < current  && "border-emerald-500 bg-emerald-500 text-white",
                i > current  && "border-slate-200 text-slate-500"
              )}
            >
              {i < current ? <Check className="h-3 w-3" /> : i + 1}
            </Badge>
            {step}
          </div>
          {i < steps.length - 1 && (
            <Separator
              className={cn("flex-1", i < current ? "bg-emerald-400" : "bg-slate-200")}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
