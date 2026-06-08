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
import { Badge } from "@/components/ui/badge";
import { brl, dtShort } from "@/lib/format";
import { toast } from "sonner";
import { Plus, CheckCircle2, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/financeiro/contas-pagar")({
  component: ContasPagarPage,
});

type ContaPagar = {
  id: string;
  descricao: string;
  fornecedor_id: string | null;
  categoria_id: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: "pendente" | "paga" | "atrasada" | "cancelada";
  forma_pagamento: string | null;
  observacoes: string | null;
};

function ContasPagarPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ContaPagar | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pendente" | "paga" | "atrasada">("todas");

  const { data: lista = [] } = useQuery({
    queryKey: ["contas_pagar"],
    queryFn: async () =>
      ((await supabase
        .from("contas_pagar")
        .select("*, fornecedores(nome), categorias_financeiras(nome, cor)")
        .order("data_vencimento")).data ?? []) as any[],
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-min"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").order("nome")).data ?? [],
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["cat-fin-despesa"],
    queryFn: async () =>
      (await supabase.from("categorias_financeiras").select("id, nome, cor").eq("tipo", "despesa").order("nome")).data ?? [],
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const exibidas = lista.filter((c) => {
    if (filtro === "todas") return true;
    if (filtro === "atrasada") return c.status !== "paga" && c.status !== "cancelada" && c.data_vencimento < hoje;
    return c.status === filtro;
  });

  const total = exibidas.reduce((s, c) => s + Number(c.valor), 0);

  const save = useMutation({
    mutationFn: async (form: Partial<ContaPagar>) => {
      const payload = {
        descricao: form.descricao!,
        fornecedor_id: form.fornecedor_id || null,
        categoria_id: form.categoria_id || null,
        valor: Number(form.valor),
        data_vencimento: form.data_vencimento!,
        status: form.status ?? "pendente",
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
      };
      if (edit) {
        const { error } = await supabase.from("contas_pagar").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_pagar").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Conta atualizada" : "Conta cadastrada");
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
      qc.invalidateQueries({ queryKey: ["fin-cp-proj"] });
      setOpen(false);
      setEdit(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const marcarPaga = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_pagar")
        .update({ status: "paga", data_pagamento: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta paga");
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
      qc.invalidateQueries({ queryKey: ["fin-cp-proj"] });
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_pagar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida");
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["todas", "pendente", "atrasada", "paga"] as const).map((f) => (
            <Button
              key={f}
              variant={filtro === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltro(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground">{brl(total)}</span>
          </span>
          <Button onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exibidas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma conta encontrada</TableCell></TableRow>
              ) : exibidas.map((c) => {
                const atrasada = c.status !== "paga" && c.status !== "cancelada" && c.data_vencimento < hoje;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell>{c.fornecedores?.nome ?? "—"}</TableCell>
                    <TableCell>{c.categorias_financeiras?.nome ?? "—"}</TableCell>
                    <TableCell>{dtShort(c.data_vencimento)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{brl(c.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "paga" ? "default" : atrasada ? "destructive" : "secondary"}>
                        {c.status === "paga" ? "Paga" : atrasada ? "Atrasada" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.status !== "paga" && (
                          <Button size="icon" variant="ghost" onClick={() => marcarPaga.mutate(c.id)} title="Marcar como paga">
                            <CheckCircle2 className="h-4 w-4 text-[color:var(--kpi-healthy)]" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir esta conta?")) remover.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContaPagarDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}
        edit={edit}
        fornecedores={fornecedores}
        categorias={categorias}
        onSave={(f) => save.mutate(f)}
        saving={save.isPending}
      />
    </div>
  );
}

function ContaPagarDialog({
  open, onOpenChange, edit, fornecedores, categorias, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit: ContaPagar | null;
  fornecedores: any[];
  categorias: any[];
  onSave: (f: Partial<ContaPagar>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<ContaPagar>>({});
  const setF = <K extends keyof ContaPagar>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // sync when opening
  if (open && form.descricao === undefined && edit) {
    setForm(edit);
  }
  if (!open && Object.keys(form).length > 0) {
    setTimeout(() => setForm({}), 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{edit ? "Editar conta" : "Nova conta a pagar"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Descrição *</Label>
            <Input value={form.descricao ?? ""} onChange={(e) => setF("descricao", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setF("valor", e.target.value)} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={form.data_vencimento ?? ""} onChange={(e) => setF("data_vencimento", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fornecedor</Label>
              <Select value={form.fornecedor_id ?? "none"} onValueChange={(v) => setF("fornecedor_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria_id ?? "none"} onValueChange={(v) => setF("categoria_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Input value={form.forma_pagamento ?? ""} onChange={(e) => setF("forma_pagamento", e.target.value)} placeholder="Ex: PIX, Boleto…" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} onClick={() => onSave(form)}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
