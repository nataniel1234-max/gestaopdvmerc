import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, dtShort } from "@/lib/format";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { useCategoriasFinanceiras, useCentrosCusto } from "@/lib/predefinicoes";

/** Parcela pela Tabela Price (juros compostos ao mês). */
function calcularParcela(principal: number, taxaMensalPct: number, n: number) {
  if (!(principal > 0) || !(n > 0)) return 0;
  const i = taxaMensalPct / 100;
  if (i <= 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

function somaMeses(base: Date, meses: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export function DialogCredito({
  open, onOpenChange, caixaId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; caixaId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [credor, setCredor] = useState("");
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("0");
  const [tarifas, setTarifas] = useState("0");
  const [parcelas, setParcelas] = useState("1");
  const [carencia, setCarencia] = useState("1");
  const [destino, setDestino] = useState<"caixa" | "banco">("caixa");
  const [bancoId, setBancoId] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("none");
  const [centroId, setCentroId] = useState<string>("none");
  const [obs, setObs] = useState("");

  const { data: categorias = [] } = useCategoriasFinanceiras("despesa");
  const { data: centros = [] } = useCentrosCusto();
  const { data: bancos = [] } = useQuery({
    queryKey: ["contas-bancarias-credito"],
    enabled: open,
    queryFn: async () =>
      ((await supabase.from("contas_bancarias").select("id, nome, saldo, tipo").eq("ativo", true).order("nome")).data ?? []) as any[],
  });

  const principal = Number(valor) || 0;
  const nParc = Math.max(1, Number(parcelas) || 1);
  const taxaNum = Number(taxa) || 0;
  const tarifasNum = Number(tarifas) || 0;
  const liquido = Math.max(0, principal - tarifasNum);
  const parcela = useMemo(() => calcularParcela(principal, taxaNum, nParc), [principal, taxaNum, nParc]);
  const totalPagar = parcela * nParc;
  const custoTotal = totalPagar - principal + tarifasNum;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!credor.trim()) throw new Error("Informe o credor / instituição");
      if (!(principal > 0)) throw new Error("Informe o valor do crédito");
      if (destino === "banco" && !bancoId) throw new Error("Selecione a conta bancária de destino");
      if (destino === "caixa" && !caixaId) throw new Error("Abra o caixa para lançar o crédito em dinheiro");

      const hoje = new Date();
      const hojeISO = hoje.toISOString().slice(0, 10);

      // 1) Dívida (passivo) — aparece em Dívidas e no Balanço
      const { data: divida, error: eDiv } = await supabase
        .from("dividas")
        .insert({
          credor: credor.trim(),
          descricao: `Crédito ${destino === "caixa" ? "recebido em caixa" : "creditado em conta"}${obs ? ` — ${obs}` : ""}`,
          valor_original: principal,
          saldo_devedor: totalPagar,
          taxa_juros_mensal: taxaNum,
          data_inicio: hojeISO,
          parcelas_total: nParc,
          parcelas_pagas: 0,
          valor_parcela: parcela,
          status: "ativa",
          observacoes: obs || null,
        })
        .select("id")
        .single();
      if (eDiv) throw eDiv;

      // 2) Parcelas em Contas a Pagar
      const primeiraEm = Math.max(0, Number(carencia) || 0);
      const linhas = Array.from({ length: nParc }, (_, k) => ({
        descricao: `${credor.trim()} — parcela ${k + 1}/${nParc}`,
        valor: Number(parcela.toFixed(2)),
        data_vencimento: somaMeses(hoje, primeiraEm + k),
        status: "pendente" as const,
        categoria_id: categoriaId === "none" ? null : categoriaId,
        centro_custo_id: centroId === "none" ? null : centroId,
        parcela_atual: k + 1,
        parcelas_total: nParc,
        observacoes: `Crédito tomado em ${dtShort(hojeISO)} · taxa ${taxaNum}% a.m.`,
      }));
      const { error: eCp } = await supabase.from("contas_pagar").insert(linhas);
      if (eCp) throw eCp;

      // 3) Entrada do valor líquido: caixa ou conta bancária
      if (destino === "caixa") {
        const { error: eMov } = await supabase.from("movimentacoes_caixa").insert({
          caixa_id: caixaId!,
          tipo: "suprimento",
          forma_pagamento: "dinheiro",
          valor: liquido,
          descricao: `Crédito recebido — ${credor.trim()}`,
          referencia_id: divida!.id,
        });
        if (eMov) throw eMov;
      } else {
        const banco = bancos.find((b) => b.id === bancoId);
        const { error: eB } = await supabase
          .from("contas_bancarias")
          .update({ saldo: Number(banco?.saldo ?? 0) + liquido })
          .eq("id", bancoId);
        if (eB) throw eB;
      }

      // 4) Tarifas/IOF como despesa do período (entra no DRE e na classificação)
      if (tarifasNum > 0) {
        const { error: eD } = await supabase.from("despesas").insert({
          descricao: `Tarifas/IOF do crédito — ${credor.trim()}`,
          valor: tarifasNum,
          data: hojeISO,
          forma_pagamento: destino === "caixa" ? "dinheiro" : "Transferência",
          categoria_id: categoriaId === "none" ? null : categoriaId,
          centro_custo_id: centroId === "none" ? null : centroId,
          observacoes: "Descontado do valor liberado do crédito",
        });
        if (eD) throw eD;
      }
    },
    onSuccess: () => {
      toast.success("Crédito lançado: caixa/banco, contas a pagar e dívidas atualizados");
      setCredor(""); setValor(""); setTarifas("0"); setObs("");
      ["caixa-movs", "caixa-aberto", "contas_pagar", "contas-pagar-abertas", "dividas", "fin-dividas",
       "bal-dividas", "bal-bancos", "despesas", "contas-bancarias-credito"]
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao lançar crédito"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Lançamento de crédito / empréstimo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Credor / instituição *</Label><Input value={credor} onChange={(e) => setCredor(e.target.value)} placeholder="Banco, financeira, sócio…" autoFocus /></div>
            <div><Label>Valor do crédito *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Taxa (% a.m.)</Label><Input type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></div>
            <div><Label>Parcelas (prazo)</Label><Input type="number" min="1" value={parcelas} onChange={(e) => setParcelas(e.target.value)} /></div>
            <div><Label>1ª parcela em (meses)</Label><Input type="number" min="0" value={carencia} onChange={(e) => setCarencia(e.target.value)} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Recebimento em</Label>
              <Select value={destino} onValueChange={(v) => setDestino(v as "caixa" | "banco")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Caixa (dinheiro)</SelectItem>
                  <SelectItem value="banco">Conta bancária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {destino === "banco" ? (
              <div>
                <Label>Conta bancária *</Label>
                <Select value={bancoId} onValueChange={setBancoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {bancos.length === 0 ? (
                      <SelectItem value="vazio" disabled>Nenhuma conta cadastrada</SelectItem>
                    ) : bancos.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome} · {brl(b.saldo)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div><Label>Tarifas / IOF descontados</Label><Input type="number" step="0.01" value={tarifas} onChange={(e) => setTarifas(e.target.value)} /></div>
            )}
          </div>

          {destino === "banco" && (
            <div><Label>Tarifas / IOF descontados</Label><Input type="number" step="0.01" value={tarifas} onChange={(e) => setTarifas(e.target.value)} /></div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Categoria financeira das parcelas</Label>
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

          <div><Label>Observações</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm grid gap-1 sm:grid-cols-2">
            <span>Valor liberado: <b className="tabular-nums">{brl(liquido)}</b></span>
            <span>Parcela: <b className="tabular-nums">{brl(parcela)}</b> × {nParc}</span>
            <span>Total a pagar: <b className="tabular-nums">{brl(totalPagar)}</b></span>
            <span>Custo do crédito: <b className="tabular-nums">{brl(custoTotal)}</b></span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={salvar.isPending || !credor || !valor} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Lançando…" : "Lançar crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
