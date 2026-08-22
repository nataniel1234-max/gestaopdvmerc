ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS variacao text,
  ADD COLUMN IF NOT EXISTS produto_pai_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_produto_pai ON public.produtos(produto_pai_id);