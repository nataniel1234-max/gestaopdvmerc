import { brl, dt } from "@/lib/format";

export type CaixaCompleto = {
  id: string;
  operador: string | null;
  aberto_em: string;
  fechado_em: string | null;
  valor_abertura: number | string;
  valor_fechamento_calculado: number | string | null;
  valor_fechamento_informado: number | string | null;
  diferenca: number | string | null;
  total_dinheiro: number | string;
  total_pix: number | string;
  total_debito: number | string;
  total_credito: number | string;
  total_fiado: number | string;
  total_sangrias: number | string;
  total_suprimentos: number | string;
  total_despesas: number | string;
  total_recebimentos_fiado: number | string;
  qtd_vendas: number;
  observacoes_abertura?: string | null;
  observacoes_fechamento?: string | null;
};

export type MovItem = {
  id: string;
  created_at: string;
  tipo: string;
  forma_pagamento: string | null;
  valor: number | string;
  descricao: string | null;
};

export type VendaItem = {
  id: string;
  numero_cupom: number;
  created_at: string;
  forma_pagamento: string;
  total: number | string;
};

export function GuiaCaixa({
  caixa,
  movimentacoes = [],
  vendas = [],
  recebimentosFiado = [],
}: {
  caixa: CaixaCompleto;
  movimentacoes?: MovItem[];
  vendas?: VendaItem[];
  recebimentosFiado?: Array<{ id: string; created_at: string; valor: number | string; forma_pagamento: string; clientes?: { nome: string } | null }>;
}) {
  const dif = Number(caixa.diferenca ?? 0);
  return (
    <div id="guia-print" className="font-mono text-xs bg-white text-black p-3 max-w-[80mm] mx-auto border">
      <div className="text-center font-bold text-sm">MERCADINHO</div>
      <div className="text-center text-[10px] mb-2">FECHAMENTO DE CAIXA</div>
      <div className="border-y border-dashed border-black py-1 mb-2 text-[10px]">
        <div>Caixa: {caixa.id.slice(0, 8)}</div>
        <div>Operador: {caixa.operador ?? "—"}</div>
        <div>Abertura: {dt(caixa.aberto_em)}</div>
        {caixa.fechado_em && <div>Fechamento: {dt(caixa.fechado_em)}</div>}
      </div>

      <Section title="RESUMO DE VENDAS">
        <Linha l="Qtd. cupons" v={String(caixa.qtd_vendas)} />
        <Linha l="Dinheiro" v={brl(caixa.total_dinheiro)} />
        <Linha l="PIX" v={brl(caixa.total_pix)} />
        <Linha l="Débito" v={brl(caixa.total_debito)} />
        <Linha l="Crédito" v={brl(caixa.total_credito)} />
        <Linha l="Fiado" v={brl(caixa.total_fiado)} />
      </Section>

      <Section title="MOVIMENTAÇÕES">
        <Linha l="Suprimentos (+)" v={brl(caixa.total_suprimentos)} />
        <Linha l="Sangrias (-)" v={brl(caixa.total_sangrias)} />
        <Linha l="Despesas (-)" v={brl(caixa.total_despesas)} />
        <Linha l="Receb. fiado" v={brl(caixa.total_recebimentos_fiado)} />
      </Section>

      <Section title="CONFERÊNCIA DINHEIRO">
        <Linha l="Abertura" v={brl(caixa.valor_abertura)} />
        <Linha l="Esperado" v={brl(caixa.valor_fechamento_calculado ?? 0)} bold />
        <Linha l="Contado" v={brl(caixa.valor_fechamento_informado ?? 0)} bold />
        <Linha
          l={dif === 0 ? "Conferido" : dif > 0 ? "SOBRA" : "FALTA"}
          v={brl(Math.abs(dif))}
          bold
        />
      </Section>

      {vendas.length > 0 && (
        <Section title={`VENDAS (${vendas.length})`}>
          {vendas.map((v) => (
            <div key={v.id} className="grid grid-cols-[auto_1fr_auto] gap-x-1 text-[10px]">
              <span>#{v.numero_cupom}</span>
              <span className="truncate">{new Date(v.created_at).toLocaleTimeString("pt-BR")} {v.forma_pagamento}</span>
              <span>{brl(v.total)}</span>
            </div>
          ))}
        </Section>
      )}

      {movimentacoes.filter((m) => ["sangria", "suprimento", "despesa"].includes(m.tipo)).length > 0 && (
        <Section title="LANÇAMENTOS">
          {movimentacoes.filter((m) => ["sangria", "suprimento", "despesa"].includes(m.tipo)).map((m) => (
            <div key={m.id} className="text-[10px]">
              <div className="flex justify-between">
                <span className="uppercase">{m.tipo}</span>
                <span>{brl(m.valor)}</span>
              </div>
              {m.descricao && <div className="text-[9px] opacity-80">{m.descricao}</div>}
            </div>
          ))}
        </Section>
      )}

      {recebimentosFiado.length > 0 && (
        <Section title={`RECEB. FIADO (${recebimentosFiado.length})`}>
          {recebimentosFiado.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-1 text-[10px]">
              <span className="truncate">{r.clientes?.nome ?? "—"} ({r.forma_pagamento})</span>
              <span>{brl(r.valor)}</span>
            </div>
          ))}
        </Section>
      )}

      {caixa.observacoes_fechamento && (
        <Section title="OBSERVAÇÕES">
          <div className="text-[10px]">{caixa.observacoes_fechamento}</div>
        </Section>
      )}

      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-[10px] mt-3">
        <div className="border-t border-black mt-8 pt-1">Assinatura do operador</div>
      </div>
      <div className="text-center text-[9px] mt-2 opacity-70">{dt(new Date())}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px] font-bold mb-1">{title}</div>
      {children}
    </>
  );
}

function Linha({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-[10px] ${bold ? "font-bold" : ""}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
