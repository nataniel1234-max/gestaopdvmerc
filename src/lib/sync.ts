import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Sincronismo global de dados.
 *
 * Regra única: TODA escrita (venda, entrada de mercadoria, saída/perda,
 * movimentação de caixa, financeiro) chama `invalidarTudo(qc)`.
 * Isso invalida o cache da janela atual e avisa as outras janelas abertas
 * (o PDV roda em janela separada e tem cache próprio) via BroadcastChannel.
 *
 * Assim nunca existe uma tela lendo saldo/venda de um cache antigo enquanto
 * outra já gravou no banco.
 */
const CANAL = "gestao-sync";

function canal(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CANAL);
  } catch {
    return null;
  }
}

/** Invalida todo o cache local e propaga para as demais janelas do sistema. */
export function invalidarTudo(qc: QueryClient) {
  qc.invalidateQueries();
  const ch = canal();
  if (ch) {
    ch.postMessage({ t: "invalidate", at: Date.now() });
    ch.close();
  }
}

/** Escuta invalidações vindas de outras janelas (ex.: PDV) e revalida ao focar. */
export function useSyncGlobal() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = canal();
    if (ch) ch.onmessage = () => qc.invalidateQueries();

    const aoFocar = () => qc.invalidateQueries();
    const aoVisivel = () => { if (document.visibilityState === "visible") qc.invalidateQueries(); };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      if (ch) ch.close();
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [qc]);
}
