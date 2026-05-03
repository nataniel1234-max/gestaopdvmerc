import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { ShoppingCart, Package, AlertTriangle, CreditCard, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mercadinho" },
      { name: "description", content: "Visão geral de vendas, estoque e fiado." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const [vendasHoje, vendasMes, prods, clientes, fiado] = await Promise.all([
        supabase.from("vendas").select("total").eq("cancelada", false).gte("created_at", hoje.toISOString()),
        supabase.from("vendas").select("total, created_at").eq("cancelada", false).gte("created_at", inicioMes.toISOString()),
        supabase.from("produtos").select("id, nome, estoque_atual, estoque_minimo").eq("ativo", true),
        supabase.from("clientes").select("id").eq("ativo", true),
        supabase.from("clientes").select("saldo_devedor").gt("saldo_devedor", 0),
      ]);

      const totalHoje = (vendasHoje.data ?? []).reduce((s, v) => s + Number(v.total), 0);
      const totalMes = (vendasMes.data ?? []).reduce((s, v) => s + Number(v.total), 0);
      const baixoEstoque = (prods.data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo));
      const totalFiado = (fiado.data ?? []).reduce((s, c) => s + Number(c.saldo_devedor), 0);

      // últimos 7 dias
      const dias: { dia: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const total = (vendasMes.data ?? [])
          .filter((v) => { const t = new Date(v.created_at).getTime(); return t >= d.getTime() && t < next.getTime(); })
          .reduce((s, v) => s + Number(v.total), 0);
        dias.push({ dia: d.toLocaleDateString("pt-BR", { weekday: "short" }), total });
      }

      return {
        totalHoje,
        totalMes,
        qtdVendasHoje: vendasHoje.data?.length ?? 0,
        produtosAtivos: prods.data?.length ?? 0,
        baixoEstoque,
        clientesAtivos: clientes.data?.length ?? 0,
        totalFiado,
        dias,
      };
    },
  });

  const cards = [
    { label: "Vendas Hoje", value: brl(stats?.totalHoje ?? 0), icon: ShoppingCart, hint: `${stats?.qtdVendasHoje ?? 0} cupons`, color: "text-primary" },
    { label: "Vendas no Mês", value: brl(stats?.totalMes ?? 0), icon: TrendingUp, hint: "acumulado", color: "text-success" },
    { label: "Produtos Ativos", value: stats?.produtosAtivos ?? 0, icon: Package, hint: `${stats?.baixoEstoque.length ?? 0} em alerta`, color: "text-warning" },
    { label: "Fiado em Aberto", value: brl(stats?.totalFiado ?? 0), icon: CreditCard, hint: `${stats?.clientesAtivos ?? 0} clientes`, color: "text-destructive" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do mercadinho em tempo real." />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
                  <p className="text-2xl font-bold mt-1 truncate">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
                </div>
                <div className={`p-2 rounded-lg bg-muted ${c.color}`}><c.icon className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Vendas — últimos 7 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.dias ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="dia" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                  />
                  <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.baixoEstoque.length ? (
              <ul className="space-y-2 max-h-60 overflow-auto">
                {stats.baixoEstoque.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex justify-between text-sm border-b pb-1">
                    <span className="truncate">{p.nome}</span>
                    <span className="text-warning font-semibold shrink-0">{Number(p.estoque_atual)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Tudo em dia 👍</p>
            )}
            <Link to="/produtos" className="text-xs text-primary hover:underline mt-3 inline-block">Ver todos →</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        <Link to="/pdv" className="group">
          <Card className="hover:shadow-md transition-all hover:-translate-y-0.5" style={{ background: "var(--gradient-primary)" }}>
            <CardContent className="p-6 text-primary-foreground">
              <ShoppingCart className="h-8 w-8 mb-2" />
              <div className="font-bold text-lg">Abrir Caixa (PDV)</div>
              <div className="text-sm opacity-90">Iniciar uma nova venda</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/entradas">
          <Card className="hover:shadow-md transition-all hover:-translate-y-0.5">
            <CardContent className="p-6">
              <Package className="h-8 w-8 mb-2 text-primary" />
              <div className="font-bold text-lg">Lançar Entrada</div>
              <div className="text-sm text-muted-foreground">Receber mercadoria</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/fiado">
          <Card className="hover:shadow-md transition-all hover:-translate-y-0.5">
            <CardContent className="p-6">
              <Users className="h-8 w-8 mb-2 text-primary" />
              <div className="font-bold text-lg">Receber Fiado</div>
              <div className="text-sm text-muted-foreground">Quitar crediário</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
