import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import {
  ShoppingCart, Package, AlertTriangle, CreditCard, TrendingUp, Users,
  Wallet, Receipt, Banknote, Clock, ArrowRight, Sparkles,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KpiCard, type KpiStatus } from "@/components/bi/KpiCard";
import { ChartCard, StatusPill } from "@/components/bi/ChartCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — Gestão Inteligente" },
      { name: "description", content: "Centro de inteligência empresarial: faturamento, lucro, fluxo de caixa e operação em tempo real." },
    ],
  }),
  component: DashboardExecutivo,
});

type Periodo = "dia" | "semana" | "mes" | "ano";

function startOf(p: Periodo, offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "dia") { d.setDate(d.getDate() - offset); return d; }
  if (p === "semana") {
    const day = d.getDay();
    d.setDate(d.getDate() - day - offset * 7);
    return d;
  }
  if (p === "mes") { return new Date(d.getFullYear(), d.getMonth() - offset, 1); }
  return new Date(d.getFullYear() - offset, 0, 1);
}

function endOf(p: Periodo, offset = 0): Date {
  if (p === "dia") {
    const d = startOf("dia", offset); d.setDate(d.getDate() + 1); return d;
  }
  if (p === "semana") {
    const d = startOf("semana", offset); d.setDate(d.getDate() + 7); return d;
  }
  if (p === "mes") {
    const d = startOf("mes", offset); return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return new Date(startOf("ano", offset).getFullYear() + 1, 0, 1);
}

function deltaPct(atual: number, anterior: number): number | undefined {
  if (!anterior) return atual > 0 ? 100 : undefined;
  return ((atual - anterior) / anterior) * 100;
}

function statusFromDelta(delta?: number, invert = false): KpiStatus {
  if (delta == null) return "neutral";
  const d = invert ? -delta : delta;
  if (d >= -2) return "healthy";
  if (d >= -10) return "warning";
  return "critical";
}

function DashboardExecutivo() {
  const { comercio, assinatura } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  // ------- KPIs principais -------
  const { data: kpis } = useQuery({
    queryKey: ["bi-kpis", comercio?.id, periodo],
    enabled: !!comercio?.id,
    queryFn: async () => {
      const ini = startOf(periodo).toISOString();
      const fim = endOf(periodo).toISOString();
      const iniAnt = startOf(periodo, 1).toISOString();
      const fimAnt = endOf(periodo, 1).toISOString();
      const iniDia = startOf("dia").toISOString();
      const fimDia = endOf("dia").toISOString();
      const iniDiaAnt = startOf("dia", 1).toISOString();
      const fimDiaAnt = endOf("dia", 1).toISOString();
      const iniMes = startOf("mes").toISOString();
      const fimMes = endOf("mes").toISOString();
      const iniMesAnt = startOf("mes", 1).toISOString();
      const fimMesAnt = endOf("mes", 1).toISOString();

      const [
        vAtual, vAnterior, vDia, vDiaAnt, vMes, vMesAnt,
        itensMes, itensMesAnt,
        produtos, fiadoQ, caixas,
      ] = await Promise.all([
        supabase.from("vendas").select("total, cliente_id").eq("cancelada", false).gte("created_at", ini).lt("created_at", fim),
        supabase.from("vendas").select("total").eq("cancelada", false).gte("created_at", iniAnt).lt("created_at", fimAnt),
        supabase.from("vendas").select("total, cliente_id").eq("cancelada", false).gte("created_at", iniDia).lt("created_at", fimDia),
        supabase.from("vendas").select("total").eq("cancelada", false).gte("created_at", iniDiaAnt).lt("created_at", fimDiaAnt),
        supabase.from("vendas").select("total").eq("cancelada", false).gte("created_at", iniMes).lt("created_at", fimMes),
        supabase.from("vendas").select("total").eq("cancelada", false).gte("created_at", iniMesAnt).lt("created_at", fimMesAnt),
        supabase.from("movimentacoes_estoque").select("quantidade, custo_unitario, produto_id").eq("tipo", "saida_venda").gte("created_at", iniMes).lt("created_at", fimMes),
        supabase.from("movimentacoes_estoque").select("quantidade, custo_unitario, produto_id").eq("tipo", "saida_venda").gte("created_at", iniMesAnt).lt("created_at", fimMesAnt),
        supabase.from("produtos").select("id, preco_custo, estoque_atual, estoque_minimo").eq("ativo", true),
        supabase.from("clientes").select("saldo_devedor").gt("saldo_devedor", 0),
        supabase.from("caixas").select("id, valor_abertura").eq("status", "aberto"),
      ]);


      const sum = (arr: { total: number }[] | null) => (arr ?? []).reduce((s, v) => s + Number(v.total ?? 0), 0);

      const fatPeriodo = sum(vAtual.data);
      const fatPeriodoAnt = sum(vAnterior.data);
      const fatDia = sum(vDia.data);
      const fatDiaAnt = sum(vDiaAnt.data);
      const fatMes = sum(vMes.data);
      const fatMesAnt = sum(vMesAnt.data);

      // CMV estimado pelo custo atual dos produtos vendidos no mês
      const custoMap = new Map<string, number>();
      (produtos.data ?? []).forEach((p) => custoMap.set(p.id, Number(p.preco_custo ?? 0)));
      const cmvCalc = (rows: any[] | null) =>
        (rows ?? []).reduce((s, it) => s + Number(it.quantidade) * (custoMap.get(it.produto_id) ?? 0), 0);
      const cmvMes = cmvCalc(itensMes.data);
      const cmvMesAnt = cmvCalc(itensMesAnt.data);
      const lucroBrutoMes = fatMes - cmvMes;
      const lucroBrutoMesAnt = fatMesAnt - cmvMesAnt;
      const margemMes = fatMes > 0 ? (lucroBrutoMes / fatMes) * 100 : 0;
      const margemMesAnt = fatMesAnt > 0 ? (lucroBrutoMesAnt / fatMesAnt) * 100 : 0;

      const clientesUnicos = new Set((vDia.data ?? []).map((v) => v.cliente_id).filter(Boolean)).size;
      const ticketDia = (vDia.data?.length ?? 0) > 0 ? fatDia / (vDia.data!.length) : 0;
      const ticketAnt = (vDiaAnt.data?.length ?? 0) > 0 ? fatDiaAnt / (vDiaAnt.data!.length) : 0;

      const saldoCaixa = (caixas.data ?? []).reduce((s, c) => {
        return s + Number(c.valor_abertura) + Number(c.total_dinheiro) + Number(c.total_suprimentos) - Number(c.total_sangrias);
      }, 0);

      const baixoEstoque = (produtos.data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo));
      const fiadoTotal = (fiadoQ.data ?? []).reduce((s, c) => s + Number(c.saldo_devedor ?? 0), 0);

      return {
        fatDia, fatDiaAnt, deltaDia: deltaPct(fatDia, fatDiaAnt),
        fatMes, fatMesAnt, deltaMes: deltaPct(fatMes, fatMesAnt),
        fatPeriodo, deltaPeriodo: deltaPct(fatPeriodo, fatPeriodoAnt),
        cupons: vDia.data?.length ?? 0,
        clientes: clientesUnicos,
        ticketDia, deltaTicket: deltaPct(ticketDia, ticketAnt),
        cmvMes, lucroBrutoMes, margemMes,
        deltaLucro: deltaPct(lucroBrutoMes, lucroBrutoMesAnt),
        deltaMargem: margemMes - margemMesAnt,
        saldoCaixa,
        caixasAbertos: caixas.data?.length ?? 0,
        baixoEstoque, fiadoTotal,
        clientesFiado: fiadoQ.data?.length ?? 0,
      };
    },
  });

  // ------- Série diária 30d + 30d anterior -------
  const { data: serie } = useQuery({
    queryKey: ["bi-serie", comercio?.id],
    enabled: !!comercio?.id,
    queryFn: async () => {
      const fim = new Date(); fim.setHours(23, 59, 59, 999);
      const ini60 = new Date(); ini60.setDate(ini60.getDate() - 59); ini60.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("vendas")
        .select("total, created_at")
        .eq("cancelada", false)
        .gte("created_at", ini60.toISOString())
        .lte("created_at", fim.toISOString());

      const buckets = new Map<string, number>();
      (data ?? []).forEach((v) => {
        const d = new Date(v.created_at); d.setHours(0, 0, 0, 0);
        const k = d.toISOString().slice(0, 10);
        buckets.set(k, (buckets.get(k) ?? 0) + Number(v.total));
      });
      const out: { dia: string; atual: number | null; anterior: number | null }[] = [];
      for (let i = 29; i >= 0; i--) {
        const dAt = new Date(); dAt.setDate(dAt.getDate() - i); dAt.setHours(0, 0, 0, 0);
        const dPr = new Date(dAt); dPr.setDate(dPr.getDate() - 30);
        out.push({
          dia: dAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          atual: buckets.get(dAt.toISOString().slice(0, 10)) ?? 0,
          anterior: buckets.get(dPr.toISOString().slice(0, 10)) ?? 0,
        });
      }
      return out;
    },
  });

  // ------- Vendas por hora (mês) -------
  const { data: porHora } = useQuery({
    queryKey: ["bi-hora", comercio?.id],
    enabled: !!comercio?.id,
    queryFn: async () => {
      const ini = startOf("mes").toISOString();
      const { data } = await supabase
        .from("vendas").select("total, created_at").eq("cancelada", false).gte("created_at", ini);
      const horas = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, total: 0 }));
      (data ?? []).forEach((v) => {
        const h = new Date(v.created_at).getHours();
        horas[h].total += Number(v.total);
      });
      return horas.filter((h) => h.total > 0);
    },
  });

  // ------- Top produtos do mês -------
  const { data: topProdutos } = useQuery({
    queryKey: ["bi-top", comercio?.id],
    enabled: !!comercio?.id,
    queryFn: async () => {
      const ini = startOf("mes").toISOString();
      const { data } = await supabase
        .from("itens_venda")
        .select("produto_nome, subtotal, quantidade, vendas!inner(created_at, cancelada)")
        .gte("vendas.created_at", ini)
        .eq("vendas.cancelada", false);
      const map = new Map<string, { receita: number; qtd: number }>();
      (data ?? []).forEach((it: any) => {
        const cur = map.get(it.produto_nome) ?? { receita: 0, qtd: 0 };
        cur.receita += Number(it.subtotal);
        cur.qtd += Number(it.quantidade);
        map.set(it.produto_nome, cur);
      });
      return Array.from(map, ([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.receita - a.receita).slice(0, 10);
    },
  });

  const periodLabel: Record<Periodo, string> = {
    dia: "vs. ontem", semana: "vs. semana anterior", mes: "vs. mês anterior", ano: "vs. ano anterior",
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho executivo */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            Centro de Inteligência Empresarial
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mt-1">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de performance financeira, comercial e operacional.
          </p>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="dia">Hoje</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="ano">Ano</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Linha 1 — KPIs financeiros */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Faturamento do dia"
          value={brl(kpis?.fatDia ?? 0)}
          icon={ShoppingCart}
          delta={kpis?.deltaDia}
          deltaLabel="vs. ontem"
          status={statusFromDelta(kpis?.deltaDia)}
          highlight
        />
        <KpiCard
          label="Faturamento do mês"
          value={brl(kpis?.fatMes ?? 0)}
          icon={TrendingUp}
          delta={kpis?.deltaMes}
          deltaLabel="vs. mês anterior"
          status={statusFromDelta(kpis?.deltaMes)}
        />
        <KpiCard
          label="Lucro bruto · mês"
          value={brl(kpis?.lucroBrutoMes ?? 0)}
          icon={Banknote}
          delta={kpis?.deltaLucro}
          deltaLabel={`margem ${(kpis?.margemMes ?? 0).toFixed(1)}%`}
          status={statusFromDelta(kpis?.deltaLucro)}
          hint="estimado"
        />
        <KpiCard
          label="Saldo em caixa"
          value={brl(kpis?.saldoCaixa ?? 0)}
          icon={Wallet}
          deltaLabel={`${kpis?.caixasAbertos ?? 0} caixa(s) aberto(s)`}
          status={(kpis?.saldoCaixa ?? 0) > 0 ? "healthy" : "warning"}
        />
      </div>

      {/* Linha 2 — KPIs comerciais */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ticket médio · hoje"
          value={brl(kpis?.ticketDia ?? 0)}
          icon={Receipt}
          delta={kpis?.deltaTicket}
          deltaLabel="vs. ontem"
          status={statusFromDelta(kpis?.deltaTicket)}
        />
        <KpiCard
          label="Clientes atendidos"
          value={String(kpis?.clientes ?? 0)}
          icon={Users}
          deltaLabel={`${kpis?.cupons ?? 0} cupons emitidos`}
          status="neutral"
        />
        <KpiCard
          label="Fiado em aberto"
          value={brl(kpis?.fiadoTotal ?? 0)}
          icon={CreditCard}
          deltaLabel={`${kpis?.clientesFiado ?? 0} cliente(s)`}
          status={(kpis?.fiadoTotal ?? 0) > 0 ? "warning" : "healthy"}
        />
        <KpiCard
          label="Estoque crítico"
          value={String(kpis?.baixoEstoque.length ?? 0)}
          icon={AlertTriangle}
          deltaLabel="produtos abaixo do mínimo"
          status={(kpis?.baixoEstoque.length ?? 0) > 0 ? "critical" : "healthy"}
        />
      </div>

      {/* Linha 3 — Gráficos comparativos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Faturamento diário"
          description="Últimos 30 dias comparados ao mesmo período anterior"
          actions={<StatusPill status={statusFromDelta(kpis?.deltaMes)}>{periodLabel.mes}</StatusPill>}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie ?? []} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="gAtual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="anterior" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} fill="transparent" />
                <Area type="monotone" dataKey="atual" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gAtual)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Receita por hora" description="Padrão de movimento no mês corrente">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porHora ?? []} margin={{ top: 10, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="hora" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickFormatter={(v) => `${v / 1000}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Linha 4 — Operacional + Top produtos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Top 10 produtos do mês"
          description="Maior contribuição em receita"
        >
          {topProdutos && topProdutos.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {topProdutos.map((p, i) => (
                <li key={p.nome} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold font-display text-primary tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.nome}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{p.qtd.toFixed(0)} un.</span>
                  <span className="font-display font-semibold tabular-nums shrink-0 w-28 text-right">{brl(p.receita)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas no mês ainda.</p>
          )}
        </ChartCard>

        <div className="space-y-4">
          <ChartCard
            title="Alertas operacionais"
            description="Pontos de atenção imediata"
            actions={
              <Badge variant="outline" className="text-[10px]">
                {(kpis?.baixoEstoque.length ?? 0) + ((kpis?.fiadoTotal ?? 0) > 0 ? 1 : 0)} ativos
              </Badge>
            }
          >
            <div className="space-y-3">
              {(kpis?.baixoEstoque.length ?? 0) > 0 && (
                <AlertRow
                  status="critical"
                  icon={Package}
                  title={`${kpis?.baixoEstoque.length} produtos em estoque crítico`}
                  desc="Abaixo do estoque mínimo cadastrado"
                  to="/produtos"
                />
              )}
              {(kpis?.fiadoTotal ?? 0) > 0 && (
                <AlertRow
                  status="warning"
                  icon={CreditCard}
                  title={`${brl(kpis?.fiadoTotal ?? 0)} em fiado`}
                  desc={`${kpis?.clientesFiado} cliente(s) em aberto`}
                  to="/fiado"
                />
              )}
              {assinatura && assinatura.status !== "ativa" && (
                <AlertRow
                  status={assinatura.status === "em_carencia" ? "warning" : "critical"}
                  icon={Clock}
                  title={`Assinatura ${assinatura.status.replace("_", " ")}`}
                  desc={`${assinatura.diasRestantes} dia(s) restantes`}
                  to="/assinatura"
                />
              )}
              {(kpis?.baixoEstoque.length ?? 0) === 0 && (kpis?.fiadoTotal ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground py-2">Nenhum alerta — operação saudável. 👍</p>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Mini-tendência · 30d" description="Faturamento diário">
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie ?? []}>
                  <Line type="monotone" dataKey="atual" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    labelFormatter={(l) => `Dia ${l}`}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 11 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Linha 5 — Ações rápidas */}
      <div className="grid sm:grid-cols-3 gap-4">
        <QuickAction to="/pdv" external icon={ShoppingCart} title="Abrir PDV" desc="Iniciar nova venda" primary />
        <QuickAction to="/entradas" icon={Package} title="Lançar entrada" desc="Receber mercadoria" />
        <QuickAction to="/fiado" icon={Users} title="Receber fiado" desc="Quitar crediário" />
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        * Lucro bruto e margem são estimativas baseadas no custo atual cadastrado dos produtos. CMV real virá na próxima fase.
      </p>
    </div>
  );
}

function AlertRow({
  status, icon: Icon, title, desc, to,
}: {
  status: "warning" | "critical" | "healthy";
  icon: typeof Package;
  title: string;
  desc: string;
  to: string;
}) {
  const color = status === "critical" ? "var(--kpi-critical)" : status === "warning" ? "var(--kpi-warning)" : "var(--kpi-healthy)";
  return (
    <Link to={to} className="flex items-start gap-3 rounded-lg border border-border/60 p-2.5 hover:bg-muted/60 transition-colors">
      <div className="rounded-md p-1.5" style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </Link>
  );
}

function QuickAction({
  to, external, icon: Icon, title, desc, primary,
}: {
  to: string; external?: boolean; icon: typeof ShoppingCart; title: string; desc: string; primary?: boolean;
}) {
  const inner = (
    <div
      className={`group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${
        primary ? "text-primary-foreground border-transparent" : "bg-card border-border/60 hover:border-primary/40"
      }`}
      style={{
        background: primary ? "var(--gradient-primary)" : undefined,
        boxShadow: primary ? "var(--shadow-elevated)" : "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-7 w-7 ${primary ? "" : "text-primary"}`} />
        <ArrowRight className="h-4 w-4 opacity-60 group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="font-display font-bold text-lg mt-3">{title}</div>
      <div className={`text-sm ${primary ? "opacity-90" : "text-muted-foreground"}`}>{desc}</div>
    </div>
  );
  return external
    ? <a href={to} target="_blank" rel="noopener">{inner}</a>
    : <Link to={to}>{inner}</Link>;
}
