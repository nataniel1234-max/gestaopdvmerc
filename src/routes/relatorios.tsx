import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, dt } from "@/lib/format";
import { Download, Printer, FileBarChart, Wallet, Package, ShoppingCart, CreditCard } from "lucide-react";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Mercadinho" }] }),
  component: RelatoriosPage,
});

function inicioDia(d: string) { return new Date(d + "T00:00:00").toISOString(); }
function fimDia(d: string) { return new Date(d + "T23:59:59.999").toISOString(); }

function csv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[,;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function RelatoriosPage() {
  const hoje = new Date().toISOString().slice(0, 10);
  const semana = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [de, setDe] = useState(semana);
  const [ate, setAte] = useState(hoje);

  const { data: caixas = [] } = useQuery({
    queryKey: ["rel-caixas", de, ate],
    queryFn: async () => (await supabase.from("caixas").select("*")
      .gte("aberto_em", inicioDia(de)).lte("aberto_em", fimDia(ate))
      .order("aberto_em", { ascending: false })).data ?? [],
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["rel-vendas", de, ate],
    queryFn: async () => (await supabase.from("vendas").select("*, clientes(nome)")
      .gte("created_at", inicioDia(de)).lte("created_at", fimDia(ate))
      .eq("cancelada", false).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["rel-movs", de, ate],
    queryFn: async () => (await supabase.from("movimentacoes_caixa").select("*")
      .gte("created_at", inicioDia(de)).lte("created_at", fimDia(ate))
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: pagFiado = [] } = useQuery({
    queryKey: ["rel-fiado", de, ate],
    queryFn: async () => (await supabase.from("pagamentos_fiado").select("*, clientes(nome)")
      .gte("created_at", inicioDia(de)).lte("created_at", fimDia(ate))
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: estoqueMov = [] } = useQuery({
    queryKey: ["rel-estoque", de, ate],
    queryFn: async () => (await supabase.from("movimentacoes_estoque").select("*, produtos(nome, unidade)")
      .gte("created_at", inicioDia(de)).lte("created_at", fimDia(ate))
      .order("created_at", { ascending: false })).data ?? [],
  });

  const totVendas = useMemo(() => vendas.reduce((s, v) => s + Number(v.total), 0), [vendas]);
  const porForma = useMemo(() => {
    const r: Record<string, number> = { dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0 };
    vendas.forEach((v) => { r[v.forma_pagamento] = (r[v.forma_pagamento] ?? 0) + Number(v.total); });
    return r;
  }, [vendas]);
  const totRecebFiado = useMemo(() => pagFiado.reduce((s, p) => s + Number(p.valor), 0), [pagFiado]);
  const totSangrias = movs.filter((m) => m.tipo === "sangria").reduce((s, m) => s + Number(m.valor), 0);
  const totSuprimentos = movs.filter((m) => m.tipo === "suprimento").reduce((s, m) => s + Number(m.valor), 0);
  const totDespesas = movs.filter((m) => m.tipo === "despesa").reduce((s, m) => s + Number(m.valor), 0);

  const presets = [
    { label: "Hoje", de: hoje, ate: hoje },
    { label: "7 dias", de: semana, ate: hoje },
    { label: "Mês atual", de: hoje.slice(0, 8) + "01", ate: hoje },
  ];

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Acompanhamento de vendas, caixas, fiado e estoque por período."
        actions={
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir página</Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          <div className="flex gap-1">
            {presets.map((p) => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => { setDe(p.de); setAte(p.ate); }}>{p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <Mini icon={<ShoppingCart className="h-4 w-4" />} label="Vendas" value={brl(totVendas)} sub={`${vendas.length} cupons`} />
        <Mini icon={<CreditCard className="h-4 w-4" />} label="Fiado recebido" value={brl(totRecebFiado)} sub={`${pagFiado.length} pagamentos`} />
        <Mini icon={<Wallet className="h-4 w-4" />} label="Saldo movimentos" value={brl(totSuprimentos - totSangrias - totDespesas)} sub={`+${brl(totSuprimentos)} / -${brl(totSangrias + totDespesas)}`} />
        <Mini icon={<Package className="h-4 w-4" />} label="Movimentações estoque" value={String(estoqueMov.length)} sub="entradas + saídas" />
      </div>

      <Tabs defaultValue="caixas">
        <TabsList>
          <TabsTrigger value="caixas"><Wallet className="h-4 w-4 mr-1" /> Caixas</TabsTrigger>
          <TabsTrigger value="vendas"><ShoppingCart className="h-4 w-4 mr-1" /> Vendas</TabsTrigger>
          <TabsTrigger value="movs"><FileBarChart className="h-4 w-4 mr-1" /> Movim. de caixa</TabsTrigger>
          <TabsTrigger value="fiado"><CreditCard className="h-4 w-4 mr-1" /> Fiado</TabsTrigger>
          <TabsTrigger value="estoque"><Package className="h-4 w-4 mr-1" /> Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="caixas">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Fechamentos de caixa</CardTitle>
              <Button size="sm" variant="outline" onClick={() => download(`caixas_${de}_${ate}.csv`,
                csv([["Abertura", "Fechamento", "Operador", "Cupons", "Dinheiro", "PIX", "Débito", "Crédito", "Fiado", "Esperado", "Contado", "Diferença"],
                  ...caixas.map((c) => [dt(c.aberto_em), c.fechado_em ? dt(c.fechado_em) : "—", c.operador ?? "—", c.qtd_vendas, Number(c.total_dinheiro), Number(c.total_pix), Number(c.total_debito), Number(c.total_credito), Number(c.total_fiado), Number(c.valor_fechamento_calculado ?? 0), Number(c.valor_fechamento_informado ?? 0), Number(c.diferenca ?? 0)])]))}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Abertura</TableHead><TableHead>Fechamento</TableHead><TableHead>Operador</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Cupons</TableHead><TableHead className="text-right">Dinheiro</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Diferença</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {caixas.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem caixas no período</TableCell></TableRow>}
                  {caixas.map((c) => {
                    const dif = Number(c.diferenca ?? 0);
                    const totVend = Number(c.total_dinheiro) + Number(c.total_pix) + Number(c.total_debito) + Number(c.total_credito) + Number(c.total_fiado);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{dt(c.aberto_em)}</TableCell>
                        <TableCell className="text-xs">{c.fechado_em ? dt(c.fechado_em) : "—"}</TableCell>
                        <TableCell className="text-xs">{c.operador ?? "—"}</TableCell>
                        <TableCell><Badge variant={c.status === "aberto" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{c.qtd_vendas}</TableCell>
                        <TableCell className="text-right">{brl(c.total_dinheiro)}</TableCell>
                        <TableCell className="text-right font-bold">{brl(totVend)}</TableCell>
                        <TableCell className={`text-right font-bold ${Math.abs(dif) < 0.005 ? "" : "text-destructive"}`}>{brl(dif)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendas">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Vendas — totais por forma</CardTitle>
              <Button size="sm" variant="outline" onClick={() => download(`vendas_${de}_${ate}.csv`,
                csv([["Cupom", "Data", "Cliente", "Forma", "Subtotal", "Desconto", "Total"],
                  ...vendas.map((v) => [v.numero_cupom, dt(v.created_at), v.clientes?.nome ?? "Consumidor", v.forma_pagamento, Number(v.subtotal), Number(v.desconto), Number(v.total)])]))}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {(["dinheiro", "pix", "debito", "credito", "fiado"] as const).map((f) => (
                  <div key={f} className="border rounded-md p-2 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">{f}</div>
                    <div className="font-bold">{brl(porForma[f] ?? 0)}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {vendas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem vendas</TableCell></TableRow>}
                    {vendas.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono">#{v.numero_cupom}</TableCell>
                        <TableCell className="text-xs">{dt(v.created_at)}</TableCell>
                        <TableCell>{v.clientes?.nome ?? "Consumidor"}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{v.forma_pagamento}</Badge></TableCell>
                        <TableCell className="text-right font-bold">{brl(v.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movs">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Sangrias, suprimentos e despesas</CardTitle>
              <Button size="sm" variant="outline" onClick={() => download(`movimentacoes_${de}_${ate}.csv`,
                csv([["Data", "Tipo", "Forma", "Descrição", "Valor"],
                  ...movs.map((m) => [dt(m.created_at), m.tipo, m.forma_pagamento ?? "", m.descricao ?? "", Number(m.valor)])]))}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Forma</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {movs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem movimentações</TableCell></TableRow>}
                  {movs.map((m) => {
                    const sai = m.tipo === "sangria" || m.tipo === "despesa";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{dt(m.created_at)}</TableCell>
                        <TableCell><Badge variant={sai ? "destructive" : "default"} className="capitalize">{m.tipo}</Badge></TableCell>
                        <TableCell className="text-xs capitalize">{m.forma_pagamento ?? "—"}</TableCell>
                        <TableCell className="text-xs">{m.descricao ?? "—"}</TableCell>
                        <TableCell className={`text-right font-bold ${sai ? "text-destructive" : "text-success"}`}>{sai ? "-" : "+"}{brl(m.valor)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiado">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Pagamentos de fiado recebidos</CardTitle>
              <Button size="sm" variant="outline" onClick={() => download(`fiado_${de}_${ate}.csv`,
                csv([["Data", "Cliente", "Forma", "Valor", "Observações"],
                  ...pagFiado.map((p) => [dt(p.created_at), p.clientes?.nome ?? "—", p.forma_pagamento, Number(p.valor), p.observacoes ?? ""])]))}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pagFiado.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem pagamentos</TableCell></TableRow>}
                  {pagFiado.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{dt(p.created_at)}</TableCell>
                      <TableCell>{p.clientes?.nome ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.forma_pagamento}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-success">{brl(p.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estoque">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Movimentações de estoque</CardTitle>
              <Button size="sm" variant="outline" onClick={() => download(`estoque_${de}_${ate}.csv`,
                csv([["Data", "Produto", "Tipo", "Motivo", "Quantidade", "Anterior", "Novo"],
                  ...estoqueMov.map((m) => [dt(m.created_at), (m as any).produtos?.nome ?? "—", m.tipo, m.motivo, Number(m.quantidade), Number(m.estoque_anterior), Number(m.estoque_novo)])]))}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Anterior → Novo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {estoqueMov.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem movimentações</TableCell></TableRow>}
                  {estoqueMov.map((m) => {
                    const sai = String(m.tipo).startsWith("saida");
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{dt(m.created_at)}</TableCell>
                        <TableCell>{(m as any).produtos?.nome ?? "—"}</TableCell>
                        <TableCell><Badge variant={sai ? "destructive" : "default"} className="capitalize">{String(m.tipo).replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-xs capitalize">{m.motivo}</TableCell>
                        <TableCell className={`text-right font-bold ${sai ? "text-destructive" : "text-success"}`}>{sai ? "-" : "+"}{Number(m.quantidade)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{Number(m.estoque_anterior)} → {Number(m.estoque_novo)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Mini({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </CardContent></Card>
  );
}
