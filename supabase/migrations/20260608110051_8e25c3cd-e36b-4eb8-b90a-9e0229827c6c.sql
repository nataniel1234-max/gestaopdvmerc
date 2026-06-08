
-- Enum de setor
DO $$ BEGIN
  CREATE TYPE public.setor_produto AS ENUM ('hortifruti','frigorifico','cereais','lanchonete','assados','mercearia','conveniencia','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS setor public.setor_produto NOT NULL DEFAULT 'outros';

-- Motivos de perda
DO $$ BEGIN
  CREATE TYPE public.motivo_perda AS ENUM ('vencimento','quebra','roubo','avaria','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de perdas
CREATE TABLE public.perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL DEFAULT public.current_user_comercio() REFERENCES public.comercios(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  motivo public.motivo_perda NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_perdas_comercio_data ON public.perdas(comercio_id, data);
CREATE INDEX idx_perdas_produto ON public.perdas(produto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perdas TO authenticated;
GRANT ALL ON public.perdas TO service_role;
ALTER TABLE public.perdas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perdas_select" ON public.perdas FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE POLICY "perdas_insert" ON public.perdas FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id)) AND public.pode_escrever(comercio_id));
CREATE POLICY "perdas_update" ON public.perdas FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id))
  WITH CHECK (public.pode_escrever(comercio_id));
CREATE POLICY "perdas_delete" ON public.perdas FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_member_of(auth.uid(), comercio_id));
CREATE TRIGGER trg_perdas_updated BEFORE UPDATE ON public.perdas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
