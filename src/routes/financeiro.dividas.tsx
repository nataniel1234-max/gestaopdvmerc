import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { brl, dtShort } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/financeiro/dividas")({
  component: DividasPage,
});

type Divida = {
  id: string;
  credor: string;
  descricao: string | null;
  valor_original: number;
  saldo_devedor: number;
  taxa_juros_mensal: number;
  data_inicio: string;
  parcelas_total: number | null;
  parcelas_pagas: number;
  valor_parcela: number | null;
  status: "ativa" | "quitada" | "renegociada";
  observacoes: string | null;
};

function DividasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Divida | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: ["dividas"],
    queryFn: async () => (await supabase.from("dividas").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const totalSaldo = lista.reduce((s, d) => s + Number(d.saldo_devedor), 0);
  const totalParcela = lista.filter(d => d.status === "ativa").reduce((s, d) => s + Number(d.valor_parcela ?? 0), 0);

  const save = useMutation({
    mutationFn: async (form: Partial<Divida>) => {
      const payload = {
        credor: form.credor!,
        descricao: form.descricao || null,
        valor_original: Number(form.valor_original),
        saldo_devedor: Number(form.saldo_devedor ?? form.valor_original),
        taxa_juros_mensal: Number(form.taxa_juros_mensal ?? 0),
        data_inicio: form.data_inicio!,
        parcelas_total: form.parcelas_total ? Number(form.parcelas_total) : null,
        parcelas_pagas: Number(form.parcelas_pagas ?? 0),
        valor_parcela: form.valor_parcela ? Number(form.valor_parcela) : null,
        status: form.status ?? "ativa",
        observacoes: form.observacoes || null,
      };
      if (edit) {
        const { error } = await supabase.from("dividas").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dividas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dívida salva");
      qc.invalidateQueries({ queryKey: ["dividas"] });
      qc.invalidateQueries({ queryKey: ["fin-dividas"] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dividas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["dividas"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-6 text-sm">
          <div><span className="text-muted-foreground">Saldo total: </span><span className="font-bold">{brl(totalSaldo)}</span></div>
          <div><span className="text-muted-foreground">Parcela mensal: </span><span className="font-bold">{brl(totalParcela)}</span></div>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova dívida</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Credor</TableHead><TableHead>Início</TableHead>
              <TableHead className="text-right">Original</TableHead><TableHead className="text-right">Saldo</TableHead>
              <TableHead>Parcelas</TableHead><TableHead className="text-right">Parcela</TableHead>
              <TableHead className="text-right">Juros/mês</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma dívida cadastrada</TableCell></TableRow>
              ) : lista.map((d) => {
                const pct = d.parcelas_total ? (d.parcelas_pagas / d.parcelas_total) * 100 : 0;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.credor}</div>
                      {d.descricao && <div className="text-xs text-muted-foreground">{d.descricao}</div>}
                    </TableCell>
                    <TableCell>{dtShort(d.data_inicio)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(d.valor_original)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{brl(d.saldo_devedor)}</TableCell>
                    <TableCell className="min-w-[140px]">
                      {d.parcelas_total ? (
                        <div className="space-y-1">
                          <div className="text-xs">{d.parcelas_pagas}/{d.parcelas_total}</div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.valor_parcela ? brl(d.valor_parcela) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(d.taxa_juros_mensal).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "quitada" ? "default" : d.status === "renegociada" ? "secondary" : "destructive"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEdit(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) remover.mutate(d.id); }}>
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

      <DividaDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}
        edit={edit}
        onSave={(f) => save.mutate(f)}
        saving={save.isPending}
      />
    </div>
  );
}

function DividaDialog({ open, onOpenChange, edit, onSave, saving }: any) {
  const [form, setForm] = useState<Partial<Divida>>({});
  const setF = (k: keyof Divida, v: any) => setForm((p) => ({ ...p, [k]: v }));
  if (open && form.credor === undefined && edit) setForm(edit);
  if (!open && Object.keys(form).length > 0) setTimeout(() => setForm({}), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{edit ? "Editar dívida" : "Nova dívida"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Credor *</Label><Input value={form.credor ?? ""} onChange={(e) => setF("credor", e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={form.descricao ?? ""} onChange={(e) => setF("descricao", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor original *</Label><Input type="number" step="0.01" value={form.valor_original ?? ""} onChange={(e) => setF("valor_original", e.target.value)} /></div>
            <div><Label>Saldo devedor</Label><Input type="number" step="0.01" value={form.saldo_devedor ?? ""} onChange={(e) => setF("saldo_devedor", e.target.value)} placeholder="= original se vazio" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Data início *</Label><Input type="date" value={form.data_inicio ?? new Date().toISOString().slice(0,10)} onChange={(e) => setF("data_inicio", e.target.value)} /></div>
            <div><Label>Juros %/mês</Label><Input type="number" step="0.01" value={form.taxa_juros_mensal ?? ""} onChange={(e) => setF("taxa_juros_mensal", e.target.value)} /></div>
            <div><Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status ?? "ativa"} onChange={(e) => setF("status", e.target.value)}>
                <option value="ativa">Ativa</option><option value="quitada">Quitada</option><option value="renegociada">Renegociada</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Parcelas total</Label><Input type="number" value={form.parcelas_total ?? ""} onChange={(e) => setF("parcelas_total", e.target.value)} /></div>
            <div><Label>Parcelas pagas</Label><Input type="number" value={form.parcelas_pagas ?? 0} onChange={(e) => setF("parcelas_pagas", e.target.value)} /></div>
            <div><Label>Valor parcela</Label><Input type="number" step="0.01" value={form.valor_parcela ?? ""} onChange={(e) => setF("valor_parcela", e.target.value)} /></div>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !form.credor || !form.valor_original || !form.data_inicio} onClick={() => onSave(form)}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
