import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, Lock } from "lucide-react";

export function BannerAssinatura() {
  const { assinatura, isSuperadmin } = useAuth();
  if (isSuperadmin || !assinatura) return null;
  if (assinatura.status === "ativa") return null;

  if (assinatura.status === "em_carencia") {
    return (
      <div className="bg-yellow-500/15 border-b border-yellow-500/40 text-yellow-900 dark:text-yellow-200 px-4 py-2 text-sm flex items-center gap-2 print:hidden">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Mensalidade vencida. Você está em <strong>período de carência</strong> — restam {assinatura.diasRestantes}{" "}
          {assinatura.diasRestantes === 1 ? "dia" : "dias"}.
        </span>
        <Link to="/assinatura" className="ml-auto underline font-medium">Ver detalhes</Link>
      </div>
    );
  }
  return (
    <div className="bg-destructive/15 border-b border-destructive/40 text-destructive px-4 py-2 text-sm flex items-center gap-2 print:hidden">
      <Lock className="h-4 w-4" />
      <span>Mensalidade vencida — sistema em <strong>modo somente leitura</strong>. Regularize o pagamento para liberar.</span>
      <Link to="/assinatura" className="ml-auto underline font-medium">Ver detalhes</Link>
    </div>
  );
}
