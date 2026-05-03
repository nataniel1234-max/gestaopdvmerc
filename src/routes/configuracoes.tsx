import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { CupomVenda, type VendaCompleta } from "@/components/CupomVenda";
import { GuiaCaixa, type CaixaCompleto } from "@/components/GuiaCaixa";
import { ReciboFiado, type ReciboFiadoData } from "@/components/ReciboFiado";
import {
  usePrintConfig, setPrintConfig, getPrintConfig, DEFAULT_PRINT_CONFIG,
  imprimirDocumento, type PrintConfig, type PrintConfigDoc, type PrintTipo,
} from "@/lib/print-config";
import { toast } from "sonner";
import { Printer, RotateCcw, Save, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações de Impressão" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const live = usePrintConfig();
  const [draft, setDraft] = useState<PrintConfig>(() => getPrintConfig());

  const update = (tipo: PrintTipo, patch: Partial<PrintConfigDoc>) =>
    setDraft((d) => ({ ...d, [tipo]: { ...d[tipo], ...patch } }));

  const salvar = () => {
    setPrintConfig(draft);
    toast.success("Configurações de impressão salvas");
  };

  const restaurar = (tipo: PrintTipo) => {
    setDraft((d) => ({ ...d, [tipo]: { ...DEFAULT_PRINT_CONFIG[tipo] } }));
    toast.info(`Padrão restaurado para ${tipo}`);
  };

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Personalize tamanho da bobina, cabeçalho/rodapé e número de vias para cada tipo de impressão."
        icon={<SettingsIcon className="h-6 w-6" />}
        actions={
          <Button onClick={salvar} size="lg">
            <Save className="h-4 w-4 mr-1" /> Salvar alterações
          </Button>
        }
      />

      <Tabs defaultValue="cupom" className="mt-2">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="cupom">Cupom de venda</TabsTrigger>
          <TabsTrigger value="guia">Guia de caixa</TabsTrigger>
          <TabsTrigger value="recibo">Recibo de fiado</TabsTrigger>
        </TabsList>

        <TabsContent value="cupom" className="mt-4">
          <SecaoConfig
            tipo="cupom"
            cfg={draft.cupom}
            onChange={(p) => update("cupom", p)}
            onReset={() => restaurar("cupom")}
            preview={<CupomVenda venda={vendaExemplo} />}
          />
        </TabsContent>

        <TabsContent value="guia" className="mt-4">
          <SecaoConfig
            tipo="guia"
            cfg={draft.guia}
            onChange={(p) => update("guia", p)}
            onReset={() => restaurar("guia")}
            preview={<GuiaCaixa caixa={caixaExemplo} movimentacoes={movsExemplo} vendas={vendasExemplo} />}
          />
        </TabsContent>

        <TabsContent value="recibo" className="mt-4">
          <SecaoConfig
            tipo="recibo"
            cfg={draft.recibo}
            onChange={(p) => update("recibo", p)}
            onReset={() => restaurar("recibo")}
            preview={<ReciboFiado data={reciboExemplo} />}
          />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground mt-6">
        ⚠ As alterações no preview já refletem o que está em edição. Lembre-se de clicar em <strong>Salvar</strong> antes de testar a impressão real.
        Configuração ativa: <strong>{live.cupom.largura_mm}mm</strong> (cupom) · <strong>{live.guia.vias}</strong> via(s) (guia) · <strong>{live.recibo.vias}</strong> via(s) (recibo).
      </p>
    </div>
  );
}

