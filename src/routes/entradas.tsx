import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Trash2, Save, ArrowDownToLine } from "lucide-react";
import { brl, dtShort } from "@/lib/format";
import { toast } from "sonner";
import { aplicarMovimentacao } from "@/lib/estoque";

export const Route = createFileRoute("/entradas")({
  head: () => ({ meta: [{ title: "Entrada de Mercadoria — Mercadinho" }] }),
  component: EntradasPage,
});

type Item = { produto_id: string; produto_nome: string; quantidade: number; preco_custo: number; vendido_por_peso?: boolean; unidade?: string };

function EntradasPage() {
  const qc = useQueryClient();
  const [fornecedor_id, setFornecedor] = useState<string>("");
  const [numero_nota, setNumero] = useState("");
  const [data_entrada, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObs] = useState("");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-busca"],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, codigo_barras, preco_custo, unidade, vendido_por_peso").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-lista"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, razao_social").eq("ativo", true).order("razao_social")).data ?? [],
  });
  const { data: ultimas = [] } = useQuery({
    queryKey: ["notas-entrada"],
    queryFn: async () => (await supabase.from("notas_entrada").select("*, fornecedores(razao_social)").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  const sugestoes = busca.length >= 2 ? produtos.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo_barras ?? "").includes(busca)
  ).slice(0, 8) : [];

  const adicionar = (p: typeof produtos[number]) => {
    setItens((prev) => [...prev, {
      produto_id: p.id, produto_nome: p.nome, quantidade: 1,
      preco_custo: Number(p.preco_custo),
      vendido_por_peso: (p as { vendido_por_peso?: boolean }).vendido_por_peso ?? false,
      unidade: p.unidade,
    }]);
    setBusca("");
  };

  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_custo, 0);

  const salvar = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) throw new Error("Adicione ao menos 1 item");
      const { data: nota, error } = await supabase.from("notas_entrada").insert({
        numero_nota: numero_nota || null,
        fornecedor_id: fornecedor_id || null,
        data_entrada,
        valor_total: total,
        observacoes: observacoes || null,
      }).select().single();
      if (error) throw error;

      for (const it of itens) {
        await supabase.from("itens_nota_entrada").insert({
          nota_id: nota.id, produto_id: it.produto_id, quantidade: it.quantidade,
          preco_custo_unitario: it.preco_custo, subtotal: it.quantidade * it.preco_custo,
        });
        await aplicarMovimentacao({
          produto_id: it.produto_id, tipo: "entrada_compra", motivo: "compra",
          quantidade: it.quantidade, custo_unitario: it.preco_custo, referencia_id: nota.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Entrada lançada com sucesso");
      setItens([]); setNumero(""); setObs("");
      qc.invalidateQueries({ queryKey: ["notas-entrada"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Entrada de Mercadoria" description="Registre o recebimento de produtos do fornecedor (nota de compra)." />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" /> Nova nota de entrada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>Fornecedor</Label>
                <Select value={fornecedor_id} onValueChange={setFornecedor}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nº da nota</Label><Input value={numero_nota} onChange={(e) => setNumero(e.target.value)} /></div>
              <div><Label>Data</Label><Input type="date" value={data_entrada} onChange={(e) => setData(e.target.value)} /></div>
            </div>

            <div className="relative">
              <Label>Adicionar produto</Label>
              <Input placeholder="Digite nome ou código de barras..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              {sugestoes.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-elevated max-h-60 overflow-auto">
                  {sugestoes.map((p) => (
                    <button key={p.id} type="button" onClick={() => adicionar(p)} className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between text-sm">
                      <span>{p.nome}</span>
                      <span className="text-muted-foreground">{brl(p.preco_custo)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-28">Qtd</TableHead>
                  <TableHead className="w-32">Custo unit.</TableHead>
                  <TableHead className="text-right w-32">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum item adicionado</TableCell></TableRow>}
                {itens.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {it.produto_nome}
                      {it.vendido_por_peso && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">peso (kg)</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="0.001" value={it.quantidade}
                          onChange={(e) => setItens((prev) => prev.map((x, j) => j === i ? { ...x, quantidade: Number(e.target.value) } : x))} />
                        <span className="text-xs text-muted-foreground">{it.vendido_por_peso ? "kg" : (it.unidade ?? "")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={it.preco_custo}
                        onChange={(e) => setItens((prev) => prev.map((x, j) => j === i ? { ...x, preco_custo: Number(e.target.value) } : x))} />
                      {it.vendido_por_peso && <p className="text-[10px] text-muted-foreground mt-1">por kg</p>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{brl(it.quantidade * it.preco_custo)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setItens((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObs(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="h-fit sticky top-20">
          <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm"><span>Itens</span><span>{itens.length}</span></div>
            <div className="flex justify-between text-2xl font-bold border-t pt-3"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
            <Button className="w-full" size="lg" onClick={() => salvar.mutate()} disabled={salvar.isPending || itens.length === 0}>
              <Save className="h-4 w-4 mr-1" /> Lançar Entrada
            </Button>
            <p className="text-xs text-muted-foreground">A entrada soma o estoque dos produtos e atualiza o preço de custo automaticamente.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Últimas entradas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Data</TableHead><TableHead>Nº Nota</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ultimas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma entrada registrada</TableCell></TableRow>}
              {ultimas.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{dtShort(n.data_entrada)}</TableCell>
                  <TableCell className="font-mono text-xs">{n.numero_nota ?? "—"}</TableCell>
                  <TableCell>{n.fornecedores?.razao_social ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{brl(n.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Para registrar perdas, devoluções ou ajustes negativos, use a página <Link to="/saidas" className="text-primary hover:underline">Saída / Perda</Link>.
      </p>
    </div>
  );
}
