-- =========================================================
-- 1. Formas de pagamento personalizadas por comércio
-- =========================================================
CREATE TABLE public.comercio_formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_base TEXT NOT NULL CHECK (tipo_base IN ('dinheiro','pix','debito','credito','fiado','outro')),
  taxa_percentual NUMERIC NOT NULL DEFAULT 0,
  prazo_recebimento_dias INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comercio_formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cfp_comercio ON public.comercio_formas_pagamento(comercio_id);

CREATE TRIGGER trg_cfp_updated_at BEFORE UPDATE ON public.comercio_formas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comercio_formas_pagamento ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();

CREATE POLICY "membros veem formas pgto" ON public.comercio_formas_pagamento FOR SELECT
USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "donos criam formas pgto" ON public.comercio_formas_pagamento FOR INSERT
WITH CHECK (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos atualizam formas pgto" ON public.comercio_formas_pagamento FOR UPDATE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos excluem formas pgto" ON public.comercio_formas_pagamento FOR DELETE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));

-- =========================================================
-- 2. Naturezas de lançamento por comércio
-- =========================================================
CREATE TABLE public.comercio_naturezas_lancamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comercio_naturezas_lancamento ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cnl_comercio ON public.comercio_naturezas_lancamento(comercio_id);

CREATE TRIGGER trg_cnl_updated_at BEFORE UPDATE ON public.comercio_naturezas_lancamento
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comercio_naturezas_lancamento ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();

CREATE POLICY "membros veem naturezas" ON public.comercio_naturezas_lancamento FOR SELECT
USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "donos criam naturezas" ON public.comercio_naturezas_lancamento FOR INSERT
WITH CHECK (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos atualizam naturezas" ON public.comercio_naturezas_lancamento FOR UPDATE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos excluem naturezas" ON public.comercio_naturezas_lancamento FOR DELETE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));

-- =========================================================
-- 3. Configuração do cupom por comércio (singleton por tenant)
-- =========================================================
CREATE TABLE public.comercio_cupom_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL UNIQUE REFERENCES public.comercios(id) ON DELETE CASCADE,
  cabecalho TEXT,
  rodape TEXT,
  serie TEXT NOT NULL DEFAULT '001',
  proximo_numero INTEGER NOT NULL DEFAULT 1,
  mensagem_promocional TEXT,
  mostrar_cnpj BOOLEAN NOT NULL DEFAULT true,
  mostrar_endereco BOOLEAN NOT NULL DEFAULT true,
  mostrar_telefone BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comercio_cupom_config ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ccc_comercio ON public.comercio_cupom_config(comercio_id);

CREATE TRIGGER trg_ccc_updated_at BEFORE UPDATE ON public.comercio_cupom_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comercio_cupom_config ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();

CREATE POLICY "membros veem cupom config" ON public.comercio_cupom_config FOR SELECT
USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "donos criam cupom config" ON public.comercio_cupom_config FOR INSERT
WITH CHECK (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos atualizam cupom config" ON public.comercio_cupom_config FOR UPDATE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));

-- =========================================================
-- 4. Função de seed para um comércio
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_comercio_defaults(_comercio_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.comercio_formas_pagamento (comercio_id, nome, tipo_base, ordem) VALUES
    (_comercio_id, 'Dinheiro', 'dinheiro', 1),
    (_comercio_id, 'PIX', 'pix', 2),
    (_comercio_id, 'Cartão de Débito', 'debito', 3),
    (_comercio_id, 'Cartão de Crédito', 'credito', 4),
    (_comercio_id, 'Fiado', 'fiado', 5)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.comercio_naturezas_lancamento (comercio_id, descricao, tipo) VALUES
    (_comercio_id, 'Venda', 'entrada'),
    (_comercio_id, 'Recebimento de fiado', 'entrada'),
    (_comercio_id, 'Suprimento', 'entrada'),
    (_comercio_id, 'Sangria', 'saida'),
    (_comercio_id, 'Despesa', 'saida')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.comercio_cupom_config (comercio_id) VALUES (_comercio_id)
  ON CONFLICT (comercio_id) DO NOTHING;
END;
$$;

-- =========================================================
-- 5. Atualizar handle_new_user para chamar o seed
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN NEW;
END;
$$;

-- =========================================================
-- 6. Backfill para comércios existentes
-- =========================================================
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.comercios LOOP
    PERFORM public.seed_comercio_defaults(c.id);
  END LOOP;
END $$;