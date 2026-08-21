import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Minus, ShoppingCart, Barcode, X, Printer, User, Banknote, CreditCard, Smartphone, BookOpen, LogOut, Store, Scale, Share2, Download } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { aplicarMovimentacao } from "@/lib/estoque";
import { exigirCaixaAberto } from "@/lib/caixa";

import { CupomVenda, type VendaCompleta } from "@/components/CupomVenda";
import { CaixaControles } from "@/components/CaixaControles";
import { imprimirDocumento } from "@/lib/print-config";
import { compartilharCupom, gerarCupomJPG, baixarBlob } from "@/lib/cupom-imagem";
import type { Database } from "@/integrations/supabase/types";

type Forma = Database["public"]["Enums"]["forma_pagamento"];

export const Route = createFileRoute("/pdv")({
  head: () => ({ meta: [{ title: "PDV — Frente de Caixa" }] }),
  component: PDVPage,
});

type ProdutoPDV = {
  id: string; nome: string; codigo_barras: string | null;
  preco_venda: number; preco_custo?: number | null; estoque_atual: number; unidade: string;
  vendido_por_peso?: boolean;
};

type Carrinho = {
  produto_id: string;
  produto_nome: string;
  preco_unitario: number;
  quantidade: number;
  estoque_disponivel: number;
  preco_custo: number;
  unidade: string;
  vendido_por_peso?: boolean;
};

