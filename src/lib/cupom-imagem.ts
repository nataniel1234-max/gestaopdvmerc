/** Geração e compartilhamento do cupom em imagem JPG (WhatsApp). */

async function elementoParaBlob(el: HTMLElement, escala = 3): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(el, {
    scale: escala,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/jpeg", 0.92),
  );
}

export async function gerarCupomJPG(el: HTMLElement, nomeArquivo: string) {
  const blob = await elementoParaBlob(el);
  return { blob, file: new File([blob], nomeArquivo, { type: "image/jpeg" }) };
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Compartilha o cupom como imagem. Usa o compartilhamento nativo do celular
 * (WhatsApp incluso). Se não houver suporte, baixa o JPG e abre o WhatsApp Web.
 */
export async function compartilharCupom(opts: {
  el: HTMLElement;
  nomeArquivo: string;
  texto: string;
  telefone?: string | null;
}): Promise<"nativo" | "download"> {
  const { file, blob } = await gerarCupomJPG(opts.el, opts.nomeArquivo);

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: opts.texto });
      return "nativo";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "nativo";
    }
  }

  baixarBlob(blob, opts.nomeArquivo);
  const tel = (opts.telefone ?? "").replace(/\D/g, "");
  const url = tel
    ? `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(opts.texto)}`
    : `https://wa.me/?text=${encodeURIComponent(opts.texto)}`;
  window.open(url, "_blank", "noopener");
  return "download";
}
