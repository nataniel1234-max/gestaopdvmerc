export const TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "XG"] as const;

export type ProdutoRotulo = { nome: string; variacao?: string | null };

/** Nome exibido do produto incluindo a variação (ex: "Camiseta Dry — M"). */
export function rotuloProduto(p: ProdutoRotulo): string {
  const v = (p.variacao ?? "").trim();
  return v ? `${p.nome} — ${v}` : p.nome;
}
