-- =========================================================
-- 1. ENUM de papéis
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('dono', 'operador');

-- =========================================================
-- 2. Tabela de comércios
-- =========================================================
CREATE TABLE public.comercios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  endereco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_comercios_updated_at
BEFORE UPDATE ON public.comercios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. Profiles (dados do usuário)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4. user_roles (vincula user a comércio + papel)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, comercio_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_comercio ON public.user_roles(comercio_id);

-- =========================================================
-- 5. SECURITY DEFINER helpers (evita recursão em RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _comercio_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND comercio_id = _comercio_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _comercio_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND comercio_id = _comercio_id
  );
$$;

-- Retorna o comércio principal do usuário (primeiro registrado)
CREATE OR REPLACE FUNCTION public.current_user_comercio()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT comercio_id FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC LIMIT 1;
$$;

-- =========================================================
-- 6. Trigger: ao criar usuário, cria comércio + papel dono
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 7. RLS para comercios / profiles / user_roles
-- =========================================================
CREATE POLICY "membros veem seu comercio" ON public.comercios FOR SELECT
USING (public.is_member_of(auth.uid(), id));

CREATE POLICY "donos atualizam seu comercio" ON public.comercios FOR UPDATE
USING (public.has_role(auth.uid(), id, 'dono'));

CREATE POLICY "qualquer autenticado cria comercio" ON public.comercios FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ver proprio profile" ON public.profiles FOR SELECT
USING (auth.uid() = user_id);
CREATE POLICY "criar proprio profile" ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "atualizar proprio profile" ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "ver proprios papeis" ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);
CREATE POLICY "donos veem papeis do comercio" ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos gerenciam papeis" ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), comercio_id, 'dono'));
CREATE POLICY "donos removem papeis" ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), comercio_id, 'dono'));

-- =========================================================
-- 8. Comércio padrão para dados existentes
-- =========================================================
DO $$
DECLARE v_default UUID;
BEGIN
  INSERT INTO public.comercios (nome) VALUES ('Comércio Padrão') RETURNING id INTO v_default;
  -- Guarda em config temporário via uma tabela? Usaremos diretamente abaixo.
  PERFORM set_config('app.default_comercio', v_default::text, false);
END $$;

-- =========================================================
-- 9. Adiciona comercio_id em todas as tabelas operacionais
-- =========================================================
ALTER TABLE public.produtos             ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.clientes             ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.fornecedores         ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.vendas               ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.itens_venda          ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.caixas               ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.movimentacoes_caixa  ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.notas_entrada        ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.itens_nota_entrada   ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;
ALTER TABLE public.pagamentos_fiado     ADD COLUMN comercio_id UUID REFERENCES public.comercios(id) ON DELETE CASCADE;

-- Backfill: atribui ao comércio padrão
UPDATE public.produtos             SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.clientes             SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.fornecedores         SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.vendas               SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.itens_venda          SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.caixas               SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.movimentacoes_caixa  SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.movimentacoes_estoque SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.notas_entrada        SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.itens_nota_entrada   SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;
UPDATE public.pagamentos_fiado     SET comercio_id = current_setting('app.default_comercio')::uuid WHERE comercio_id IS NULL;

-- Tornar NOT NULL
ALTER TABLE public.produtos             ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.clientes             ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.fornecedores         ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.vendas               ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.itens_venda          ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.caixas               ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.movimentacoes_caixa  ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.notas_entrada        ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.itens_nota_entrada   ALTER COLUMN comercio_id SET NOT NULL;
ALTER TABLE public.pagamentos_fiado     ALTER COLUMN comercio_id SET NOT NULL;

-- Defaults baseados no usuário corrente
ALTER TABLE public.produtos             ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.clientes             ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.fornecedores         ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.vendas               ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.itens_venda          ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.caixas               ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.movimentacoes_caixa  ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.notas_entrada        ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.itens_nota_entrada   ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();
ALTER TABLE public.pagamentos_fiado     ALTER COLUMN comercio_id SET DEFAULT public.current_user_comercio();

-- Índices para performance de RLS
CREATE INDEX idx_produtos_comercio ON public.produtos(comercio_id);
CREATE INDEX idx_clientes_comercio ON public.clientes(comercio_id);
CREATE INDEX idx_fornecedores_comercio ON public.fornecedores(comercio_id);
CREATE INDEX idx_vendas_comercio ON public.vendas(comercio_id);
CREATE INDEX idx_itens_venda_comercio ON public.itens_venda(comercio_id);
CREATE INDEX idx_caixas_comercio ON public.caixas(comercio_id);
CREATE INDEX idx_mov_caixa_comercio ON public.movimentacoes_caixa(comercio_id);
CREATE INDEX idx_mov_estoque_comercio ON public.movimentacoes_estoque(comercio_id);
CREATE INDEX idx_notas_entrada_comercio ON public.notas_entrada(comercio_id);
CREATE INDEX idx_itens_nota_entrada_comercio ON public.itens_nota_entrada(comercio_id);
CREATE INDEX idx_pagamentos_fiado_comercio ON public.pagamentos_fiado(comercio_id);

-- =========================================================
-- 10. Substituir as policies "público true" por policies por comércio
-- =========================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'produtos','clientes','fornecedores','vendas','itens_venda',
    'caixas','movimentacoes_caixa','movimentacoes_estoque',
    'notas_entrada','itens_nota_entrada','pagamentos_fiado'
  ];
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "membros selecionam %1$s" ON public.%1$I FOR SELECT
      USING (public.is_member_of(auth.uid(), comercio_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "membros inserem %1$s" ON public.%1$I FOR INSERT
      WITH CHECK (public.is_member_of(auth.uid(), comercio_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "membros atualizam %1$s" ON public.%1$I FOR UPDATE
      USING (public.is_member_of(auth.uid(), comercio_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "membros excluem %1$s" ON public.%1$I FOR DELETE
      USING (public.is_member_of(auth.uid(), comercio_id));
    $f$, t);
  END LOOP;
END $$;

-- =========================================================
-- 11. Atualizar caixa_aberto() para considerar o comércio do usuário
-- =========================================================
CREATE OR REPLACE FUNCTION public.caixa_aberto()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.caixas
  WHERE status = 'aberto' AND comercio_id = public.current_user_comercio()
  ORDER BY aberto_em DESC LIMIT 1;
$$;