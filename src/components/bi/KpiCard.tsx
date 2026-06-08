import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiStatus = "healthy" | "warning" | "critical" | "neutral";

export type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: number; // variação percentual vs. período anterior
  deltaLabel?: string;
  icon?: LucideIcon;
  status?: KpiStatus;
  highlight?: boolean;
};

const statusRing: Record<KpiStatus, string> = {
  healthy: "before:bg-[color:var(--kpi-healthy)]",
  warning: "before:bg-[color:var(--kpi-warning)]",
  critical: "before:bg-[color:var(--kpi-critical)]",
  neutral: "before:bg-[color:var(--primary)]",
};

export function KpiCard({
  label, value, hint, delta, deltaLabel, icon: Icon, status = "neutral", highlight,
}: KpiCardProps) {
  const deltaPos = delta != null && delta > 0;
  const deltaNeg = delta != null && delta < 0;
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/60 transition-all",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-['']",
        statusRing[status],
        highlight && "ring-1 ring-[color:var(--primary)]/15",
      )}
      style={{ boxShadow: "var(--shadow-kpi)", background: highlight ? "var(--gradient-kpi)" : undefined }}
    >
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</p>
            <p className="text-3xl font-display font-bold mt-2 tabular-nums tracking-tight truncate">{value}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              {delta != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
                    deltaPos && "bg-[color:var(--kpi-healthy)]/10 text-[color:var(--kpi-healthy)]",
                    deltaNeg && "bg-[color:var(--kpi-critical)]/10 text-[color:var(--kpi-critical)]",
                    delta === 0 && "bg-muted text-muted-foreground",
                  )}
                >
                  {deltaPos ? <ArrowUpRight className="h-3 w-3" /> : deltaNeg ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              {(deltaLabel || hint) && (
                <span className="text-muted-foreground truncate">{deltaLabel ?? hint}</span>
              )}
            </div>
          </div>
          {Icon && (
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
