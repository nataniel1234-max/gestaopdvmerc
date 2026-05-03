
-- Enum tipo de movimentação de caixa
CREATE TYPE public.tipo_mov_caixa AS ENUM ('abertura','sangria','suprimento','despesa','venda','recebimento_fiado','fechamento');

-- Tabela caixas
CREATE TABLE public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador text,
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado
  valor_abertura numeric NOT NULL DEFAULT 0,
  valor_fechamento_informado numeric,
  valor_fechamento_calculado numeric,
  diferenca numeric,
  total_dinheiro numeric NOT NULL DEFAULT 0,
  total_pix numeric NOT NULL DEFAULT 0,
  total_debito numeric NOT NULL DEFAULT 0,
  total_credito numeric NOT NULL DEFAULT 0,
  total_fiado numeric NOT NULL DEFAULT 0,
  total_sangrias numeric NOT NULL DEFAULT 0,
  total_suprimentos numeric NOT NULL DEFAULT 0,
  total_despesas numeric NOT NULL DEFAULT 0,
  total_recebimentos_fiado numeric NOT NULL DEFAULT 0,
  qtd_vendas integer NOT NULL DEFAULT 0,
  observacoes_abertura text,
  observacoes_fechamento text,
  aberto_em timestamptz NOT NULL DEFAULT now(),
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acesso_publico_select_caixas" ON public.caixas FOR SELECT USING (true);
CREATE POLICY "acesso_publico_insert_caixas" ON public.caixas FOR INSERT WITH CHECK (true);
CREATE POLICY "acesso_publico_update_caixas" ON public.caixas FOR UPDATE USING (true);
CREATE POLICY "acesso_publico_delete_caixas" ON public.caixas FOR DELETE USING (true);

CREATE TRIGGER trg_caixas_updated BEFORE UPDATE ON public.caixas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela movimentacoes_caixa
CREATE TABLE public.movimentacoes_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo public.tipo_mov_caixa NOT NULL,
  forma_pagamento public.forma_pagamento,
  valor numeric NOT NULL,
  descricao text,
  referencia_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acesso_publico_select_mov_caixa" ON public.movimentacoes_caixa FOR SELECT USING (true);
CREATE POLICY "acesso_publico_insert_mov_caixa" ON public.movimentacoes_caixa FOR INSERT WITH CHECK (true);
CREATE POLICY "acesso_publico_update_mov_caixa" ON public.movimentacoes_caixa FOR UPDATE USING (true);
CREATE POLICY "acesso_publico_delete_mov_caixa" ON public.movimentacoes_caixa FOR DELETE USING (true);

CREATE INDEX idx_mov_caixa_caixa ON public.movimentacoes_caixa(caixa_id);

-- Vínculo de vendas e pagamentos de fiado ao caixa
ALTER TABLE public.vendas ADD COLUMN caixa_id uuid REFERENCES public.caixas(id);
ALTER TABLE public.pagamentos_fiado ADD COLUMN caixa_id uuid REFERENCES public.caixas(id);

CREATE INDEX idx_vendas_caixa ON public.vendas(caixa_id);
CREATE INDEX idx_pag_fiado_caixa ON public.pagamentos_fiado(caixa_id);

-- Função: retornar o caixa aberto atual (se houver)
CREATE OR REPLACE FUNCTION public.caixa_aberto()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.caixas WHERE status = 'aberto' ORDER BY aberto_em DESC LIMIT 1;
$$;
