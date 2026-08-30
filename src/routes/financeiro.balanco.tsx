import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import {
  Wallet, Boxes, CreditCard, Landmark, TrendingUp, TrendingDown,
  Building2, Car, Cpu, Sparkles, PiggyBank, Banknote, AlertTriangle, CheckCircle2, Plus, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/financeiro/balanco")({
  component: BalancoPage,
});

const PIE_COLORS = ["#0EA5E9", "#6366F1", "#EF4444", "#F97316", "#10B981", "#A855F7"];

// ========== CATÁLOGOS ==========
const IMOB_CATS = [
  { v: "imovel", l: "Imóveis próprios", icon: Building2 },
  { v: "terreno", l: "Terrenos", icon: Building2 },
  { v: "veiculo", l: "Veículos", icon: Car },
  { v: "maquina", l: "Máquinas", icon: Cpu },
  { v: "equipamento", l: "Equipamentos", icon: Cpu },
  { v: "moveis", l: "Móveis e utensílios", icon: Boxes },
  { v: "computador", l: "Computadores", icon: Cpu },
  { v: "reforma", l: "Reformas / benfeitorias", icon: Building2 },
  { v: "outro", l: "Outro", icon: Boxes },
];
const INTANG_CATS = [
  { v: "marca", l: "Marca" },
  { v: "software", l: "Software" },
  { v: "patente", l: "Patente" },
  { v: "licenca", l: "Licença" },
  { v: "outro", l: "Outro" },
];
const INVEST_CATS = [
  { v: "participacao", l: "Participação societária" },
  { v: "aplicacao_longo", l: "Aplicação de longo prazo" },
  { v: "outro", l: "Outro investimento" },
];
const PLP_TIPOS = [
  { v: "financiamento", l: "Financiamento bancário" },
  { v: "emprestimo_longo", l: "Empréstimo de longo prazo" },
  { v: "parcelamento_tributario", l: "Parcelamento tributário" },
  { v: "parcelamento_trabalhista", l: "Parcelamento trabalhista" },
  { v: "divida_renegociada", l: "Dívida renegociada" },
  { v: "processo_judicial", l: "Processo judicial" },
  { v: "outro", l: "Outra obrigação" },
];
const BANCO_TIPOS = [
  { v: "caixa", l: "Caixa / tesouraria" },
  { v: "banco", l: "Conta bancária" },
  { v: "aplicacao", l: "Aplicação financeira" },
  { v: "outros_creditos", l: "Outros créditos" },
];
const PL_TIPOS = [
  { v: "capital_social", l: "Capital social" },
  { v: "reserva_legal", l: "Reserva legal" },
  { v: "reserva_lucros", l: "Reserva de lucros" },
  { v: "lucros_acumulados", l: "Lucros acumulados (manual)" },
  { v: "outro", l: "Outro" },
];

const lbl = (arr: { v: string; l: string }[], v: string) => arr.find((x) => x.v === v)?.l ?? v;

// ========== HOOKS ==========
function useTable<T = any>(tabela: string, key: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => ((await supabase.from(tabela as any).select("*").order("created_at", { ascending: false })).data ?? []) as T[],
  });
}

