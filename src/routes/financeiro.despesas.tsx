import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl, dtShort } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCategoriasFinanceiras, useCentrosCusto, useFormasPagamento } from "@/lib/predefinicoes";

export const Route = createFileRoute("/financeiro/despesas")({
  component: DespesasPage,
});

type Despesa = {
  id: string;
  descricao: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  observacoes: string | null;
};

function DespesasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Despesa | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () =>
      ((await supabase
        .from("despesas")
        .select("*, categorias_financeiras(nome, cor)")
        .order("data", { ascending: false })).data ?? []) as any[],
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["cat-fin-despesa"],
    queryFn: async () =>
      (await supabase.from("categorias_financeiras").select("id, nome, cor").eq("tipo", "despesa").order("nome")).data ?? [],
  });

  const total = lista.reduce((s, d) => s + Number(d.valor), 0);

  const save = useMutation({
    mutationFn: async (form: Partial<Despesa>) => {
      const payload = {
        descricao: form.descricao!,
        categoria_id: form.categoria_id || null,
        valor: Number(form.valor),
        data: form.data!,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
      };
      if (edit) {
        const { error } = await supabase.from("despesas").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Despesa salva");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["fin-despesas-30"] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["despesas"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{brl(total)}</span></span>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
              <TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa</TableCell></TableRow>
              ) : lista.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{dtShort(d.data)}</TableCell>
                  <TableCell className="font-medium">{d.descricao}</TableCell>
                  <TableCell>{d.categorias_financeiras?.nome ?? "—"}</TableCell>
                  <TableCell>{d.forma_pagamento ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{brl(d.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEdit(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remover.mutate(d.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DespesaDialog
        open={open}
        onOpenChange={(v: boolean) => { setOpen(v); if (!v) setEdit(null); }}
        edit={edit}
        categorias={categorias}
        onSave={(f: Partial<Despesa>) => save.mutate(f)}
        saving={save.isPending}
      />
    </div>
  );
}

function DespesaDialog({ open, onOpenChange, edit, categorias, onSave, saving }: any) {
  const [form, setForm] = useState<Partial<Despesa>>({});
  const setF = (k: keyof Despesa, v: any) => setForm((p) => ({ ...p, [k]: v }));
  if (open && form.descricao === undefined && edit) setForm(edit);
  if (!open && Object.keys(form).length > 0) setTimeout(() => setForm({}), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{edit ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Descrição *</Label><Input value={form.descricao ?? ""} onChange={(e) => setF("descricao", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setF("valor", e.target.value)} /></div>
            <div><Label>Data *</Label><Input type="date" value={form.data ?? new Date().toISOString().slice(0,10)} onChange={(e) => setF("data", e.target.value)} /></div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoria_id ?? "none"} onValueChange={(v) => setF("categoria_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Forma de pagamento</Label><Input value={form.forma_pagamento ?? ""} onChange={(e) => setF("forma_pagamento", e.target.value)} /></div>
          <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !form.descricao || !form.valor || !form.data} onClick={() => onSave(form)}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
