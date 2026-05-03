import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpFromLine, Save } from "lucide-react";
import { brl, dt } from "@/lib/format";
import { toast } from "sonner";
import { aplicarMovimentacao } from "@/lib/estoque";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type MovTipo = Database["public"]["Enums"]["movimentacao_tipo"];
type MovMotivo = Database["public"]["Enums"]["movimentacao_motivo"];

export const Route = createFileRoute("/saidas")({
  head: () => ({ meta: [{ title: "Saída e Perdas — Mercadinho" }] }),
  component: SaidasPage,
});

const motivoLabel: Record<MovMotivo, string> = {
  compra: "Compra", venda: "Venda", troca: "Troca",
  vencido: "Vencido", roubo: "Roubo / furto", depreciacao: "Depreciação",
  furo_estoque: "Furo de estoque", outro: "Outro",
};

function SaidasPage() {
  const qc = useQueryClient();
  const [produto_id, setProduto] = useState("");
  const [tipo, setTipo] = useState<MovTipo>("saida_perda");
  const [motivo, setMotivo] = useState<MovMotivo>("vencido");
  const [quantidade, setQtd] = useState("1");
  const [observacoes, setObs] = useState("");
  const [busca, setBusca] = useState("");

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-busca"],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, codigo_barras, estoque_atual, unidade").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: ultimas = [] } = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async () => (await supabase.from("movimentacoes_estoque")
      .select("*, produtos(nome, unidade)")
      .in("tipo", ["saida_perda", "saida_troca", "ajuste"])
      .order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const sugestoes = busca.length >= 2 ? produtos.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo_barras ?? "").includes(busca)
  ).slice(0, 8) : [];

  const produtoSel = produtos.find((p) => p.id === produto_id);

  const motivosPorTipo: Record<MovTipo, MovMotivo[]> = {
    entrada_compra: ["compra"],
    saida_venda: ["venda"],
    saida_troca: ["troca"],
    saida_perda: ["vencido", "roubo", "depreciacao", "furo_estoque", "outro"],
    ajuste: ["furo_estoque", "outro"],
  };

  const lancar = useMutation({
    mutationFn: async () => {
      if (!produto_id) throw new Error("Selecione um produto");
      const q = Number(quantidade);
      if (q <= 0) throw new Error("Quantidade inválida");
      await aplicarMovimentacao({ produto_id, tipo, motivo, quantidade: q, observacoes: observacoes || null });
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      setProduto(""); setBusca(""); setQtd("1"); setObs("");
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Saída / Perda" description="Registre saídas que não são vendas: trocas, perdas, depreciação ou furo de estoque." />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4" /> Nova movimentação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Natureza do lançamento</Label>
                <Select value={tipo} onValueChange={(v: MovTipo) => { setTipo(v); setMotivo(motivosPorTipo[v][0]); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida_troca">Saída por Troca</SelectItem>
                    <SelectItem value="saida_perda">Saída por Perda</SelectItem>
                    <SelectItem value="ajuste">Ajuste de estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo</Label>
                <Select value={motivo} onValueChange={(v: MovMotivo) => setMotivo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {motivosPorTipo[tipo].map((m) => <SelectItem key={m} value={m}>{motivoLabel[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              <Label>Produto</Label>
              {produtoSel ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-accent/30">
                  <div>
                    <div className="font-medium">{produtoSel.nome}</div>
                    <div className="text-xs text-muted-foreground">Estoque atual: {Number(produtoSel.estoque_atual)} {produtoSel.unidade}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setProduto("")}>Trocar</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Buscar por nome ou código de barras..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                  {sugestoes.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-elevated max-h-60 overflow-auto">
                      {sugestoes.map((p) => (
                        <button key={p.id} type="button" onClick={() => { setProduto(p.id); setBusca(""); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                          {p.nome} <span className="text-muted-foreground">({Number(p.estoque_atual)} {p.unidade})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Quantidade</Label><Input type="number" step="0.001" value={quantidade} onChange={(e) => setQtd(e.target.value)} /></div>
              <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObs(e.target.value)} /></div>
            </div>

            <Button onClick={() => lancar.mutate()} disabled={lancar.isPending || !produto_id} size="lg" className="w-full">
              <Save className="h-4 w-4 mr-1" /> Registrar Movimentação
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Saída por Troca</strong>: produto trocado com fornecedor ou cliente.</p>
            <p>• <strong>Saída por Perda</strong>: vencido, roubo, depreciação ou furo de estoque.</p>
            <p>• <strong>Ajuste</strong>: correção de divergência de inventário.</p>
            <p className="pt-2 text-xs">Toda saída diminui o estoque e fica registrada no histórico.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Histórico de saídas e ajustes</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Estoque pós</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma movimentação</TableCell></TableRow>}
              {ultimas.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{dt(m.created_at)}</TableCell>
                  <TableCell>{m.produtos?.nome}</TableCell>
                  <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                  <TableCell><Badge variant={m.tipo === "saida_perda" ? "destructive" : "secondary"}>{motivoLabel[m.motivo]}</Badge></TableCell>
                  <TableCell className="text-right">{Number(m.quantidade)} {m.produtos?.unidade}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{Number(m.estoque_novo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
