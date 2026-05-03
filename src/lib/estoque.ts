import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MovTipo = Database["public"]["Enums"]["movimentacao_tipo"];
type MovMotivo = Database["public"]["Enums"]["movimentacao_motivo"];

/** Aplica uma movimentação de estoque e atualiza o produto. */
export async function aplicarMovimentacao(args: {
  produto_id: string;
  tipo: MovTipo;
  motivo: MovMotivo;
  quantidade: number; // sempre positivo
  custo_unitario?: number | null;
  referencia_id?: string | null;
  observacoes?: string | null;
}) {
  const { data: produto, error: e1 } = await supabase
    .from("produtos")
    .select("id, estoque_atual, preco_custo")
    .eq("id", args.produto_id)
    .single();
  if (e1 || !produto) throw e1 ?? new Error("Produto não encontrado");

  const estoque_anterior = Number(produto.estoque_atual);
  const sinal = args.tipo === "entrada_compra" ? 1 : -1;
  const estoque_novo = estoque_anterior + sinal * args.quantidade;

  const { error: e2 } = await supabase.from("movimentacoes_estoque").insert({
    produto_id: args.produto_id,
    tipo: args.tipo,
    motivo: args.motivo,
    quantidade: args.quantidade,
    estoque_anterior,
    estoque_novo,
    custo_unitario: args.custo_unitario ?? null,
    referencia_id: args.referencia_id ?? null,
    observacoes: args.observacoes ?? null,
  });
  if (e2) throw e2;

  const update: Record<string, unknown> = { estoque_atual: estoque_novo };
  if (args.tipo === "entrada_compra" && args.custo_unitario != null) {
    update.preco_custo = args.custo_unitario;
  }
  const { error: e3 } = await supabase.from("produtos").update(update).eq("id", args.produto_id);
  if (e3) throw e3;

  return { estoque_anterior, estoque_novo };
}
