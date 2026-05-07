import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, ShieldCheck } from "lucide-react";

const ADMIN_EMAIL = "natanmtf@gmail.com";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Controle de PDVs" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fdate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const fdt = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

function statusBadge(s: string) {
  if (s === "ativa") return <Badge>Ativa</Badge>;
  if (s === "em_carencia") return <Badge variant="secondary">Carência</Badge>;
  return <Badge variant="destructive">{s === "vencida" ? "Vencida" : "Bloqueada"}</Badge>;
}

function AdminPage() {
  const [busca, setBusca] = useState("");
  const [comercioId, setComercioId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: comercios } = useQuery({
    queryKey: ["admin-comercios"],
    queryFn: async () => {
      const { data: cs } = await supabase.from("comercios").select("id, nome, documento, telefone, created_at").order("created_at");
      const { data: as } = await supabase.from("assinaturas").select("*");
      const { data: rs } = await supabase
        .from("user_roles").select("comercio_id, role, profiles:user_id(display_name)");
      const aMap = new Map((as ?? []).map((a: any) => [a.comercio_id, a]));
      const rMap = new Map<string, any[]>();
      (rs ?? []).forEach((r: any) => {
        if (!rMap.has(r.comercio_id)) rMap.set(r.comercio_id, []);
        rMap.get(r.comercio_id)!.push(r);
      });
      return (cs ?? []).map((c: any) => {
        const a = aMap.get(c.id);
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const venc = a ? new Date(a.proximo_vencimento + "T00:00:00") : null;
        const limite = a && venc ? new Date(venc.getTime() + a.dias_carencia * 86400000) : null;
        let status = "sem_assinatura";
        if (a) {
          if (!a.ativa) status = "bloqueada";
          else if (hoje <= venc!) status = "ativa";
          else if (hoje <= limite!) status = "em_carencia";
          else status = "vencida";
        }
        return { ...c, assinatura: a, status, donos: (rMap.get(c.id) ?? []).filter((r) => r.role === "dono") };
      });
    },
  });

  const lista = useMemo(() => {
    if (!comercios) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return comercios;
    return comercios.filter((c: any) => (c.nome ?? "").toLowerCase().includes(q) || (c.documento ?? "").toLowerCase().includes(q));
  }, [comercios, busca]);

  const totais = useMemo(() => {
    const t = { total: 0, ativas: 0, carencia: 0, vencidas: 0, mrr: 0 };
    (comercios ?? []).forEach((c: any) => {
      t.total++;
      if (c.status === "ativa") t.ativas++;
      else if (c.status === "em_carencia") t.carencia++;
      else if (c.status === "vencida" || c.status === "bloqueada") t.vencidas++;
      if (c.assinatura && (c.status === "ativa" || c.status === "em_carencia")) t.mrr += Number(c.assinatura.valor_mensal);
    });
    return t;
  }, [comercios]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Controle de PDVs</h1>
          <p className="text-sm text-muted-foreground">Painel global de comércios cadastrados (super-admin).</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Comércios</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totais.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Ativas</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-600">{totais.ativas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Em carência</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-yellow-600">{totais.carencia}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Vencidas</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{totais.vencidas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">MRR</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmt(totais.mrr)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Comércios</CardTitle>
          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Comércio</TableHead><TableHead>Dono(s)</TableHead><TableHead>Cadastro</TableHead>
              <TableHead>Vencimento</TableHead><TableHead>Mensalidade</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-sm">{c.donos.map((d: any) => d.profiles?.display_name).filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-sm">{fdate(c.created_at)}</TableCell>
                  <TableCell className="text-sm">{c.assinatura ? fdate(c.assinatura.proximo_vencimento) : "—"}</TableCell>
                  <TableCell className="text-sm">{c.assinatura ? fmt(Number(c.assinatura.valor_mensal)) : "—"}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setComercioId(c.id)}>Detalhes</Button></TableCell>
                </TableRow>
              ))}
              {lista.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum comércio.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DetalheComercio comercioId={comercioId} onClose={() => setComercioId(null)} onChange={() => qc.invalidateQueries({ queryKey: ["admin-comercios"] })} />
    </div>
  );
}

