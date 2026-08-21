import { supabase } from "@/integrations/supabase/client";

/**
 * "Caixa da empresa" é o caixa financeiro (tesouraria) do comércio.
 * É separado do caixa do PDV: lançamentos de crédito, despesas e pagamentos
 * feitos na aba Caixa afetam apenas este saldo — nunca o caixa aberto no PDV.
 * O caixa do PDV, ao ser fechado, é que alimenta o caixa da empresa.
 */
export const NOME_CAIXA_EMPRESA = "Caixa da empresa";

export type ContaFinanceira = { id: string; nome: string; saldo: number; tipo: string };

export async function obterCaixaEmpresa(): Promise<ContaFinanceira> {
  const { data: existente, error } = await supabase
    .from("contas_bancarias")
    .select("id, nome, saldo, tipo")
    .eq("nome", NOME_CAIXA_EMPRESA)
    .maybeSingle();
  if (error) throw error;
  if (existente) return existente as ContaFinanceira;

  const { data: criada, error: eIns } = await supabase
    .from("contas_bancarias")
    .insert({ nome: NOME_CAIXA_EMPRESA, tipo: "caixa", saldo: 0, observacoes: "Caixa financeiro da empresa (tesouraria)" })
    .select("id, nome, saldo, tipo")
    .single();
  if (eIns) throw eIns;
  return criada as ContaFinanceira;
}

/** Soma (ou subtrai, com valor negativo) um valor ao saldo do caixa da empresa. */
export async function movimentarCaixaEmpresa(delta: number) {
  const conta = await obterCaixaEmpresa();
  const { error } = await supabase
    .from("contas_bancarias")
    .update({ saldo: Number(conta.saldo ?? 0) + delta })
    .eq("id", conta.id);
  if (error) throw error;
  return conta.id;
}

/** Soma (ou subtrai) um valor de qualquer conta financeira pelo id. */
export async function movimentarConta(contaId: string, delta: number) {
  const { data, error } = await supabase.from("contas_bancarias").select("saldo").eq("id", contaId).single();
  if (error) throw error;
  const { error: eUp } = await supabase
    .from("contas_bancarias")
    .update({ saldo: Number(data.saldo ?? 0) + delta })
    .eq("id", contaId);
  if (eUp) throw eUp;
}
