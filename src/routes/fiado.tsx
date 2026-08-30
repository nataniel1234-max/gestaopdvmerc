import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidarTudo } from "@/lib/sync";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl, dt } from "@/lib/format";
import { CreditCard, Receipt, FileText, Printer, Eye, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { exigirCaixaAberto } from "@/lib/caixa";
import { ReciboFiado, type ReciboFiadoData } from "@/components/ReciboFiado";
import { imprimirDocumento } from "@/lib/print-config";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];

export const Route = createFileRoute("/fiado")({
  head: () => ({ meta: [{ title: "Fiado / Crediário — Mercadinho" }] }),
  component: FiadoPage,
});

function FiadoPage() {
  const qc = useQueryClient();
  const [clienteSel, setClienteSel] = useState<{ id: string; nome: string; saldo_devedor: number } | null>(null);
  const [extratoCliente, setExtratoCliente] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [obs, setObs] = useState("");
  const [recibo, setRecibo] = useState<ReciboFiadoData | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-fiado"],
    queryFn: async () => (await supabase.from("clientes").select("*").gt("saldo_devedor", 0).order("nome")).data ?? [],
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["pagamentos-fiado"],
    queryFn: async () => (await supabase.from("pagamentos_fiado")
      .select("*, clientes(nome)").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const { data: vendasFiado = [] } = useQuery({
    queryKey: ["vendas-fiado", clienteSel?.id],
    enabled: !!clienteSel,
    queryFn: async () => (await supabase.from("vendas")
      .select("*").eq("cliente_id", clienteSel!.id).eq("forma_pagamento", "fiado")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const totalFiado = clientes.reduce((s, c) => s + Number(c.saldo_devedor), 0);

  const pagar = useMutation({
    mutationFn: async () => {
      if (!clienteSel) throw new Error("Selecione um cliente");
      const v = Number(valor);
      if (v <= 0) throw new Error("Valor inválido");
      if (v > Number(clienteSel.saldo_devedor)) throw new Error("Valor maior que o saldo devedor");

      const caixa_id = await exigirCaixaAberto();

      const { data: pag, error: e1 } = await supabase.from("pagamentos_fiado").insert({
        cliente_id: clienteSel.id, valor: v, forma_pagamento: forma, observacoes: obs || null, caixa_id,
      }).select("id").single();
      if (e1) throw e1;

      const saldoAnterior = Number(clienteSel.saldo_devedor);
      const novoSaldo = saldoAnterior - v;
      const { data: cliFull } = await supabase.from("clientes").select("documento, telefone").eq("id", clienteSel.id).single();
      const { error: e2 } = await supabase.from("clientes").update({ saldo_devedor: novoSaldo }).eq("id", clienteSel.id);
      if (e2) throw e2;

      await supabase.from("movimentacoes_caixa").insert({
        caixa_id, tipo: "recebimento_fiado", forma_pagamento: forma, valor: v,
        descricao: `Recebimento fiado — ${clienteSel.nome}`, referencia_id: pag?.id ?? null,
      });

      return {
        numero: pag?.id?.slice(0, 8).toUpperCase(),
        cliente: { nome: clienteSel.nome, documento: cliFull?.documento, telefone: cliFull?.telefone },
        valor_pago: v,
        forma_pagamento: forma,
        saldo_anterior: saldoAnterior,
        saldo_atual: novoSaldo,
        data: new Date(),
        observacoes: obs || null,
      } as ReciboFiadoData;
    },
    onSuccess: (data) => {
      toast.success("Pagamento registrado");
      setRecibo(data);
      setClienteSel(null); setValor(""); setObs("");
      invalidarTudo(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Se está no modo extrato, renderiza a tela de extrato do cliente
  if (extratoCliente) {
    return (
      <ExtratoCliente
        clienteId={extratoCliente}
        onVoltar={() => setExtratoCliente(null)}
        onReceber={(c) => { setClienteSel({ id: c.id, nome: c.nome, saldo_devedor: Number(c.saldo_devedor) }); setValor(String(c.saldo_devedor)); }}
        onImprimirRecibo={(r) => setRecibo(r)}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Fiado / Crediário" description="Controle de saldos devedores e quitações." />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Total em aberto</p>
          <p className="text-2xl font-bold text-destructive mt-1">{brl(totalFiado)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Clientes devedores</p>
          <p className="text-2xl font-bold mt-1">{clientes.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Pagamentos hoje</p>
          <p className="text-2xl font-bold text-success mt-1">
            {brl(historico.filter((h) => new Date(h.created_at).toDateString() === new Date().toDateString()).reduce((s, h) => s + Number(h.valor), 0))}
          </p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Clientes com saldo em aberto</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Limite</TableHead><TableHead className="text-right">Devedor</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum cliente devedor 🎉</TableCell></TableRow>}
                {clientes.map((c) => {
                  const pct = Number(c.limite_credito) > 0 ? (Number(c.saldo_devedor) / Number(c.limite_credito)) * 100 : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.nome}</div>
                        {pct >= 80 && <Badge variant="destructive" className="text-[10px]">Limite {pct.toFixed(0)}%</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{brl(c.limite_credito)}</TableCell>
                      <TableCell className="text-right text-destructive font-bold">{brl(c.saldo_devedor)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="outline" onClick={() => setExtratoCliente(c.id)}><FileText className="h-3 w-3 mr-1" /> Extrato</Button>
                        <Button size="sm" onClick={() => { setClienteSel({ id: c.id, nome: c.nome, saldo_devedor: Number(c.saldo_devedor) }); setValor(String(c.saldo_devedor)); }}>Receber</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Últimos pagamentos</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {historico.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum pagamento</TableCell></TableRow>}
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{dt(h.created_at)}</TableCell>
                    <TableCell>{h.clientes?.nome}</TableCell>
                    <TableCell><Badge variant="secondary">{h.forma_pagamento}</Badge></TableCell>
                    <TableCell className="text-right font-bold text-success">{brl(h.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!clienteSel} onOpenChange={(v) => !v && setClienteSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Receber de {clienteSel?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <div className="flex justify-between text-sm"><span>Saldo devedor</span><span className="font-bold text-destructive">{brl(clienteSel?.saldo_devedor ?? 0)}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" onClick={() => setValor(String(((clienteSel?.saldo_devedor ?? 0) / 2).toFixed(2)))}>50%</Button>
              <Button size="sm" variant="outline" onClick={() => setValor(String(clienteSel?.saldo_devedor ?? 0))}>Total</Button>
              <Button size="sm" variant="outline" onClick={() => setValor("")}>Limpar</Button>
            </div>
            <div><Label>Valor a receber</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={(v: Forma) => setForma(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="debito">Cartão Débito</SelectItem>
                  <SelectItem value="credito">Cartão Crédito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>

            {vendasFiado.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Receipt className="h-3 w-3" /> Vendas fiadas</p>
                <div className="max-h-32 overflow-auto space-y-1">
                  {vendasFiado.map((v) => (
                    <div key={v.id} className="flex justify-between text-xs">
                      <span>#{v.numero_cupom} — {dt(v.created_at)}</span><span className="font-semibold">{brl(v.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteSel(null)}>Cancelar</Button>
            <Button onClick={() => pagar.mutate()} disabled={pagar.isPending}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recibo */}
      <Dialog open={!!recibo} onOpenChange={(v) => !v && setRecibo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Recibo de pagamento</DialogTitle></DialogHeader>
          {recibo && <ReciboFiado data={recibo} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecibo(null)}>Fechar</Button>
            <Button onClick={() => imprimirDocumento("recibo")}><Printer className="h-4 w-4 mr-1" /> Imprimir recibo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExtratoCliente({
  clienteId, onVoltar, onReceber, onImprimirRecibo,
}: {
  clienteId: string;
  onVoltar: () => void;
  onReceber: (c: any) => void;
  onImprimirRecibo: (r: ReciboFiadoData) => void;
}) {
  const { data: cliente } = useQuery({
    queryKey: ["fiado-extrato", "cliente", clienteId],
    queryFn: async () => (await supabase.from("clientes").select("*").eq("id", clienteId).single()).data,
  });
  const { data: vendas = [] } = useQuery({
    queryKey: ["fiado-extrato", "vendas", clienteId],
    queryFn: async () => (await supabase.from("vendas")
      .select("*, itens_venda(*)").eq("cliente_id", clienteId).eq("forma_pagamento", "fiado")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["fiado-extrato", "pagamentos", clienteId],
    queryFn: async () => (await supabase.from("pagamentos_fiado")
      .select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })).data ?? [],
  });

  if (!cliente) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const totalCompras = vendas.reduce((s, v) => s + Number(v.total), 0);
  const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

  // monta extrato com lançamentos cronológicos
  type Lanc = { data: string; tipo: "venda" | "pagamento"; descricao: string; valor: number; saldo: number };
  const lancs: Lanc[] = [
    ...vendas.map((v) => ({ data: v.created_at, tipo: "venda" as const, descricao: `Venda #${v.numero_cupom}`, valor: Number(v.total), saldo: 0 })),
    ...pagamentos.map((p) => ({ data: p.created_at, tipo: "pagamento" as const, descricao: `Pagamento (${p.forma_pagamento})${p.observacoes ? " - " + p.observacoes : ""}`, valor: -Number(p.valor), saldo: 0 })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  let s = 0;
  for (const l of lancs) { s += l.valor; l.saldo = s; }
  lancs.reverse();

  return (
    <div>
      <PageHeader
        title={`Extrato — ${cliente.nome}`}
        description={cliente.documento ? `Doc: ${cliente.documento}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onVoltar}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            {Number(cliente.saldo_devedor) > 0 && (
              <Button onClick={() => onReceber(cliente)}><CreditCard className="h-4 w-4 mr-1" /> Receber pagamento</Button>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Saldo devedor</p><p className="text-2xl font-bold text-destructive mt-1">{brl(cliente.saldo_devedor)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Limite</p><p className="text-2xl font-bold mt-1">{brl(cliente.limite_credito)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total comprado (fiado)</p><p className="text-2xl font-bold mt-1">{brl(totalCompras)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total pago</p><p className="text-2xl font-bold text-success mt-1">{brl(totalPago)}</p></CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Extrato cronológico</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem lançamentos</TableCell></TableRow>}
              {lancs.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{dt(l.data)}</TableCell>
                  <TableCell>
                    <Badge variant={l.tipo === "venda" ? "destructive" : "default"} className="capitalize">{l.tipo}</Badge>
                  </TableCell>
                  <TableCell>{l.descricao}</TableCell>
                  <TableCell className={`text-right font-bold ${l.valor >= 0 ? "text-destructive" : "text-success"}`}>
                    {l.valor >= 0 ? "+" : ""}{brl(l.valor)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{brl(l.saldo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Pagamentos realizados</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {pagamentos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum pagamento</TableCell></TableRow>}
                {pagamentos.map((p, idx) => {
                  // saldo na época
                  const saldoNaEpoca = pagamentos.slice(0, idx + 1).reduce((s, x) => s + Number(x.valor), 0);
                  const saldoAnt = totalCompras - (saldoNaEpoca - Number(p.valor));
                  const saldoAt = saldoAnt - Number(p.valor);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{dt(p.created_at)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.forma_pagamento}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-success">{brl(p.valor)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" title="Reimprimir recibo"
                          onClick={() => onImprimirRecibo({
                            numero: p.id.slice(0, 8).toUpperCase(),
                            cliente: { nome: cliente.nome, documento: cliente.documento, telefone: cliente.telefone },
                            valor_pago: Number(p.valor),
                            forma_pagamento: p.forma_pagamento,
                            saldo_anterior: saldoAnt,
                            saldo_atual: saldoAt,
                            data: p.created_at,
                            observacoes: p.observacoes,
                          })}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vendas em fiado</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Itens</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {vendas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma venda</TableCell></TableRow>}
                {vendas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">#{v.numero_cupom}</TableCell>
                    <TableCell className="text-xs">{dt(v.created_at)}</TableCell>
                    <TableCell className="text-right">{(v.itens_venda as any[])?.length ?? 0}</TableCell>
                    <TableCell className="text-right font-bold">{brl(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