function DetalheComercio({ comercioId, onClose, onChange }: { comercioId: string | null; onClose: () => void; onChange: () => void }) {
  const open = !!comercioId;

  const { data: detalhe } = useQuery({
    queryKey: ["admin-detalhe", comercioId],
    enabled: open,
    queryFn: async () => {
      const [c, a, p, s, au] = await Promise.all([
        supabase.from("comercios").select("*").eq("id", comercioId!).maybeSingle(),
        supabase.from("assinaturas").select("*").eq("comercio_id", comercioId!).maybeSingle(),
        supabase.from("pagamentos_assinatura").select("*").eq("comercio_id", comercioId!).order("data_pagamento", { ascending: false }),
        supabase.from("sessoes_acesso").select("*").eq("comercio_id", comercioId!).order("iniciada_em", { ascending: false }).limit(50),
        supabase.from("auditoria").select("*").eq("comercio_id", comercioId!).order("created_at", { ascending: false }).limit(100),
      ]);
      return { comercio: c.data, assinatura: a.data, pagamentos: p.data ?? [], sessoes: s.data ?? [], auditoria: au.data ?? [] };
    },
  });

  const [valor, setValor] = useState("99.90");
  const [carencia, setCarencia] = useState("15");
  const [venc, setVenc] = useState("");

  const a = detalhe?.assinatura as any;
  const valorAtual = a?.valor_mensal ?? "99.90";
  const carenciaAtual = a?.dias_carencia ?? 15;
  const vencAtual = a?.proximo_vencimento ?? "";

  const salvar = async () => {
    if (!comercioId) return;
    const payload: any = {
      valor_mensal: Number(valor || valorAtual),
      dias_carencia: Number(carencia || carenciaAtual),
      proximo_vencimento: venc || vencAtual,
    };
    const { error } = await supabase.from("assinaturas").update(payload).eq("comercio_id", comercioId);
    if (error) return toast.error(error.message);
    toast.success("Assinatura atualizada");
    onChange();
  };

  const registrarPagamento = async () => {
    if (!comercioId || !a) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const proxData = new Date(a.proximo_vencimento + "T00:00:00");
    proxData.setMonth(proxData.getMonth() + 1);
    const prox = proxData.toISOString().slice(0, 10);
    const { error } = await supabase.from("pagamentos_assinatura").insert({
      comercio_id: comercioId, valor: Number(a.valor_mensal),
      data_pagamento: hoje, referente_a: a.proximo_vencimento, proximo_vencimento: prox, forma: "manual",
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado");
    onChange();
  };

  const toggleAtiva = async () => {
    if (!comercioId || !a) return;
    const { error } = await supabase.from("assinaturas").update({ ativa: !a.ativa }).eq("comercio_id", comercioId);
    if (error) return toast.error(error.message);
    toast.success(a.ativa ? "Bloqueada" : "Reativada");
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{detalhe?.comercio?.nome ?? "Comércio"}</DialogTitle></DialogHeader>

        <Tabs defaultValue="assinatura">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="sessoes">Acessos</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="assinatura" className="space-y-4 pt-4">
            {a ? (
              <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" defaultValue={valorAtual} onChange={(e) => setValor(e.target.value)} /></div>
                  <div><Label>Carência (dias)</Label><Input type="number" defaultValue={carenciaAtual} onChange={(e) => setCarencia(e.target.value)} /></div>
                  <div><Label>Próx. vencimento</Label><Input type="date" defaultValue={vencAtual} onChange={(e) => setVenc(e.target.value)} /></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={salvar}>Salvar alterações</Button>
                  <Button variant="secondary" onClick={registrarPagamento}>Registrar pagamento</Button>
                  <Button variant={a.ativa ? "destructive" : "default"} onClick={toggleAtiva}>{a.ativa ? "Bloquear" : "Reativar"}</Button>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Sem assinatura.</p>}
          </TabsContent>

          <TabsContent value="pagamentos" className="pt-4">
            <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ref.</TableHead><TableHead>Próx. venc.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>{(detalhe?.pagamentos ?? []).map((p: any) => (
                <TableRow key={p.id}><TableCell>{fdate(p.data_pagamento)}</TableCell><TableCell>{fdate(p.referente_a)}</TableCell><TableCell>{fdate(p.proximo_vencimento)}</TableCell><TableCell className="text-right">{fmt(Number(p.valor))}</TableCell></TableRow>
              ))}{(detalhe?.pagamentos ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem pagamentos.</TableCell></TableRow>}</TableBody></Table>
          </TabsContent>

          <TabsContent value="sessoes" className="pt-4">
            <Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Duração</TableHead></TableRow></TableHeader>
              <TableBody>{(detalhe?.sessoes ?? []).map((s: any) => (
                <TableRow key={s.id}><TableCell className="text-sm">{s.email ?? "—"}</TableCell><TableCell className="text-sm">{fdt(s.iniciada_em)}</TableCell><TableCell className="text-sm">{fdt(s.encerrada_em)}</TableCell><TableCell className="text-sm">{s.duracao_segundos ? `${Math.floor(s.duracao_segundos/60)}min` : "em curso"}</TableCell></TableRow>
              ))}{(detalhe?.sessoes ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem acessos.</TableCell></TableRow>}</TableBody></Table>
          </TabsContent>

          <TabsContent value="auditoria" className="pt-4">
            <Table><TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead></TableRow></TableHeader>
              <TableBody>{(detalhe?.auditoria ?? []).map((a: any) => (
                <TableRow key={a.id}><TableCell className="text-sm">{fdt(a.created_at)}</TableCell><TableCell className="text-sm">{a.user_email ?? "—"}</TableCell><TableCell className="text-sm"><Badge variant="outline">{a.acao}</Badge></TableCell><TableCell className="text-sm">{a.entidade}</TableCell></TableRow>
              ))}{(detalhe?.auditoria ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem registros.</TableCell></TableRow>}</TableBody></Table>
          </TabsContent>
        </Tabs>

        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
