import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { TrendingUp, TrendingDown, Layers, AlertTriangle, Lightbulb } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/financeiro/setores")({
  component: SetoresPage,
});

const SETOR_LABELS: Record<string, string> = {
  hortifruti: "Hortifruti",
  frigorifico: "Frigorífico",
  cereais: "Cereais",
  lanchonete: "Lanchonete",
  assados: "Assados",
  mercearia: "Mercearia",
  conveniencia: "Conveniência",
  outros: "Outros",
};

const SETOR_COLORS: Record<string, string> = {
  hortifruti: "#16a34a",
  frigorifico: "#dc2626",
  cereais: "#ca8a04",
  lanchonete: "#ea580c",
  assados: "#a16207",
  mercearia: "#2563eb",
  conveniencia: "#7c3aed",
  outros: "#64748b",
};

function firstDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayIso() { return new Date().toISOString().slice(0, 10); }

type Linha = {
  setor: string;
  produtos: number;
  qtd: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  participacao: number;
  ticketMedio: number;
  perdas: number;
  estoqueValor: number;
  giro: number;
};

function SetoresPage() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayIso());

  const { data: vendas = [] } = useQuery({
    queryKey: ["setor-vendas", inicio, fim],
    queryFn: async () => (await supabase.from("vendas").select("id")
      .eq("cancelada", false)
      .gte("created_at", `${inicio}T00:00:00`)
      .lte("created_at", `${fim}T23:59:59`)).data ?? [],
  });

  const vendaIds = vendas.map((v) => v.id);
  const { data: itens = [] } = useQuery({
    queryKey: ["setor-itens", vendaIds.length, inicio, fim],
    enabled: vendaIds.length > 0,
    queryFn: async () => (await supabase.from("itens_venda")
      .select("produto_id, quantidade, subtotal").in("venda_id", vendaIds)).data ?? [],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["setor-produtos"],
    queryFn: async () => (await supabase.from("produtos")
      .select("id, nome, setor, preco_custo, preco_venda, estoque_atual, ativo")).data ?? [],
  });

  const { data: perdas = [] } = useQuery({
    queryKey: ["setor-perdas", inicio, fim],
    queryFn: async () => (await supabase.from("perdas")
      .select("produto_id, valor_total")
      .gte("data_perda", inicio).lte("data_perda", fim)).data ?? [],
  });

  const prodMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const linhas: Linha[] = useMemo(() => {
    const agg = new Map<string, Linha>();
    const ensure = (s: string) => {
      const k = s || "outros";
      let row = agg.get(k);
      if (!row) {
        row = { setor: k, produtos: 0, qtd: 0, receita: 0, custo: 0, lucro: 0, margem: 0, participacao: 0, ticketMedio: 0, perdas: 0, estoqueValor: 0, giro: 0 };
        agg.set(k, row);
      }
      return row;
    };

    for (const p of produtos) {
      if (!p.ativo) continue;
      const row = ensure((p.setor as string) ?? "outros");
      row.produtos += 1;
      row.estoqueValor += Number(p.estoque_atual ?? 0) * Number(p.preco_custo ?? 0);
    }

    for (const it of itens) {
      const prod = it.produto_id ? prodMap.get(it.produto_id) : null;
      const setor = (prod?.setor as string) ?? "outros";
      const row = ensure(setor);
      const qtd = Number(it.quantidade ?? 0);
      const receita = Number(it.subtotal ?? 0);
      const custo = qtd * Number(prod?.preco_custo ?? 0);
      row.qtd += qtd;
      row.receita += receita;
      row.custo += custo;
    }

    for (const pe of perdas) {
      const prod = pe.produto_id ? prodMap.get(pe.produto_id) : null;
      const setor = (prod?.setor as string) ?? "outros";
      const row = ensure(setor);
      row.perdas += Number(pe.valor_total ?? 0);
    }

    const arr = Array.from(agg.values());
    const totalReceita = arr.reduce((s, r) => s + r.receita, 0) || 1;
    for (const r of arr) {
      r.lucro = r.receita - r.custo;
      r.margem = r.receita > 0 ? (r.lucro / r.receita) * 100 : 0;
      r.participacao = (r.receita / totalReceita) * 100;
      r.ticketMedio = r.qtd > 0 ? r.receita / r.qtd : 0;
      r.giro = r.estoqueValor > 0 ? r.custo / r.estoqueValor : 0;
    }
    return arr.sort((a, b) => b.receita - a.receita);
  }, [itens, produtos, perdas, prodMap]);

  const totals = useMemo(() => {
    const receita = linhas.reduce((s, r) => s + r.receita, 0);
    const lucro = linhas.reduce((s, r) => s + r.lucro, 0);
    const perdasT = linhas.reduce((s, r) => s + r.perdas, 0);
    const estoque = linhas.reduce((s, r) => s + r.estoqueValor, 0);
    return {
      receita, lucro,
      margem: receita > 0 ? (lucro / receita) * 100 : 0,
      perdas: perdasT,
      estoque,
      setores: linhas.filter((l) => l.receita > 0).length,
    };
  }, [linhas]);

  const insights = useMemo(() => {
    const out: { tipo: "positivo" | "alerta" | "info"; titulo: string; descricao: string }[] = [];
    const ativos = linhas.filter((l) => l.receita > 0);
    if (ativos.length === 0) return out;

    const melhorMargem = [...ativos].sort((a, b) => b.margem - a.margem)[0];
    const piorMargem = [...ativos].sort((a, b) => a.margem - b.margem)[0];
    const maiorReceita = ativos[0];
    const mediaMargem = ativos.reduce((s, r) => s + r.margem, 0) / ativos.length;

    out.push({
      tipo: "positivo",
      titulo: `${SETOR_LABELS[melhorMargem.setor] ?? melhorMargem.setor} é o setor mais rentável`,
      descricao: `Margem de ${melhorMargem.margem.toFixed(1)}% — considere ampliar mix e exposição.`,
    });
    out.push({
      tipo: "info",
      titulo: `${SETOR_LABELS[maiorReceita.setor] ?? maiorReceita.setor} concentra ${maiorReceita.participacao.toFixed(0)}% do faturamento`,
      descricao: `Setor estratégico. Falhas de abastecimento aqui impactam o caixa.`,
    });
    if (piorMargem.margem < mediaMargem * 0.5 && piorMargem.receita > 0) {
      out.push({
        tipo: "alerta",
        titulo: `${SETOR_LABELS[piorMargem.setor] ?? piorMargem.setor} com margem baixa (${piorMargem.margem.toFixed(1)}%)`,
        descricao: `Revise precificação, custo de fornecedor ou estratégia de promoção.`,
      });
    }
    for (const l of ativos) {
      if (l.perdas > l.receita * 0.05 && l.receita > 0) {
        out.push({
          tipo: "alerta",
          titulo: `Perdas elevadas em ${SETOR_LABELS[l.setor] ?? l.setor}`,
          descricao: `R$ ${l.perdas.toFixed(2)} (${((l.perdas / l.receita) * 100).toFixed(1)}% do faturamento do setor).`,
        });
      }
      if (l.estoqueValor > 0 && l.giro < 0.3 && l.produtos > 2) {
        out.push({
          tipo: "alerta",
          titulo: `Estoque parado em ${SETOR_LABELS[l.setor] ?? l.setor}`,
          descricao: `Giro de ${l.giro.toFixed(2)}x no período — capital empatado em mercadoria.`,
        });
      }
    }
    return out;
  }, [linhas]);

  const chartData = linhas.filter((l) => l.receita > 0).map((l) => ({
    nome: SETOR_LABELS[l.setor] ?? l.setor,
    receita: Number(l.receita.toFixed(2)),
    lucro: Number(l.lucro.toFixed(2)),
    margem: Number(l.margem.toFixed(1)),
    setor: l.setor,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div>
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="text-sm text-muted-foreground ml-auto">
            Análise comparativa por setor — receita, lucro, margem, perdas e giro de estoque.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Setores ativos" value={String(totals.setores)} icon={<Layers className="h-4 w-4" />} />
        <KpiCard label="Receita total" value={brl(totals.receita)} icon={<TrendingUp className="h-4 w-4" />} status="healthy" />
        <KpiCard label="Lucro bruto" value={brl(totals.lucro)} hint={`Margem ${totals.margem.toFixed(1)}%`} status={totals.margem >= 25 ? "healthy" : totals.margem >= 15 ? "warning" : "critical"} />
        <KpiCard label="Perdas no período" value={brl(totals.perdas)} icon={<TrendingDown className="h-4 w-4" />} status={totals.perdas > totals.receita * 0.03 ? "critical" : "healthy"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Receita por setor" description="Participação no faturamento do período">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="receita" nameKey="nome" outerRadius={100} label={(e: any) => `${e.nome} ${((e.percent ?? 0) * 100).toFixed(0)}%`}>
                {chartData.map((e) => <Cell key={e.setor} fill={SETOR_COLORS[e.setor] ?? "#64748b"} />)}
              </Pie>
              <Tooltip formatter={(v: number) => brl(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Receita vs Lucro por setor" description="Comparativo absoluto">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => brl(v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend />
              <Bar dataKey="receita" fill="var(--primary)" name="Receita" />
              <Bar dataKey="lucro" fill="var(--kpi-healthy)" name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Margem (%) por setor">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="margem" name="Margem">
              {chartData.map((e) => <Cell key={e.setor} fill={SETOR_COLORS[e.setor] ?? "#64748b"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {insights.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Lightbulb className="h-4 w-4 text-primary" /> Inteligência comercial
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {insights.map((i, idx) => (
                <div key={idx} className={`rounded-md border p-3 flex gap-3 ${
                  i.tipo === "alerta" ? "border-destructive/40 bg-destructive/5" :
                  i.tipo === "positivo" ? "border-green-500/30 bg-green-500/5" :
                  "border-border bg-muted/30"
                }`}>
                  {i.tipo === "alerta" ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> :
                   i.tipo === "positivo" ? <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> :
                   <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                  <div className="text-sm">
                    <div className="font-medium">{i.titulo}</div>
                    <div className="text-muted-foreground">{i.descricao}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="font-semibold mb-3">Detalhamento por setor</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Qtd vendida</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Estoque (custo)</TableHead>
                  <TableHead className="text-right">Giro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.setor}>
                    <TableCell>
                      <Badge style={{ backgroundColor: SETOR_COLORS[l.setor] ?? "#64748b", color: "white" }}>
                        {SETOR_LABELS[l.setor] ?? l.setor}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{l.produtos}</TableCell>
                    <TableCell className="text-right">{l.qtd.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{brl(l.receita)}</TableCell>
                    <TableCell className="text-right">{brl(l.custo)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(l.lucro)}</TableCell>
                    <TableCell className="text-right">
                      <span className={l.margem >= 25 ? "text-green-600" : l.margem >= 15 ? "text-amber-600" : "text-destructive"}>
                        {l.margem.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{l.participacao.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{brl(l.perdas)}</TableCell>
                    <TableCell className="text-right">{brl(l.estoqueValor)}</TableCell>
                    <TableCell className="text-right">{l.giro.toFixed(2)}x</TableCell>
                  </TableRow>
                ))}
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Sem dados no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
