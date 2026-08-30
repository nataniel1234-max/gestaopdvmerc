import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidarTudo } from "@/lib/sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/bi/KpiCard";
import { CaixaControles } from "@/components/CaixaControles";
import { brl, dt, dtShort } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowDownCircle, ArrowUpCircle, Banknote, Receipt, FileText, Wallet, ShoppingBag, Landmark,
} from "lucide-react";
import { useCategoriasFinanceiras, useCentrosCusto, useFormasPagamento } from "@/lib/predefinicoes";
import { DialogCredito } from "@/components/DialogCredito";
import { movimentarConta, NOME_CAIXA_EMPRESA } from "@/lib/caixa-empresa";
import { SelectContaDestino, DialogNovaConta, useContasFinanceiras } from "@/components/SelectContaDestino";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Movimentação e Fechamento | Mercadinho" },
      { name: "description", content: "Controle a movimentação de caixa: recebimentos, suprimentos, sangrias, despesas, pagamentos de contas e boletos, além dos fechamentos diários." },
      { property: "og:title", content: "Caixa — Movimentação e Fechamento" },
      { property: "og:description", content: "Entradas, saídas, pagamentos de contas e fechamentos de caixa em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaixaPage,
});

type Linha = { id: string; quando: string; tipo: string; descricao: string; valor: number; entrada: boolean; forma?: string | null };

function CaixaPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | "entrada" | "despesa" | "conta" | "credito" | "conta-bancaria">(null);

  const { data: caixa } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () =>
      (await supabase.from("caixas").select("*").eq("status", "aberto").order("aberto_em", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["caixa-pg-vendas", caixa?.id],
    enabled: !!caixa,
    queryFn: async () =>
      (await supabase.from("vendas").select("id, numero_cupom, total, forma_pagamento, created_at").eq("caixa_id", caixa!.id).eq("cancelada", false).order("created_at")).data ?? [],
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["caixa-movs", caixa?.id],
    enabled: !!caixa,
    queryFn: async () =>
      (await supabase.from("movimentacoes_caixa").select("*").eq("caixa_id", caixa!.id).order("created_at")).data ?? [],
  });

  const { data: fiado = [] } = useQuery({
    queryKey: ["caixa-fiado", caixa?.id],
    enabled: !!caixa,
    queryFn: async () =>
      ((await supabase.from("pagamentos_fiado").select("*, clientes(nome)").eq("caixa_id", caixa!.id).order("created_at")).data ?? []) as any[],
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ["caixas-fechados"],
    queryFn: async () =>
      (await supabase.from("caixas").select("*").eq("status", "fechado").order("fechado_em", { ascending: false }).limit(30)).data ?? [],
  });

  const linhas: Linha[] = useMemo(() => {
    const l: Linha[] = [];
    for (const v of vendas) {
      const aPrazo = v.forma_pagamento === "fiado";
      l.push({
        id: `v-${v.id}`, quando: v.created_at,
        tipo: aPrazo ? "Venda a prazo" : "Venda",
        descricao: `Cupom #${v.numero_cupom}`, valor: Number(v.total),
        entrada: !aPrazo, forma: v.forma_pagamento,
      });
    }
    for (const p of fiado) {
      l.push({
        id: `f-${p.id}`, quando: p.created_at, tipo: "Recebimento fiado",
        descricao: p.clientes?.nome ?? "Cliente", valor: Number(p.valor), entrada: true, forma: p.forma_pagamento,
      });
    }
    for (const m of movs) {
      // vendas, recebimentos de fiado e abertura já são contabilizados pelas suas origens
      if (m.tipo === "venda" || m.tipo === "recebimento_fiado" || m.tipo === "abertura" || m.tipo === "fechamento") continue;
      const entrada = m.tipo === "suprimento";
      l.push({
        id: `m-${m.id}`, quando: m.created_at,
        tipo: m.tipo === "sangria" ? "Sangria" : m.tipo === "suprimento" ? "Suprimento" : "Saída / Despesa",
        descricao: m.descricao ?? "—", valor: Number(m.valor), entrada, forma: m.forma_pagamento,
      });
    }
    return l.sort((a, b) => (a.quando < b.quando ? 1 : -1));
  }, [vendas, movs, fiado]);

  const resumo = useMemo(() => {
    let entradas = 0, saidas = 0, dinheiro = 0, totalVendas = 0, aPrazo = 0;
    for (const l of linhas) {
      if (l.tipo === "Venda" || l.tipo === "Venda a prazo") totalVendas += l.valor;
      if (l.tipo === "Venda a prazo") { aPrazo += l.valor; continue; } // não movimenta caixa
      if (l.entrada) entradas += l.valor; else saidas += l.valor;
      const emDinheiro = l.forma === "dinheiro" || (!l.entrada && !l.forma);
      if (emDinheiro) dinheiro += l.entrada ? l.valor : -l.valor;
    }
    const saldoDinheiro = Number(caixa?.valor_abertura ?? 0) + dinheiro;
    return { entradas, saidas, saldoDinheiro, totalVendas, aPrazo };
  }, [linhas, caixa]);

  const invalidar = () => {
    // Refresh amplo: caixa, contas financeiras, contas a pagar, dívidas,
    // despesas e todos os painéis de balanço / inteligência financeira.
    invalidarTudo(qc);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">Caixa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Movimentação do dia, recebimentos, saídas, pagamentos de contas e fechamento.
          </p>
        </div>
        <CaixaControles />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialog("entrada")}><ArrowDownCircle className="h-4 w-4 mr-1" /> Entrada de valores (empresa)</Button>
        <Button variant="outline" onClick={() => setDialog("despesa")}><Receipt className="h-4 w-4 mr-1" /> Saída para despesa (empresa)</Button>
        <Button variant="outline" onClick={() => setDialog("conta")}><FileText className="h-4 w-4 mr-1" /> Pagar conta / boleto</Button>
        <Button variant="outline" onClick={() => setDialog("credito")}><Landmark className="h-4 w-4 mr-1" /> Lançar crédito / empréstimo</Button>
        <Button variant="outline" onClick={() => setDialog("conta-bancaria")}><Wallet className="h-4 w-4 mr-1" /> Cadastrar conta bancária</Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Créditos, despesas e pagamentos lançados aqui movimentam o caixa financeiro da empresa ou a conta bancária escolhida — nunca o caixa do PDV.
      </p>

      {!caixa ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum caixa do PDV aberto. Os lançamentos financeiros da empresa acima continuam disponíveis.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Saldo em dinheiro (PDV)" value={brl(resumo.saldoDinheiro)} icon={Banknote} status="healthy" highlight
              hint={`Abertura ${brl(caixa.valor_abertura)}`} />
            <KpiCard label="Entradas" value={brl(resumo.entradas)} icon={ArrowDownCircle} status="neutral" hint="Vendas à vista, recebimentos de fiado e suprimentos" />
            <KpiCard label="Saídas" value={brl(resumo.saidas)} icon={ArrowUpCircle} status="warning" hint="Sangrias, despesas e pagamentos" />
            <KpiCard label="Vendas do caixa" value={brl(resumo.totalVendas)} icon={ShoppingBag} status="neutral"
              hint={`${vendas.length} cupons · a prazo ${brl(resumo.aPrazo)} (fora do caixa)`} />
          </div>


          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Movimentação do caixa aberto</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead>
                  <TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linhas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma movimentação</TableCell></TableRow>
                  ) : linhas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{dt(l.quando)}</TableCell>
                      <TableCell><Badge variant={l.entrada ? "secondary" : "outline"}>{l.tipo}</Badge></TableCell>
                      <TableCell className="font-medium">{l.descricao}</TableCell>
                      <TableCell className="capitalize">{l.forma ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${l.entrada ? "text-[color:var(--kpi-healthy)]" : "text-destructive"}`}>
                        {l.entrada ? "+" : "−"} {brl(l.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Fechamentos de caixa</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fechado em</TableHead><TableHead>Operador</TableHead>
              <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Dinheiro</TableHead>
              <TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Diferença</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {fechamentos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum fechamento registrado</TableCell></TableRow>
              ) : fechamentos.map((c) => {
                const dif = Number(c.diferenca ?? 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{c.fechado_em ? dt(c.fechado_em) : dtShort(c.aberto_em)}</TableCell>
                    <TableCell>{c.operador ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.qtd_vendas}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.total_dinheiro)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(c.total_sangrias) + Number(c.total_despesas))}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${dif === 0 ? "" : dif > 0 ? "text-[color:var(--kpi-healthy)]" : "text-destructive"}`}>
                      {brl(dif)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PosicaoFinanceira />

      <DialogMovimento
        tipo={dialog === "entrada" ? "suprimento" : "despesa"}
        open={dialog === "entrada" || dialog === "despesa"}
        onOpenChange={(v) => { if (!v) setDialog(null); }}
        onDone={() => { setDialog(null); invalidar(); }}
      />
      <DialogPagarConta
        open={dialog === "conta"}
        onOpenChange={(v) => { if (!v) setDialog(null); }}
        onDone={() => { setDialog(null); invalidar(); }}
      />

      <DialogCredito
        open={dialog === "credito"}
        onOpenChange={(v) => { if (!v) setDialog(null); }}
        onDone={() => { setDialog(null); invalidar(); }}
      />

      <DialogNovaConta
        open={dialog === "conta-bancaria"}
        onOpenChange={(v) => { if (!v) setDialog(null); }}
        onCreated={() => invalidar()}
      />

    </div>
  );
}

