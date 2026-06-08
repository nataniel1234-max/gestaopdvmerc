
-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.tipo_categoria_financeira AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_conta_pagar AS ENUM ('pendente', 'paga', 'atrasada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_conta_receber AS ENUM ('pendente', 'recebida', 'atrasada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_divida AS ENUM ('ativa', 'quitada', 'renegociada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- categorias_financeiras
CREATE TABLE public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.tipo_categoria_financeira NOT NULL,
  cor TEXT DEFAULT '#3B82F6',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comercio_id, nome, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_financeiras TO authenticated;
GRANT ALL ON public.categorias_financeiras TO service_role;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_fin_select" ON public.categorias_financeiras FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "categorias_fin_insert" ON public.categorias_financeiras FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "categorias_fin_update" ON public.categorias_financeiras FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "categorias_fin_delete" ON public.categorias_financeiras FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_categorias_fin_updated BEFORE UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- centros_custo
CREATE TABLE public.centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comercio_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centros_custo_select" ON public.centros_custo FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "centros_custo_insert" ON public.centros_custo FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "centros_custo_update" ON public.centros_custo FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "centros_custo_delete" ON public.centros_custo FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_centros_custo_updated BEFORE UPDATE ON public.centros_custo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contas_pagar
CREATE TABLE public.contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.status_conta_pagar NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  observacoes TEXT,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  parcela_atual INT,
  parcelas_total INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contas_pagar_comercio_venc ON public.contas_pagar(comercio_id, data_vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_pagar_select" ON public.contas_pagar FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "contas_pagar_insert" ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "contas_pagar_update" ON public.contas_pagar FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "contas_pagar_delete" ON public.contas_pagar FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_contas_pagar_updated BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contas_receber
CREATE TABLE public.contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  status public.status_conta_receber NOT NULL DEFAULT 'pendente',
  forma_recebimento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contas_receber_comercio_venc ON public.contas_receber(comercio_id, data_vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber TO authenticated;
GRANT ALL ON public.contas_receber TO service_role;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_receber_select" ON public.contas_receber FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "contas_receber_insert" ON public.contas_receber FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "contas_receber_update" ON public.contas_receber FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "contas_receber_delete" ON public.contas_receber FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_contas_receber_updated BEFORE UPDATE ON public.contas_receber FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- despesas
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_despesas_comercio_data ON public.despesas(comercio_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_select" ON public.despesas FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "despesas_insert" ON public.despesas FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "despesas_update" ON public.despesas FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "despesas_delete" ON public.despesas FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_despesas_updated BEFORE UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- dividas
CREATE TABLE public.dividas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  credor TEXT NOT NULL,
  descricao TEXT,
  valor_original NUMERIC(14,2) NOT NULL CHECK (valor_original >= 0),
  saldo_devedor NUMERIC(14,2) NOT NULL CHECK (saldo_devedor >= 0),
  taxa_juros_mensal NUMERIC(7,4) NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  parcelas_total INT,
  parcelas_pagas INT NOT NULL DEFAULT 0,
  valor_parcela NUMERIC(14,2),
  status public.status_divida NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividas TO authenticated;
GRANT ALL ON public.dividas TO service_role;
ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dividas_select" ON public.dividas FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "dividas_insert" ON public.dividas FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "dividas_update" ON public.dividas FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "dividas_delete" ON public.dividas FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_dividas_updated BEFORE UPDATE ON public.dividas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
