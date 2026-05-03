import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, Store } from "lucide-react";

export const Route = createFileRoute("/comercio")({
  head: () => ({ meta: [{ title: "Configurações do Comércio" }] }),
  component: ComercioPage,
});

const TIPOS_BASE = [
  { v: "dinheiro", l: "Dinheiro" },
  { v: "pix", l: "PIX" },
  { v: "debito", l: "Débito" },
  { v: "credito", l: "Crédito" },
  { v: "fiado", l: "Fiado" },
  { v: "outro", l: "Outro" },
];

function ComercioPage() {
  const { comercio, refreshComercio } = useAuth();
  if (!comercio) return <div>Carregando...</div>;

  return (
    <div>
      <PageHeader
        title="Configurações do Comércio"
        description="Personalize formas de pagamento, naturezas de lançamento e cupom para este comércio."
      />
      <Tabs defaultValue="dados">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-4">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="formas">Formas de pagto</TabsTrigger>
          <TabsTrigger value="naturezas">Naturezas</TabsTrigger>
          <TabsTrigger value="cupom">Cupom</TabsTrigger>
        </TabsList>

        <TabsContent value="dados"><DadosTab onSaved={refreshComercio} /></TabsContent>
        <TabsContent value="formas"><FormasTab comercioId={comercio.id} /></TabsContent>
        <TabsContent value="naturezas"><NaturezasTab comercioId={comercio.id} /></TabsContent>
        <TabsContent value="cupom"><CupomTab comercioId={comercio.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Dados do comércio ---------- */
function DadosTab({ onSaved }: { onSaved: () => void }) {
  const qc = useQueryClient();
  const { comercio } = useAuth();
  const { data } = useQuery({
    queryKey: ["comercio-dados", comercio?.id],
    queryFn: async () => (await supabase.from("comercios").select("*").eq("id", comercio!.id).maybeSingle()).data,
    enabled: !!comercio,
  });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const payload = {
        nome: String(fd.get("nome")),
        documento: String(fd.get("documento") || "") || null,
        telefone: String(fd.get("telefone") || "") || null,
        endereco: String(fd.get("endereco") || "") || null,
      };
      const { error } = await supabase.from("comercios").update(payload).eq("id", comercio!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do comércio atualizados");
      qc.invalidateQueries({ queryKey: ["comercio-dados"] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Identificação</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 max-w-xl" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
          <div><Label>Nome do comércio</Label><Input name="nome" defaultValue={data.nome} required /></div>
          <div><Label>CNPJ / CPF</Label><Input name="documento" defaultValue={data.documento ?? ""} /></div>
          <div><Label>Telefone</Label><Input name="telefone" defaultValue={data.telefone ?? ""} /></div>
          <div><Label>Endereço</Label><Textarea name="endereco" defaultValue={data.endereco ?? ""} rows={2} /></div>
          <Button type="submit" disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Formas de pagamento ---------- */
type Forma = { id: string; nome: string; tipo_base: string; taxa_percentual: number; prazo_recebimento_dias: number; ativo: boolean; ordem: number };

function FormasTab({ comercioId }: { comercioId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Forma | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: ["formas-pgto", comercioId],
    queryFn: async () => (await supabase.from("comercio_formas_pagamento").select("*").order("ordem")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const payload = {
        nome: String(fd.get("nome")),
        tipo_base: String(fd.get("tipo_base")),
        taxa_percentual: Number(fd.get("taxa_percentual") || 0),
        prazo_recebimento_dias: Number(fd.get("prazo_recebimento_dias") || 0),
        ordem: Number(fd.get("ordem") || 0),
        ativo: fd.get("ativo") === "on",
      };
      if (edit) {
        const { error } = await supabase.from("comercio_formas_pagamento").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comercio_formas_pagamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Forma de pagamento salva");
      qc.invalidateQueries({ queryKey: ["formas-pgto"] });
      setOpen(false); setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comercio_formas_pagamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["formas-pgto"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Formas de pagamento</CardTitle>
          <CardDescription>Personalize formas, taxas e prazos. Usadas no PDV e relatórios.</CardDescription>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ord.</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Taxa %</TableHead><TableHead className="text-right">Prazo (dias)</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma forma cadastrada</TableCell></TableRow>}
            {lista.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{f.ordem}</TableCell>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell><Badge variant="outline">{TIPOS_BASE.find((t) => t.v === f.tipo_base)?.l ?? f.tipo_base}</Badge></TableCell>
                <TableCell className="text-right">{Number(f.taxa_percentual).toFixed(2)}</TableCell>
                <TableCell className="text-right">{f.prazo_recebimento_dias}</TableCell>
                <TableCell>{f.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(f as Forma); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${f.nome}"?`)) del.mutate(f.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Nova"} forma de pagamento</DialogTitle></DialogHeader>
          <form id="form-fpgto" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
            <div><Label>Nome</Label><Input name="nome" defaultValue={edit?.nome ?? ""} required /></div>
            <div>
              <Label>Tipo base</Label>
              <Select name="tipo_base" defaultValue={edit?.tipo_base ?? "dinheiro"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_BASE.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Taxa %</Label><Input name="taxa_percentual" type="number" step="0.01" defaultValue={edit?.taxa_percentual ?? 0} /></div>
              <div><Label>Prazo (dias)</Label><Input name="prazo_recebimento_dias" type="number" defaultValue={edit?.prazo_recebimento_dias ?? 0} /></div>
              <div><Label>Ordem</Label><Input name="ordem" type="number" defaultValue={edit?.ordem ?? 0} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={edit?.ativo ?? true} /> Ativo</label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" form="form-fpgto" disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Naturezas ---------- */
type Nat = { id: string; descricao: string; tipo: string; ativo: boolean };

function NaturezasTab({ comercioId }: { comercioId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Nat | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: ["naturezas", comercioId],
    queryFn: async () => (await supabase.from("comercio_naturezas_lancamento").select("*").order("descricao")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const payload = {
        descricao: String(fd.get("descricao")),
        tipo: String(fd.get("tipo")),
        ativo: fd.get("ativo") === "on",
      };
      if (edit) {
        const { error } = await supabase.from("comercio_naturezas_lancamento").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comercio_naturezas_lancamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Natureza salva");
      qc.invalidateQueries({ queryKey: ["naturezas"] });
      setOpen(false); setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comercio_naturezas_lancamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["naturezas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Naturezas de lançamento</CardTitle>
          <CardDescription>Categorias para classificar movimentações de caixa (entradas e saídas).</CardDescription>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {lista.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma natureza cadastrada</TableCell></TableRow>}
            {lista.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.descricao}</TableCell>
                <TableCell><Badge variant={n.tipo === "entrada" ? "default" : "destructive"}>{n.tipo === "entrada" ? "Entrada" : "Saída"}</Badge></TableCell>
                <TableCell>{n.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(n as Nat); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${n.descricao}"?`)) del.mutate(n.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Nova"} natureza</DialogTitle></DialogHeader>
          <form id="form-nat" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
            <div><Label>Descrição</Label><Input name="descricao" defaultValue={edit?.descricao ?? ""} required /></div>
            <div>
              <Label>Tipo</Label>
              <Select name="tipo" defaultValue={edit?.tipo ?? "saida"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={edit?.ativo ?? true} /> Ativo</label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" form="form-nat" disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Cupom ---------- */
function CupomTab({ comercioId }: { comercioId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cupom-config", comercioId],
    queryFn: async () => (await supabase.from("comercio_cupom_config").select("*").maybeSingle()).data,
  });

  const [form, setForm] = useState<{ mostrar_cnpj: boolean; mostrar_endereco: boolean; mostrar_telefone: boolean } | null>(null);
  if (data && !form) setForm({ mostrar_cnpj: data.mostrar_cnpj, mostrar_endereco: data.mostrar_endereco, mostrar_telefone: data.mostrar_telefone });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const payload = {
        cabecalho: String(fd.get("cabecalho") || "") || null,
        rodape: String(fd.get("rodape") || "") || null,
        serie: String(fd.get("serie") || "001"),
        proximo_numero: Number(fd.get("proximo_numero") || 1),
        mensagem_promocional: String(fd.get("mensagem_promocional") || "") || null,
        mostrar_cnpj: form?.mostrar_cnpj ?? true,
        mostrar_endereco: form?.mostrar_endereco ?? true,
        mostrar_telefone: form?.mostrar_telefone ?? true,
      };
      if (data?.id) {
        const { error } = await supabase.from("comercio_cupom_config").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comercio_cupom_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração do cupom salva");
      qc.invalidateQueries({ queryKey: ["cupom-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || !form) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parametrização do cupom</CardTitle>
        <CardDescription>Cabeçalho, rodapé, série e numeração padrão deste comércio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 max-w-2xl" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
          <div><Label>Cabeçalho do cupom</Label><Textarea name="cabecalho" defaultValue={data.cabecalho ?? ""} rows={2} placeholder="Ex: Mercadinho do José — desde 1998" /></div>
          <div><Label>Rodapé do cupom</Label><Textarea name="rodape" defaultValue={data.rodape ?? ""} rows={2} placeholder="Ex: Obrigado pela preferência!" /></div>
          <div><Label>Mensagem promocional</Label><Input name="mensagem_promocional" defaultValue={data.mensagem_promocional ?? ""} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Série</Label><Input name="serie" defaultValue={data.serie} required /></div>
            <div><Label>Próximo número</Label><Input name="proximo_numero" type="number" defaultValue={data.proximo_numero} required /></div>
          </div>
          <div className="grid gap-2 pt-2">
            <div className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Mostrar CNPJ no cupom</span>
              <Switch checked={form.mostrar_cnpj} onCheckedChange={(v) => setForm({ ...form, mostrar_cnpj: v })} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Mostrar endereço</span>
              <Switch checked={form.mostrar_endereco} onCheckedChange={(v) => setForm({ ...form, mostrar_endereco: v })} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Mostrar telefone</span>
              <Switch checked={form.mostrar_telefone} onCheckedChange={(v) => setForm({ ...form, mostrar_telefone: v })} /></div>
          </div>
          <Button type="submit" disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Salvar configuração</Button>
        </form>
      </CardContent>
    </Card>
  );
}