function PDVPage() {
  const qc = useQueryClient();
  const inputBuscaRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Carrinho[]>([]);
  const [cliente_id, setClienteId] = useState<string>("");
  const [desconto, setDesconto] = useState("0");
  const [pagOpen, setPagOpen] = useState(false);
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [cupomFinal, setCupomFinal] = useState<VendaCompleta | null>(null);
  const cupomRef = useRef<HTMLDivElement>(null);
  const [gerandoImg, setGerandoImg] = useState(false);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-pdv"],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, codigo_barras, preco_venda, preco_custo, estoque_atual, unidade, vendido_por_peso").eq("ativo", true).order("nome")).data ?? [],
    staleTime: 2 * 60_000,
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-pdv"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome, permite_fiado, limite_credito, saldo_devedor").eq("ativo", true).order("nome")).data ?? [],
    staleTime: 2 * 60_000,
  });
  const { data: caixaAberto } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => (await supabase.from("caixas").select("id, aberto_em, operador").eq("status", "aberto").order("aberto_em", { ascending: false }).limit(1).maybeSingle()).data,
    staleTime: 60_000,
  });

  const clienteSel = useMemo(() => clientes.find((c) => c.id === cliente_id), [clientes, cliente_id]);
  const buscaDeferida = useDeferredValue(busca);
  const sugestoes = useMemo(() => {
    if (buscaDeferida.length < 1) return [];
    const q = buscaDeferida.toLowerCase();
    const out: typeof produtos = [];
    for (let i = 0; i < produtos.length && out.length < 6; i++) {
      const p = produtos[i];
      if (p.nome.toLowerCase().includes(q) || (p.codigo_barras ?? "").includes(buscaDeferida)) out.push(p);
    }
    return out;
  }, [produtos, buscaDeferida]);

  const subtotal = carrinho.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const total = Math.max(0, subtotal - Number(desconto || 0));
  const troco = forma === "dinheiro" ? Math.max(0, Number(valorRecebido || 0) - total) : 0;

  useEffect(() => { inputBuscaRef.current?.focus(); }, []);

  // Atalhos globais (quando modal de pagamento aberto)
  useEffect(() => {
    if (!pagOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc fecha modal
      if (e.key === "Escape") { e.preventDefault(); setPagOpen(false); return; }
      // Atalhos de forma de pagamento (Alt para não conflitar com input numérico)
      const k = e.key.toLowerCase();
      if (e.altKey || (e.target as HTMLElement)?.tagName !== "INPUT") {
        if (k === "d") { e.preventDefault(); setForma("dinheiro"); }
        else if (k === "p") { e.preventDefault(); setForma("pix"); }
        else if (k === "x") { e.preventDefault(); setForma("debito"); }
        else if (k === "c") { e.preventDefault(); setForma("credito"); }
        else if (k === "f") { e.preventDefault(); setForma("fiado"); }
      }
      // Enter ou F4 confirma
      if (e.key === "F4" || (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "TEXTAREA")) {
        if (forma !== "dinheiro" || Number(valorRecebido) >= total) {
          e.preventDefault();
          finalizar.mutate();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagOpen, forma, valorRecebido, total]);

  // Modal para informar peso de produtos pesáveis
  const [pesoOpen, setPesoOpen] = useState(false);
  const [pesoProduto, setPesoProduto] = useState<ProdutoPDV | null>(null);
  const [pesoValor, setPesoValor] = useState("");
  const [pesoUnidade, setPesoUnidade] = useState<"kg" | "g">("kg");

  const adicionarItem = (p: ProdutoPDV, quantidade: number) => {
    setCarrinho((prev) => {
      const ex = prev.find((x) => x.produto_id === p.id);
      if (ex) {
        const nova = ex.quantidade + quantidade;
        if (nova > Number(p.estoque_atual)) { toast.warning("Estoque insuficiente"); return prev; }
        return prev.map((x) => x.produto_id === p.id ? { ...x, quantidade: nova } : x);
      }
      if (quantidade > Number(p.estoque_atual)) { toast.warning(`${p.nome}: estoque insuficiente`); return prev; }
      return [...prev, {
        produto_id: p.id, produto_nome: p.nome,
        preco_unitario: Number(p.preco_venda), quantidade,
        estoque_disponivel: Number(p.estoque_atual), preco_custo: Number(p.preco_custo ?? 0), unidade: p.unidade,
        vendido_por_peso: p.vendido_por_peso,
      }];
    });
  };

  const adicionar = (p: ProdutoPDV) => {
    if (Number(p.estoque_atual) <= 0) { toast.warning(`${p.nome} sem estoque`); return; }
    if (p.vendido_por_peso) {
      setPesoProduto(p);
      setPesoValor("");
      setPesoUnidade("kg");
      setPesoOpen(true);
      return;
    }
    adicionarItem(p, 1);
    setBusca("");
    inputBuscaRef.current?.focus();
  };

  const confirmarPeso = () => {
    if (!pesoProduto) return;
    const v = Number(pesoValor.replace(",", "."));
    if (!v || v <= 0) { toast.warning("Informe um peso válido"); return; }
    const kg = pesoUnidade === "g" ? v / 1000 : v;
    if (kg > Number(pesoProduto.estoque_atual)) {
      toast.warning(`Estoque disponível: ${Number(pesoProduto.estoque_atual)} kg`);
      return;
    }
    adicionarItem(pesoProduto, kg);
    setPesoOpen(false); setPesoProduto(null); setPesoValor(""); setBusca("");
    inputBuscaRef.current?.focus();
  };

  // Enter / scanner: se há sugestões, adiciona a primeira; se for código exato, adiciona direto
  const handleBuscaKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const exato = produtos.find((p) => p.codigo_barras === busca);
      if (exato) return adicionar(exato);
      if (sugestoes[0]) return adicionar(sugestoes[0]);
    }
    if (e.key === "F2") { e.preventDefault(); if (carrinho.length) setPagOpen(true); }
  };

  const setQtd = (id: string, q: number) => setCarrinho((prev) =>
    prev.map((x) => x.produto_id === id ? { ...x, quantidade: Math.max(0.001, Math.min(q, x.estoque_disponivel)) } : x));
  const remover = (id: string) => setCarrinho((prev) => prev.filter((x) => x.produto_id !== id));
  const limpar = () => { if (carrinho.length === 0 || confirm("Cancelar venda atual?")) { setCarrinho([]); setDesconto("0"); setClienteId(""); setObservacoes(""); } };

  const finalizar = useMutation({
    mutationFn: async () => {
      if (carrinho.length === 0) throw new Error("Carrinho vazio");
      if (forma === "fiado") {
        if (!clienteSel) throw new Error("Selecione um cliente para fiado");
        if (!clienteSel.permite_fiado) throw new Error("Cliente não tem fiado liberado");
        const novoSaldo = Number(clienteSel.saldo_devedor) + total;
        if (Number(clienteSel.limite_credito) > 0 && novoSaldo > Number(clienteSel.limite_credito)) {
          throw new Error(`Excede limite de crédito (${brl(clienteSel.limite_credito)})`);
        }
      }
      if (forma === "dinheiro" && Number(valorRecebido) < total) throw new Error("Valor recebido insuficiente");

      const caixa_id = await exigirCaixaAberto();

      const { data: venda, error } = await supabase.from("vendas").insert({
        cliente_id: cliente_id || null,
        forma_pagamento: forma,
        subtotal, desconto: Number(desconto || 0), total,
        valor_recebido: forma === "dinheiro" ? Number(valorRecebido) : total,
        troco, observacoes: observacoes || null,
        caixa_id,
      }).select("*, clientes(nome)").single();
      if (error) throw error;

      for (const it of carrinho) {
        await supabase.from("itens_venda").insert({
          venda_id: venda.id, produto_id: it.produto_id, produto_nome: it.produto_nome,
          quantidade: it.quantidade, preco_unitario: it.preco_unitario, subtotal: it.quantidade * it.preco_unitario,
        });
        await aplicarMovimentacao({
          produto_id: it.produto_id, tipo: "saida_venda", motivo: "venda",
          quantidade: it.quantidade, referencia_id: venda.id,
          custo_unitario: it.preco_custo || null,
        });
      }

      if (forma === "fiado" && clienteSel) {
        await supabase.from("clientes")
          .update({ saldo_devedor: Number(clienteSel.saldo_devedor) + total })
          .eq("id", clienteSel.id);
      }

      // Venda fiado não entra no caixa: só vira caixa no recebimento do fiado
      if (forma !== "fiado") {
        await supabase.from("movimentacoes_caixa").insert({
          caixa_id, tipo: "venda", forma_pagamento: forma, valor: total,
          descricao: `Venda #${venda.numero_cupom}`, referencia_id: venda.id,
        });
      }

      const { data: completa } = await supabase.from("vendas")
        .select("*, clientes(nome), itens_venda(*)").eq("id", venda.id).single();
      return completa as VendaCompleta;
    },
    onSuccess: (v) => {
      toast.success(`Venda #${v.numero_cupom} finalizada!`);
      setCupomFinal(v);
      setCarrinho([]); setDesconto("0"); setClienteId(""); setObservacoes(""); setValorRecebido("");
      setPagOpen(false); setForma("dinheiro");
      qc.invalidateQueries({ queryKey: ["produtos-pdv"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["caixa-vendas"] });
      qc.invalidateQueries({ queryKey: ["caixa-movs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nomeArquivoCupom = () => `cupom-${cupomFinal?.numero_cupom ?? "venda"}.jpg`;

  const baixarJPG = async () => {
    if (!cupomRef.current) return;
    setGerandoImg(true);
    try {
      const { blob } = await gerarCupomJPG(cupomRef.current, nomeArquivoCupom());
      baixarBlob(blob, nomeArquivoCupom());
      toast.success("Cupom salvo em JPG");
    } catch { toast.error("Não foi possível gerar a imagem"); }
    finally { setGerandoImg(false); }
  };

  const compartilharWhats = async () => {
    if (!cupomRef.current || !cupomFinal) return;
    setGerandoImg(true);
    try {
      const modo = await compartilharCupom({
        el: cupomRef.current,
        nomeArquivo: nomeArquivoCupom(),
        texto: `Cupom #${cupomFinal.numero_cupom} — Total ${brl(cupomFinal.total)}`,
      });
      if (modo === "download") toast.info("Imagem baixada — anexe no WhatsApp que foi aberto.");
    } catch { toast.error("Não foi possível compartilhar o cupom"); }
    finally { setGerandoImg(false); }
  };

  const formaIcon: Record<Forma, React.ReactNode> = {
    dinheiro: <Banknote className="h-4 w-4" />, debito: <CreditCard className="h-4 w-4" />,
    credito: <CreditCard className="h-4 w-4" />, pix: <Smartphone className="h-4 w-4" />, fiado: <BookOpen className="h-4 w-4" />,
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Barra superior do PDV (sempre visível) */}
      <header className="flex flex-wrap items-center gap-2 md:gap-3 border-b bg-card px-3 md:px-4 py-2 md:h-14 md:py-0 sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2 font-bold text-sm md:text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          <span className="hidden xs:inline sm:inline">PDV — Frente de Caixa</span>
          <span className="sm:hidden">PDV</span>
        </div>
        <div className="order-3 w-full md:order-none md:w-auto md:flex-1 overflow-x-auto">
          <div className="flex md:justify-end">
            <CaixaControles />
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto md:ml-2"
          onClick={() => {
            // Se foi aberto em nova janela, fecha. Senão volta ao dashboard.
            window.close();
            setTimeout(() => {
              if (!window.closed) window.location.href = "/";
            }, 100);
          }}
        >
          <LogOut className="h-4 w-4 mr-1" /> Sair do PDV
        </Button>
      </header>

      {!caixaAberto ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-xl w-full" style={{ background: "var(--gradient-primary)" }}>
            <CardContent className="p-8 text-center text-primary-foreground">
              <Store className="h-16 w-16 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl font-bold mb-2">Caixa fechado</h2>
              <p className="opacity-90 mb-2">Para iniciar as vendas, abra o caixa pelo botão <strong>Abrir caixa</strong> na barra superior.</p>
              <p className="text-xs opacity-80">Toda abertura, fechamento, sangria, suprimento e conferência agora são feitos aqui mesmo no PDV.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-4 px-3 md:px-6 py-3 md:py-6 flex-1 pb-28 lg:pb-6">
          {/* Lado esquerdo: busca + carrinho */}
      <div className="flex flex-col gap-4 min-w-0">
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Barcode className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <Input
                ref={inputBuscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={handleBuscaKey}
                placeholder="Bipe o código ou busque o produto…"
                className="pl-10 h-12 text-base"
                autoFocus
              />
              {sugestoes.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border rounded-md shadow-elevated max-h-72 overflow-auto">
                  {sugestoes.map((p) => (
                    <button key={p.id} onClick={() => adicionar(p)} className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between items-center border-b last:border-0">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {p.nome}
                          {p.vendido_por_peso && <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"><Scale className="h-3 w-3" /> peso</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.codigo_barras ?? "—"} · estoque: {Number(p.estoque_atual)} {p.unidade}</div>
                      </div>
                      <div className="font-bold text-primary">{brl(p.preco_venda)}{p.vendido_por_peso ? "/kg" : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col">
          <CardHeader className="py-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Itens ({carrinho.length})</CardTitle>
            {carrinho.length > 0 && <Button size="sm" variant="ghost" onClick={limpar}><X className="h-4 w-4 mr-1" /> Cancelar venda</Button>}
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {carrinho.length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum item. Bipe um código de barras ou busque um produto.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {carrinho.map((it) => (
                  <div key={it.produto_id} className="flex flex-wrap items-center gap-2 md:gap-3 p-3 border rounded-md hover:bg-accent/30">
                    <div className="flex-1 min-w-[55%]">
                      <div className="font-medium truncate flex items-center gap-2">
                        {it.produto_nome}
                        {it.vendido_por_peso && <Scale className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {brl(it.preco_unitario)} / {it.vendido_por_peso ? "kg" : it.unidade}
                        {it.vendido_por_peso && <> · <strong>{(it.quantidade * 1000).toFixed(0)} g</strong> ({it.quantidade.toFixed(3)} kg)</>}
                      </div>
                    </div>
                    {it.vendido_por_peso ? (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => {
                        const p = produtos.find((x) => x.id === it.produto_id);
                        if (!p) return;
                        // Reabre modal de peso pré-preenchido; remove o item atual e re-adiciona
                        setCarrinho((prev) => prev.filter((x) => x.produto_id !== it.produto_id));
                        setPesoProduto(p as ProdutoPDV);
                        setPesoValor(String(it.quantidade));
                        setPesoUnidade("kg");
                        setPesoOpen(true);
                      }}>
                        <Scale className="h-3 w-3 mr-1" /> Alterar peso
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQtd(it.produto_id, it.quantidade - 1)}><Minus className="h-3 w-3" /></Button>
                        <Input type="number" step="0.001" value={it.quantidade}
                          onChange={(e) => setQtd(it.produto_id, Number(e.target.value))}
                          className="w-16 h-8 text-center" />
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQtd(it.produto_id, it.quantidade + 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    )}
                    <div className="w-20 md:w-24 text-right font-bold tabular-nums">{brl(it.quantidade * it.preco_unitario)}</div>
                    <Button size="icon" variant="ghost" onClick={() => remover(it.produto_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lado direito: resumo + finalizar */}
      <Card className="h-fit order-first lg:order-none lg:sticky lg:top-20" style={{ background: "var(--gradient-primary)" }}>
        <CardContent className="p-5 text-primary-foreground space-y-4">
          <div>
            <Label className="text-primary-foreground/80 text-xs uppercase tracking-wider">Cliente (opcional)</Label>
            <Select value={cliente_id || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground"><User className="h-4 w-4 mr-1" /><SelectValue placeholder="Consumidor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Consumidor (sem cadastro)</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.permite_fiado ? "📒" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clienteSel && clienteSel.permite_fiado && (
              <p className="text-xs mt-1 text-primary-foreground/80">
                Devedor atual: {brl(clienteSel.saldo_devedor)} / Limite: {brl(clienteSel.limite_credito)}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-white/20">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between items-center text-sm">
              <span>Desconto</span>
              <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)}
                className="w-24 h-7 text-right bg-white/10 border-white/20 text-primary-foreground" />
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-white/20">
              <span className="text-lg">TOTAL</span>
              <span className="text-4xl font-bold tabular-nums">{brl(total)}</span>
            </div>
          </div>

          <Button size="lg" className="w-full bg-white text-primary hover:bg-white/90 h-14 text-lg font-bold" disabled={carrinho.length === 0}
            onClick={() => { setValorRecebido(String(total.toFixed(2))); setPagOpen(true); }}>
            FINALIZAR VENDA (F2)
          </Button>

          <p className="text-[10px] text-center text-primary-foreground/70">Atalhos: Enter adiciona produto · F2 finaliza</p>
        </CardContent>
      </Card>
        </div>
      )}

      {/* Barra fixa de finalização (mobile) */}
      {caixaAberto && carrinho.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card px-3 py-2 flex items-center gap-3 print:hidden">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase text-muted-foreground">Total · {carrinho.length} itens</div>
            <div className="text-xl font-bold tabular-nums truncate">{brl(total)}</div>
          </div>
          <Button size="lg" className="shrink-0" onClick={() => setPagOpen(true)}>Finalizar</Button>
        </div>
      )}

      {/* Modal de pagamento */}
      <Dialog open={pagOpen} onOpenChange={setPagOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md flex justify-between items-baseline">
              <span className="text-sm">Total a pagar</span><span className="text-3xl font-bold text-primary">{brl(total)}</span>
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                {(["dinheiro", "debito", "credito", "pix", "fiado"] as Forma[]).map((f) => {
                  const atalhos: Record<Forma, string> = { dinheiro: "D", debito: "X", credito: "C", pix: "P", fiado: "F" };
                  return (
                    <Button key={f} type="button" variant={forma === f ? "default" : "outline"}
                      onClick={() => setForma(f)} className="flex-col h-auto py-2 gap-1 relative">
                      {formaIcon[f]}<span className="text-[10px] capitalize">{f}</span>
                      <span className="absolute top-1 right-1 text-[9px] font-mono opacity-60">{atalhos[f]}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {forma === "dinheiro" && (
              <div>
                <Label>Valor recebido</Label>
                <Input type="number" step="0.01" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} className="text-lg h-11" autoFocus />
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[5, 10, 20, 50, 100, 200].map((v) => (
                    <Button key={v} size="sm" type="button" variant="outline"
                      onClick={() => setValorRecebido(String(v))}
                      className="text-xs h-7 px-2">R$ {v}</Button>
                  ))}
                  <Button size="sm" type="button" variant="outline" className="text-xs h-7 px-2"
                    onClick={() => setValorRecebido(String(total.toFixed(2)))}>Exato</Button>
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span>Troco</span>
                  <span className="font-bold text-success text-lg">{brl(troco)}</span>
                </div>
              </div>
            )}

            {forma === "fiado" && (
              <div className="bg-warning/10 border border-warning/40 p-3 rounded-md text-sm">
                {clienteSel ? (
                  clienteSel.permite_fiado
                    ? <>Será adicionado <strong>{brl(total)}</strong> ao saldo de <strong>{clienteSel.nome}</strong>. Novo saldo: <strong>{brl(Number(clienteSel.saldo_devedor) + total)}</strong></>
                    : <span className="text-destructive">Este cliente não tem fiado liberado. Edite o cadastro.</span>
                ) : <span className="text-destructive">Selecione um cliente para venda fiada.</span>}
              </div>
            )}

            <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

            <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded font-mono">
              <strong>Atalhos:</strong> D=Dinheiro · P=PIX · X=Débito · C=Crédito · F=Fiado · Enter/F4=Confirmar · Esc=Cancelar
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagOpen(false)}>Voltar</Button>
            <Button onClick={() => finalizar.mutate()} disabled={finalizar.isPending} size="lg">Confirmar venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de peso (produtos vendidos por peso) */}
      <Dialog open={pesoOpen} onOpenChange={(v) => { if (!v) { setPesoOpen(false); setPesoProduto(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Informe o peso</DialogTitle>
          </DialogHeader>
          {pesoProduto && (
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-md">
                <div className="font-medium">{pesoProduto.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Preço: <strong>{brl(pesoProduto.preco_venda)}/kg</strong> · Estoque: {Number(pesoProduto.estoque_atual)} kg
                </div>
              </div>
              <div>
                <Label>Peso</Label>
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.001" inputMode="decimal" autoFocus
                    value={pesoValor} onChange={(e) => setPesoValor(e.target.value)}
                    placeholder={pesoUnidade === "kg" ? "Ex: 0,500 ou 2,5" : "Ex: 500 ou 2500"}
                    className="text-lg h-11"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarPeso(); } }}
                  />
                  <Select value={pesoUnidade} onValueChange={(v) => setPesoUnidade(v as "kg" | "g")}>
                    <SelectTrigger className="w-24 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {pesoUnidade === "kg"
                    ? [0.1, 0.25, 0.5, 1, 1.5, 2].map((v) => (
                        <Button key={v} size="sm" type="button" variant="outline" className="text-xs h-7"
                          onClick={() => setPesoValor(String(v))}>{v} kg</Button>
                      ))
                    : [100, 200, 250, 500, 750, 1000].map((v) => (
                        <Button key={v} size="sm" type="button" variant="outline" className="text-xs h-7"
                          onClick={() => setPesoValor(String(v))}>{v} g</Button>
                      ))}
                </div>
              </div>
              {(() => {
                const v = Number((pesoValor || "0").replace(",", "."));
                const kg = pesoUnidade === "g" ? v / 1000 : v;
                const total = kg * Number(pesoProduto.preco_venda);
                return (
                  <div className="flex justify-between items-baseline border-t pt-3">
                    <span className="text-sm">Total do item</span>
                    <span className="text-2xl font-bold text-primary">{brl(total)}</span>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPesoOpen(false); setPesoProduto(null); }}>Cancelar</Button>
            <Button onClick={confirmarPeso}>Adicionar ao carrinho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cupom impresso */}
      <Dialog open={!!cupomFinal} onOpenChange={(v) => { if (!v) setCupomFinal(null); }}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Venda concluída — Cupom #{cupomFinal?.numero_cupom}</DialogTitle></DialogHeader>
          <div ref={cupomRef} className="bg-white">
            {cupomFinal && <CupomVenda venda={cupomFinal} />}
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button className="w-full sm:w-auto" disabled={gerandoImg} onClick={compartilharWhats}>
              <Share2 className="h-4 w-4 mr-1" /> {gerandoImg ? "Gerando…" : "Enviar no WhatsApp"}
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" disabled={gerandoImg} onClick={baixarJPG}>
              <Download className="h-4 w-4 mr-1" /> Salvar JPG
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => imprimirDocumento("cupom")}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setCupomFinal(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
