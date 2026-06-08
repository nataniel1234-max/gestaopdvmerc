import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title, description, actions, children, className, contentClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("border-border/60", className)} style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold font-display">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent className={cn("pt-2", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function StatusPill({
  status, children,
}: {
  status: "healthy" | "warning" | "critical" | "neutral";
  children: ReactNode;
}) {
  const map = {
    healthy: "bg-[color:var(--kpi-healthy)]/12 text-[color:var(--kpi-healthy)]",
    warning: "bg-[color:var(--kpi-warning)]/15 text-[color:var(--kpi-warning)]",
    critical: "bg-[color:var(--kpi-critical)]/12 text-[color:var(--kpi-critical)]",
    neutral: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", map[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
