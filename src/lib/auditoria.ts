import { supabase } from "@/integrations/supabase/client";

export type AcaoAuditoria = "criar" | "editar" | "excluir" | "login" | "logout" | "config";

export async function registrarAuditoria(params: {
  acao: AcaoAuditoria;
  entidade: string;
  entidade_id?: string | null;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("auditoria").insert({
      user_id: user.id,
      user_email: user.email,
      acao: params.acao,
      entidade: params.entidade,
      entidade_id: params.entidade_id ?? null,
      detalhes: (params.detalhes ?? {}) as never,
    } as never);
  } catch (e) {
    console.warn("auditoria falhou", e);
  }
}
