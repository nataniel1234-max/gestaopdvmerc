import { supabase } from "@/integrations/supabase/client";

export async function getCaixaAberto() {
  const { data } = await supabase
    .from("caixas")
    .select("*")
    .eq("status", "aberto")
    .order("aberto_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function exigirCaixaAberto(): Promise<string> {
  const c = await getCaixaAberto();
  if (!c) throw new Error("Nenhum caixa aberto. Abra o caixa antes de operar.");
  return c.id;
}
