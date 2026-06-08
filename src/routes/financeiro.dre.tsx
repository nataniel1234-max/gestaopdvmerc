import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { TrendingUp, TrendingDown, Percent, DollarSign } from "lucide-react";

export const Route = createFileRoute("/financeiro/dre")({
  component: DREPage,
});

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

function DREPage() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayIso());

  // Vendas no período
  const { data: vendas = [] } = useQuery({
    queryKey: ["dre-vendas", inicio, fim],
    queryFn: async () =>
      (await supabase
        .from("vendas")
        .select("id, total, desconto, status, created_at")
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .neq("status", "cancelada")).data ?? [],
  });

  // Itens de venda (para CMV estimado pelo custo do produto)
  const vendaIds = vendas.map((v) => v.id);
  const { data: itens = [] } = useQuery({
    queryKey: ["dre-itens", vendaIds.length, inicio, fim],
    enabled: vendaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("itens_venda")
        .select("quantidade, preco_unitario, custo_unitario")
        .in("venda_id", vendaIds);
      return data ?? [];
    },
  });

  // Despesas no período
  const { data: despesas = [] } = useQuery({
    queryKey: ["dre-despesas", inicio, fim],
    queryFn: async () =>
      ((await supabase
        .from("despesas")
        .select("valor, data, categorias_financeiras(nome)")
        .gte("data", inicio).lte("data", fim)).data ?? []) as any[],
  });

  // Contas a pagar pagas no período (despesas adicionais quitadas)
  const { data: cpPagas = [] } = useQuery({
    queryKey: ["dre-cp", inicio, fim],
    queryFn: async () =>
      ((await supabase
        .from("contas_pagar")
        .select("valor, data_pagamento, categorias_financeiras(nome)")
        .eq("status", "paga")
        .gte("data_pagamento", inicio).lte("data_pagamento", fim)).data ?? []) as any[],
  });

  const receitaBruta = vendas.reduce((s, v) => s + Number(v.total), 0);
  const descontos = vendas.reduce((s, v) => s + Number(v.desconto ?? 0), 0);
  const receitaLiquida = receitaBruta; // total já é líquido do desconto
  const cmv = itens.reduce(
    (s, i) => s + Number(i.custo_unitario ?? 0) * Number(i.quantidade),
    0,
  );
  const lucroBruto = receitaLiquida - cmv;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;

  // Despesas operacionais agrupadas
  const despesasMap = new Map<string, number>();
  for (const d of despesas) {
    const k = d.categorias_financeiras?.nome ?? "Outras despesas";
    despesasMap.set(k, (despesasMap.get(k) ?? 0) + Number(d.valor));
  }
  for (const c of cpPagas) {
    const k = c.categorias_financeiras?.nome ?? "Outras contas pagas";
    despesasMap.set(k, (despesasMap.get(k) ?? 0) + Number(c.valor));
  }
  const despesasArr = Array.from(despesasMap.entries()).sort((a, b) => b[1] - a[1]);
  const totalDespesasOp = despesasArr.reduce((s, [, v]) => s + v, 0);

  const lucroLiquido = lucroBruto - totalDespesasOp;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setInicio(firstDayOfMonth()); setFim(todayIso()); }}>Mês atual</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(); d.setMonth(d.getMonth() - 1);
              setInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10));
              setFim(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0,10));
            }}>Mês anterior</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const y = new Date().getFullYear();
              setInicio(`${y}-01-01`); setFim(todayIso());
            }}>Ano</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita líquida" value={brl(receitaLiquida)} icon={DollarSign} status="healthy" highlight />
        <KpiCard label="Lucro bruto" value={brl(lucroBruto)} icon={TrendingUp} status={lucroBruto >= 0 ? "healthy" : "critical"} />
        <KpiCard label="Lucro líquido" value={brl(lucroLiquido)} icon={lucroLiquido >= 0 ? TrendingUp : TrendingDown} status={lucroLiquido >= 0 ? "healthy" : "critical"} />
        <KpiCard label="Margem líquida" value={`${margemLiquida.toFixed(1)}%`} icon={Percent} status={margemLiquida >= 10 ? "healthy" : margemLiquida >= 0 ? "warning" : "critical"} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-display font-bold text-lg">Demonstração do Resultado</h3>
            <p className="text-xs text-muted-foreground">Período: {inicio} a {fim}</p>
          </div>
          <div className="divide-y divide-border">
            <DRELine label="Receita bruta de vendas" value={receitaBruta} />
            <DRELine label="(–) Descontos concedidos" value={-descontos} muted />
            <DRELine label="= Receita líquida" value={receitaLiquida} bold />
            <DRELine label="(–) Custo das mercadorias vendidas (CMV)" value={-cmv} muted />
            <DRELine label="= Lucro bruto" value={lucroBruto} bold highlight={lucroBruto >= 0 ? "good" : "bad"} hint={`Margem bruta: ${margemBruta.toFixed(1)}%`} />

            <div className="px-6 py-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Despesas operacionais</p>
            </div>
            {despesasArr.length === 0 ? (
              <div className="px-6 py-3 text-sm text-muted-foreground italic">Nenhuma despesa lançada no período</div>
            ) : despesasArr.map(([nome, valor]) => (
              <DRELine key={nome} label={`  ${nome}`} value={-valor} muted small />
            ))}
            <DRELine label="= Total de despesas operacionais" value={-totalDespesasOp} bold />

            <DRELine label="= Resultado líquido do período" value={lucroLiquido} bold highlight={lucroLiquido >= 0 ? "good" : "bad"} hint={`Margem líquida: ${margemLiquida.toFixed(1)}%`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DRELine({ label, value, bold, muted, small, highlight, hint }: {
  label: string; value: number; bold?: boolean; muted?: boolean; small?: boolean;
  highlight?: "good" | "bad"; hint?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-6 py-2.5 ${highlight === "good" ? "bg-[color:var(--kpi-healthy)]/5" : highlight === "bad" ? "bg-[color:var(--kpi-critical)]/5" : ""}`}>
      <div className={`${bold ? "font-bold" : ""} ${muted ? "text-muted-foreground" : ""} ${small ? "text-sm" : ""}`}>
        {label}
        {hint && <span className="ml-2 text-xs text-muted-foreground">({hint})</span>}
      </div>
      <div className={`tabular-nums ${bold ? "font-bold text-base" : "text-sm"} ${value < 0 ? "text-[color:var(--kpi-critical)]" : ""}`}>
        {brl(value)}
      </div>
    </div>
  );
}
