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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Mercadinho" }] }),
  component: FornecedoresPage,
});

type Form = { id?: string; razao_social: string; nome_fantasia: string; cnpj: string; telefone: string; email: string; endereco: string; observacoes: string; };
const empty: Form = { razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", email: "", endereco: "", observacoes: "" };

function FornecedoresPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: itens = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const filtrados = itens.filter((f) => !busca || f.razao_social.toLowerCase().includes(busca.toLowerCase()) || (f.cnpj ?? "").includes(busca));

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        razao_social: f.razao_social.trim(),
        nome_fantasia: f.nome_fantasia.trim() || null,
        cnpj: f.cnpj.trim() || null,
        telefone: f.telefone.trim() || null,
        email: f.email.trim() || null,
        endereco: f.endereco.trim() || null,
        observacoes: f.observacoes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Fornecedor salvo"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); setOpen(false); setForm(empty); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fornecedor desativado"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); },
  });

  const editar = (f: typeof itens[number]) => {
    setForm({
      id: f.id, razao_social: f.razao_social, nome_fantasia: f.nome_fantasia ?? "",
      cnpj: f.cnpj ?? "", telefone: f.telefone ?? "", email: f.email ?? "",
      endereco: f.endereco ?? "", observacoes: f.observacoes ?? "",
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores e prestadores."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo fornecedor</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Label>Razão social *</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
                <div><Label>Nome fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
                <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => salvar.mutate(form)} disabled={!form.razao_social || salvar.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por razão social ou CNPJ..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum fornecedor</TableCell></TableRow>}
              {filtrados.map((f) => (
                <TableRow key={f.id} className={!f.ativo ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="font-medium">{f.razao_social}</div>
                    {f.nome_fantasia && <div className="text-xs text-muted-foreground">{f.nome_fantasia}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.cnpj ?? "—"}</TableCell>
                  <TableCell className="text-sm">{f.telefone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{f.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => editar(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Desativar?")) excluir.mutate(f.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
