# Regularizar confirmação e liberação de assinaturas

## Alterações
- Restaurar o acionamento automático que, após um pagamento confirmado, atualiza o último pagamento, o próximo vencimento e reativa a assinatura.
- Corrigir o cálculo do próximo vencimento no ADMIN para renovar por um mês a partir da maior data entre hoje e o vencimento atual, evitando manter assinaturas antigas vencidas.
- Atualizar imediatamente os detalhes e a lista do ADMIN após a confirmação.
- Fazer o acesso do comércio reconhecer a liberação sem novo login, inclusive com o PDV aberto em outra janela.

## Validação
- Confirmar pagamento de uma assinatura vencida e verificar status “Ativa”, novo vencimento e histórico.
- Conferir que o modo somente leitura e seu aviso desaparecem após a confirmação.
- Manter inalteradas mensalidade, carência e regras de acesso existentes.
