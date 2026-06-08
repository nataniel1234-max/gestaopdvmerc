import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, Layers } from "lucide-react";

export const Route = createFileRoute("/financeiro/classificacao")({
  head: () => ({ meta: [{ title: "Classificação Financeira — Mercadinho" }] }),
  component: ClassificacaoPage,
});

const COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899","#84CC16","#F97316","#14B8A6","#A855F7","#0EA5E9"];

function iso(d: Date) { return d.toISOString().slice(0, 10); }

function ClassificacaoPage() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [ini, setIni] = useState(iso(inicioMes));
  const [fim, setFim] = useState(iso(hoje));

  const { data: despesas = [] } = useQuery({
    queryKey: ["class-despesas", ini, fim],
    queryFn: async () => (await supabase
      .from("despesas")
      .select("valor, data, forma_pagamento, categorias_financeiras(nome, cor), centros_custo(nome)")
      .gte("data", ini).lte("data", fim)).data ?? [],
  });

  const { data: cp = [] } = useQuery({
    queryKey: ["class-cp", ini, fim],
    queryFn: async () => (await supabase
      .from("contas_pagar")
      .select("valor, data_vencimento, status, forma_pagamento, categorias_financeiras(nome, cor), centros_custo(nome)")
      .gte("data_vencimento", ini).lte("data_vencimento", fim)).data ?? [],
  });

  const { data: cr = [] } = useQuery({
    queryKey: ["class-cr", ini, fim],
    queryFn: async () => (await supabase
      .from("contas_receber")
      .select("valor, data_vencimento, status, forma_recebimento, categorias_financeiras(nome, cor)")
      .gte("data_vencimento", ini).lte("data_vencimento", fim)).data ?? [],
  });

  const totalDespesas = useMemo(() => despesas.reduce((s: number, r: any) => s + Number(r.valor), 0), [despesas]);
  const totalCP = useMemo(() => cp.reduce((s: number, r: any) => s + Number(r.valor), 0), [cp]);
  const totalCR = useMemo(() => cr.reduce((s: number, r: any) => s + Number(r.valor), 0), [cr]);
  const totalSaidas = totalDespesas + totalCP;
  const saldo = totalCR - totalSaidas;

  // Agregações
  function aggBy<T>(rows: any[], keyFn: (r: any) => string | null | undefined) {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = keyFn(r) || "Sem classificação";
      m.set(k, (m.get(k) ?? 0) + Number(r.valor));
    }
    return Array.from(m.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }

  const saidas = [...despesas, ...cp];
  const porCategoriaDespesa = aggBy(saidas, (r) => r.categorias_financeiras?.nome);
  const porCategoriaReceita = aggBy(cr, (r) => r.categorias_financeiras?.nome);
  const porCentroCusto     = aggBy(saidas, (r) => r.centros_custo?.nome);
  const porFormaPagamento  = aggBy(saidas, (r) => r.forma_pagamento);
  const porFormaRecebimento= aggBy(cr,    (r) => r.forma_recebimento);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>De</Label>
            <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" />
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            Resumo classificado por categoria, centro de custo e forma de pagamento.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receitas (contas a receber)" value={brl(totalCR)} icon={ArrowDownToLine} status="healthy" />
        <KpiCard label="Despesas pagas" value={brl(totalDespesas)} icon={ArrowUpFromLine} status="neutral" />
        <KpiCard label="Contas a pagar" value={brl(totalCP)} icon={Wallet} status="warning" />
        <KpiCard label="Saldo classificado" value={brl(saldo)} icon={Layers} status={saldo >= 0 ? "healthy" : "critical"} highlight />
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Por categoria</TabsTrigger>
          <TabsTrigger value="centros">Por centro de custo</TabsTrigger>
          <TabsTrigger value="formas">Por forma de pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Saídas por categoria" description="Despesas + contas a pagar">
              <PieDist data={porCategoriaDespesa} />
            </ChartCard>
            <ChartCard title="Receitas por categoria" description="Contas a receber">
              <PieDist data={porCategoriaReceita} />
            </ChartCard>
          </div>
          <BreakdownTable titulo="Saídas por categoria" data={porCategoriaDespesa} total={totalSaidas} />
          <BreakdownTable titulo="Receitas por categoria" data={porCategoriaReceita} total={totalCR} />
        </TabsContent>

        <TabsContent value="centros" className="space-y-6 mt-4">
          <ChartCard title="Saídas por centro de custo" description="Onde o dinheiro está sendo gasto">
            <BarDist data={porCentroCusto} />
          </ChartCard>
          <BreakdownTable titulo="Centros de custo" data={porCentroCusto} total={totalSaidas} />
        </TabsContent>

        <TabsContent value="formas" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Saídas por forma de pagamento" description="Como você paga seus compromissos">
              <PieDist data={porFormaPagamento} />
            </ChartCard>
            <ChartCard title="Recebimentos por forma" description="Como você recebe">
              <PieDist data={porFormaRecebimento} />
            </ChartCard>
          </div>
          <BreakdownTable titulo="Saídas por forma de pagamento" data={porFormaPagamento} total={totalSaidas} />
          <BreakdownTable titulo="Recebimentos por forma" data={porFormaRecebimento} total={totalCR} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PieDist({ data }: { data: { nome: string; total: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="nome" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => brl(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarDist({ data }: { data: { nome: string; total: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="nome" width={140} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return <div className="h-[280px] grid place-items-center text-sm text-muted-foreground">Sem dados no período</div>;
}

function BreakdownTable({ titulo, data, total }: { titulo: string; data: { nome: string; total: number }[]; total: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">{titulo}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classificação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">% do total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem lançamentos no período</TableCell></TableRow>
            ) : data.map((r) => (
              <TableRow key={r.nome}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{brl(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {total > 0 ? ((r.total / total) * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