function DialogMovimento({
  tipo, open, onOpenChange, onDone,
}: { tipo: "suprimento" | "despesa"; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [categoriaId, setCategoriaId] = useState<string>("none");
  const [centroId, setCentroId] = useState<string>("none");
  const [contaId, setContaId] = useState<string>("");
  const { data: categorias = [] } = useCategoriasFinanceiras(tipo === "despesa" ? "despesa" : "receita");
  const { data: centros = [] } = useCentrosCusto();
  const { data: contasFin = [] } = useContasFinanceiras(open);

  const salvar = useMutation({
    mutationFn: async () => {
      const v = Number(valor);
      if (!(v > 0)) throw new Error("Informe um valor válido");
      // Movimenta apenas a conta financeira da empresa — nunca o caixa aberto no PDV.
      if (!contaId) throw new Error("Selecione a conta de origem/destino");
      const nomeConta = contasFin.find((c) => c.id === contaId)?.nome ?? "conta da empresa";
      await movimentarConta(contaId, tipo === "suprimento" ? v : -v);
      if (tipo === "despesa") {
        const { error: e2 } = await supabase.from("despesas").insert({
          descricao: descricao || "Saída de caixa",
          valor: v,
          data: new Date().toISOString().slice(0, 10),
          forma_pagamento: forma,
          categoria_id: categoriaId === "none" ? null : categoriaId,
          centro_custo_id: centroId === "none" ? null : centroId,
          observacoes: `Pago por: ${nomeConta}`,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(tipo === "suprimento" ? "Entrada registrada" : "Saída registrada");
      setValor(""); setDescricao(""); setCategoriaId("none"); setCentroId("none");
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tipo === "suprimento" ? `Entrada de valores no ${NOME_CAIXA_EMPRESA.toLowerCase()}` : "Saída para despesa (empresa)"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Este lançamento afeta o caixa financeiro da empresa e os relatórios — não entra no caixa do PDV.
        </p>
        <div className="grid gap-3 py-2">
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
          <SelectContaDestino
            value={contaId}
            onChange={setContaId}
            enabled={open}
            label={tipo === "suprimento" ? "Conta de destino" : "Conta de origem do pagamento"}
          />
          <div>
            <Label>Forma</Label>
            <Select value={forma} onValueChange={(v) => setForma(v as Forma)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["dinheiro", "pix", "debito", "credito"] as Forma[]).map((f) => (
                  <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipo === "despesa" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de custo</Label>
                <Select value={centroId} onValueChange={setCentroId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={salvar.isPending || !valor} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogPagarConta({
  open, onOpenChange, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [contaId, setContaId] = useState<string>("");
  const [forma, setForma] = useState<string>("dinheiro");
  const [contaFinId, setContaFinId] = useState<string>("");
  const { data: formas = [] } = useFormasPagamento();

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-pagar-abertas"],
    enabled: open,
    queryFn: async () =>
      ((await supabase
        .from("contas_pagar")
        .select("id, descricao, valor, data_vencimento, fornecedores(razao_social)")
        .in("status", ["pendente", "atrasada"])
        .order("data_vencimento")).data ?? []) as any[],
  });

  const conta = contas.find((c) => c.id === contaId);
  const { data: contasFin = [] } = useContasFinanceiras(open);

  const pagar = useMutation({
    mutationFn: async () => {
      if (!conta) throw new Error("Selecione uma conta");
      // O pagamento sai da conta financeira escolhida (caixa da empresa ou banco), nunca do caixa do PDV.
      if (!contaFinId) throw new Error("Selecione a conta de pagamento");
      const nomeConta = contasFin.find((c) => c.id === contaFinId)?.nome ?? "conta da empresa";
      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("contas_pagar")
        .update({
          status: "paga",
          data_pagamento: hoje,
          forma_pagamento: forma,
          observacoes: `Pago por: ${nomeConta}`,
        })
        .eq("id", conta.id);
      if (error) throw error;
      await movimentarConta(contaFinId, -Number(conta.valor));
    },
    onSuccess: () => { toast.success("Conta paga"); setContaId(""); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao pagar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pagar conta, compra ou boleto</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Conta em aberto *</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {contas.length === 0 ? (
                  <SelectItem value="vazio" disabled>Nenhuma conta em aberto</SelectItem>
                ) : contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {dtShort(c.data_vencimento)} · {c.descricao} · {brl(c.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SelectContaDestino value={contaFinId} onChange={setContaFinId} enabled={open} label="Pagar com (conta da empresa)" />
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                {formas.filter((f) => f.tipo_base !== "dinheiro").map((f) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                ))}
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Transferência">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {conta && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Valor a pagar: <span className="font-bold tabular-nums">{brl(conta.valor)}</span></span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pagar.isPending || !contaId} onClick={() => pagar.mutate()}>
            {pagar.isPending ? "Pagando…" : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Posição financeira consolidada: caixa/bancos, compromissos e crédito tomado. */
function PosicaoFinanceira() {
  const { data: bancos = [] } = useQuery({
    queryKey: ["bal-bancos"],
    queryFn: async () => (await supabase.from("contas_bancarias").select("id, nome, saldo").eq("ativo", true)).data ?? [],
  });
  const { data: dividas = [] } = useQuery({
    queryKey: ["dividas"],
    queryFn: async () => (await supabase.from("dividas").select("credor, saldo_devedor, valor_parcela, status").in("status", ["ativa", "renegociada"])).data ?? [],
  });
  const { data: aPagar = [] } = useQuery({
    queryKey: ["contas-pagar-abertas"],
    queryFn: async () => (await supabase.from("contas_pagar").select("valor, data_vencimento, status").in("status", ["pendente", "atrasada"])).data ?? [],
  });

  const saldoBancos = bancos.reduce((s, b) => s + Number(b.saldo ?? 0), 0);
  const totalDividas = dividas.reduce((s, d) => s + Number(d.saldo_devedor ?? 0), 0);
  const parcelasMes = dividas.reduce((s, d) => s + Number(d.valor_parcela ?? 0), 0);
  const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const aPagarMes = aPagar.filter((c) => c.data_vencimento <= fimMes).reduce((s, c) => s + Number(c.valor), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Posição financeira</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Caixa da empresa e bancos" value={brl(saldoBancos)} icon={Wallet} status="neutral" hint={`${bancos.length} conta(s) financeiras`} />
        <KpiCard label="A pagar até o fim do mês" value={brl(aPagarMes)} icon={FileText} status={aPagarMes > 0 ? "warning" : "healthy"} hint="Contas a pagar pendentes e atrasadas" />
        <KpiCard label="Crédito tomado (saldo)" value={brl(totalDividas)} icon={Landmark} status={totalDividas > 0 ? "warning" : "healthy"} hint={`${dividas.length} contrato(s) ativo(s)`} />
        <KpiCard label="Parcelas mensais" value={brl(parcelasMes)} icon={Receipt} status="neutral" hint="Compromisso fixo mensal com credores" />
      </CardContent>
    </Card>
  );
}
