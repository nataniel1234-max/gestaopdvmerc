import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CategoriaFinanceira = { id: string; nome: string; cor: string | null; tipo: "receita" | "despesa" };
export type CentroCusto = { id: string; nome: string };
export type FormaPagamento = { id: string; nome: string; tipo_base: string; ordem: number };

export function useCategoriasFinanceiras(tipo: "receita" | "despesa") {
  return useQuery({
    queryKey: ["categorias_financeiras", tipo],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, cor, tipo")
        .eq("tipo", tipo)
        .eq("ativa", true)
        .order("nome");
      return (data ?? []) as CategoriaFinanceira[];
    },
  });
}

export function useCentrosCusto() {
  return useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as CentroCusto[];
    },
  });
}

export function useFormasPagamento() {
  return useQuery({
    queryKey: ["formas_pagamento_pref"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comercio_formas_pagamento")
        .select("id, nome, tipo_base, ordem")
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []) as FormaPagamento[];
    },
  });
}
