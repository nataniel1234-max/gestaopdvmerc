import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidarTudo } from "@/lib/sync";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Mercadinho" }] }),
  component: ClientesPage,
});

type Form = {
  id?: string; nome: string; documento: string; telefone: string; email: string;
  endereco: string; limite_credito: string; permite_fiado: boolean; observacoes: string;
};
const empty: Form = { nome: "", documento: "", telefone: "", email: "", endereco: "", limite_credito: "0", permite_fiado: false, observacoes: "" };

function ClientesPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtrados = clientes.filter((c) => {
    const q = busca.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || (c.documento ?? "").includes(busca) || (c.telefone ?? "").includes(busca);
  });

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        nome: f.nome.trim(), documento: f.documento.trim() || null,
        telefone: f.telefone.trim() || null, email: f.email.trim() || null,
        endereco: f.endereco.trim() || null,
        limite_credito: Number(f.limite_credito), permite_fiado: f.permite_fiado,
        observacoes: f.observacoes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Cliente salvo"); invalidarTudo(qc); setOpen(false); setForm(empty); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente desativado"); invalidarTudo(qc); },
  });

  const editar = (c: typeof clientes[number]) => {
    setForm({
      id: c.id, nome: c.nome, documento: c.documento ?? "", telefone: c.telefone ?? "",
      email: c.email ?? "", endereco: c.endereco ?? "",
      limite_credito: String(c.limite_credito), permite_fiado: c.permite_fiado,
      observacoes: c.observacoes ?? "",
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes e controle de crediário (fiado)."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo cliente</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>CPF / CNPJ</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
                <div><Label>Limite de crédito (R$)</Label><Input type="number" step="0.01" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch id="fiado" checked={form.permite_fiado} onCheckedChange={(v) => setForm({ ...form, permite_fiado: v })} />
                  <Label htmlFor="fiado">Permitir fiado</Label>
                </div>
                <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
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
            <Input placeholder="Buscar por nome, documento ou telefone..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Fiado</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead className="text-right">Devedor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</TableCell></TableRow>
              )}
              {filtrados.map((c) => (
                <TableRow key={c.id} className={!c.ativo ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="font-medium">{c.nome}</div>
                    {c.documento && <div className="text-xs text-muted-foreground font-mono">{c.documento}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{c.telefone ?? "—"}</TableCell>
                  <TableCell>{c.permite_fiado ? <Badge>Liberado</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                  <TableCell className="text-right">{brl(c.limite_credito)}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(c.saldo_devedor) > 0 ? "text-destructive font-semibold" : ""}>{brl(c.saldo_devedor)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => editar(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Desativar cliente?")) excluir.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
