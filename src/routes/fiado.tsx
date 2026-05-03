import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl, dt } from "@/lib/format";
import { CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { exigirCaixaAberto } from "@/lib/caixa";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];

export const Route = createFileRoute("/fiado")({
  head: () => ({ meta: [{ title: "Fiado / Crediário — Mercadinho" }] }),
  component: FiadoPage,
});

function FiadoPage() {
  const qc = useQueryClient();
  const [clienteSel, setClienteSel] = useState<{ id: string; nome: string; saldo_devedor: number } | null>(null);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [obs, setObs] = useState("");

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

      const novoSaldo = Number(clienteSel.saldo_devedor) - v;
      const { error: e2 } = await supabase.from("clientes").update({ saldo_devedor: novoSaldo }).eq("id", clienteSel.id);
      if (e2) throw e2;

      await supabase.from("movimentacoes_caixa").insert({
        caixa_id, tipo: "recebimento_fiado", forma_pagamento: forma, valor: v,
        descricao: `Recebimento fiado — ${clienteSel.nome}`, referencia_id: pag?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setClienteSel(null); setValor(""); setObs("");
      qc.invalidateQueries({ queryKey: ["clientes-fiado"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-fiado"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
                      <TableCell><Button size="sm" onClick={() => { setClienteSel({ id: c.id, nome: c.nome, saldo_devedor: Number(c.saldo_devedor) }); setValor(String(c.saldo_devedor)); }}>Receber</Button></TableCell>
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
            <div><Label>Valor a receber</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
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
    </div>
  );
}
