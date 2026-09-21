ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS venda_id uuid NULL REFERENCES public.vendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_receber_venda_id
  ON public.contas_receber (venda_id)
  WHERE venda_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_receber_venda_id
  ON public.contas_receber (venda_id)
  WHERE venda_id IS NOT NULL;