import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { brl, dt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Printer, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CupomVenda, type VendaCompleta } from "@/components/CupomVenda";

export const Route = createFileRoute("/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Mercadinho" }] }),
  component: VendasPage,
});

const formaPagLabel: Record<string, string> = {
  dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito", pix: "PIX", fiado: "Fiado",
};

function VendasPage() {
  const [busca, setBusca] = useState("");
  const [vendaSel, setVendaSel] = useState<VendaCompleta | null>(null);

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => (await supabase.from("vendas")
      .select("*, clientes(nome), itens_venda(*)")
      .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const filtradas = vendas.filter((v) => !busca ||
    String(v.numero_cupom).includes(busca) ||
    (v.clientes?.nome ?? "").toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Histórico de vendas registradas no PDV."
        actions={<Link to="/pdv"><Button>Abrir PDV</Button></Link>}
      />

      <Card className="mb-4"><CardContent className="p-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número de cupom ou cliente..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cupom</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead>
              <TableHead>Pagamento</TableHead><TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda</TableCell></TableRow>}
            {filtradas.map((v) => (
              <TableRow key={v.id} className={v.cancelada ? "opacity-50" : ""}>
                <TableCell className="font-mono">#{v.numero_cupom}</TableCell>
                <TableCell className="text-xs">{dt(v.created_at)}</TableCell>
                <TableCell>{v.clientes?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Badge variant={v.forma_pagamento === "fiado" ? "destructive" : "secondary"}>{formaPagLabel[v.forma_pagamento]}</Badge></TableCell>
                <TableCell className="text-right">{v.itens_venda?.length ?? 0}</TableCell>
                <TableCell className="text-right font-bold">{brl(v.total)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setVendaSel(v as VendaCompleta)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!vendaSel} onOpenChange={(v) => !v && setVendaSel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cupom #{vendaSel?.numero_cupom}</DialogTitle></DialogHeader>
          {vendaSel && <CupomVenda venda={vendaSel} />}
          <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir cupom</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
