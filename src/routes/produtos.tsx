import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Barcode, AlertTriangle, Scale } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Mercadinho" }] }),
  component: ProdutosPage,
});

type ProdutoForm = {
  id?: string;
  nome: string;
  codigo_barras: string;
  categoria: string;
  unidade: string;
  preco_custo: string;
  preco_venda: string;
  estoque_atual: string;
  estoque_minimo: string;
  fornecedor_id: string | null;
  vendido_por_peso: boolean;
};

const empty: ProdutoForm = {
  nome: "", codigo_barras: "", categoria: "", unidade: "UN",
  preco_custo: "0", preco_venda: "0", estoque_atual: "0", estoque_minimo: "0", fornecedor_id: null,
  vendido_por_peso: false,
};

function ProdutosPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProdutoForm>(empty);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-lista"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, razao_social").eq("ativo", true).order("razao_social");
      return data ?? [];
    },
  });

  const filtrados = produtos.filter((p) => {
    const q = busca.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || (p.codigo_barras ?? "").includes(busca);
  });

  const salvar = useMutation({
    mutationFn: async (f: ProdutoForm) => {
      const payload = {
        nome: f.nome.trim(),
        codigo_barras: f.codigo_barras.trim() || null,
        categoria: f.categoria.trim() || null,
        unidade: f.vendido_por_peso ? "KG" : f.unidade,
        preco_custo: Number(f.preco_custo),
        preco_venda: Number(f.preco_venda),
        estoque_atual: Number(f.estoque_atual),
        estoque_minimo: Number(f.estoque_minimo),
        fornecedor_id: f.fornecedor_id,
        vendido_por_peso: f.vendido_por_peso,
      };
      if (f.id) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      setOpen(false); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto desativado"); qc.invalidateQueries({ queryKey: ["produtos"] }); },
  });

  const editar = (p: typeof produtos[number]) => {
    setForm({
      id: p.id, nome: p.nome, codigo_barras: p.codigo_barras ?? "",
      categoria: p.categoria ?? "", unidade: p.unidade,
      preco_custo: String(p.preco_custo), preco_venda: String(p.preco_venda),
      estoque_atual: String(p.estoque_atual), estoque_minimo: String(p.estoque_minimo),
      fornecedor_id: p.fornecedor_id,
      vendido_por_peso: (p as { vendido_por_peso?: boolean }).vendido_por_peso ?? false,
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Cadastro de mercadorias do mercadinho."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo produto</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Barcode className="h-3 w-3" /> Código de barras</Label>
                  <Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} placeholder="EAN-13 ou interno" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["UN", "KG", "G", "L", "ML", "CX", "PCT", "DZ"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={form.fornecedor_id ?? "none"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem fornecedor —</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preço de custo</Label>
                  <Input type="number" step="0.01" value={form.preco_custo}
                    onChange={(e) => {
                      const custo = e.target.value;
                      // Mantém margem ao mudar custo, recalcula venda
                      const c = Number(custo);
                      const v = Number(form.preco_venda);
                      if (c > 0 && v > 0) {
                        // se já tem venda, mantém venda e a margem se ajusta sozinha (campo derivado)
                        setForm({ ...form, preco_custo: custo });
                      } else {
                        setForm({ ...form, preco_custo: custo });
                      }
                    }} />
                </div>
                <div>
                  <Label>Margem (%)</Label>
                  <Input type="number" step="0.01"
                    value={(() => {
                      const c = Number(form.preco_custo);
                      const v = Number(form.preco_venda);
                      if (c > 0 && v > 0) return (((v - c) / c) * 100).toFixed(2);
                      return "";
                    })()}
                    onChange={(e) => {
                      const margem = Number(e.target.value);
                      const c = Number(form.preco_custo);
                      if (c > 0) {
                        const novoV = c * (1 + margem / 100);
                        setForm({ ...form, preco_venda: novoV.toFixed(2) });
                      }
                    }}
                    placeholder="Ex: 30" />
                </div>
                <div>
                  <Label>Preço de venda *</Label>
                  <Input type="number" step="0.01" value={form.preco_venda}
                    onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} />
                  {(() => {
                    const c = Number(form.preco_custo);
                    const v = Number(form.preco_venda);
                    if (c > 0 && v > 0) {
                      const lucro = v - c;
                      const m = ((lucro / c) * 100).toFixed(1);
                      return <p className="text-[10px] text-muted-foreground mt-1">Lucro: <strong>{lucro.toFixed(2)}</strong> ({m}%)</p>;
                    }
                    return null;
                  })()}
                </div>
                <div><Label>Estoque atual</Label><Input type="number" step="0.001" value={form.estoque_atual} onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })} /></div>
                <div><Label>Estoque mínimo</Label><Input type="number" step="0.001" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => salvar.mutate(form)} disabled={!form.nome || salvar.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou código de barras..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cód. Barras</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum produto cadastrado</TableCell></TableRow>
              )}
              {filtrados.map((p) => {
                const baixo = Number(p.estoque_atual) <= Number(p.estoque_minimo);
                return (
                  <TableRow key={p.id} className={!p.ativo ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="font-medium">{p.nome}</div>
                      {p.categoria && <div className="text-xs text-muted-foreground">{p.categoria}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.codigo_barras ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(p.preco_custo)}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(p.preco_venda)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {baixo && <AlertTriangle className="h-3 w-3 text-warning" />}
                        <Badge variant={baixo ? "destructive" : "secondary"}>{Number(p.estoque_atual)} {p.unidade}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => editar(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Desativar produto?")) excluir.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
