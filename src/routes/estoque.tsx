import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiCard } from "@/components/bi/KpiCard";
import { brl, dt } from "@/lib/format";
import { Boxes, Search, AlertTriangle, TrendingUp, PackageX, History } from "lucide-react";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque por Produto — Mercadinho" },
      { name: "description", content: "Posição individualizada de estoque: saldo, custo, valor de venda, margem e histórico de movimentações de cada produto." },
      { property: "og:title", content: "Estoque por Produto — Mercadinho" },
      { property: "og:description", content: "Controle individualizado de estoque com kardex por produto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstoquePage,
});

type Produto = {
  id: string; nome: string; codigo_barras: string | null; categoria: string | null;
  setor: string; unidade: string; vendido_por_peso: boolean;
  estoque_atual: number; estoque_minimo: number; preco_custo: number; preco_venda: number;
};

const qtd = (v: number, un: string) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${un}`;

function EstoquePage() {
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("todos");
  const [situacao, setSituacao] = useState("todas");
  const [sel, setSel] = useState<Produto | null>(null);

  const { data: produtos = [] } = useQuery({
    queryKey: ["estoque-produtos"],
    queryFn: async () =>
      ((await supabase
        .from("produtos")
        .select("id, nome, codigo_barras, categoria, setor, unidade, vendido_por_peso, estoque_atual, estoque_minimo, preco_custo, preco_venda")
        .eq("ativo", true)
        .order("nome")).data ?? []) as Produto[],
  });

  const setores = useMemo(() => Array.from(new Set(produtos.map((p) => p.setor).filter(Boolean))), [produtos]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (t && !(p.nome.toLowerCase().includes(t) || (p.codigo_barras ?? "").includes(t))) return false;
      if (setor !== "todos" && p.setor !== setor) return false;
      const e = Number(p.estoque_atual);
      if (situacao === "zerado" && e > 0) return false;
      if (situacao === "baixo" && !(e > 0 && e <= Number(p.estoque_minimo))) return false;
      if (situacao === "ok" && !(e > Number(p.estoque_minimo))) return false;
      return true;
    });
  }, [produtos, busca, setor, situacao]);

  const totCusto = produtos.reduce((s, p) => s + Number(p.estoque_atual) * Number(p.preco_custo), 0);
  const totVenda = produtos.reduce((s, p) => s + Number(p.estoque_atual) * Number(p.preco_venda), 0);
  const baixos = produtos.filter((p) => Number(p.estoque_atual) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo)).length;
  const zerados = produtos.filter((p) => Number(p.estoque_atual) <= 0).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Estoque" description="Posição individualizada por produto: saldo, custo imobilizado, potencial de venda e histórico de movimentações." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Estoque a custo" value={brl(totCusto)} hint="Capital imobilizado em mercadoria" status="neutral" />
        <KpiCard label="Potencial de venda" value={brl(totVenda)} hint={`Margem embutida: ${brl(totVenda - totCusto)}`} status="healthy" />
        <KpiCard label="Abaixo do mínimo" value={String(baixos)} hint="Produtos que precisam de reposição" status={baixos > 0 ? "warning" : "healthy"} />
        <KpiCard label="Sem estoque" value={String(zerados)} hint="Produtos zerados ou negativos" status={zerados > 0 ? "critical" : "healthy"} />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou código de barras..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as situações</SelectItem>
              <SelectItem value="ok">Estoque saudável</SelectItem>
              <SelectItem value="baixo">Abaixo do mínimo</SelectItem>
              <SelectItem value="zerado">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Custo un.</TableHead>
                <TableHead className="text-right">Venda un.</TableHead>
                <TableHead className="text-right">Total custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Kardex</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Nenhum produto encontrado</TableCell></TableRow>
              )}
              {lista.map((p) => {
                const e = Number(p.estoque_atual);
                const un = p.vendido_por_peso ? "kg" : p.unidade;
                const margem = Number(p.preco_venda) > 0 ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_venda)) * 100 : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.codigo_barras ?? "—"}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{p.setor}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={e <= 0 ? "text-destructive font-semibold" : e <= Number(p.estoque_minimo) ? "text-[color:var(--kpi-warning)] font-semibold" : ""}>
                        {qtd(e, un)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{qtd(Number(p.estoque_minimo), un)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.preco_custo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.preco_venda)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{brl(e * Number(p.preco_custo))}</TableCell>
                    <TableCell className="text-right tabular-nums">{margem.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setSel(p)}><History className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <KardexDialog produto={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function KardexDialog({ produto, onClose }: { produto: Produto | null; onClose: () => void }) {
  const { data: movs = [] } = useQuery({
    queryKey: ["kardex", produto?.id],
    enabled: !!produto,
    queryFn: async () =>
      (await supabase
        .from("movimentacoes_estoque")
        .select("*")
        .eq("produto_id", produto!.id)
        .order("created_at", { ascending: false })
        .limit(200)).data ?? [],
  });

  const un = produto ? (produto.vendido_por_peso ? "kg" : produto.unidade) : "";
  const entradas = movs.filter((m) => m.tipo === "entrada_compra").reduce((s, m) => s + Number(m.quantidade), 0);
  const saidas = movs.filter((m) => m.tipo === "saida_venda").reduce((s, m) => s + Number(m.quantidade), 0);
  const perdas = movs.filter((m) => m.tipo === "saida_perda").reduce((s, m) => s + Number(m.quantidade), 0);

  return (
    <Dialog open={!!produto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Boxes className="h-4 w-4" /> {produto?.nome}</DialogTitle></DialogHeader>
        {produto && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <Info label="Saldo atual" value={qtd(Number(produto.estoque_atual), un)} icon={Boxes} />
              <Info label="Entradas" value={qtd(entradas, un)} icon={TrendingUp} />
              <Info label="Vendas" value={qtd(saidas, un)} icon={History} />
              <Info label="Perdas / ajustes" value={qtd(perdas, un)} icon={PackageX} />
            </div>
            <div className="max-h-[50vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Saldo depois</TableHead>
                    <TableHead className="text-right">Custo un.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem movimentações registradas</TableCell></TableRow>}
                  {movs.map((m) => {
                    const entrada = m.tipo === "entrada_compra";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs">{dt(m.created_at)}</TableCell>
                        <TableCell><Badge variant={entrada ? "default" : "secondary"}>{String(m.tipo).replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-xs">{m.motivo}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${entrada ? "text-[color:var(--kpi-healthy)]" : "text-destructive"}`}>
                          {entrada ? "+" : "−"}{qtd(Number(m.quantidade), un)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{qtd(Number(m.estoque_novo), un)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.custo_unitario != null ? brl(m.custo_unitario) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {Number(produto.estoque_atual) <= Number(produto.estoque_minimo) && (
              <p className="text-xs flex items-center gap-1 text-[color:var(--kpi-warning)]">
                <AlertTriangle className="h-3 w-3" /> Estoque no limite ou abaixo do mínimo definido — considere repor.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
