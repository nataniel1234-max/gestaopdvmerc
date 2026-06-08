
# Reestruturação em Plataforma de Inteligência Empresarial

Entrega faseada. Cada fase é testável de forma independente antes de avançar. Visual novo "Power BI corporativo" aplicado já na Fase 1.

## Visão geral das fases

```text
Fase 1  ──  Redesign + Dashboard Executivo + KPIs
Fase 2  ──  Inteligência Financeira (Contas a Pagar/Receber, Dívidas, Fluxo de Caixa projetado)
Fase 3  ──  DRE Automática + Balanço Patrimonial
Fase 4  ──  CMV Inteligente + Gestão de Perdas + Curva ABC
Fase 5  ──  Inteligência Comercial + Análise de Setores
Fase 6  ──  Copiloto IA (sob demanda) + Central de Indicadores
Fase 7  ──  Relatórios PDF/Excel
```

Esta proposta detalha **Fase 1** (a que vou executar agora se você aprovar) e descreve em alto nível as fases 2–7 para alinhamento. Cada fase seguinte volta para aprovação com seu próprio plano detalhado.

---

## FASE 1 — Redesign corporativo + Dashboard Executivo

### Objetivo
Estabelecer a nova identidade visual "BI executivo" e entregar a primeira tela de valor (Dashboard Executivo) usando dados que já existem no banco (vendas, itens_venda, movimentacoes_caixa, fiado, produtos, clientes).

### 1.1 Redesign — tema corporativo

Trocar o tema verde-mercado por um tema BI:
- **Paleta:** azul-marinho profundo (`oklch(0.18 0.04 250)`) como sidebar/fundos de painéis, branco gelo (`oklch(0.98 0.005 250)`) como background, azul elétrico (`oklch(0.55 0.20 250)`) como primário/CTAs, dourado discreto (`oklch(0.72 0.14 80)`) para destaques de KPI.
- **Tipografia:** "Plus Jakarta Sans" para títulos/KPIs (peso 700), "Inter" para corpo. Carregadas via `<link>` em `__root.tsx`.
- **Indicadores semânticos:**
  - `--kpi-healthy` (verde sóbrio)
  - `--kpi-warning` (âmbar)
  - `--kpi-critical` (vermelho corporativo)
- **Componentes novos em `src/components/bi/`:**
  - `KpiCard` — cartão com label, valor grande, delta vs. período anterior, sparkline opcional, status semântico (healthy/warning/critical).
  - `MetricGroup` — grade responsiva de KpiCards.
  - `ComparativoTabs` — abas Hoje/Semana/Mês/Ano para gráficos.
  - `ChartCard` — wrapper visual padrão para gráficos Recharts.
  - `StatusPill` — chip semafórico.

Atualizar `src/styles.css`: novos tokens em `@theme inline`, manter o sistema de override por usuário (`tema.ts`) mas com novos defaults. Sidebar passa de verde para navy.

### 1.2 Dashboard Executivo (`/`)

Substitui o conteúdo atual de `src/routes/index.tsx` (vou preservar o que houver de útil, mas a rota vira o dashboard executivo).

**Linha 1 — KPIs financeiros do dia/mês:**
- Faturamento do dia / do mês (com delta vs. ontem / mês passado)
- Lucro bruto estimado (receita − CMV via custo médio dos produtos vendidos)
- Ticket médio
- Quantidade de clientes atendidos hoje
- Fluxo de caixa disponível (saldo atual dos caixas abertos + saldo bancário se houver)

**Linha 2 — Gráficos comparativos:**
- Vendas por dia (últimos 30 dias) com linha do mês anterior sobreposta
- Receita por hora do dia (top horários)
- Top 10 produtos por faturamento (mês)

**Linha 3 — Operacional:**
- Fiado em aberto (total + nº de clientes)
- Produtos com estoque crítico (abaixo do mínimo)
- Próximos vencimentos de produtos (se houver campo de validade)
- Status da assinatura

**Tabs de comparação:** Hoje x Ontem | Semana x Anterior | Mês x Anterior | Ano x Anterior — afeta os gráficos da linha 2.

**Indicadores visuais** com cores semânticas (Saudável/Atenção/Crítico) calculados por regras simples e configuráveis depois (ex.: ticket médio caiu >10% vs. média 30d → atenção; >20% → crítico).

### 1.3 Server functions de leitura

