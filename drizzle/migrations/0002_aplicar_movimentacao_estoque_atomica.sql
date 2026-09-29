CREATE FUNCTION public.aplicar_movimentacao_estoque(
  p_produto_id uuid,
  p_tipo public.movimentacao_tipo,
  p_motivo public.movimentacao_motivo,
  p_quantidade numeric,
  p_custo_unitario numeric DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS TABLE (estoque_anterior numeric, estoque_novo numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_anterior numeric;
  v_novo numeric;
  v_comercio_id uuid;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > 999999999.999 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT p.estoque_atual, p.comercio_id
    INTO v_anterior, v_comercio_id
    FROM public.produtos AS p
    WHERE p.id = p_produto_id
      AND p.comercio_id = public.current_user_comercio()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF NOT public.pode_escrever(v_comercio_id) THEN
    RAISE EXCEPTION 'Comércio em modo somente leitura';
  END IF;

  v_novo := v_anterior + CASE WHEN p_tipo = 'entrada_compra' THEN p_quantidade ELSE -p_quantidade END;

  INSERT INTO public.movimentacoes_estoque
    (produto_id, tipo, motivo, quantidade, estoque_anterior, estoque_novo, custo_unitario, referencia_id, observacoes)
  VALUES
    (p_produto_id, p_tipo, p_motivo, p_quantidade, v_anterior, v_novo, p_custo_unitario, p_referencia_id, p_observacoes);

  UPDATE public.produtos AS p
    SET estoque_atual = v_novo,
        preco_custo = CASE WHEN p_tipo = 'entrada_compra' AND p_custo_unitario IS NOT NULL THEN p_custo_unitario ELSE p.preco_custo END
    WHERE p.id = p_produto_id AND p.comercio_id = v_comercio_id;

  estoque_anterior := v_anterior;
  estoque_novo := v_novo;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_movimentacao_estoque(uuid, public.movimentacao_tipo, public.movimentacao_motivo, numeric, numeric, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_movimentacao_estoque(uuid, public.movimentacao_tipo, public.movimentacao_motivo, numeric, numeric, uuid, text) TO authenticated;