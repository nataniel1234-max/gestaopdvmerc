import { useEffect, useState } from "react";

export type PrintTipo = "cupom" | "guia" | "recibo";

export type PrintConfigDoc = {
  largura_mm: number; // 58 ou 80
  cabecalho: string; // multilinha — nome da loja, endereço, etc
  rodape: string; // multilinha — agradecimento, obs
  vias: number; // quantas vias imprimir
  mostrar_cabecalho: boolean;
  mostrar_rodape: boolean;
};

export type PrintConfig = {
  cupom: PrintConfigDoc;
  guia: PrintConfigDoc;
  recibo: PrintConfigDoc;
};

const STORAGE_KEY = "mercadinho:print-config:v1";

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  cupom: {
    largura_mm: 80,
    cabecalho: "MERCADINHO\nRua Exemplo, 123 — Centro\nCNPJ: 00.000.000/0001-00",
    rodape: "OBRIGADO E VOLTE SEMPRE!\n*** SEM VALOR FISCAL ***",
    vias: 1,
    mostrar_cabecalho: true,
    mostrar_rodape: true,
  },
  guia: {
    largura_mm: 80,
    cabecalho: "MERCADINHO\nFECHAMENTO DE CAIXA",
    rodape: "Conferido e assinado pelo operador.",
    vias: 2,
    mostrar_cabecalho: true,
    mostrar_rodape: true,
  },
  recibo: {
    largura_mm: 80,
    cabecalho: "MERCADINHO\nRECIBO DE PAGAMENTO — FIADO",
    rodape: "Documento emitido para conferência e assinatura.",
    vias: 2,
    mostrar_cabecalho: true,
    mostrar_rodape: true,
  },
};

export function getPrintConfig(): PrintConfig {
  if (typeof window === "undefined") return DEFAULT_PRINT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      cupom: { ...DEFAULT_PRINT_CONFIG.cupom, ...(parsed.cupom ?? {}) },
      guia: { ...DEFAULT_PRINT_CONFIG.guia, ...(parsed.guia ?? {}) },
      recibo: { ...DEFAULT_PRINT_CONFIG.recibo, ...(parsed.recibo ?? {}) },
    };
  } catch {
    return DEFAULT_PRINT_CONFIG;
  }
}

export function setPrintConfig(cfg: PrintConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("print-config-changed"));
}

export function usePrintConfig(): PrintConfig {
  const [cfg, setCfg] = useState<PrintConfig>(() => getPrintConfig());
  useEffect(() => {
    const handler = () => setCfg(getPrintConfig());
    window.addEventListener("print-config-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("print-config-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return cfg;
}

/**
 * Aplica vars CSS no documento e dispara window.print().
 * Repete N vezes para imprimir múltiplas vias.
 */
export function imprimirDocumento(tipo: PrintTipo) {
  const cfg = getPrintConfig()[tipo];
  const root = document.documentElement;
  root.style.setProperty("--print-largura-mm", `${cfg.largura_mm}mm`);
  root.setAttribute("data-print-tipo", tipo);

  const vias = Math.max(1, Math.min(5, cfg.vias));
  let i = 0;
  const tick = () => {
    i++;
    window.print();
    if (i < vias) setTimeout(tick, 400);
  };
  setTimeout(tick, 50);
}