Criar `src/lib/dashboard.functions.ts` com `createServerFn` (usando `requireSupabaseAuth` para respeitar RLS por comércio):
- `getDashboardKpis({ periodo })` — agrega vendas, itens, caixa, clientes
- `getVendasSerie({ dias })` — série temporal diária
- `getVendasPorHora({ periodo })`
- `getTopProdutos({ periodo, limit })`
- `getAlertasOperacionais()` — estoque crítico, fiado em aberto, validade

Todas as consultas usam o cliente autenticado do middleware (RLS via `comercio_id`), sem precisar de novas tabelas.

### 1.4 Itens *fora* da Fase 1 (vêm em fases seguintes)
- Contas a pagar/receber, dívidas, despesas, impostos → Fase 2 (requer novas tabelas)
- DRE completa, Balanço → Fase 3
- CMV detalhado, Curva ABC, perdas → Fase 4
- Análise comparativa de setores (hortifruti vs. lanchonete etc.) → Fase 5 (requer campo `setor` em produtos ou tabela `setores`)
- Copiloto IA → Fase 6
- Exportação PDF/Excel → Fase 7

Na Fase 1 o lucro bruto/CMV mostrado é **estimativa baseada em `preco_custo` atual dos produtos vendidos** — vou marcar visualmente como "estimado" até a Fase 4 trazer CMV real.

### 1.5 Migração de banco (Fase 1)
**Nenhuma.** Fase 1 usa apenas o esquema atual. Migrações começam na Fase 2.

### 1.6 Arquivos afetados na Fase 1
- `src/styles.css` — novo tema BI
- `src/routes/__root.tsx` — fontes via `<link>`, sidebar navy
- `src/components/AppSidebar.tsx` — cores novas, ícones revisados
- `src/components/bi/*` — componentes novos
- `src/routes/index.tsx` — Dashboard Executivo
- `src/lib/dashboard.functions.ts` — server functions
- `src/lib/tema.ts` — novos defaults

---

## Fases seguintes (resumo, virão com planos próprios)

**Fase 2 — Inteligência Financeira**
Novas tabelas: `categorias_financeiras`, `centros_custo`, `contas_pagar`, `contas_receber`, `dividas`, `parcelas_divida`, `despesas`. Telas `/financeiro/contas-a-pagar`, `/financeiro/contas-a-receber`, `/financeiro/dividas`, `/financeiro/fluxo-caixa` com projeção 30/60/90/180d. Alertas de insuficiência de caixa.

**Fase 3 — DRE + Balanço**
Views/funções SQL para DRE mensal/trimestral/anual e Balanço Patrimonial a partir das tabelas das fases 1–2. Tela `/financeiro/dre` e `/financeiro/balanco`.

**Fase 4 — CMV + Perdas + ABC**
Tabela `perdas` (motivo: quebra/vencimento/deterioração/erro). Campo `setor` em `produtos` (ou tabela `setores`). Server functions para CMV real (estoque inicial + compras − final), Curva ABC e ranking de perdas. Telas `/estoque/cmv`, `/estoque/perdas`, `/estoque/abc`.

**Fase 5 — Inteligência Comercial**
Tela `/comercial/setores` com comparativo entre Hortifruti/Frigorífico/Cereais/Lanchonete/Assados/Mercearia/Conveniência. Análises por setor/categoria/produto/hora. Identificação de mais lucrativos, encalhados, sem giro.

**Fase 6 — Copiloto IA + Central de Indicadores**
Server function `analisarNegocio` usando Lovable AI (Gemini) sob demanda — botão "Analisar agora" coleta KPIs/séries das fases 1–5 e devolve alertas + recomendações estruturadas (JSON via `Output.object`). Tela `/copiloto` com histórico de análises persistidas. Tela `/kpis` com EBITDA, margens, liquidez, giro, cobertura, conversão.

**Fase 7 — Relatórios**
Geração server-side de PDF (relatório diário/semanal/mensal/executivo) e Excel. Tela `/relatorios` com agendamento opcional.

---

## O que preciso de você

Aprovar este plano = autorizo executar **só a Fase 1** agora (redesign + Dashboard Executivo, sem migrações de banco). Ao finalizar, volto com o plano detalhado da Fase 2.

Se quiser ajustar a ordem (ex.: priorizar CMV antes do redesign) ou paleta/tipografia, me diga antes de aprovar.
