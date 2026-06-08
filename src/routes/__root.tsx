import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Store } from "lucide-react";
import { aplicarTema, carregarTema } from "@/lib/tema";
import { BannerAssinatura } from "@/components/BannerAssinatura";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mercadinho — PDV e Gestão" },
      { name: "description", content: "Sistema completo de PDV, estoque, clientes, fornecedores e fiado para mercadinhos." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { aplicarTema(carregarTema()); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, loading, comercio, signOut } = useAuth();
  const isPdv = pathname.startsWith("/pdv");
  const isAuthRoute = pathname.startsWith("/auth");

  useEffect(() => {
    if (!loading && !user && !isAuthRoute) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, isAuthRoute, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (isAuthRoute) return <Outlet />;
  if (!user) return null;

  if (isPdv) {
    return <div className="min-h-screen w-full bg-background"><Outlet /></div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-30 print:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-2 text-sm font-medium">
              <Store className="h-4 w-4 text-primary" />
              <span>{comercio?.nome ?? "—"}</span>
            </div>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
            <span className="text-xs text-muted-foreground hidden md:inline">{user.email}</span>
            <Button size="sm" variant="ghost" onClick={() => { signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </header>
          <BannerAssinatura />
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