function SecaoConfig({
  tipo, cfg, onChange, onReset, preview,
}: {
  tipo: PrintTipo;
  cfg: PrintConfigDoc;
  onChange: (p: Partial<PrintConfigDoc>) => void;
  onReset: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-[1fr_auto] gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ajustes de impressão</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
            </Button>
            <Button variant="outline" size="sm" onClick={() => imprimirDocumento(tipo)}>
              <Printer className="h-3 w-3 mr-1" /> Testar impressão
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Largura da bobina</Label>
              <Select value={String(cfg.largura_mm)} onValueChange={(v) => onChange({ largura_mm: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58 mm (compacta)</SelectItem>
                  <SelectItem value="80">80 mm (padrão térmica)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número de vias</Label>
              <Input type="number" min={1} max={5} value={cfg.vias}
                onChange={(e) => onChange({ vias: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
              <p className="text-[10px] text-muted-foreground mt-1">Quantas cópias serão impressas em sequência.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Cabeçalho</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mostrar</span>
                <Switch checked={cfg.mostrar_cabecalho} onCheckedChange={(v) => onChange({ mostrar_cabecalho: v })} />
              </div>
            </div>
            <Textarea rows={4} value={cfg.cabecalho} onChange={(e) => onChange({ cabecalho: e.target.value })}
              placeholder="Nome da loja&#10;Endereço&#10;CNPJ / Telefone" />
            <p className="text-[10px] text-muted-foreground mt-1">Cada linha aparece centralizada no topo.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Rodapé</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mostrar</span>
                <Switch checked={cfg.mostrar_rodape} onCheckedChange={(v) => onChange({ mostrar_rodape: v })} />
              </div>
            </div>
            <Textarea rows={3} value={cfg.rodape} onChange={(e) => onChange({ rodape: e.target.value })}
              placeholder="Mensagem de agradecimento&#10;Aviso fiscal / contato" />
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Pré-visualização</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md flex justify-center overflow-auto">
            <div style={{ transform: cfg.largura_mm === 58 ? "scale(0.95)" : "scale(1)", transformOrigin: "top center" }}>
              {preview}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Largura simulada: {cfg.largura_mm}mm · {cfg.vias} via(s)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- exemplos para preview ----------

const vendaExemplo: VendaCompleta = {
  id: "ex", numero_cupom: 1234, created_at: new Date().toISOString(),
  forma_pagamento: "dinheiro", subtotal: 27.50, desconto: 2.50, total: 25.00,
  valor_recebido: 30, troco: 5, observacoes: null,
  clientes: { nome: "Cliente Exemplo" },
  itens_venda: [
    { id: "1", produto_nome: "ARROZ TIPO 1 5KG", quantidade: 1, preco_unitario: 22.50, subtotal: 22.50 },
    { id: "2", produto_nome: "FEIJAO CARIOCA 1KG", quantidade: 1, preco_unitario: 5.00, subtotal: 5.00 },
  ],
};

const caixaExemplo: CaixaCompleto = {
  id: "exemplo-uuid-12345678", operador: "João",
  aberto_em: new Date(Date.now() - 8 * 3600_000).toISOString(),
  fechado_em: new Date().toISOString(),
  valor_abertura: 100, valor_fechamento_calculado: 480, valor_fechamento_informado: 480, diferenca: 0,
  total_dinheiro: 380, total_pix: 220, total_debito: 150, total_credito: 90, total_fiado: 60,
  total_sangrias: 50, total_suprimentos: 30, total_despesas: 0, total_recebimentos_fiado: 100,
  qtd_vendas: 12, observacoes_fechamento: null,
};

const movsExemplo = [
  { id: "1", created_at: new Date().toISOString(), tipo: "sangria", forma_pagamento: "dinheiro", valor: 50, descricao: "Depósito cofre" },
  { id: "2", created_at: new Date().toISOString(), tipo: "suprimento", forma_pagamento: "dinheiro", valor: 30, descricao: "Troco extra" },
];

const vendasExemplo = [
  { id: "v1", numero_cupom: 1230, created_at: new Date().toISOString(), forma_pagamento: "dinheiro", total: 45.00 },
  { id: "v2", numero_cupom: 1231, created_at: new Date().toISOString(), forma_pagamento: "pix", total: 22.00 },
];

const reciboExemplo: ReciboFiadoData = {
  numero: "ABC12345",
  cliente: { nome: "Maria Silva", documento: "123.456.789-00", telefone: "(11) 9 9999-0000" },
  valor_pago: 50, forma_pagamento: "dinheiro",
  saldo_anterior: 150, saldo_atual: 100, data: new Date(),
  observacoes: "Pagamento parcial.",
};
