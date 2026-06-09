
-- Ativo Circulante: contas bancárias / aplicações
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('banco','aplicacao','outros_creditos')),
  nome TEXT NOT NULL,
  instituicao TEXT,
  saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT ALL ON public.contas_bancarias TO service_role;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem contas_bancarias" ON public.contas_bancarias FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem contas_bancarias" ON public.contas_bancarias FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_contas_bancarias_upd BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ativo Não Circulante: Imobilizado
CREATE TABLE public.ativos_imobilizado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('imovel','terreno','veiculo','maquina','equipamento','moveis','computador','reforma','outro')),
  descricao TEXT NOT NULL,
  valor_aquisicao NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_aquisicao DATE,
  vida_util_anos INTEGER,
  depreciacao_acumulada NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_imobilizado TO authenticated;
GRANT ALL ON public.ativos_imobilizado TO service_role;
ALTER TABLE public.ativos_imobilizado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem ativos_imob" ON public.ativos_imobilizado FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem ativos_imob" ON public.ativos_imobilizado FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_ativos_imob_upd BEFORE UPDATE ON public.ativos_imobilizado
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ativo Não Circulante: Intangível
CREATE TABLE public.ativos_intangivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('marca','software','patente','licenca','outro')),
  descricao TEXT NOT NULL,
  valor_registrado NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_atualizado NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_intangivel TO authenticated;
GRANT ALL ON public.ativos_intangivel TO service_role;
ALTER TABLE public.ativos_intangivel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem intang" ON public.ativos_intangivel FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem intang" ON public.ativos_intangivel FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_intang_upd BEFORE UPDATE ON public.ativos_intangivel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ativo Não Circulante: Investimentos
CREATE TABLE public.ativos_investimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('participacao','aplicacao_longo','outro')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_investimentos TO authenticated;
GRANT ALL ON public.ativos_investimentos TO service_role;
ALTER TABLE public.ativos_investimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem invest" ON public.ativos_investimentos FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem invest" ON public.ativos_investimentos FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_invest_upd BEFORE UPDATE ON public.ativos_investimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Passivo Não Circulante
CREATE TABLE public.passivos_longo_prazo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('financiamento','emprestimo_longo','parcelamento_tributario','parcelamento_trabalhista','divida_renegociada','processo_judicial','outro')),
  credor TEXT NOT NULL,
  valor_original NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_devedor NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_juros NUMERIC(7,4),
  data_contratacao DATE,
  data_vencimento_final DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passivos_longo_prazo TO authenticated;
GRANT ALL ON public.passivos_longo_prazo TO service_role;
ALTER TABLE public.passivos_longo_prazo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem plp" ON public.passivos_longo_prazo FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem plp" ON public.passivos_longo_prazo FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_plp_upd BEFORE UPDATE ON public.passivos_longo_prazo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Patrimônio Líquido (capital social, reservas, lucros acumulados manuais)
CREATE TABLE public.patrimonio_liquido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('capital_social','reserva_legal','reserva_lucros','lucros_acumulados','outro')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrimonio_liquido TO authenticated;
GRANT ALL ON public.patrimonio_liquido TO service_role;
ALTER TABLE public.patrimonio_liquido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem pl" ON public.patrimonio_liquido FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "membros escrevem pl" ON public.patrimonio_liquido FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.is_member_of(auth.uid(), comercio_id) AND public.pode_escrever(comercio_id));
CREATE TRIGGER trg_pl_upd BEFORE UPDATE ON public.patrimonio_liquido
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
