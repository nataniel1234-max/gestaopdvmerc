ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS vendido_por_peso BOOLEAN NOT NULL DEFAULT false;