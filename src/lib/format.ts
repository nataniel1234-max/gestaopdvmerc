export const brl = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (n: number | string | null | undefined, digits = 3) =>
  Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const dt = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const dtShort = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR");
