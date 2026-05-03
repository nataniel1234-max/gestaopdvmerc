-- ENUMs
CREATE TYPE movimentacao_tipo AS ENUM ('entrada_compra', 'saida_venda', 'saida_troca', 'saida_perda', 'ajuste');
CREATE TYPE movimentacao_motivo AS ENUM ('compra', 'venda', 'troca', 'vencido', 'roubo', 'depreciacao', 'furo_estoque', 'outro');
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'debito', 'credito', 'pix', 'fiado');

-- Fornecedores
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  limite_credito NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_devedor NUMERIC(12,2) NOT NULL DEFAULT 0,
  permite_fiado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras TEXT UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_custo NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_codigo_barras ON public.produtos(codigo_barras);
CREATE INDEX idx_produtos_nome ON public.produtos(nome);

-- Notas de entrada (cabeçalho de pedido recebido do fornecedor)
CREATE TABLE public.notas_entrada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nota TEXT,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.itens_nota_entrada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES public.notas_entrada(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  quantidade NUMERIC(12,3) NOT NULL,
  preco_custo_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

-- Vendas
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cupom SERIAL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  forma_pagamento forma_pagamento NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_recebido NUMERIC(12,2) DEFAULT 0,
  troco NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  cancelada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.itens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  produto_nome TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

-- Movimentações de estoque (auditoria de toda alteração de estoque)
CREATE TABLE public.movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo movimentacao_tipo NOT NULL,
  motivo movimentacao_motivo NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  estoque_anterior NUMERIC(12,3) NOT NULL,
  estoque_novo NUMERIC(12,3) NOT NULL,
  custo_unitario NUMERIC(12,2),
  referencia_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_produto ON public.movimentacoes_estoque(produto_id);
CREATE INDEX idx_mov_data ON public.movimentacoes_estoque(created_at);

-- Pagamentos de fiado
CREATE TABLE public.pagamentos_fiado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento forma_pagamento NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_fornecedores_upd BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clientes_upd BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_produtos_upd BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS habilitado, acesso público (sem login conforme escolha do usuário)
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_nota_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_fiado ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['fornecedores','clientes','produtos','notas_entrada','itens_nota_entrada','vendas','itens_venda','movimentacoes_estoque','pagamentos_fiado'])
  LOOP
    EXECUTE format('CREATE POLICY "acesso_publico_select_%s" ON public.%I FOR SELECT USING (true);', t, t);
    EXECUTE format('CREATE POLICY "acesso_publico_insert_%s" ON public.%I FOR INSERT WITH CHECK (true);', t, t);
    EXECUTE format('CREATE POLICY "acesso_publico_update_%s" ON public.%I FOR UPDATE USING (true);', t, t);
    EXECUTE format('CREATE POLICY "acesso_publico_delete_%s" ON public.%I FOR DELETE USING (true);', t, t);
  END LOOP;
END $$;