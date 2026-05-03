import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, dt } from "@/lib/format";
import { toast } from "sonner";
import {
  DoorOpen, DoorClosed, ArrowDownCircle, ArrowUpCircle, Wallet, Banknote, Smartphone,
  CreditCard, BookOpen, AlertTriangle, Printer, History,
} from "lucide-react";
import { GuiaCaixa, type CaixaCompleto } from "@/components/GuiaCaixa";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];
type TipoMov = Database["public"]["Enums"]["tipo_mov_caixa"];

export const Route = createFileRoute("/caixa")({
  head: () => ({ meta: [{ title: "Controle de Caixa — Mercadinho" }] }),
  component: CaixaPage,
});

function CaixaPage() {
  const qc = useQueryClient();
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);
  const [openMov, setOpenMov] = useState<null | "sangria" | "suprimento" | "despesa">(null);
  const [openHist, setOpenHist] = useState(false);
  const [guiaCaixa, setGuiaCaixa] = useState<CaixaCompleto | null>(null);

  // Form abrir
  const [operador, setOperador] = useState("");
  const [valorAbertura, setValorAbertura] = useState("0");
  const [obsAbertura, setObsAbertura] = useState("");

  // Form mov
  const [movValor, setMovValor] = useState("");
  const [movForma, setMovForma] = useState<Forma>("dinheiro");
  const [movDesc, setMovDesc] = useState("");

  // Form fechar
  const [valorFechado, setValorFechado] = useState("");
  const [obsFechamento, setObsFechamento] = useState("");

  const { data: caixa } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => (await supabase.from("caixas").select("*").eq("status", "aberto").order("aberto_em", { ascending: false }).limit(1).maybeSingle()).data,
    refetchInterval: 5000,
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["caixa-vendas", caixa?.id],
    enabled: !!caixa,
    queryFn: async () => (await supabase.from("vendas").select("*").eq("caixa_id", caixa!.id).eq("cancelada", false).order("created_at")).data ?? [],
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["caixa-movs", caixa?.id],
    enabled: !!caixa,
    queryFn: async () => (await supabase.from("movimentacoes_caixa").select("*").eq("caixa_id", caixa!.id).order("created_at")).data ?? [],
  });

  const { data: recebimentosFiado = [] } = useQuery({
    queryKey: ["caixa-fiado", caixa?.id],
    enabled: !!caixa,
    queryFn: async () => (await supabase.from("pagamentos_fiado").select("*, clientes(nome)").eq("caixa_id", caixa!.id).order("created_at")).data ?? [],
  });

  const { data: caixasFechados = [] } = useQuery({
    queryKey: ["caixas-fechados"],
    queryFn: async () => (await supabase.from("caixas").select("*").eq("status", "fechado").order("fechado_em", { ascending: false }).limit(30)).data ?? [],
  });

  // Resumo calculado em tempo real
  const resumo = useMemo(() => {
    const r = {
      dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0,
      sangrias: 0, suprimentos: 0, despesas: 0, recebFiado: 0,
      recebFiadoDinheiro: 0, qtd: 0, totalVendas: 0,
    };
    for (const v of vendas) {
      const t = Number(v.total);
      r.qtd++;
      r.totalVendas += t;
      if (v.forma_pagamento === "dinheiro") r.dinheiro += t;
      else if (v.forma_pagamento === "pix") r.pix += t;
      else if (v.forma_pagamento === "debito") r.debito += t;
      else if (v.forma_pagamento === "credito") r.credito += t;
      else if (v.forma_pagamento === "fiado") r.fiado += t;
    }
    for (const m of movimentacoes) {
      const v = Number(m.valor);
      if (m.tipo === "sangria") r.sangrias += v;
      else if (m.tipo === "suprimento") r.suprimentos += v;
      else if (m.tipo === "despesa") r.despesas += v;
    }
    for (const p of recebimentosFiado) {
      const v = Number(p.valor);
      r.recebFiado += v;
      if (p.forma_pagamento === "dinheiro") r.recebFiadoDinheiro += v;
      else if (p.forma_pagamento === "pix") r.pix += v;
      else if (p.forma_pagamento === "debito") r.debito += v;
      else if (p.forma_pagamento === "credito") r.credito += v;
    }
    const saldoDinheiro =
      Number(caixa?.valor_abertura ?? 0) + r.dinheiro + r.recebFiadoDinheiro + r.suprimentos - r.sangrias - r.despesas;
    return { ...r, saldoDinheiro };
  }, [vendas, movimentacoes, recebimentosFiado, caixa]);

  // ---- Mutations ----
  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("caixas").insert({
        operador: operador || null,
        valor_abertura: Number(valorAbertura || 0),
        observacoes_abertura: obsAbertura || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      setOpenAbrir(false); setOperador(""); setValorAbertura("0"); setObsAbertura("");
      qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lancarMov = useMutation({
    mutationFn: async () => {
      if (!caixa) throw new Error("Sem caixa aberto");
      const v = Number(movValor);
      if (v <= 0) throw new Error("Valor inválido");
      const tipo = openMov as TipoMov;
      const { error } = await supabase.from("movimentacoes_caixa").insert({
        caixa_id: caixa.id, tipo, valor: v, forma_pagamento: movForma, descricao: movDesc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      setOpenMov(null); setMovValor(""); setMovDesc(""); setMovForma("dinheiro");
      qc.invalidateQueries({ queryKey: ["caixa-movs", caixa?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fechar = useMutation({
    mutationFn: async () => {
      if (!caixa) throw new Error("Sem caixa aberto");
      const informado = Number(valorFechado || 0);
      const calculado = resumo.saldoDinheiro;
      const dif = informado - calculado;
      const { data, error } = await supabase.from("caixas").update({
        status: "fechado",
        valor_fechamento_informado: informado,
        valor_fechamento_calculado: calculado,
        diferenca: dif,
        total_dinheiro: resumo.dinheiro,
        total_pix: resumo.pix,
        total_debito: resumo.debito,
        total_credito: resumo.credito,
        total_fiado: resumo.fiado,
        total_sangrias: resumo.sangrias,
        total_suprimentos: resumo.suprimentos,
        total_despesas: resumo.despesas,
        total_recebimentos_fiado: resumo.recebFiado,
        qtd_vendas: resumo.qtd,
        observacoes_fechamento: obsFechamento || null,
        fechado_em: new Date().toISOString(),
      }).eq("id", caixa.id).select().single();
      if (error) throw error;
      return data as CaixaCompleto;
    },
    onSuccess: (caixaFechado) => {
      toast.success("Caixa fechado!");
      setOpenFechar(false); setValorFechado(""); setObsFechamento("");
      setGuiaCaixa(caixaFechado);
      qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
      qc.invalidateQueries({ queryKey: ["caixas-fechados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Render ----
  if (!caixa) {
    return (
      <div>
        <PageHeader title="Controle de Caixa" description="Abra um caixa para começar a operar o PDV." actions={
          <Button variant="outline" onClick={() => setOpenHist(true)}><History className="h-4 w-4 mr-1" /> Histórico</Button>
        } />
        <Card className="max-w-2xl mx-auto" style={{ background: "var(--gradient-primary)" }}>
          <CardContent className="p-8 text-center text-primary-foreground">
            <DoorClosed className="h-16 w-16 mx-auto mb-4 opacity-80" />
            <h2 className="text-2xl font-bold mb-2">Nenhum caixa aberto</h2>
            <p className="opacity-90 mb-6">Para registrar vendas e recebimentos, abra o caixa informando o valor inicial em dinheiro.</p>
            <Button size="lg" className="bg-white text-primary hover:bg-white/90" onClick={() => setOpenAbrir(true)}>
              <DoorOpen className="h-5 w-5 mr-2" /> Abrir Caixa
            </Button>
          </CardContent>
        </Card>

        <DialogAbrir open={openAbrir} onOpenChange={setOpenAbrir}
          operador={operador} setOperador={setOperador}
          valorAbertura={valorAbertura} setValorAbertura={setValorAbertura}
          obs={obsAbertura} setObs={setObsAbertura}
          onConfirm={() => abrir.mutate()} loading={abrir.isPending} />

        <DialogHistorico open={openHist} onOpenChange={setOpenHist} caixas={caixasFechados} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Controle de Caixa"
        description={`Aberto em ${dt(caixa.aberto_em)}${caixa.operador ? ` por ${caixa.operador}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenHist(true)}><History className="h-4 w-4 mr-1" /> Histórico</Button>
            <Button variant="destructive" onClick={() => { setValorFechado(String(resumo.saldoDinheiro.toFixed(2))); setOpenFechar(true); }}>
              <DoorClosed className="h-4 w-4 mr-1" /> Fechar Caixa
            </Button>
          </div>
        }
      />

      {/* Saldo destaque */}
      <Card className="mb-6" style={{ background: "var(--gradient-primary)" }}>
        <CardContent className="p-6 text-primary-foreground grid md:grid-cols-4 gap-6 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-70">Saldo em dinheiro</div>
            <div className="text-4xl font-bold tabular-nums mt-1">{brl(resumo.saldoDinheiro)}</div>
            <div className="text-xs opacity-80 mt-1">Abertura: {brl(caixa.valor_abertura)}</div>
          </div>
          <Stat label="Vendas" value={brl(resumo.totalVendas)} sub={`${resumo.qtd} cupons`} />
          <Stat label="Recebido em fiado" value={brl(resumo.recebFiado)} />
          <div className="flex flex-col gap-2">
            <Button onClick={() => { setOpenMov("sangria"); setMovForma("dinheiro"); }} className="bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/20">
              <ArrowUpCircle className="h-4 w-4 mr-1" /> Sangria
            </Button>
            <Button onClick={() => { setOpenMov("suprimento"); setMovForma("dinheiro"); }} className="bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/20">
              <ArrowDownCircle className="h-4 w-4 mr-1" /> Suprimento
            </Button>
            <Button onClick={() => { setOpenMov("despesa"); setMovForma("dinheiro"); }} className="bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/20">
              <Wallet className="h-4 w-4 mr-1" /> Despesa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Por forma */}
      <div className="grid md:grid-cols-5 gap-3 mb-6">
        <FormaCard icon={<Banknote className="h-4 w-4" />} label="Dinheiro" value={resumo.dinheiro} />
        <FormaCard icon={<Smartphone className="h-4 w-4" />} label="PIX" value={resumo.pix} />
        <FormaCard icon={<CreditCard className="h-4 w-4" />} label="Débito" value={resumo.debito} />
        <FormaCard icon={<CreditCard className="h-4 w-4" />} label="Crédito" value={resumo.credito} />
        <FormaCard icon={<BookOpen className="h-4 w-4" />} label="Fiado" value={resumo.fiado} />
      </div>

      {/* Movimentações */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Vendas do caixa ({vendas.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Hora</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {vendas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma venda</TableCell></TableRow>}
                {vendas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">#{v.numero_cupom}</TableCell>
                    <TableCell className="text-xs">{new Date(v.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{v.forma_pagamento}</Badge></TableCell>
                    <TableCell className="text-right font-bold">{brl(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Sangrias / Suprimentos / Despesas</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {movimentacoes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma movimentação</TableCell></TableRow>}
                {movimentacoes.map((m) => {
                  const sai = m.tipo === "sangria" || m.tipo === "despesa";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                      <TableCell><Badge variant={sai ? "destructive" : "default"} className="capitalize">{m.tipo}</Badge></TableCell>
                      <TableCell className="text-xs">{m.descricao ?? "—"}</TableCell>
                      <TableCell className={`text-right font-bold ${sai ? "text-destructive" : "text-success"}`}>
                        {sai ? "-" : "+"}{brl(m.valor)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modais */}
      <DialogMov open={!!openMov} onOpenChange={(v) => !v && setOpenMov(null)}
        tipo={openMov} valor={movValor} setValor={setMovValor}
        forma={movForma} setForma={setMovForma}
        descricao={movDesc} setDescricao={setMovDesc}
        onConfirm={() => lancarMov.mutate()} loading={lancarMov.isPending} />

      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DoorClosed className="h-5 w-5" /> Fechamento de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Linha l="Abertura" v={caixa.valor_abertura} />
              <Linha l="Vendas dinheiro" v={resumo.dinheiro} pos />
              <Linha l="Recebido fiado (dinheiro)" v={resumo.recebFiadoDinheiro} pos />
              <Linha l="Suprimentos" v={resumo.suprimentos} pos />
              <Linha l="Sangrias" v={-resumo.sangrias} />
              <Linha l="Despesas" v={-resumo.despesas} />
            </div>
            <div className="bg-primary/10 p-3 rounded-md flex justify-between items-baseline border border-primary/20">
              <span className="font-semibold">Esperado em dinheiro</span>
              <span className="text-2xl font-bold text-primary">{brl(resumo.saldoDinheiro)}</span>
            </div>
            <div>
              <Label>Valor contado em dinheiro</Label>
              <Input type="number" step="0.01" value={valorFechado} onChange={(e) => setValorFechado(e.target.value)} className="text-lg h-11" autoFocus />
            </div>
            {valorFechado !== "" && (() => {
              const dif = Number(valorFechado) - resumo.saldoDinheiro;
              const ok = Math.abs(dif) < 0.005;
              return (
                <div className={`p-3 rounded-md flex items-center gap-2 ${ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {!ok && <AlertTriangle className="h-4 w-4" />}
                  <span className="font-semibold">
                    {ok ? "Conferido!" : `Diferença: ${dif > 0 ? "sobra" : "falta"} de ${brl(Math.abs(dif))}`}
                  </span>
                </div>
              );
            })()}
            <div><Label>Observações de fechamento</Label><Textarea value={obsFechamento} onChange={(e) => setObsFechamento(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenFechar(false)}>Cancelar</Button>
            <Button onClick={() => fechar.mutate()} disabled={fechar.isPending}>Confirmar fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogHistorico open={openHist} onOpenChange={setOpenHist} caixas={caixasFechados} />
    </div>
  );
}

// ---------- subcomponentes ----------

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-80">{sub}</div>}
    </div>
  );
}

function FormaCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{brl(value)}</div>
    </CardContent></Card>
  );
}

function Linha({ l, v, pos }: { l: string; v: number; pos?: boolean }) {
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-muted-foreground">{l}</span>
      <span className={`font-semibold tabular-nums ${pos ? "text-success" : v < 0 ? "text-destructive" : ""}`}>{brl(v)}</span>
    </div>
  );
}

function DialogAbrir({
  open, onOpenChange, operador, setOperador, valorAbertura, setValorAbertura, obs, setObs, onConfirm, loading,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  operador: string; setOperador: (v: string) => void;
  valorAbertura: string; setValorAbertura: (v: string) => void;
  obs: string; setObs: (v: string) => void;
  onConfirm: () => void; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><DoorOpen className="h-5 w-5" /> Abrir Caixa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Operador (opcional)</Label><Input value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Nome de quem abriu" /></div>
          <div><Label>Valor de abertura (troco inicial)</Label><Input type="number" step="0.01" value={valorAbertura} onChange={(e) => setValorAbertura(e.target.value)} autoFocus /></div>
          <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading}>Abrir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogMov({
  open, onOpenChange, tipo, valor, setValor, forma, setForma, descricao, setDescricao, onConfirm, loading,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  tipo: "sangria" | "suprimento" | "despesa" | null;
  valor: string; setValor: (v: string) => void;
  forma: Forma; setForma: (v: Forma) => void;
  descricao: string; setDescricao: (v: string) => void;
  onConfirm: () => void; loading: boolean;
}) {
  const labels: Record<string, { titulo: string; desc: string }> = {
    sangria: { titulo: "Sangria (retirada)", desc: "Retirada de dinheiro do caixa (ex: depósito no cofre)." },
    suprimento: { titulo: "Suprimento (entrada)", desc: "Entrada extra de dinheiro no caixa (ex: troco adicional)." },
    despesa: { titulo: "Despesa", desc: "Pagamento avulso saindo do caixa (ex: gás, frete, água)." },
  };
  const meta = tipo ? labels[tipo] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{meta?.titulo}</DialogTitle></DialogHeader>
        {meta && <p className="text-sm text-muted-foreground">{meta.desc}</p>}
        <div className="space-y-3">
          <div><Label>Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
          <div>
            <Label>Forma</Label>
            <Select value={forma} onValueChange={(v: Forma) => setForma(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Motivo / referência" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogHistorico({ open, onOpenChange, caixas }: { open: boolean; onOpenChange: (v: boolean) => void; caixas: any[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Histórico de Caixas Fechados</DialogTitle></DialogHeader>
        <div className="overflow-x-auto max-h-[70vh]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Abertura</TableHead><TableHead>Fechamento</TableHead><TableHead>Operador</TableHead>
              <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Dinheiro</TableHead>
              <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Contado</TableHead>
              <TableHead className="text-right">Diferença</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {caixas.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum caixa fechado</TableCell></TableRow>}
              {caixas.map((c) => {
                const dif = Number(c.diferenca ?? 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{dt(c.aberto_em)}</TableCell>
                    <TableCell className="text-xs">{c.fechado_em ? dt(c.fechado_em) : "—"}</TableCell>
                    <TableCell className="text-xs">{c.operador ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.qtd_vendas}</TableCell>
                    <TableCell className="text-right">{brl(c.total_dinheiro)}</TableCell>
                    <TableCell className="text-right">{brl(c.valor_fechamento_calculado ?? 0)}</TableCell>
                    <TableCell className="text-right">{brl(c.valor_fechamento_informado ?? 0)}</TableCell>
                    <TableCell className={`text-right font-bold ${Math.abs(dif) < 0.005 ? "text-success" : "text-destructive"}`}>{brl(dif)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
