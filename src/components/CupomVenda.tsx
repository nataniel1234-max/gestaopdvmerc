import { brl, dt } from "@/lib/format";

export type VendaCompleta = {
  id: string;
  numero_cupom: number;
  created_at: string;
  forma_pagamento: string;
  subtotal: number | string;
  desconto: number | string;
  total: number | string;
  valor_recebido?: number | string | null;
  troco?: number | string | null;
  observacoes?: string | null;
  clientes?: { nome: string } | null;
  itens_venda: Array<{
    id: string;
    produto_nome: string;
    quantidade: number | string;
    preco_unitario: number | string;
    subtotal: number | string;
  }>;
};

const formaPagLabel: Record<string, string> = {
  dinheiro: "DINHEIRO", debito: "CARTAO DEBITO", credito: "CARTAO CREDITO", pix: "PIX", fiado: "FIADO",
};

export function CupomVenda({ venda }: { venda: VendaCompleta }) {
  return (
    <div id="cupom-print" className="font-mono text-xs bg-white text-black p-3 max-w-[80mm] mx-auto border">
      <div className="text-center font-bold text-sm mb-1">MERCADINHO</div>
      <div className="text-center text-[10px] mb-2">CUPOM NAO FISCAL</div>
      <div className="text-[10px] text-center border-y border-dashed border-black py-1 mb-2">
        Cupom #{venda.numero_cupom} — {dt(venda.created_at)}
      </div>

      {venda.clientes && <div className="mb-1">Cliente: {venda.clientes.nome}</div>}

      <div className="border-t border-dashed border-black my-1" />
      <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[10px] font-bold">
        <span>ITEM</span><span>VALOR</span>
      </div>
      <div className="border-t border-dashed border-black my-1" />

      {venda.itens_venda.map((it) => (
        <div key={it.id} className="mb-1">
          <div className="text-[11px]">{it.produto_nome}</div>
          <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[10px]">
            <span>{Number(it.quantidade)} x {brl(it.preco_unitario)}</span>
            <span className="font-semibold">{brl(it.subtotal)}</span>
          </div>
        </div>
      ))}

      <div className="border-t border-dashed border-black my-1" />
      <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[11px]">
        <span>SUBTOTAL</span><span>{brl(venda.subtotal)}</span>
        {Number(venda.desconto) > 0 && (<><span>DESCONTO</span><span>-{brl(venda.desconto)}</span></>)}
        <span className="font-bold text-sm pt-1">TOTAL</span>
        <span className="font-bold text-sm pt-1">{brl(venda.total)}</span>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[11px]">
        <span>PAGAMENTO</span><span>{formaPagLabel[venda.forma_pagamento]}</span>
        {venda.valor_recebido != null && Number(venda.valor_recebido) > 0 && (<>
          <span>RECEBIDO</span><span>{brl(venda.valor_recebido)}</span>
          <span>TROCO</span><span>{brl(venda.troco ?? 0)}</span>
        </>)}
      </div>

      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-[10px] mt-2">
        OBRIGADO E VOLTE SEMPRE!<br />
        *** SEM VALOR FISCAL ***
      </div>
    </div>
  );
}
