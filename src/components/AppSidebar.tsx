import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  CreditCard,
  Store,
  FileBarChart,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof ShoppingCart;
  external?: boolean;
};

const operacao: NavItem[] = [
  { title: "PDV — Caixa (nova janela)", url: "/pdv", icon: ShoppingCart, external: true },
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
];

const cadastros = [
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
];

const movimentos = [
  { title: "Entrada de Mercadoria", url: "/entradas", icon: ArrowDownToLine },
  { title: "Saída / Perda", url: "/saidas", icon: ArrowUpFromLine },
  { title: "Vendas", url: "/vendas", icon: Receipt },
  { title: "Fiado / Crediário", url: "/fiado", icon: CreditCard },
];

const sistema = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  const Section = ({ label, items }: { label: string; items: NavItem[] }) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase tracking-wider text-xs">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={!item.external && isActive(item.url)} tooltip={item.title}>
                {item.external ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="font-medium">{item.title}</span>}
                  </a>
                ) : (
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="font-medium">{item.title}</span>}
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" style={{ background: "var(--gradient-sidebar)" }}>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sidebar-foreground">Mercadinho</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">PDV & Gestão</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Section label="Operação" items={operacao} />
        <Section label="Cadastros" items={cadastros} />
        <Section label="Movimentos" items={movimentos} />
        <Section label="Sistema" items={sistema} />
      </SidebarContent>
    </Sidebar>
  );
}
