
-- 1) Privilege escalation: prevent assigning 'superadmin' via RLS-governed INSERT
CREATE POLICY "bloqueia auto-atribuicao de superadmin"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (role <> 'superadmin'::app_role);

-- 2) Sessões: trigger que sobrescreve campos sensíveis com dados do servidor
CREATE OR REPLACE FUNCTION public.set_sessao_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers json;
BEGIN
  NEW.user_id := auth.uid();
  NEW.email := COALESCE((auth.jwt() ->> 'email'), NEW.email);
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  IF v_headers IS NOT NULL THEN
    NEW.user_agent := v_headers ->> 'user-agent';
    NEW.ip := COALESCE(
      split_part(v_headers ->> 'x-forwarded-for', ',', 1),
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-real-ip'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sessao_metadata ON public.sessoes_acesso;
CREATE TRIGGER trg_set_sessao_metadata
BEFORE INSERT ON public.sessoes_acesso
FOR EACH ROW EXECUTE FUNCTION public.set_sessao_metadata();

-- 3) Search path fixo em set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4) Revoga EXECUTE de funções de gatilho/sistema que não devem ser chamadas via API
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aplicar_pagamento_assinatura() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_comercio_defaults(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sessao_metadata() FROM anon, authenticated, PUBLIC;