function BalancoPage() {
  // ===== Operacionais (já existentes) =====
  // Saldo dos caixas abertos calculado pela mesma fonte do fechamento
  // (vendas/movimentações vinculadas à sessão), não pelas colunas totalizadoras.
  const { data: caixaAtual = 0 } = useQuery({
    queryKey: ["bal-caixas"],
    queryFn: async () => {
      const { data } = await supabase.from("caixas").select("id, valor_abertura").eq("status", "aberto");
      const resumos = await Promise.all(
        (data ?? []).map((c) => carregarResumoCaixa(c.id, Number(c.valor_abertura ?? 0))),
      );
      return resumos.reduce((s, r) => s + r.saldoDinheiro, 0);
    },
  });


  const { data: produtos = [] } = useQuery({
    queryKey: ["bal-produtos"],
    queryFn: async () => (await supabase.from("produtos").select("estoque_atual, preco_custo, preco_venda").eq("ativo", true)).data ?? [],
  });
  const valorEstoque = produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.preco_custo ?? 0), 0);
  const valorEstoquePV = produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.preco_venda ?? 0), 0);

  const { data: clientes = [] } = useQuery({
    queryKey: ["bal-clientes"],
    queryFn: async () => (await supabase.from("clientes").select("saldo_devedor").gt("saldo_devedor", 0)).data ?? [],
  });
  const fiadoReceber = clientes.reduce((s, c) => s + Number(c.saldo_devedor), 0);

  const { data: cr = [] } = useQuery({
    queryKey: ["bal-cr"],
    queryFn: async () => (await supabase.from("contas_receber").select("valor, status").not("status", "in", "(recebida,cancelada)")).data ?? [],
  });
  const contasReceberAtivo = cr.reduce((s, c) => s + Number(c.valor), 0);

  const { data: cp = [] } = useQuery({
    queryKey: ["bal-cp"],
    queryFn: async () => (await supabase.from("contas_pagar").select("valor, status").not("status", "in", "(paga,cancelada)")).data ?? [],
  });
  const contasPagarPassivo = cp.reduce((s, c) => s + Number(c.valor), 0);

  const { data: dividas = [] } = useQuery({
    queryKey: ["bal-dividas"],
    queryFn: async () => (await supabase.from("dividas").select("credor, saldo_devedor, status, valor_parcela").in("status", ["ativa", "renegociada"])).data ?? [],
  });
  const dividasPassivoCurto = dividas.reduce((s, d) => s + Number(d.saldo_devedor), 0);

  // ===== Novas tabelas =====
  const { data: bancos = [] } = useTable<any>("contas_bancarias", "bal-bancos");
  const { data: imob = [] } = useTable<any>("ativos_imobilizado", "bal-imob");
  const { data: intang = [] } = useTable<any>("ativos_intangivel", "bal-intang");
  const { data: invest = [] } = useTable<any>("ativos_investimentos", "bal-invest");
  const { data: plp = [] } = useTable<any>("passivos_longo_prazo", "bal-plp");
  const { data: pl = [] } = useTable<any>("patrimonio_liquido", "bal-pl");

  const somaTipo = (t: string) => bancos.filter((b: any) => b.ativo && b.tipo === t).reduce((s: number, b: any) => s + Number(b.saldo), 0);
  const totalCaixaEmpresa = somaTipo("caixa");
  const totalBancos = somaTipo("banco");
  const totalAplicacoes = somaTipo("aplicacao");
  const totalOutrosCred = somaTipo("outros_creditos");

  const totalImob = imob.filter((i: any) => i.ativo).reduce((s: number, i: any) => s + (Number(i.valor_atual) - Number(i.depreciacao_acumulada ?? 0)), 0);
  const totalIntang = intang.filter((i: any) => i.ativo).reduce((s: number, i: any) => s + Number(i.valor_atualizado), 0);
  const totalInvest = invest.filter((i: any) => i.ativo).reduce((s: number, i: any) => s + Number(i.valor), 0);

  const totalPLPAtivas = plp.filter((p: any) => p.ativo).reduce((s: number, p: any) => s + Number(p.saldo_devedor), 0);
  const totalPLPInativas = plp.filter((p: any) => !p.ativo).reduce((s: number, p: any) => s + Number(p.saldo_devedor), 0);

  const capitalSocial = pl.filter((p: any) => p.tipo === "capital_social").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const reservas = pl.filter((p: any) => p.tipo === "reserva_legal" || p.tipo === "reserva_lucros").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const lucrosManuais = pl.filter((p: any) => p.tipo === "lucros_acumulados").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const outrosPL = pl.filter((p: any) => p.tipo === "outro").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const plRegistrado = capitalSocial + reservas + lucrosManuais + outrosPL;

  // ===== TOTAIS =====
  const ativoCirculante = caixaAtual + totalCaixaEmpresa + totalBancos + totalAplicacoes + valorEstoque + fiadoReceber + contasReceberAtivo + totalOutrosCred;
  const ativoNaoCirculante = totalImob + totalIntang + totalInvest;
  const ativoTotal = ativoCirculante + ativoNaoCirculante;

  const passivoCirculante = contasPagarPassivo + dividasPassivoCurto;
  const passivoNaoCirculante = totalPLPAtivas;
  const passivoTotal = passivoCirculante + passivoNaoCirculante;

  const patrimonioLiquidoCalc = ativoTotal - passivoTotal;
  const divergencia = Math.abs(plRegistrado - patrimonioLiquidoCalc);
  const divergenciaSig = plRegistrado > 0 && divergencia > 0.01;

  // ===== INDICADORES =====
  const liqCorrente = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : null;
  const liqGeral = (passivoCirculante + passivoNaoCirculante) > 0 ? (ativoCirculante + totalInvest) / (passivoCirculante + passivoNaoCirculante) : null;
  const endividamento = ativoTotal > 0 ? (passivoTotal / ativoTotal) * 100 : 0;
  const partCapTerceiros = patrimonioLiquidoCalc > 0 ? passivoTotal / patrimonioLiquidoCalc : null;
  const imobPL = patrimonioLiquidoCalc > 0 ? totalImob / patrimonioLiquidoCalc : null;
  const cdgProprio = patrimonioLiquidoCalc - ativoNaoCirculante;
  const solvencia = passivoTotal > 0 ? ativoTotal / passivoTotal : null;

  const pieData = useMemo(() => {
    const total = ativoTotal + passivoTotal + Math.max(patrimonioLiquidoCalc, 0);
    if (total === 0) return [];
    return [
      { name: "Ativo Circulante", value: ativoCirculante },
      { name: "Ativo Não Circulante", value: ativoNaoCirculante },
      { name: "Passivo Circulante", value: passivoCirculante },
      { name: "Passivo Não Circulante", value: passivoNaoCirculante },
      { name: "Patrimônio Líquido", value: Math.max(patrimonioLiquidoCalc, 0) },
    ].filter((d) => d.value > 0);
  }, [ativoCirculante, ativoNaoCirculante, passivoCirculante, passivoNaoCirculante, patrimonioLiquidoCalc, ativoTotal, passivoTotal]);

  return (
    <div className="space-y-6">
      {/* DASHBOARD EXECUTIVO */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Ativo Circulante" value={brl(ativoCirculante)} icon={Wallet} status="healthy" />
        <KpiCard label="Ativo Não Circulante" value={brl(ativoNaoCirculante)} icon={Building2} status="neutral" />
        <KpiCard label="Ativo Total" value={brl(ativoTotal)} icon={TrendingUp} status="healthy" highlight />
        <KpiCard label="Passivo Circulante" value={brl(passivoCirculante)} icon={CreditCard} status={passivoCirculante > ativoCirculante ? "critical" : "warning"} />
        <KpiCard label="Passivo Não Circulante" value={brl(passivoNaoCirculante)} icon={Landmark} status="neutral" />
        <KpiCard label="Passivo Total" value={brl(passivoTotal)} icon={TrendingDown} status={passivoTotal > ativoTotal ? "critical" : "neutral"} />
        <KpiCard label="Patrimônio Líquido" value={brl(patrimonioLiquidoCalc)} icon={Landmark} status={patrimonioLiquidoCalc >= 0 ? "healthy" : "critical"} highlight />
        <KpiCard label="Endividamento Geral" value={`${endividamento.toFixed(1)}%`} icon={AlertTriangle} status={endividamento >= 70 ? "critical" : endividamento >= 40 ? "warning" : "healthy"} hint="Passivo / Ativo" />
        <KpiCard label="Liquidez Corrente" value={liqCorrente == null ? "—" : liqCorrente.toFixed(2)} icon={CheckCircle2} status={liqCorrente == null ? "neutral" : liqCorrente >= 1.5 ? "healthy" : liqCorrente >= 1 ? "warning" : "critical"} hint="AC / PC" />
        <KpiCard label="Solvência Geral" value={solvencia == null ? "—" : solvencia.toFixed(2)} icon={CheckCircle2} status={solvencia == null ? "neutral" : solvencia >= 1.5 ? "healthy" : solvencia >= 1 ? "warning" : "critical"} hint="Ativo / Passivo" />
      </div>

      {/* VALIDAÇÃO CONTÁBIL */}
      {divergenciaSig && (
        <Card className="border-[color:var(--kpi-warning)]/40 bg-[color:var(--kpi-warning)]/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[color:var(--kpi-warning)] mt-0.5" />
            <div className="flex-1 text-sm">
              <strong>Divergência contábil detectada.</strong> O Patrimônio Líquido registrado ({brl(plRegistrado)}) difere do calculado por Ativo − Passivo ({brl(patrimonioLiquidoCalc)}).
              <span className="block text-xs text-muted-foreground mt-1">Diferença: {brl(divergencia)}. Ajuste os lançamentos de Capital Social, Reservas ou Lucros Acumulados.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="visao">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="bancos">Bancos & Aplicações</TabsTrigger>
          <TabsTrigger value="imob">Imobilizado</TabsTrigger>
          <TabsTrigger value="intang">Intangível</TabsTrigger>
          <TabsTrigger value="invest">Investimentos</TabsTrigger>
          <TabsTrigger value="plp">Passivo Longo Prazo</TabsTrigger>
          <TabsTrigger value="pl">Patrimônio Líquido</TabsTrigger>
          <TabsTrigger value="indic">Indicadores</TabsTrigger>
        </TabsList>

        {/* ===== VISÃO GERAL ===== */}
        <TabsContent value="visao" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-border bg-[color:var(--kpi-healthy)]/5">
                  <h3 className="font-display font-bold text-lg">Ativo</h3>
                  <p className="text-xs text-muted-foreground">O que o comércio possui</p>
                </div>
                <div className="divide-y divide-border">
                  <Section title="Ativo Circulante" />
                  <Line icon={Wallet} label="Caixa PDV (operacional)" value={caixaAtual} />
                  <Line icon={Wallet} label="Caixa da empresa (tesouraria)" value={totalCaixaEmpresa} />
                  <Line icon={Banknote} label="Bancos" value={totalBancos} />
                  <Line icon={PiggyBank} label="Aplicações financeiras" value={totalAplicacoes} />
                  <Line icon={Boxes} label="Estoque (custo)" value={valorEstoque} hint={`PV: ${brl(valorEstoquePV)}`} />
                  <Line icon={CreditCard} label="Fiado a receber" value={fiadoReceber} />
                  <Line icon={CreditCard} label="Contas a receber" value={contasReceberAtivo} />
                  <Line icon={CreditCard} label="Outros créditos" value={totalOutrosCred} />
                  <Line label="Subtotal Circulante" value={ativoCirculante} bold />

                  <Section title="Ativo Não Circulante" />
                  <Line icon={Building2} label="Imobilizado (líquido)" value={totalImob} />
                  <Line icon={Sparkles} label="Intangível" value={totalIntang} />
                  <Line icon={PiggyBank} label="Investimentos" value={totalInvest} />
                  <Line label="Subtotal Não Circulante" value={ativoNaoCirculante} bold />
                  <Line label="ATIVO TOTAL" value={ativoTotal} bold highlight="good" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-border bg-[color:var(--kpi-critical)]/5">
                  <h3 className="font-display font-bold text-lg">Passivo + Patrimônio Líquido</h3>
                  <p className="text-xs text-muted-foreground">Como o ativo está financiado</p>
                </div>
                <div className="divide-y divide-border">
                  <Section title="Passivo Circulante" />
                  <Line icon={CreditCard} label="Contas a pagar / fornecedores" value={contasPagarPassivo} />
                  <Line icon={Landmark} label="Dívidas (ativas e renegociadas)" value={dividasPassivoCurto} hint={dividas.length ? `${dividas.length} contrato(s)` : "Nenhum contrato lançado"} />
                  {dividas.map((d: any, i: number) => (
                    <Line key={i} label={`↳ ${d.credor}${d.status === "renegociada" ? " (renegociada)" : ""}`} value={Number(d.saldo_devedor)} />
                  ))}
                  <Line label="Subtotal Circulante" value={passivoCirculante} bold />

                  <Section title="Passivo Não Circulante" />
                  <Line icon={Landmark} label="Financiamentos / longo prazo (ativas)" value={totalPLPAtivas} />
                  {plp.filter((p: any) => p.ativo).map((p: any) => (
                    <Line key={p.id} label={`↳ ${lbl(PLP_TIPOS, p.tipo)} — ${p.credor}`} value={Number(p.saldo_devedor)} />
                  ))}
                  <Line icon={Landmark} label="Obrigações inativas (memória)" value={totalPLPInativas} hint="Quitadas/baixadas — não somam ao passivo" />
                  <Line label="Subtotal Não Circulante" value={passivoNaoCirculante} bold />
                  <Line label="PASSIVO TOTAL" value={passivoTotal} bold highlight="bad" />

                  <Section title="Patrimônio Líquido" />
                  <Line label="Capital social" value={capitalSocial} />
                  <Line label="Reservas" value={reservas} />
                  <Line label="Lucros acumulados (manuais)" value={lucrosManuais} />
                  {outrosPL > 0 && <Line label="Outros" value={outrosPL} />}
                  <Line label="PL registrado" value={plRegistrado} bold />
                  <Line label="PL calculado (Ativo − Passivo)" value={patrimonioLiquidoCalc} bold highlight={patrimonioLiquidoCalc >= 0 ? "good" : "bad"} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-display font-bold mb-2">Composição Patrimonial</h3>
              {pieData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para compor o gráfico.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(d: any) => `${((d.value / pieData.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => brl(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BANCOS ===== */}
        <TabsContent value="bancos" className="mt-4">
          <CrudBancos data={bancos} />
        </TabsContent>

        {/* ===== IMOBILIZADO ===== */}
        <TabsContent value="imob" className="mt-4">
          <CrudImob data={imob} />
        </TabsContent>

        {/* ===== INTANGÍVEL ===== */}
        <TabsContent value="intang" className="mt-4">
          <CrudIntang data={intang} />
        </TabsContent>

        {/* ===== INVESTIMENTOS ===== */}
        <TabsContent value="invest" className="mt-4">
          <CrudInvest data={invest} />
        </TabsContent>

        {/* ===== PASSIVO LP ===== */}
        <TabsContent value="plp" className="mt-4">
          <CrudPLP data={plp} />
        </TabsContent>

        {/* ===== PL ===== */}
        <TabsContent value="pl" className="mt-4">
          <CrudPL data={pl} />
        </TabsContent>

        {/* ===== INDICADORES ===== */}
        <TabsContent value="indic" className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Liquidez Corrente" value={liqCorrente == null ? "—" : liqCorrente.toFixed(2)} hint="AC ÷ PC — capacidade de honrar o curto prazo" status={liqCorrente == null ? "neutral" : liqCorrente >= 1.5 ? "healthy" : liqCorrente >= 1 ? "warning" : "critical"} />
            <KpiCard label="Liquidez Geral" value={liqGeral == null ? "—" : liqGeral.toFixed(2)} hint="(AC + Investimentos) ÷ Passivo Total" status={liqGeral == null ? "neutral" : liqGeral >= 1 ? "healthy" : "critical"} />
            <KpiCard label="Endividamento Geral" value={`${endividamento.toFixed(1)}%`} hint="Passivo ÷ Ativo" status={endividamento >= 70 ? "critical" : endividamento >= 40 ? "warning" : "healthy"} />
            <KpiCard label="Capital de Terceiros / PL" value={partCapTerceiros == null ? "—" : partCapTerceiros.toFixed(2)} hint="Passivo ÷ PL" status={partCapTerceiros == null ? "neutral" : partCapTerceiros <= 1 ? "healthy" : partCapTerceiros <= 2 ? "warning" : "critical"} />
            <KpiCard label="Imobilização do PL" value={imobPL == null ? "—" : `${(imobPL * 100).toFixed(1)}%`} hint="Imobilizado ÷ PL" status={imobPL == null ? "neutral" : imobPL <= 0.5 ? "healthy" : imobPL <= 1 ? "warning" : "critical"} />
            <KpiCard label="Capital de Giro Próprio" value={brl(cdgProprio)} hint="PL − Ativo Não Circulante" status={cdgProprio >= 0 ? "healthy" : "critical"} />
            <KpiCard label="Solvência Geral" value={solvencia == null ? "—" : solvencia.toFixed(2)} hint="Ativo ÷ Passivo" status={solvencia == null ? "neutral" : solvencia >= 1.5 ? "healthy" : solvencia >= 1 ? "warning" : "critical"} />
          </div>
          <Card>
            <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
              <p><strong>Cruzamento com a DRE:</strong> o lucro/prejuízo do período apurado na DRE deve ser lançado manualmente em <em>Patrimônio Líquido → Lucros acumulados</em> (positivo soma, negativo subtrai). O sistema valida automaticamente que <strong>Ativo Total = Passivo Total + Patrimônio Líquido</strong> e alerta quando há divergência.</p>
              <p>Toda venda impacta Caixa/Bancos ou Contas a Receber; toda compra impacta Estoque e Contas a Pagar; toda amortização reduz Passivo e Caixa; todo investimento em ativo permanente reduz Caixa e aumenta Imobilizado — esses fluxos já são refletidos automaticamente pelos módulos operacionais.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ========== AUX UI ==========
function Section({ title }: { title: string }) {
  return <div className="px-6 py-2 bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{title}</div>;
}
function Line({ icon: Icon, label, value, bold, hint, highlight }: { icon?: any; label: string; value: number; bold?: boolean; hint?: string; highlight?: "good" | "bad" }) {
  return (
    <div className={`flex items-center justify-between px-6 py-2.5 ${highlight === "good" ? "bg-[color:var(--kpi-healthy)]/5" : highlight === "bad" ? "bg-[color:var(--kpi-critical)]/5" : ""}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <div className={bold ? "font-bold" : "text-sm"}>{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div className={`tabular-nums ${bold ? "font-bold" : "text-sm font-medium"} ${value < 0 ? "text-[color:var(--kpi-critical)]" : ""}`}>{brl(value)}</div>
    </div>
  );
}

// ========== CRUD GENÉRICO ==========
function useCrud(tabela: string, key: string) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      if (id) {
        const { error } = await supabase.from(tabela as any).update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tabela as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: [key] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: [key] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  return { save, remove };
}

// ========== CRUD: Bancos ==========
function CrudBancos({ data }: { data: any[] }) {
  const { save, remove } = useCrud("contas_bancarias", "bal-bancos");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Bancos, aplicações e outros créditos</h3>
            <p className="text-xs text-muted-foreground">Compõem o ativo circulante</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Instituição</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Ativo</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{lbl(BANCO_TIPOS, b.tipo)}</TableCell>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell>{b.instituicao ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(b.saldo)}</TableCell>
                <TableCell>{b.ativo ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(b.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar conta" : "Nova conta"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "tipo", label: "Tipo", type: "select", options: BANCO_TIPOS, required: true, defaultValue: "banco" },
          { name: "nome", label: "Nome", type: "text", required: true },
          { name: "instituicao", label: "Instituição", type: "text" },
          { name: "saldo", label: "Saldo (R$)", type: "number", required: true, defaultValue: 0 },
          { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== CRUD: Imobilizado ==========
function CrudImob({ data }: { data: any[] }) {
  const { save, remove } = useCrud("ativos_imobilizado", "bal-imob");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Ativo Imobilizado</h3>
            <p className="text-xs text-muted-foreground">Imóveis, veículos, máquinas, equipamentos, móveis, computadores</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Aquisição</TableHead><TableHead className="text-right">Atual</TableHead><TableHead className="text-right">Deprec.</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{lbl(IMOB_CATS, i.categoria)}</TableCell>
                <TableCell className="font-medium">{i.descricao}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.valor_aquisicao)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.valor_atual)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.depreciacao_acumulada)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{brl(Number(i.valor_atual) - Number(i.depreciacao_acumulada ?? 0))}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar bem" : "Novo bem"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "categoria", label: "Categoria", type: "select", options: IMOB_CATS, required: true, defaultValue: "equipamento" },
          { name: "descricao", label: "Descrição", type: "text", required: true },
          { name: "valor_aquisicao", label: "Valor de aquisição (R$)", type: "number", defaultValue: 0 },
          { name: "valor_atual", label: "Valor atual (R$)", type: "number", required: true, defaultValue: 0 },
          { name: "data_aquisicao", label: "Data de aquisição", type: "date" },
          { name: "vida_util_anos", label: "Vida útil (anos)", type: "number" },
          { name: "depreciacao_acumulada", label: "Depreciação acumulada (R$)", type: "number", defaultValue: 0 },
          { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== CRUD: Intangível ==========
function CrudIntang({ data }: { data: any[] }) {
  const { save, remove } = useCrud("ativos_intangivel", "bal-intang");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Ativo Intangível</h3>
            <p className="text-xs text-muted-foreground">Marca, software, patentes, licenças</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Registrado</TableHead><TableHead className="text-right">Atualizado</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{lbl(INTANG_CATS, i.categoria)}</TableCell>
                <TableCell className="font-medium">{i.descricao}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.valor_registrado)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.valor_atualizado)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar intangível" : "Novo intangível"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "categoria", label: "Categoria", type: "select", options: INTANG_CATS, required: true, defaultValue: "software" },
          { name: "descricao", label: "Descrição", type: "text", required: true },
          { name: "valor_registrado", label: "Valor registrado (R$)", type: "number", defaultValue: 0 },
          { name: "valor_atualizado", label: "Valor atualizado (R$)", type: "number", required: true, defaultValue: 0 },
          { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== CRUD: Investimentos ==========
function CrudInvest({ data }: { data: any[] }) {
  const { save, remove } = useCrud("ativos_investimentos", "bal-invest");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Investimentos</h3>
            <p className="text-xs text-muted-foreground">Participações societárias, aplicações de longo prazo</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{lbl(INVEST_CATS, i.categoria)}</TableCell>
                <TableCell className="font-medium">{i.descricao}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(i.valor)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar investimento" : "Novo investimento"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "categoria", label: "Categoria", type: "select", options: INVEST_CATS, required: true, defaultValue: "aplicacao_longo" },
          { name: "descricao", label: "Descrição", type: "text", required: true },
          { name: "valor", label: "Valor (R$)", type: "number", required: true, defaultValue: 0 },
          { name: "ativo", label: "Ativo", type: "switch", defaultValue: true },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== CRUD: Passivo Longo Prazo ==========
function CrudPLP({ data }: { data: any[] }) {
  const { save, remove } = useCrud("passivos_longo_prazo", "bal-plp");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Passivo Não Circulante</h3>
            <p className="text-xs text-muted-foreground">Financiamentos, parcelamentos e obrigações de longo prazo. Dívidas inativas não impactam fluxo de caixa, mas permanecem no passivo.</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Credor</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Juros</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{lbl(PLP_TIPOS, d.tipo)}</TableCell>
                <TableCell className="font-medium">{d.credor}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(d.valor_original)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(d.saldo_devedor)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.taxa_juros != null ? `${Number(d.taxa_juros).toFixed(2)}%` : "—"}</TableCell>
                <TableCell>{d.ativo ? <Badge variant="default">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(d.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar dívida" : "Nova dívida"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "tipo", label: "Tipo", type: "select", options: PLP_TIPOS, required: true, defaultValue: "financiamento" },
          { name: "credor", label: "Credor", type: "text", required: true },
          { name: "valor_original", label: "Valor original (R$)", type: "number", defaultValue: 0 },
          { name: "saldo_devedor", label: "Saldo devedor (R$)", type: "number", required: true, defaultValue: 0 },
          { name: "taxa_juros", label: "Taxa de juros (% a.m.)", type: "number" },
          { name: "data_contratacao", label: "Data de contratação", type: "date" },
          { name: "data_vencimento_final", label: "Vencimento final", type: "date" },
          { name: "ativo", label: "Ativa (impacta fluxo de caixa)", type: "switch", defaultValue: true },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== CRUD: Patrimônio Líquido ==========
function CrudPL({ data }: { data: any[] }) {
  const { save, remove } = useCrud("patrimonio_liquido", "bal-pl");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Patrimônio Líquido</h3>
            <p className="text-xs text-muted-foreground">Capital social, reservas e lucros acumulados. O lucro/prejuízo da DRE deve ser lançado aqui como "Lucros acumulados".</p>
          </div>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground italic">Nenhum registro</TableCell></TableRow>}
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{lbl(PL_TIPOS, p.tipo)}</TableCell>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell className={`text-right tabular-nums ${Number(p.valor) < 0 ? "text-[color:var(--kpi-critical)]" : ""}`}>{brl(p.valor)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar lançamento" : "Novo lançamento"} initial={edit} onSave={(f) => save.mutate(f, { onSuccess: () => setOpen(false) })}
        fields={[
          { name: "tipo", label: "Tipo", type: "select", options: PL_TIPOS, required: true, defaultValue: "capital_social" },
          { name: "descricao", label: "Descrição", type: "text", required: true },
          { name: "valor", label: "Valor (R$) — negativo para prejuízo", type: "number", required: true, defaultValue: 0 },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]} />
    </Card>
  );
}

// ========== FORM DIALOG GENÉRICO ==========
type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select" | "switch";
  options?: { v: string; l: string }[];
  required?: boolean;
  defaultValue?: any;
};

function FormDialog({ open, onOpenChange, title, fields, initial, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  fields: Field[]; initial: any | null; onSave: (data: any) => void;
}) {
  const [form, setForm] = useState<any>({});
  // reset when dialog opens
  const key = `${open}-${initial?.id ?? "new"}`;
  useMemo(() => {
    if (open) {
      const base: any = {};
      fields.forEach((f) => { base[f.name] = initial?.[f.name] ?? f.defaultValue ?? (f.type === "switch" ? false : ""); });
      if (initial?.id) base.id = initial.id;
      setForm(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const submit = () => {
    for (const f of fields) {
      if (f.required && (form[f.name] === "" || form[f.name] == null)) {
        toast.error(`Campo obrigatório: ${f.label}`); return;
      }
    }
    const payload: any = { ...form };
    fields.forEach((f) => {
      if (f.type === "number") payload[f.name] = payload[f.name] === "" || payload[f.name] == null ? null : Number(payload[f.name]);
      if (f.type === "date" && payload[f.name] === "") payload[f.name] = null;
      if (f.type === "text" && payload[f.name] === "") payload[f.name] = null;
      if (f.type === "textarea" && payload[f.name] === "") payload[f.name] = null;
    });
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <Label>{f.label}{f.required && <span className="text-[color:var(--kpi-critical)]"> *</span>}</Label>
              {f.type === "text" && <Input value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}
              {f.type === "number" && <Input type="number" step="0.01" value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}
              {f.type === "date" && <Input type="date" value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}
              {f.type === "textarea" && <Textarea value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}
              {f.type === "select" && (
                <Select value={form[f.name] ?? ""} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{f.options!.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {f.type === "switch" && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={!!form[f.name]} onCheckedChange={(v) => setForm({ ...form, [f.name]: v })} />
                  <span className="text-sm text-muted-foreground">{form[f.name] ? "Sim" : "Não"}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
