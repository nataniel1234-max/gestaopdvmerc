import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Inteligência Financeira — Mercadinho" }] }),
  component: FinanceiroLayout,
});

const tabs = [
  { to: "/financeiro", label: "Visão Geral", exact: true },
  { to: "/financeiro/dre", label: "DRE" },
  { to: "/financeiro/balanco", label: "Balanço" },
  { to: "/financeiro/curva-abc", label: "Curva ABC" },
  { to: "/financeiro/setores", label: "Setores" },
  { to: "/financeiro/perdas", label: "Perdas" },
  { to: "/financeiro/contas-pagar", label: "Contas a Pagar" },
  { to: "/financeiro/contas-receber", label: "Contas a Receber" },
  { to: "/financeiro/despesas", label: "Despesas" },
  { to: "/financeiro/dividas", label: "Dívidas" },
];

function FinanceiroLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">Inteligência Financeira</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contas, despesas, dívidas e projeção de fluxo de caixa.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
