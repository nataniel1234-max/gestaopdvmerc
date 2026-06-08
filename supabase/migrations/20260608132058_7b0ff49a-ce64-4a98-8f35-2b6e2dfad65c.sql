
CREATE OR REPLACE FUNCTION public.seed_comercio_defaults(_comercio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.comercio_formas_pagamento (comercio_id, nome, tipo_base, ordem) VALUES
    (_comercio_id, 'Dinheiro', 'dinheiro', 1),
    (_comercio_id, 'PIX', 'pix', 2),
    (_comercio_id, 'Cartão de Débito', 'debito', 3),
    (_comercio_id, 'Cartão de Crédito', 'credito', 4),
    (_comercio_id, 'Fiado', 'fiado', 5)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.comercio_naturezas_lancamento (comercio_id, descricao, tipo) VALUES
    (_comercio_id, 'Venda', 'entrada'),
    (_comercio_id, 'Recebimento de fiado', 'entrada'),
    (_comercio_id, 'Suprimento', 'entrada'),
    (_comercio_id, 'Sangria', 'saida'),
    (_comercio_id, 'Despesa', 'saida')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.comercio_cupom_config (comercio_id) VALUES (_comercio_id)
  ON CONFLICT (comercio_id) DO NOTHING;

  -- Categorias financeiras de RECEITA
  INSERT INTO public.categorias_financeiras (comercio_id, nome, tipo, cor) VALUES
    (_comercio_id, 'Vendas à vista',        'receita', '#10B981'),
    (_comercio_id, 'Vendas no cartão',      'receita', '#22C55E'),
    (_comercio_id, 'Vendas no PIX',         'receita', '#06B6D4'),
    (_comercio_id, 'Vendas fiado',          'receita', '#84CC16'),
    (_comercio_id, 'Recebimento de fiado',  'receita', '#0EA5E9'),
    (_comercio_id, 'Aporte do sócio',       'receita', '#6366F1'),
    (_comercio_id, 'Outras receitas',       'receita', '#A855F7')
  ON CONFLICT DO NOTHING;

  -- Categorias financeiras de DESPESA
  INSERT INTO public.categorias_financeiras (comercio_id, nome, tipo, cor) VALUES
    (_comercio_id, 'Fornecedores / Mercadorias', 'despesa', '#EF4444'),
    (_comercio_id, 'Aluguel',                    'despesa', '#F97316'),
    (_comercio_id, 'Energia elétrica',           'despesa', '#F59E0B'),
    (_comercio_id, 'Água',                       'despesa', '#0EA5E9'),
    (_comercio_id, 'Internet / Telefone',        'despesa', '#8B5CF6'),
    (_comercio_id, 'Folha de pagamento',         'despesa', '#EC4899'),
    (_comercio_id, 'Pró-labore',                 'despesa', '#D946EF'),
    (_comercio_id, 'Impostos e taxas',           'despesa', '#DC2626'),
    (_comercio_id, 'Taxas de cartão / maquininha','despesa', '#B91C1C'),
    (_comercio_id, 'Material de limpeza',        'despesa', '#14B8A6'),
    (_comercio_id, 'Material de escritório',     'despesa', '#6366F1'),
    (_comercio_id, 'Embalagens',                 'despesa', '#A16207'),
    (_comercio_id, 'Manutenção e reparos',       'despesa', '#78716C'),
    (_comercio_id, 'Combustível / Frete',        'despesa', '#0F766E'),
    (_comercio_id, 'Marketing e divulgação',     'despesa', '#DB2777'),
    (_comercio_id, 'Bancos e tarifas',           'despesa', '#7C3AED'),
    (_comercio_id, 'Juros e empréstimos',        'despesa', '#9F1239'),
    (_comercio_id, 'Perdas / quebras',           'despesa', '#525252'),
    (_comercio_id, 'Outras despesas',            'despesa', '#71717A')
  ON CONFLICT DO NOTHING;

  -- Centros de custo padrão (setores do mercadinho)
  INSERT INTO public.centros_custo (comercio_id, nome, descricao) VALUES
    (_comercio_id, 'Loja / Vendas',     'Operação da loja: PDV, atendimento, frente de caixa'),
    (_comercio_id, 'Hortifruti',        'FLV: frutas, legumes e verduras'),
    (_comercio_id, 'Frigorífico',       'Açougue, frios e congelados'),
    (_comercio_id, 'Mercearia',         'Produtos secos, cereais, bebidas'),
    (_comercio_id, 'Padaria / Lanchonete','Pães, assados, lanches'),
    (_comercio_id, 'Administrativo',    'Escritório, contabilidade, gestão'),
    (_comercio_id, 'Estrutura / Imóvel','Aluguel, IPTU, manutenção do prédio'),
    (_comercio_id, 'Logística / Entrega','Frete, combustível, motoboy'),
    (_comercio_id, 'Marketing',         'Divulgação, panfletos, redes sociais')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Backfill: aplica os defaults em todos os comércios que ainda não possuem categorias ou centros de custo
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.comercios LOOP
    PERFORM public.seed_comercio_defaults(c.id);
  END LOOP;
END $$;
