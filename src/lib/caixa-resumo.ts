import { supabase } from "@/integrations/supabase/client";

/**
 * Fonte única de verdade do resumo de uma sessão de caixa.
 * Sempre lê direto do banco pelo vínculo caixa_id (vendas, movimentações e
 * recebimentos de fiado da sessão), nunca de cache de tela.
 */
export type ResumoCaixa = {
  dinheiro: number; pix: number; debito: number; credito: number; fiado: number;
  sangrias: number; suprimentos: number; despesas: number;
  recebFiado: number; recebFiadoDinheiro: number;
  qtd: number; totalVendas: number; saldoDinheiro: number;
};

export async function carregarResumoCaixa(caixaId: string, valorAbertura: number): Promise<ResumoCaixa> {
  const [{ data: vendas }, { data: movs }, { data: fiados }] = await Promise.all([
    supabase.from("vendas").select("total, forma_pagamento").eq("caixa_id", caixaId).eq("cancelada", false),
    supabase.from("movimentacoes_caixa").select("tipo, valor").eq("caixa_id", caixaId),
    supabase.from("pagamentos_fiado").select("valor, forma_pagamento").eq("caixa_id", caixaId),
  ]);

  const r: ResumoCaixa = {
    dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0,
    sangrias: 0, suprimentos: 0, despesas: 0,
    recebFiado: 0, recebFiadoDinheiro: 0, qtd: 0, totalVendas: 0, saldoDinheiro: 0,
  };

  for (const v of vendas ?? []) {
    const t = Number(v.total); r.qtd++; r.totalVendas += t;
    if (v.forma_pagamento === "dinheiro") r.dinheiro += t;
    else if (v.forma_pagamento === "pix") r.pix += t;
    else if (v.forma_pagamento === "debito") r.debito += t;
    else if (v.forma_pagamento === "credito") r.credito += t;
    else if (v.forma_pagamento === "fiado") r.fiado += t;
  }
  for (const m of movs ?? []) {
    const v = Number(m.valor);
    if (m.tipo === "sangria") r.sangrias += v;
    else if (m.tipo === "suprimento") r.suprimentos += v;
    else if (m.tipo === "despesa") r.despesas += v;
  }
  for (const p of fiados ?? []) {
    const v = Number(p.valor); r.recebFiado += v;
    if (p.forma_pagamento === "dinheiro") r.recebFiadoDinheiro += v;
    else if (p.forma_pagamento === "pix") r.pix += v;
    else if (p.forma_pagamento === "debito") r.debito += v;
    else if (p.forma_pagamento === "credito") r.credito += v;
  }

  r.saldoDinheiro = Number(valorAbertura ?? 0) + r.dinheiro + r.recebFiadoDinheiro + r.suprimentos - r.sangrias - r.despesas;
  return r;
}
