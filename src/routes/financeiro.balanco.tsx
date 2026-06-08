import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { KpiCard } from "@/components/bi/KpiCard";
import { Wallet, Boxes, CreditCard, Landmark, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/financeiro/balanco")({
  component: BalancoPage,
});

function BalancoPage() {
  // ATIVO
  // Caixa: saldo de caixas abertos
  const { data: caixasAbertos = [] } = useQuery({
    queryKey: ["bal-caixas"],
    queryFn: async () => (await supabase.from("caixas").select("saldo_atual, valor_abertura").eq("status", "aberto")).data ?? [],
  });
  const caixaAtual = caixasAbertos.reduce((s, c) => s + Number(c.saldo_atual ?? c.valor_abertura ?? 0), 0);

  // Estoque: estoque_atual * custo_medio
  const { data: produtos = [] } = useQuery({
    queryKey: ["bal-produtos"],
    queryFn: async () => (await supabase.from("produtos").select("estoque_atual, custo_medio, preco_venda").eq("ativo", true)).data ?? [],
  });
  const valorEstoque = produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.custo_medio ?? 0), 0);
  const valorEstoquePV = produtos.reduce((s, p) => s + Number(p.estoque_atual ?? 0) * Number(p.preco_venda ?? 0), 0);

  // Fiado a receber
  const { data: clientes = [] } = useQuery({
    queryKey: ["bal-clientes"],
    queryFn: async () => (await supabase.from("clientes").select("saldo_devedor").gt("saldo_devedor", 0)).data ?? [],
  });
  const fiadoReceber = clientes.reduce((s, c) => s + Number(c.saldo_devedor), 0);

  // Contas a receber em aberto
  const { data: cr = [] } = useQuery({
    queryKey: ["bal-cr"],
    queryFn: async () => (await supabase.from("contas_receber").select("valor, status").not("status", "in", "(recebida,cancelada)")).data ?? [],
  });
  const contasReceberAtivo = cr.reduce((s, c) => s + Number(c.valor), 0);

  // PASSIVO
  const { data: cp = [] } = useQuery({
    queryKey: ["bal-cp"],
    queryFn: async () => (await supabase.from("contas_pagar").select("valor, status").not("status", "in", "(paga,cancelada)")).data ?? [],
  });
  const contasPagarPassivo = cp.reduce((s, c) => s + Number(c.valor), 0);

  const { data: dividas = [] } = useQuery({
    queryKey: ["bal-dividas"],
    queryFn: async () => (await supabase.from("dividas").select("saldo_devedor").eq("status", "ativa")).data ?? [],
  });
  const dividasPassivo = dividas.reduce((s, d) => s + Number(d.saldo_devedor), 0);

  const totalAtivo = caixaAtual + valorEstoque + fiadoReceber + contasReceberAtivo;
  const totalPassivo = contasPagarPassivo + dividasPassivo;
  const patrimonioLiquido = totalAtivo - totalPassivo;
  const lucroPotencialEstoque = valorEstoquePV - valorEstoque;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ativo total" value={brl(totalAtivo)} icon={TrendingUp} status="healthy" highlight />
        <KpiCard label="Passivo total" value={brl(totalPassivo)} icon={TrendingDown} status={totalPassivo > totalAtivo ? "critical" : "neutral"} />
        <KpiCard label="Patrimônio líquido" value={brl(patrimonioLiquido)} icon={Landmark} status={patrimonioLiquido >= 0 ? "healthy" : "critical"} />
        <KpiCard label="Lucro potencial estoque" value={brl(lucroPotencialEstoque)} icon={Boxes} status="neutral" hint="Se vender tudo ao preço atual" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-border bg-[color:var(--kpi-healthy)]/5">
              <h3 className="font-display font-bold text-lg">Ativo</h3>
              <p className="text-xs text-muted-foreground">O que o comércio possui</p>
            </div>
            <div className="divide-y divide-border">
              <BalLine icon={Wallet} label="Caixa (operacional)" value={caixaAtual} />
              <BalLine icon={Boxes} label="Estoque (a custo médio)" value={valorEstoque} hint={`PV: ${brl(valorEstoquePV)}`} />
              <BalLine icon={CreditCard} label="Fiado a receber" value={fiadoReceber} />
              <BalLine icon={CreditCard} label="Contas a receber" value={contasReceberAtivo} />
              <BalLine label="Total do ativo" value={totalAtivo} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-border bg-[color:var(--kpi-critical)]/5">
              <h3 className="font-display font-bold text-lg">Passivo</h3>
              <p className="text-xs text-muted-foreground">O que o comércio deve</p>
            </div>
            <div className="divide-y divide-border">
              <BalLine icon={CreditCard} label="Contas a pagar (em aberto)" value={contasPagarPassivo} />
              <BalLine icon={Landmark} label="Dívidas (saldo devedor)" value={dividasPassivo} />
              <BalLine label="Total do passivo" value={totalPassivo} bold />
              <div className="px-6 py-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold">= Patrimônio líquido</span>
                  <span className={`text-xl font-display font-bold tabular-nums ${patrimonioLiquido < 0 ? "text-[color:var(--kpi-critical)]" : "text-[color:var(--kpi-healthy)]"}`}>
                    {brl(patrimonioLiquido)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ativo − Passivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          <strong>Nota:</strong> Balanço simplificado calculado a partir de caixa, estoque (custo médio), fiado, contas a receber/pagar e dívidas. Não considera ativo imobilizado, capital social, impostos diferidos ou outros itens contábeis formais.
        </CardContent>
      </Card>
    </div>
  );
}

function BalLine({ icon: Icon, label, value, bold, hint }: { icon?: any; label: string; value: number; bold?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <div>
          <div className={bold ? "font-bold" : "text-sm"}>{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div className={`tabular-nums ${bold ? "font-bold text-base" : "text-sm font-medium"}`}>{brl(value)}</div>
    </div>
  );
}
