import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/bi/KpiCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { brl } from "@/lib/format";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, Receipt, ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/financeiro/")({
  component: FinanceiroDashboard,
});

const HORIZONS = [30, 60, 90, 180] as const;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function FinanceiroDashboard() {
  const hoje = new Date();
  const fim180 = iso(addDays(hoje, 180));
  const ini = iso(addDays(hoje, -180));

  const { data: cp = [] } = useQuery({
    queryKey: ["fin-cp-proj"],
    queryFn: async () =>
      (await supabase
        .from("contas_pagar")
        .select("valor, data_vencimento, data_pagamento, status")
        .lte("data_vencimento", fim180)).data ?? [],
  });

  const { data: cr = [] } = useQuery({
    queryKey: ["fin-cr-proj"],
    queryFn: async () =>
      (await supabase
        .from("contas_receber")
        .select("valor, data_vencimento, data_recebimento, status")
        .lte("data_vencimento", fim180)).data ?? [],
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["fin-despesas-30"],
    queryFn: async () =>
      (await supabase
        .from("despesas")
        .select("valor, data")
        .gte("data", ini)).data ?? [],
  });

  const { data: dividas = [] } = useQuery({
    queryKey: ["fin-dividas"],
    queryFn: async () =>
      (await supabase.from("dividas").select("saldo_devedor, status, valor_parcela").eq("status", "ativa")).data ?? [],
  });

  const totalDividas = dividas.reduce((s, d) => s + Number(d.saldo_devedor ?? 0), 0);
  const parcelaMensalDividas = dividas.reduce((s, d) => s + Number(d.valor_parcela ?? 0), 0);

  // KPIs período próximo (30 dias)
  const fim30 = iso(addDays(hoje, 30));
  const hojeIso = iso(hoje);
  const aPagar30 = cp.filter((c) => c.status !== "paga" && c.status !== "cancelada" && c.data_vencimento >= hojeIso && c.data_vencimento <= fim30)
    .reduce((s, c) => s + Number(c.valor), 0);
  const aReceber30 = cr.filter((c) => c.status !== "recebida" && c.status !== "cancelada" && c.data_vencimento >= hojeIso && c.data_vencimento <= fim30)
    .reduce((s, c) => s + Number(c.valor), 0);
  const atrasadasPagar = cp.filter((c) => c.status !== "paga" && c.status !== "cancelada" && c.data_vencimento < hojeIso)
    .reduce((s, c) => s + Number(c.valor), 0);
  const atrasadasReceber = cr.filter((c) => c.status !== "recebida" && c.status !== "cancelada" && c.data_vencimento < hojeIso)
    .reduce((s, c) => s + Number(c.valor), 0);

  const despesasUlt30 = despesas
    .filter((d) => d.data >= iso(addDays(hoje, -30)))
    .reduce((s, d) => s + Number(d.valor), 0);

  // Projeção por horizonte
  const projecao = HORIZONS.map((h) => {
    const limite = iso(addDays(hoje, h));
    const pagar = cp.filter((c) => c.status !== "paga" && c.status !== "cancelada" && c.data_vencimento <= limite)
      .reduce((s, c) => s + Number(c.valor), 0);
    const receber = cr.filter((c) => c.status !== "recebida" && c.status !== "cancelada" && c.data_vencimento <= limite)
      .reduce((s, c) => s + Number(c.valor), 0);
    return {
      horizonte: `${h}d`,
      "A receber": Number(receber.toFixed(2)),
      "A pagar": Number(pagar.toFixed(2)),
      Saldo: Number((receber - pagar).toFixed(2)),
    };
  });

  const saldoProjetado30 = aReceber30 - aPagar30;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="A receber (30 dias)"
          value={brl(aReceber30)}
          icon={ArrowDownToLine}
          status="healthy"
          hint={`${cr.filter(c => c.status !== "recebida" && c.status !== "cancelada").length} contas em aberto`}
        />
        <KpiCard
          label="A pagar (30 dias)"
          value={brl(aPagar30)}
          icon={ArrowUpFromLine}
          status={aPagar30 > aReceber30 ? "warning" : "neutral"}
          hint={`${cp.filter(c => c.status !== "paga" && c.status !== "cancelada").length} contas em aberto`}
        />
        <KpiCard
          label="Saldo projetado 30d"
          value={brl(saldoProjetado30)}
          icon={saldoProjetado30 >= 0 ? TrendingUp : TrendingDown}
          status={saldoProjetado30 >= 0 ? "healthy" : "critical"}
          highlight
        />
        <KpiCard
          label="Despesas últ. 30d"
          value={brl(despesasUlt30)}
          icon={Receipt}
          status="neutral"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Atrasadas a pagar"
          value={brl(atrasadasPagar)}
          icon={AlertTriangle}
          status={atrasadasPagar > 0 ? "critical" : "healthy"}
        />
        <KpiCard
          label="Atrasadas a receber"
          value={brl(atrasadasReceber)}
          icon={AlertTriangle}
          status={atrasadasReceber > 0 ? "warning" : "healthy"}
        />
        <KpiCard
          label="Saldo de dívidas"
          value={brl(totalDividas)}
          icon={Landmark}
          status={totalDividas > 0 ? "warning" : "healthy"}
          hint={`${dividas.length} dívidas ativas`}
        />
        <KpiCard
          label="Parcela mensal dívidas"
          value={brl(parcelaMensalDividas)}
          icon={Wallet}
          status="neutral"
        />
      </div>

      <ChartCard
        title="Projeção de Fluxo de Caixa"
        description="A receber vs. a pagar nos próximos horizontes"
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={projecao}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="horizonte" />
            <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Legend />
            <Bar dataKey="A receber" fill="var(--kpi-healthy)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="A pagar" fill="var(--kpi-critical)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Saldo" fill="var(--primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
