ALTER TABLE public.contas_bancarias DROP CONSTRAINT IF EXISTS contas_bancarias_tipo_check;
ALTER TABLE public.contas_bancarias
  ADD CONSTRAINT contas_bancarias_tipo_check
  CHECK (tipo = ANY (ARRAY['caixa'::text,'banco'::text,'aplicacao'::text,'outros_creditos'::text]));