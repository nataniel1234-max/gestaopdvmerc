
-- =========================================
-- HELPERS
-- =========================================
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin');
$$;

-- =========================================
-- ASSINATURAS
-- =========================================
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL UNIQUE,
  valor_mensal numeric NOT NULL DEFAULT 99.90,
  dias_carencia integer NOT NULL DEFAULT 15,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  proximo_vencimento date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days')::date,
  ultimo_pagamento date,
  ativa boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin tudo assinaturas" ON public.assinaturas FOR ALL
  USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "dono ve sua assinatura" ON public.assinaturas FOR SELECT
  USING (has_role(auth.uid(), comercio_id, 'dono'::app_role));

CREATE TRIGGER trg_assinaturas_updated BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Status calculado
CREATE OR REPLACE FUNCTION public.comercio_status(_comercio_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT a.ativa THEN 'bloqueada'
    WHEN CURRENT_DATE <= a.proximo_vencimento THEN 'ativa'
    WHEN CURRENT_DATE <= a.proximo_vencimento + (a.dias_carencia || ' days')::interval THEN 'em_carencia'
    ELSE 'vencida'
  END
  FROM public.assinaturas a WHERE a.comercio_id = _comercio_id;
$$;

-- Pode escrever? (modo somente leitura se vencida)
CREATE OR REPLACE FUNCTION public.pode_escrever(_comercio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.comercio_status(_comercio_id) IN ('ativa', 'em_carencia'), true);
$$;

-- =========================================
-- PAGAMENTOS DE ASSINATURA
-- =========================================
CREATE TABLE public.pagamentos_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL,
  valor numeric NOT NULL,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  referente_a date NOT NULL,
  proximo_vencimento date NOT NULL,
  forma text,
  observacoes text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pagamentos_assinatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin tudo pagto assinatura" ON public.pagamentos_assinatura FOR ALL
  USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "dono ve pagto assinatura" ON public.pagamentos_assinatura FOR SELECT
  USING (has_role(auth.uid(), comercio_id, 'dono'::app_role));

-- Ao registrar pagamento, atualizar assinatura
CREATE OR REPLACE FUNCTION public.aplicar_pagamento_assinatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.assinaturas
     SET ultimo_pagamento = NEW.data_pagamento,
         proximo_vencimento = NEW.proximo_vencimento,
         ativa = true,
         updated_at = now()
   WHERE comercio_id = NEW.comercio_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_aplicar_pagto AFTER INSERT ON public.pagamentos_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_pagamento_assinatura();

-- =========================================
-- SESSÕES DE ACESSO
-- =========================================
CREATE TABLE public.sessoes_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  comercio_id uuid,
  email text,
  ip text,
  user_agent text,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz,
  duracao_segundos integer
);
ALTER TABLE public.sessoes_acesso ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sessoes_comercio ON public.sessoes_acesso(comercio_id, iniciada_em DESC);
CREATE INDEX idx_sessoes_user ON public.sessoes_acesso(user_id, iniciada_em DESC);

CREATE POLICY "superadmin ve sessoes" ON public.sessoes_acesso FOR SELECT
  USING (is_superadmin(auth.uid()));
CREATE POLICY "dono ve sessoes do comercio" ON public.sessoes_acesso FOR SELECT
  USING (comercio_id IS NOT NULL AND has_role(auth.uid(), comercio_id, 'dono'::app_role));
CREATE POLICY "user ve propria sessao" ON public.sessoes_acesso FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user cria propria sessao" ON public.sessoes_acesso FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user atualiza propria sessao" ON public.sessoes_acesso FOR UPDATE
  USING (user_id = auth.uid());

-- =========================================
-- AUDITORIA
-- =========================================
CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id uuid NOT NULL DEFAULT current_user_comercio(),
  user_id uuid,
  user_email text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_auditoria_comercio ON public.auditoria(comercio_id, created_at DESC);
CREATE INDEX idx_auditoria_entidade ON public.auditoria(entidade, created_at DESC);

CREATE POLICY "superadmin tudo auditoria" ON public.auditoria FOR ALL
  USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "dono ve auditoria" ON public.auditoria FOR SELECT
  USING (has_role(auth.uid(), comercio_id, 'dono'::app_role));
CREATE POLICY "membros inserem auditoria" ON public.auditoria FOR INSERT
  WITH CHECK (is_member_of(auth.uid(), comercio_id));

-- =========================================
-- AJUSTAR handle_new_user PARA CRIAR ASSINATURA
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comercio_id UUID;
  v_nome_comercio TEXT;
  v_display_name TEXT;
BEGIN
  v_nome_comercio := COALESCE(NEW.raw_user_meta_data->>'nome_comercio', 'Meu Comércio');
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (user_id, display_name) VALUES (NEW.id, v_display_name);
  INSERT INTO public.comercios (nome) VALUES (v_nome_comercio) RETURNING id INTO v_comercio_id;
  INSERT INTO public.user_roles (user_id, comercio_id, role) VALUES (NEW.id, v_comercio_id, 'dono');

  PERFORM public.seed_comercio_defaults(v_comercio_id);

  -- Cria assinatura padrão (15 dias de carência a partir de hoje, R$ 99,90)
  INSERT INTO public.assinaturas (comercio_id, valor_mensal, dias_carencia, data_inicio, proximo_vencimento)
  VALUES (v_comercio_id, 99.90, 15, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days');

  RETURN NEW;
END; $$;

-- Garantir trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- BACKFILL: assinaturas para comercios existentes
-- =========================================
INSERT INTO public.assinaturas (comercio_id, valor_mensal, dias_carencia, data_inicio, proximo_vencimento)
SELECT c.id, 99.90, 15, c.created_at::date, (c.created_at::date + INTERVAL '15 days')::date
FROM public.comercios c
WHERE NOT EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.comercio_id = c.id);

-- =========================================
-- PROMOVER SUPERADMIN: natanmtf@gmail.com
-- =========================================
INSERT INTO public.user_roles (user_id, comercio_id, role)
SELECT u.id, (SELECT id FROM public.comercios LIMIT 1), 'superadmin'
FROM auth.users u
WHERE u.email = 'natanmtf@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = u.id AND role = 'superadmin');
