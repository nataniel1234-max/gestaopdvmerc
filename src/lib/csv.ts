// Utilitário CSV simples: parse + serialize, sem dependências externas.
// Suporta separador vírgula OU ponto-e-vírgula (auto-detect), aspas e escape.

export type CsvRow = Record<string, string>;

const detectSep = (header: string): "," | ";" | "\t" => {
  const c = (header.match(/,/g) ?? []).length;
  const s = (header.match(/;/g) ?? []).length;
  const t = (header.match(/\t/g) ?? []).length;
  if (t >= c && t >= s) return "\t";
  if (s >= c) return ";";
  return ",";
};

export function parseCSV(text: string): { headers: string[]; rows: CsvRow[]; sep: string } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const sep = detectSep(firstLine);

  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }

  const headers = (out.shift() ?? []).map((h) => h.trim());
  const rows = out
    .filter((r) => r.some((c) => c && c.trim() !== ""))
    .map((r) => {
      const obj: CsvRow = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
  return { headers, rows, sep };
}

const esc = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  if (/[",;\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function toCSV(headers: string[], rows: Record<string, unknown>[], sep = ";"): string {
  const lines = [headers.join(sep)];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(sep));
  return "\uFEFF" + lines.join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Normaliza nome de coluna para auto-mapeamento. */
export const normCol = (s: string) =>
  s.toLowerCase()
   .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9]/g, "");

/** Tenta encontrar a coluna do CSV que corresponde a um campo destino. */
export function autoMap(csvHeaders: string[], aliases: string[]): string | null {
  const want = aliases.map(normCol);
  for (const h of csvHeaders) {
    if (want.includes(normCol(h))) return h;
  }
  return null;
}

export const toNum = (v: string | undefined | null): number => {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  const n2 = Number(String(v).replace(",", "."));
  return Number.isNaN(n2) ? 0 : n2;
};

export const toBool = (v: string | undefined | null): boolean => {
  const s = (v ?? "").toString().trim().toLowerCase();
  return ["1", "true", "sim", "s", "yes", "y", "verdadeiro"].includes(s);
};
