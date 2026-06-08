import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { Crown, Award, ShoppingBag } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

export const Route = createFileRoute("/financeiro/curva-abc")({
  component: CurvaABCPage,
});

function firstDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayIso() { return new Date().toISOString().slice(0, 10); }

const COLOR_A = "var(--kpi-healthy)";
const COLOR_B = "var(--primary)";
const COLOR_C = "var(--kpi-warning)";

function CurvaABCPage() {
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(todayIso());

  const { data: vendas = [] } = useQuery({
    queryKey: ["abc-vendas", inicio, fim],
    queryFn: async () => (await supabase.from("vendas").select("id").eq("cancelada", false)
      .gte("created_at", `${inicio}T00:00:00`).lte("created_at", `${fim}T23:59:59`)).data ?? [],
  });

  const vendaIds = vendas.map((v) => v.id);
  const { data: itens = [] } = useQuery({
    queryKey: ["abc-itens", vendaIds.length, inicio, fim],
    enabled: vendaIds.length > 0,
    queryFn: async () => (await supabase.from("itens_venda")
      .select("produto_id, produto_nome, quantidade, preco_unitario, subtotal").in("venda_id", vendaIds)).data ?? [],
  });

  const produtoIds = useMemo(() => Array.from(new Set(itens.map((i) => i.produto_id).filter(Boolean) as string[])), [itens]);
  const { data: produtos = [] } = useQuery({
    queryKey: ["abc-produtos", produtoIds.length],
    enabled: produtoIds.length > 0,
    queryFn: async () => (await supabase.from("produtos").select("id, nome, preco_custo, setor").in("id", produtoIds)).data ?? [],
  });
  const prodMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const ranking = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; setor: string; qtd: number; receita: number; custo: number }>();
    for (const i of itens) {
      const pid = i.produto_id as string;
      if (!pid) continue;
      const prod = prodMap.get(pid);
      const cur = map.get(pid) ?? { id: pid, nome: i.produto_nome ?? prod?.nome ?? "—", setor: prod?.setor ?? "outros", qtd: 0, receita: 0, custo: 0 };
      const qtd = Number(i.quantidade);
      cur.qtd += qtd;
      cur.receita += Number(i.subtotal);
      cur.custo += qtd * Number(prod?.preco_custo ?? 0);
      map.set(pid, cur);
    }
    const arr = Array.from(map.values()).map((r) => ({ ...r, lucro: r.receita - r.custo, margem: r.receita > 0 ? ((r.receita - r.custo) / r.receita) * 100 : 0 }));
    arr.sort((a, b) => b.receita - a.receita);
    const total = arr.reduce((s, r) => s + r.receita, 0);
    let acc = 0;
    return arr.map((r) => {
      acc += r.receita;
      const pctAcc = total > 0 ? (acc / total) * 100 : 0;
      const classe: "A" | "B" | "C" = pctAcc <= 80 ? "A" : pctAcc <= 95 ? "B" : "C";
      return { ...r, pctAcc, classe, pctReceita: total > 0 ? (r.receita / total) * 100 : 0 };
    });
  }, [itens, prodMap]);

  const totalReceita = ranking.reduce((s, r) => s + r.receita, 0);
  const totalLucro = ranking.reduce((s, r) => s + r.lucro, 0);
  const countA = ranking.filter((r) => r.classe === "A").length;
  const countB = ranking.filter((r) => r.classe === "B").length;
  const countC = ranking.filter((r) => r.classe === "C").length;
  const receitaA = ranking.filter((r) => r.classe === "A").reduce((s, r) => s + r.receita, 0);

  const top10 = ranking.slice(0, 10).map((r) => ({ nome: r.nome.length > 18 ? r.nome.slice(0, 17) + "…" : r.nome, receita: Number(r.receita.toFixed(2)), classe: r.classe }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" /></div>
          <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" /></div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setInicio(firstDayOfMonth()); setFim(todayIso()); }}>Mês</Button>
            <Button variant="outline" size="sm" onClick={() => { const y = new Date().getFullYear(); setInicio(`${y}-01-01`); setFim(todayIso()); }}>Ano</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita do período" value={brl(totalReceita)} icon={ShoppingBag} status="healthy" highlight />
        <KpiCard label="Lucro estimado" value={brl(totalLucro)} icon={Award} status={totalLucro >= 0 ? "healthy" : "critical"} />
        <KpiCard label="Produtos A (80% da receita)" value={String(countA)} icon={Crown} status="healthy" hint={`${brl(receitaA)} em vendas`} />
        <KpiCard label="Produtos B / C" value={`${countB} / ${countC}`} icon={ShoppingBag} status="neutral" hint="15% / 5% restantes" />
      </div>

      <ChartCard title="Top 10 produtos por receita" description="Cor por classificação ABC">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
            <YAxis type="category" dataKey="nome" width={140} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="receita" radius={[0, 6, 6, 0]}>
              {top10.map((d, i) => (
                <Cell key={i} fill={d.classe === "A" ? COLOR_A : d.classe === "B" ? COLOR_B : COLOR_C} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg">Curva ABC completa</h3>
              <p className="text-xs text-muted-foreground">{ranking.length} produtos vendidos no período</p>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge style={{ background: COLOR_A, color: "#fff" }}>A · 80%</Badge>
              <Badge style={{ background: COLOR_B, color: "#fff" }}>B · 15%</Badge>
              <Badge style={{ background: COLOR_C, color: "#fff" }}>C · 5%</Badge>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">% acum.</TableHead>
              <TableHead>Classe</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ranking.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem vendas no período</TableCell></TableRow>
              ) : ranking.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="capitalize text-xs text-muted-foreground">{r.setor}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qtd.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{brl(r.receita)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.lucro < 0 ? "text-[color:var(--kpi-critical)]" : ""}`}>{brl(r.lucro)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.margem.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.pctAcc.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Badge style={{ background: r.classe === "A" ? COLOR_A : r.classe === "B" ? COLOR_B : COLOR_C, color: "#fff" }}>{r.classe}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
