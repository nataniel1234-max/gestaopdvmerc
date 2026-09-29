import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MovTipo = Database["public"]["Enums"]["movimentacao_tipo"];
type MovMotivo = Database["public"]["Enums"]["movimentacao_motivo"];

/** Aplica uma movimentação de estoque e atualiza o produto atomicamente. */
export async function aplicarMovimentacao(args: {
  produto_id: string;
  tipo: MovTipo;
  motivo: MovMotivo;
  quantidade: number; // sempre positivo
  custo_unitario?: number | null;
  referencia_id?: string | null;
  observacoes?: string | null;
}) {
  const { data, error } = await supabase.rpc("aplicar_movimentacao_estoque", {
    p_produto_id: args.produto_id,
    p_tipo: args.tipo,
    p_motivo: args.motivo,
    p_quantidade: args.quantidade,
    p_custo_unitario: args.custo_unitario ?? null,
    p_referencia_id: args.referencia_id ?? null,
    p_observacoes: args.observacoes ?? null,
  });
  if (error) throw error;
  const resultado = data?.[0];
  if (!resultado) throw new Error("Movimentação de estoque não retornou saldo");

  return {
    estoque_anterior: Number(resultado.estoque_anterior),
    estoque_novo: Number(resultado.estoque_novo),
  };
}
