import { brl, dt } from "@/lib/format";
import { usePrintConfig } from "@/lib/print-config";

export type ReciboFiadoData = {
  numero?: string;
  cliente: { nome: string; documento?: string | null; telefone?: string | null };
  valor_pago: number;
  forma_pagamento: string;
  saldo_anterior: number;
  saldo_atual: number;
  data: string | Date;
  observacoes?: string | null;
};

export function ReciboFiado({ data }: { data: ReciboFiadoData }) {
  const cfg = usePrintConfig().recibo;
  return (
    <div id="recibo-print" className="font-mono text-xs bg-white text-black p-4 mx-auto border" style={{ maxWidth: `${cfg.largura_mm}mm`, width: "100%" }}>
      {cfg.mostrar_cabecalho && cfg.cabecalho && (
        <div className="text-center font-bold text-[11px] whitespace-pre-line mb-1">{cfg.cabecalho}</div>
      )}
      <div className="border-y border-dashed border-black py-1 text-[10px] mb-2">
        {data.numero && <div>Recibo Nº: {data.numero}</div>}
        <div>Data: {dt(data.data)}</div>
      </div>

      <div className="text-[11px] mb-2">
        <div><strong>Cliente:</strong> {data.cliente.nome}</div>
        {data.cliente.documento && <div>Doc: {data.cliente.documento}</div>}
        {data.cliente.telefone && <div>Tel: {data.cliente.telefone}</div>}
      </div>

      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[11px] mb-1">
        Recebi a quantia de <strong>{brl(data.valor_pago)}</strong> referente a pagamento{" "}
        de saldo em fiado, na forma de <strong className="uppercase">{data.forma_pagamento}</strong>.
      </div>

      <div className="border-t border-dashed border-black my-1" />
      <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[11px]">
        <span>Saldo anterior</span>
        <span className="font-semibold">{brl(data.saldo_anterior)}</span>
        <span>Pagamento</span>
        <span className="font-semibold">- {brl(data.valor_pago)}</span>
        <span className="font-bold pt-1 border-t">Saldo atual</span>
        <span className="font-bold pt-1 border-t">{brl(data.saldo_atual)}</span>
      </div>

      {data.observacoes && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="text-[10px]">Obs: {data.observacoes}</div>
        </>
      )}

      <div className="border-t border-dashed border-black my-3" />
      <div className="text-[10px] text-center mt-1">
        {data.saldo_atual <= 0 ? (
          <strong>*** QUITADO ***</strong>
        ) : (
          <span>Saldo restante em aberto.</span>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-2 text-[9px] text-center">
        <div className="border-t border-black pt-1">Recebedor</div>
        <div className="border-t border-black pt-1">Cliente</div>
      </div>

      {cfg.mostrar_rodape && cfg.rodape && (
        <div className="text-center text-[10px] mt-3 whitespace-pre-line">{cfg.rodape}</div>
      )}
    </div>
  );
}
