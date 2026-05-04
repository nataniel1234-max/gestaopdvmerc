// Tema personalizável por usuário (cor primária, fundo e texto)
// Persistido em localStorage. Aplicado como variáveis CSS no :root.

export type Tema = {
  primary: string;     // hex #rrggbb
  background: string;  // hex
  foreground: string;  // hex
};

export const TEMA_PADRAO: Tema = {
  primary: "#16a34a",     // verde mercado
  background: "#f7faf7",  // quase branco
  foreground: "#1a2e22",  // verde-escuro p/ texto
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

// Converte #rrggbb para "r g b" e injeta variáveis CSS sobrescrevendo o tema base
export function aplicarTema(t: Tema) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Sobrescrevemos as variáveis OKLCH usando os hex via color() não é trivial;
  // usamos os tokens de cor diretamente com hex (OKLCH aceita hex via fallback do navegador).
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--ring", t.primary);
  root.style.setProperty("--sidebar-primary", t.primary);
  root.style.setProperty("--sidebar-ring", t.primary);
  root.style.setProperty("--background", t.background);
  root.style.setProperty("--foreground", t.foreground);
  root.style.setProperty("--card-foreground", t.foreground);
  root.style.setProperty("--popover-foreground", t.foreground);

  // Recalcula gradiente primário com a nova cor
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${t.primary}, ${shade(t.primary, 18)})`,
  );
}

// Clareia um hex em N% (0-100)
function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const f = (c: number) => Math.min(255, Math.round(c + (255 - c) * (percent / 100)));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
