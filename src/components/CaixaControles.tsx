import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DoorOpen, DoorClosed, ArrowDownCircle, ArrowUpCircle, Wallet, Banknote, Smartphone,
  CreditCard, BookOpen, AlertTriangle, Printer, History, ClipboardList,
} from "lucide-react";
import { brl, dt } from "@/lib/format";
import { toast } from "sonner";
import { GuiaCaixa, type CaixaCompleto } from "@/components/GuiaCaixa";
import { imprimirDocumento } from "@/lib/print-config";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];
type TipoMov = Database["public"]["Enums"]["tipo_mov_caixa"];

export function CaixaControles({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();

  const [openAbrir, setOpenAbrir] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);
  const [openMov, setOpenMov] = useState<null | "sangria" | "suprimento" | "despesa">(null);
  const [openHist, setOpenHist] = useState(false);
  const [openConferencia, setOpenConferencia] = useState(false);
  const [guiaCaixa, setGuiaCaixa] = useState<CaixaCompleto | null>(null);

  // forms
  const [operador, setOperador] = useState("");
  const [valorAbertura, setValorAbertura] = useState("0");
  const [obsAbertura, setObsAbertura] = useState("");
  const [movValor, setMovValor] = useState("");
  const [movForma, setMovForma] = useState<Forma>("dinheiro");
  const [movDesc, setMovDesc] = useState("");
  const [valorFechado, setValorFechado] = useState("");
  const [obsFechamento, setObsFechamento] = useState("");

  const { data: caixa } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => (await supabase.from("caixas").select("*").eq("status", "aberto").order("aberto_em", { ascending: false }).limit(1).maybeSingle()).data,
    staleTime: 60_000,
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

  const resumo = useMemo(() => {
    const r = { dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0, sangrias: 0, suprimentos: 0, despesas: 0, recebFiado: 0, recebFiadoDinheiro: 0, qtd: 0, totalVendas: 0 };
    for (const v of vendas) {
      const t = Number(v.total); r.qtd++; r.totalVendas += t;
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
      const v = Number(p.valor); r.recebFiado += v;
      if (p.forma_pagamento === "dinheiro") r.recebFiadoDinheiro += v;
      else if (p.forma_pagamento === "pix") r.pix += v;
      else if (p.forma_pagamento === "debito") r.debito += v;
      else if (p.forma_pagamento === "credito") r.credito += v;
    }
    const saldoDinheiro = Number(caixa?.valor_abertura ?? 0) + r.dinheiro + r.recebFiadoDinheiro + r.suprimentos - r.sangrias - r.despesas;
    return { ...r, saldoDinheiro };
  }, [vendas, movimentacoes, recebimentosFiado, caixa]);

  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("caixas").insert({
        operador: operador || null, valor_abertura: Number(valorAbertura || 0), observacoes_abertura: obsAbertura || null,
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
      const v = Number(movValor); if (v <= 0) throw new Error("Valor inválido");
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
        valor_fechamento_informado: informado, valor_fechamento_calculado: calculado, diferenca: dif,
        total_dinheiro: resumo.dinheiro, total_pix: resumo.pix, total_debito: resumo.debito,
        total_credito: resumo.credito, total_fiado: resumo.fiado,
        total_sangrias: resumo.sangrias, total_suprimentos: resumo.suprimentos, total_despesas: resumo.despesas,
        total_recebimentos_fiado: resumo.recebFiado, qtd_vendas: resumo.qtd,
        observacoes_fechamento: obsFechamento || null, fechado_em: new Date().toISOString(),
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

  // ---------- Sem caixa: botão Abrir + Histórico ----------
  if (!caixa) {
    return (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="destructive" className="gap-1"><DoorClosed className="h-3 w-3" /> Caixa fechado</Badge>
          <Button size="sm" onClick={() => setOpenAbrir(true)}><DoorOpen className="h-4 w-4 mr-1" /> Abrir caixa</Button>
          <Button size="sm" variant="outline" onClick={() => setOpenHist(true)}><History className="h-4 w-4 mr-1" /> Histórico</Button>
        </div>
        <DialogAbrir open={openAbrir} onOpenChange={setOpenAbrir}
          operador={operador} setOperador={setOperador}
          valorAbertura={valorAbertura} setValorAbertura={setValorAbertura}
          obs={obsAbertura} setObs={setObsAbertura}
          onConfirm={() => abrir.mutate()} loading={abrir.isPending} />
        <DialogHistorico open={openHist} onOpenChange={setOpenHist} caixas={caixasFechados} onPrint={(c) => setGuiaCaixa(c)} />
        <DialogGuia caixa={guiaCaixa} onClose={() => setGuiaCaixa(null)} />
      </>
    );
  }

  // ---------- Com caixa: barra com saldo e ações ----------
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default" className="gap-1 bg-success text-success-foreground hover:bg-success">
          <DoorOpen className="h-3 w-3" /> Caixa aberto
        </Badge>
        {!compact && (
          <span className="text-xs text-muted-foreground hidden md:inline">
            {caixa.operador ? `${caixa.operador} · ` : ""}desde {new Date(caixa.aberto_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs">
          <span className="text-muted-foreground">Dinheiro:</span>{" "}
          <span className="font-bold text-primary tabular-nums">{brl(resumo.saldoDinheiro)}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenConferencia(true)}>
          <ClipboardList className="h-4 w-4 mr-1" /> Conferência
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setOpenMov("sangria"); setMovForma("dinheiro"); }}>
          <ArrowUpCircle className="h-4 w-4 mr-1" /> Sangria
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setOpenMov("suprimento"); setMovForma("dinheiro"); }}>
          <ArrowDownCircle className="h-4 w-4 mr-1" /> Suprimento
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setOpenMov("despesa"); setMovForma("dinheiro"); }}>
          <Wallet className="h-4 w-4 mr-1" /> Despesa
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpenHist(true)}>
          <History className="h-4 w-4 mr-1" /> Histórico
        </Button>
        <Button size="sm" variant="destructive" onClick={() => { setValorFechado(String(resumo.saldoDinheiro.toFixed(2))); setOpenFechar(true); }}>
          <DoorClosed className="h-4 w-4 mr-1" /> Fechar caixa
        </Button>
      </div>

      <DialogMov open={!!openMov} onOpenChange={(v) => !v && setOpenMov(null)}
        tipo={openMov} valor={movValor} setValor={setMovValor}
        forma={movForma} setForma={setMovForma}
        descricao={movDesc} setDescricao={setMovDesc}
        onConfirm={() => lancarMov.mutate()} loading={lancarMov.isPending} />

      {/* Conferência (acompanhamento em tempo real) */}
      <Dialog open={openConferencia} onOpenChange={setOpenConferencia}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Conferência do Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <FormaCard icon={<Banknote className="h-4 w-4" />} label="Dinheiro" value={resumo.dinheiro} />
              <FormaCard icon={<Smartphone className="h-4 w-4" />} label="PIX" value={resumo.pix} />
              <FormaCard icon={<CreditCard className="h-4 w-4" />} label="Débito" value={resumo.debito} />
              <FormaCard icon={<CreditCard className="h-4 w-4" />} label="Crédito" value={resumo.credito} />
              <FormaCard icon={<BookOpen className="h-4 w-4" />} label="Fiado" value={resumo.fiado} />
              <FormaCard icon={<Wallet className="h-4 w-4" />} label="Saldo dinheiro" value={resumo.saldoDinheiro} highlight />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm bg-muted/40 p-3 rounded-md">
              <Linha l="Abertura" v={Number(caixa.valor_abertura)} />
              <Linha l="Suprimentos" v={resumo.suprimentos} pos />
              <Linha l="Sangrias" v={-resumo.sangrias} />
              <Linha l="Despesas" v={-resumo.despesas} />
              <Linha l="Receb. fiado" v={resumo.recebFiado} pos />
              <Linha l="Cupons" v={resumo.qtd} />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-muted text-xs font-semibold uppercase">Vendas ({vendas.length})</div>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Hora</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {vendas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>}
                      {vendas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">#{v.numero_cupom}</TableCell>
                          <TableCell className="text-xs">{new Date(v.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                          <TableCell><Badge variant="secondary" className="capitalize text-[10px]">{v.forma_pagamento}</Badge></TableCell>
                          <TableCell className="text-right text-xs font-bold">{brl(v.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-muted text-xs font-semibold uppercase">Movimentações ({movimentacoes.length})</div>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Descr.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {movimentacoes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">—</TableCell></TableRow>}
                      {movimentacoes.map((m) => {
                        const sai = m.tipo === "sangria" || m.tipo === "despesa";
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{new Date(m.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                            <TableCell><Badge variant={sai ? "destructive" : "default"} className="capitalize text-[10px]">{m.tipo}</Badge></TableCell>
                            <TableCell className="text-xs truncate max-w-[120px]">{m.descricao ?? "—"}</TableCell>
                            <TableCell className={`text-right text-xs font-bold ${sai ? "text-destructive" : "text-success"}`}>{sai ? "-" : "+"}{brl(m.valor)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConferencia(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fechamento */}
      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DoorClosed className="h-5 w-5" /> Fechamento de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Linha l="Abertura" v={Number(caixa.valor_abertura)} />
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

      <DialogHistorico open={openHist} onOpenChange={setOpenHist} caixas={caixasFechados} onPrint={(c) => setGuiaCaixa(c)} />
      <DialogGuia
        caixa={guiaCaixa}
        onClose={() => setGuiaCaixa(null)}
        movimentacoes={movimentacoes as React.ComponentProps<typeof GuiaCaixa>["movimentacoes"]}
        vendas={vendas as React.ComponentProps<typeof GuiaCaixa>["vendas"]}
        recebimentosFiado={recebimentosFiado as React.ComponentProps<typeof GuiaCaixa>["recebimentosFiado"]}
      />
    </>
  );
}

// ---------- subcomponentes ----------

function FormaCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card"}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">{icon}{label}</div>
      <div className={`text-lg font-bold mt-1 tabular-nums ${highlight ? "text-primary" : ""}`}>{brl(value)}</div>
    </div>
  );
}

function Linha({ l, v, pos }: { l: string; v: number; pos?: boolean }) {
  const isCount = !pos && Number.isInteger(v) && Math.abs(v) < 10000 && l.toLowerCase() === "cupons";
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-muted-foreground">{l}</span>
      <span className={`font-semibold tabular-nums ${pos ? "text-success" : v < 0 ? "text-destructive" : ""}`}>
        {isCount ? v : brl(v)}
      </span>
    </div>
  );
}

function DialogAbrir({ open, onOpenChange, operador, setOperador, valorAbertura, setValorAbertura, obs, setObs, onConfirm, loading }: {
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

function DialogMov({ open, onOpenChange, tipo, valor, setValor, forma, setForma, descricao, setDescricao, onConfirm, loading }: {
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

function DialogHistorico({ open, onOpenChange, caixas, onPrint }: { open: boolean; onOpenChange: (v: boolean) => void; caixas: CaixaCompleto[]; onPrint?: (c: CaixaCompleto) => void }) {
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
                    <TableCell><Button size="icon" variant="ghost" onClick={() => onPrint?.(c)}><Printer className="h-4 w-4" /></Button></TableCell>
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

function DialogGuia({ caixa, onClose, movimentacoes, vendas, recebimentosFiado }: {
  caixa: CaixaCompleto | null;
  onClose: () => void;
  movimentacoes?: React.ComponentProps<typeof GuiaCaixa>["movimentacoes"];
  vendas?: React.ComponentProps<typeof GuiaCaixa>["vendas"];
  recebimentosFiado?: React.ComponentProps<typeof GuiaCaixa>["recebimentosFiado"];
}) {
  return (
    <Dialog open={!!caixa} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Guia de Fechamento</DialogTitle></DialogHeader>
        {caixa && (
          <GuiaCaixa
            caixa={caixa}
            movimentacoes={movimentacoes ?? []}
            vendas={vendas ?? []}
            recebimentosFiado={recebimentosFiado ?? []}
          />
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => imprimirDocumento("guia")}><Printer className="h-4 w-4 mr-1" /> Imprimir guia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
