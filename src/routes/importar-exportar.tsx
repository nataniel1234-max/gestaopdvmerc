import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, FileSpreadsheet, Info, CheckCircle2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { parseCSV, toCSV, downloadCSV, autoMap, toNum, toBool, normCol, type CsvRow } from "@/lib/csv";

export const Route = createFileRoute("/importar-exportar")({
  head: () => ({ meta: [{ title: "Importar / Exportar — Mercadinho" }] }),
  component: ImportarExportarPage,
});

// =================== Definição das entidades ===================

type FieldDef = {
  key: string;            // nome destino (coluna no banco / chave do payload)
  label: string;          // rótulo amigável
  aliases: string[];      // possíveis nomes em CSVs externos
  required?: boolean;
  type?: "text" | "number" | "bool";
};

type EntityDef = {
  id: "produtos" | "clientes" | "fornecedores";
  label: string;
  table: "produtos" | "clientes" | "fornecedores";
  fields: FieldDef[];
  uniqueKey: string;      // campo usado para detectar duplicados (atualizar)
  uniqueLabel: string;
};

const ENTITIES: EntityDef[] = [
  {
    id: "produtos",
    label: "Produtos",
    table: "produtos",
    uniqueKey: "codigo_barras",
    uniqueLabel: "Código de barras",
    fields: [
      { key: "nome", label: "Nome", aliases: ["nome", "descricao", "produto", "descricaoproduto"], required: true },
      { key: "codigo_barras", label: "Código de barras", aliases: ["codigobarras", "ean", "gtin", "codigo", "codbarras", "barcode"] },
      { key: "categoria", label: "Categoria", aliases: ["categoria", "grupo", "secao"] },
      { key: "unidade", label: "Unidade", aliases: ["unidade", "und", "un", "unidademedida"] },
      { key: "preco_custo", label: "Preço de custo", aliases: ["precocusto", "custo", "valorcusto"], type: "number" },
      { key: "preco_venda", label: "Preço de venda", aliases: ["precovenda", "venda", "valorvenda", "preco"], type: "number", required: true },
      { key: "estoque_atual", label: "Estoque atual", aliases: ["estoque", "estoqueatual", "qtde", "quantidade"], type: "number" },
      { key: "estoque_minimo", label: "Estoque mínimo", aliases: ["estoqueminimo", "minimo", "estminimo"], type: "number" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    table: "clientes",
    uniqueKey: "documento",
    uniqueLabel: "CPF/CNPJ",
    fields: [
      { key: "nome", label: "Nome", aliases: ["nome", "cliente", "razaosocial"], required: true },
      { key: "documento", label: "CPF/CNPJ", aliases: ["documento", "cpf", "cnpj", "cpfcnpj"] },
      { key: "telefone", label: "Telefone", aliases: ["telefone", "celular", "fone", "tel"] },
      { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail"] },
      { key: "endereco", label: "Endereço", aliases: ["endereco", "rua", "logradouro"] },
      { key: "limite_credito", label: "Limite de crédito", aliases: ["limitecredito", "limite", "credito"], type: "number" },
      { key: "permite_fiado", label: "Permite fiado", aliases: ["permitefiado", "fiado"], type: "bool" },
      { key: "observacoes", label: "Observações", aliases: ["observacoes", "obs", "observacao"] },
    ],
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    table: "fornecedores",
    uniqueKey: "cnpj",
    uniqueLabel: "CNPJ",
    fields: [
      { key: "razao_social", label: "Razão social", aliases: ["razaosocial", "razao", "nome", "fornecedor"], required: true },
      { key: "nome_fantasia", label: "Nome fantasia", aliases: ["nomefantasia", "fantasia", "apelido"] },
      { key: "cnpj", label: "CNPJ", aliases: ["cnpj", "documento", "cpfcnpj"] },
      { key: "telefone", label: "Telefone", aliases: ["telefone", "fone", "celular", "tel"] },
      { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail"] },
      { key: "endereco", label: "Endereço", aliases: ["endereco", "rua", "logradouro"] },
      { key: "observacoes", label: "Observações", aliases: ["observacoes", "obs"] },
    ],
  },
];

// =================== Página ===================

function ImportarExportarPage() {
  return (
    <div>
      <PageHeader
        title="Importar / Exportar Cadastros"
        description="Migre dados de outro PDV ou planilhas via CSV. Compatível com Excel, Google Sheets e a maioria dos sistemas."
      />

      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          O formato usado é <strong>CSV</strong> (separado por <code>;</code> ou <code>,</code>) — universal entre PDVs.
          Para começar, baixe o <strong>modelo</strong> da aba desejada, preencha no Excel/Sheets, salve como CSV e importe.
          Você também pode exportar uma planilha vazia direto do seu antigo PDV — o sistema tenta reconhecer as colunas automaticamente.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="produtos">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          {ENTITIES.map((e) => (
            <TabsTrigger key={e.id} value={e.id}>{e.label}</TabsTrigger>
          ))}
        </TabsList>

        {ENTITIES.map((e) => (
          <TabsContent key={e.id} value={e.id} className="mt-4 space-y-4">
            <EntityPanel entity={e} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// =================== Painel por entidade ===================

function EntityPanel({ entity }: { entity: EntityDef }) {
  const qc = useQueryClient();
  const { comercio } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csv, setCsv] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"create" | "upsert">("upsert");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ ok: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const { data: existentes = [] } = useQuery({
    queryKey: [entity.table, "count"],
    queryFn: async () => {
      const { count } = await supabase.from(entity.table).select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const headers = useMemo(() => entity.fields.map((f) => f.label), [entity]);

  // ------- Exportar -------
  const exportarTudo = async () => {
    const cols = entity.fields.map((f) => f.key).join(", ");
    const { data, error } = await supabase.from(entity.table).select(cols);
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []).map((row: any) => {
      const o: Record<string, unknown> = {};
      entity.fields.forEach((f) => { o[f.label] = row[f.key] ?? ""; });
      return o;
    });
    const csvOut = toCSV(headers, rows, ";");
    downloadCSV(`${entity.id}_${new Date().toISOString().slice(0, 10)}.csv`, csvOut);
    toast.success(`${rows.length} ${entity.label.toLowerCase()} exportados`);
  };

  const baixarModelo = () => {
    const exemplo: Record<string, unknown> = {};
    entity.fields.forEach((f) => {
      exemplo[f.label] =
        f.type === "number" ? "0" :
        f.type === "bool" ? "Não" :
        f.key === "nome" || f.key === "razao_social" ? `Exemplo de ${entity.label.toLowerCase().slice(0, -1)}` : "";
    });
    const csvOut = toCSV(headers, [exemplo], ";");
    downloadCSV(`modelo_${entity.id}.csv`, csvOut);
  };

  // ------- Importar -------
  const onFile = async (file: File) => {
    setReport(null);
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.headers.length === 0) { toast.error("CSV vazio ou inválido"); return; }
    // Sanitiza cabeçalhos: remove vazios e duplicados (Radix Select não aceita value="")
    const seen = new Set<string>();
    const cleanHeaders: string[] = [];
    parsed.headers.forEach((h, idx) => {
      let name = (h ?? "").trim();
      if (!name) name = `coluna_${idx + 1}`;
      let unique = name;
      let n = 2;
      while (seen.has(unique)) unique = `${name} (${n++})`;
      seen.add(unique);
      cleanHeaders.push(unique);
    });
    const cleanRows = parsed.rows.map((r) => {
      const o: CsvRow = {};
      parsed.headers.forEach((orig, i) => { o[cleanHeaders[i]] = r[orig] ?? ""; });
      return o;
    });
    setCsv({ headers: cleanHeaders, rows: cleanRows });
    // auto-map
    const m: Record<string, string> = {};
    entity.fields.forEach((f) => {
      const found = autoMap(cleanHeaders, [f.label, f.key, ...f.aliases]);
      if (found) m[f.key] = found;
    });
    setMapping(m);
    toast.success(`${parsed.rows.length} linhas lidas. Confira o mapeamento das colunas.`);
  };

  const importar = async () => {
    if (!csv) return;
    if (!comercio) { toast.error("Comércio não carregado"); return; }
    const obrigatorios = entity.fields.filter((f) => f.required);
    for (const f of obrigatorios) {
      if (!mapping[f.key]) { toast.error(`Mapeie a coluna obrigatória: ${f.label}`); return; }
    }

    setBusy(true);
    const rep = { ok: 0, updated: 0, skipped: 0, errors: [] as string[] };

    // Carrega existentes para upsert por chave única
    let existing = new Map<string, string>(); // unique => id
    if (mode === "upsert" && mapping[entity.uniqueKey]) {
      const { data } = await supabase
        .from(entity.table)
        .select(`id, ${entity.uniqueKey}`);
      (data ?? []).forEach((r: any) => {
        const k = (r[entity.uniqueKey] ?? "").toString().trim();
        if (k) existing.set(k, r.id);
      });
    }

    // Processa em lotes
    const BATCH = 100;
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];

    for (let i = 0; i < csv.rows.length; i++) {
      const r = csv.rows[i];
      const payload: Record<string, unknown> = {};
      let valido = true;
      for (const f of entity.fields) {
        const col = mapping[f.key];
        if (!col) continue;
        const raw = r[col] ?? "";
        if (f.required && !raw) { valido = false; break; }
        if (raw === "" && !f.required) continue;
        if (f.type === "number") payload[f.key] = toNum(raw);
        else if (f.type === "bool") payload[f.key] = toBool(raw);
        else payload[f.key] = raw;
      }
      if (!valido) { rep.skipped++; continue; }

      const uniqueVal = mapping[entity.uniqueKey] ? (r[mapping[entity.uniqueKey]] ?? "").toString().trim() : "";
      if (mode === "upsert" && uniqueVal && existing.has(uniqueVal)) {
        toUpdate.push({ id: existing.get(uniqueVal)!, payload });
      } else {
        toInsert.push(payload);
      }
    }

    // Insere em lotes
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const slice = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from(entity.table).insert(slice as any);
      if (error) rep.errors.push(`Inserção lote ${i / BATCH + 1}: ${error.message}`);
      else rep.ok += slice.length;
    }
    // Atualiza um a um (poucos campos, RLS por id)
    for (const u of toUpdate) {
      const { error } = await supabase.from(entity.table).update(u.payload as any).eq("id", u.id);
      if (error) rep.errors.push(`Atualização ${u.id.slice(0, 8)}: ${error.message}`);
      else rep.updated++;
    }

    setBusy(false);
    setReport(rep);
    qc.invalidateQueries({ queryKey: [entity.table] });
    qc.invalidateQueries({ queryKey: [entity.table, "count"] });
    if (rep.errors.length === 0) toast.success(`Importação concluída: ${rep.ok} novos, ${rep.updated} atualizados`);
    else toast.warning(`Importação com ${rep.errors.length} erros`);
  };

  const limpar = () => {
    setCsv(null); setMapping({}); setReport(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Exportar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Exportar {entity.label}</CardTitle>
          <CardDescription>Baixe seus cadastros para backup ou migração. Formato CSV (Excel-friendly).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Total no sistema: <Badge variant="secondary">{existentes}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportarTudo} disabled={existentes === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar todos
            </Button>
            <Button variant="outline" onClick={baixarModelo}>
              <FileDown className="h-4 w-4 mr-2" /> Baixar modelo (vazio)
            </Button>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2">
            <strong>Colunas:</strong> {headers.join(" • ")}
          </div>
        </CardContent>
      </Card>

      {/* Importar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Importar {entity.label}</CardTitle>
          <CardDescription>
            Envie um arquivo CSV exportado de outro PDV/Excel. As colunas são mapeadas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:opacity-90"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />

          {csv && (
            <>
              <div className="text-sm">
                <Badge>{csv.rows.length} linhas</Badge>{" "}
                <Badge variant="outline">{csv.headers.length} colunas</Badge>
              </div>

              <div>
                <Label className="text-xs">Modo de importação</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upsert">Atualizar existentes + criar novos (chave: {entity.uniqueLabel})</SelectItem>
                    <SelectItem value="create">Apenas criar novos (pode duplicar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-auto">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Mapeamento de colunas</div>
                {entity.fields.map((f) => (
                  <div key={f.key} className="grid grid-cols-2 gap-2 items-center text-sm">
                    <Label className="text-xs">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select
                      value={mapping[f.key] ?? "__none__"}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ignorar —</SelectItem>
                        {csv.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Pré-visualização */}
              <div className="border rounded-md overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {entity.fields.filter((f) => mapping[f.key]).map((f) => (
                        <TableHead key={f.key} className="text-xs">{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csv.rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        {entity.fields.filter((f) => mapping[f.key]).map((f) => (
                          <TableCell key={f.key} className="text-xs">{r[mapping[f.key]] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {csv.rows.length > 5 && (
                  <div className="text-[10px] text-muted-foreground text-center py-1">
                    + {csv.rows.length - 5} linhas...
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={importar} disabled={busy} className="flex-1">
                  {busy ? "Importando..." : `Importar ${csv.rows.length} ${entity.label.toLowerCase()}`}
                </Button>
                <Button variant="outline" onClick={limpar} disabled={busy}>Cancelar</Button>
              </div>
            </>
          )}

          {report && (
            <Alert className={report.errors.length === 0 ? "border-success" : "border-warning"}>
              {report.errors.length === 0
                ? <CheckCircle2 className="h-4 w-4 text-success" />
                : <AlertTriangle className="h-4 w-4 text-warning" />}
              <AlertTitle>Resultado da importação</AlertTitle>
              <AlertDescription>
                <div className="space-y-1 mt-1">
                  <div>✓ Novos registros: <strong>{report.ok}</strong></div>
                  <div>↻ Atualizados: <strong>{report.updated}</strong></div>
                  <div>⊘ Ignorados (faltava obrigatório): <strong>{report.skipped}</strong></div>
                  {report.errors.length > 0 && (
                    <div className="mt-2">
                      <div className="font-semibold text-destructive">{report.errors.length} erro(s):</div>
                      <ul className="text-xs list-disc pl-5 max-h-24 overflow-auto">
                        {report.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
