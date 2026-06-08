// Tema personalizável por usuário (cor primária, fundo e texto)
// Persistido em localStorage. Aplicado como variáveis CSS no :root.

export type Tema = {
  primary: string;     // hex #rrggbb
  background: string;  // hex
  foreground: string;  // hex
};

// Tema BI corporativo — navy + azul elétrico
export const TEMA_PADRAO: Tema = {
  primary: "#2563eb",     // azul elétrico corporativo
  background: "#f8fafc",  // branco gelo
  foreground: "#0f172a",  // navy profundo para texto
};

const KEY = "app:tema:v1";

export function carregarTema(): Tema {
  if (typeof window === "undefined") return TEMA_PADRAO;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return TEMA_PADRAO;
    const t = JSON.parse(raw) as Tema;
    return { ...TEMA_PADRAO, ...t };
  } catch {
    return TEMA_PADRAO;
  }
}

export function salvarTema(t: Tema) {
  localStorage.setItem(KEY, JSON.stringify(t));
  aplicarTema(t);
}

export function aplicarTema(t: Tema) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--ring", t.primary);
  root.style.setProperty("--sidebar-primary", t.primary);
  root.style.setProperty("--sidebar-ring", t.primary);
  root.style.setProperty("--background", t.background);
  root.style.setProperty("--foreground", t.foreground);
  root.style.setProperty("--card-foreground", t.foreground);
  root.style.setProperty("--popover-foreground", t.foreground);

  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${t.primary}, ${shade(t.primary, 18)})`,
  );
}

function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const f = (c: number) => Math.min(255, Math.round(c + (255 - c) * (percent / 100)));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
