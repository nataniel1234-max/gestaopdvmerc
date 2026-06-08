import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { brl, dtShort } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { Plus, Trash2, AlertTriangle, TrendingDown, Package } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/financeiro/perdas")({
  component: PerdasPage,
});

type Perda = {
  id: string;
  produto_id: string;
  motivo: "vencimento" | "quebra" | "roubo" | "avaria" | "outro";
  quantidade: number;
  custo_unitario: number;
  valor_total: number;
  data: string;
  observacoes: string | null;
};

const MOTIVO_COR: Record<string, string> = {
  vencimento: "#ef4444",
  quebra: "#f59e0b",
  roubo: "#8b5cf6",
  avaria: "#06b6d4",
  outro: "#64748b",
};

function firstDayOfMonth() { return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10); }

function PerdasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState(firstDayOfMonth());
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));

  const { data: lista = [] } = useQuery({
    queryKey: ["perdas", inicio, fim],
    queryFn: async () =>
      ((await supabase.from("perdas")
        .select("*, produtos(nome, setor)")
        .gte("data", inicio).lte("data", fim)
        .order("data", { ascending: false })).data ?? []) as any[],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["perdas-produtos"],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, preco_custo").eq("ativo", true).order("nome")).data ?? [],
  });

  const totalPerdas = lista.reduce((s, p) => s + Number(p.valor_total), 0);
  const qtdPerdas = lista.length;

  const porMotivo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of lista) m.set(p.motivo, (m.get(p.motivo) ?? 0) + Number(p.valor_total));
    return Array.from(m.entries()).map(([motivo, valor]) => ({ motivo, valor: Number(valor.toFixed(2)) }));
  }, [lista]);

  const rankingProdutos = useMemo(() => {
    const m = new Map<string, { nome: string; setor: string; valor: number; qtd: number }>();
    for (const p of lista) {
      const k = p.produto_id;
      const cur = m.get(k) ?? { nome: p.produtos?.nome ?? "—", setor: p.produtos?.setor ?? "outros", valor: 0, qtd: 0 };
      cur.valor += Number(p.valor_total);
      cur.qtd += Number(p.quantidade);
      m.set(k, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [lista]);

  const save = useMutation({
    mutationFn: async (form: Partial<Perda>) => {
      const prod = produtos.find((p) => p.id === form.produto_id);
      const custo = Number(form.custo_unitario ?? prod?.preco_custo ?? 0);
      const qtd = Number(form.quantidade);
      const valor_total = custo * qtd;
      const { error } = await supabase.from("perdas").insert({
        produto_id: form.produto_id!,
        motivo: form.motivo!,
        quantidade: qtd,
        custo_unitario: custo,
        valor_total,
        data: form.data!,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda registrada");
      qc.invalidateQueries({ queryKey: ["perdas"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("perdas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["perdas"] }); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" /></div>
          <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" /></div>
          <Button className="ml-auto" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Registrar perda</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total de perdas" value={brl(totalPerdas)} icon={TrendingDown} status={totalPerdas > 0 ? "critical" : "healthy"} highlight />
        <KpiCard label="Ocorrências" value={String(qtdPerdas)} icon={AlertTriangle} status="warning" />
        <KpiCard label="Produtos afetados" value={String(rankingProdutos.length)} icon={Package} status="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Perdas por motivo" description="Distribuição do valor perdido">
          {porMotivo.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porMotivo} dataKey="valor" nameKey="motivo" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.motivo}>
                  {porMotivo.map((m, i) => <Cell key={i} fill={MOTIVO_COR[m.motivo] ?? "#64748b"} />)}
                </Pie>
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-display font-bold text-lg">Top 10 produtos com mais perdas</h3>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produto</TableHead><TableHead>Setor</TableHead>
                <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rankingProdutos.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                ) : rankingProdutos.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">{r.setor}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.qtd.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-[color:var(--kpi-critical)]">{brl(r.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-display font-bold text-lg">Histórico de perdas</h3>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Motivo</TableHead>
              <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Custo unit.</TableHead>
              <TableHead className="text-right">Valor</TableHead><TableHead>Obs.</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma perda registrada</TableCell></TableRow>
              ) : lista.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{dtShort(p.data)}</TableCell>
                  <TableCell className="font-medium">{p.produtos?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge style={{ background: MOTIVO_COR[p.motivo], color: "#fff" }} className="capitalize">{p.motivo}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(p.quantidade).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.custo_unitario)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-[color:var(--kpi-critical)]">{brl(p.valor_total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.observacoes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir esta perda?")) remover.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PerdaDialog open={open} onOpenChange={setOpen} produtos={produtos} onSave={(f) => save.mutate(f)} saving={save.isPending} />
    </div>
  );
}

function PerdaDialog({ open, onOpenChange, produtos, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void; produtos: any[];
  onSave: (f: Partial<Perda>) => void; saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Perda>>({ data: new Date().toISOString().slice(0, 10), motivo: "vencimento" });
  const setF = (k: keyof Perda, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const prod = produtos.find((p) => p.id === form.produto_id);
  const custoSugerido = Number(form.custo_unitario ?? prod?.preco_custo ?? 0);
  const valorTotal = Number(form.quantidade ?? 0) * custoSugerido;

  if (!open && Object.keys(form).length > 2) {
    setTimeout(() => setForm({ data: new Date().toISOString().slice(0, 10), motivo: "vencimento" }), 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar perda de mercadoria</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Produto *</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.produto_id ?? ""} onChange={(e) => setF("produto_id", e.target.value)}>
              <option value="">— Selecione —</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Motivo *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.motivo ?? "vencimento"} onChange={(e) => setF("motivo", e.target.value)}>
                <option value="vencimento">Vencimento</option>
                <option value="quebra">Quebra</option>
                <option value="roubo">Roubo</option>
                <option value="avaria">Avaria</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setF("data", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantidade *</Label><Input type="number" step="0.001" value={form.quantidade ?? ""} onChange={(e) => setF("quantidade", e.target.value)} /></div>
            <div>
              <Label>Custo unit.</Label>
              <Input type="number" step="0.01" value={form.custo_unitario ?? ""} onChange={(e) => setF("custo_unitario", e.target.value)} placeholder={prod ? brl(prod.preco_custo) : "0,00"} />
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Valor total da perda</span>
            <span className="font-bold text-[color:var(--kpi-critical)]">{brl(valorTotal)}</span>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !form.produto_id || !form.quantidade} onClick={() => onSave(form)}>{saving ? "Salvando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
