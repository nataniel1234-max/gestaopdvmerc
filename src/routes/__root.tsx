import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
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
      { property: "og:title", content: "Mercadinho — PDV e Gestão" },
      { name: "twitter:title", content: "Mercadinho — PDV e Gestão" },
      { property: "og:description", content: "Sistema completo de PDV, estoque, clientes, fornecedores e fiado para mercadinhos." },
      { name: "twitter:description", content: "Sistema completo de PDV, estoque, clientes, fornecedores e fiado para mercadinhos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/10b1f158-4c03-4d5e-aedc-a2e52ec6d06e/id-preview-d6c6cbe4--4cfa739a-86cd-4f64-8cff-5f6fedfc2317.lovable.app-1777810807145.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/10b1f158-4c03-4d5e-aedc-a2e52ec6d06e/id-preview-d6c6cbe4--4cfa739a-86cd-4f64-8cff-5f6fedfc2317.lovable.app-1777810807145.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isPdv = pathname.startsWith("/pdv");

  return (
    <QueryClientProvider client={queryClient}>
      {isPdv ? (
        <div className="min-h-screen w-full bg-background">
          <Outlet />
        </div>
      ) : (
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-30 print:hidden">
                <SidebarTrigger />
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </span>
              </header>
              <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      )}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
