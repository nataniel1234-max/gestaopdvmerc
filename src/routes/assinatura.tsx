import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/assinatura")({
  head: () => ({ meta: [{ title: "Minha Assinatura" }] }),
  component: AssinaturaPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function AssinaturaPage() {
  const { assinatura, comercio } = useAuth();
  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos-assinatura", comercio?.id],
    enabled: !!comercio?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_assinatura").select("*")
        .eq("comercio_id", comercio!.id).order("data_pagamento", { ascending: false });
      return data ?? [];
    },
  });

  const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ativa: { label: "Ativa", variant: "default" },
    em_carencia: { label: "Em carência", variant: "secondary" },
    vencida: { label: "Vencida", variant: "destructive" },
    bloqueada: { label: "Bloqueada", variant: "destructive" },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Minha Assinatura</h1>
        <p className="text-sm text-muted-foreground">Mensalidade do sistema PDV.</p>
      </div>

      {!assinatura ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma assinatura encontrada.</CardContent></Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Status</CardTitle></CardHeader>
              <CardContent><Badge variant={statusLabel[assinatura.status].variant}>{statusLabel[assinatura.status].label}</Badge></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Mensalidade</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{fmt(Number(assinatura.valor_mensal))}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Próximo vencimento</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{data(assinatura.proximo_vencimento)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Carência</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{assinatura.dias_carencia} dias</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Histórico de pagamentos</CardTitle></CardHeader>
            <CardContent>
              {pagamentos && pagamentos.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Referente a</TableHead>
                    <TableHead>Próx. venc.</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pagamentos.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{data(p.data_pagamento)}</TableCell>
                        <TableCell>{data(p.referente_a)}</TableCell>
                        <TableCell>{data(p.proximo_vencimento)}</TableCell>
                        <TableCell>{p.forma ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(p.valor))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
