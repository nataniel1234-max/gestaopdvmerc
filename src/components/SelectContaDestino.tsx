import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { obterCaixaEmpresa, NOME_CAIXA_EMPRESA, type ContaFinanceira } from "@/lib/caixa-empresa";

/** Lista de contas financeiras da empresa (caixa da empresa + contas bancárias). */
export function useContasFinanceiras(enabled = true) {
  return useQuery({
    queryKey: ["contas-financeiras"],
    enabled,
    queryFn: async () => {
      await obterCaixaEmpresa(); // garante que o caixa da empresa exista
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, nome, saldo, tipo")
        .eq("ativo", true)
        .order("nome");
      const lista = (data ?? []) as ContaFinanceira[];
      // caixa da empresa sempre primeiro
      return lista.sort((a, b) => (a.nome === NOME_CAIXA_EMPRESA ? -1 : b.nome === NOME_CAIXA_EMPRESA ? 1 : a.nome.localeCompare(b.nome)));
    },
  });
}

export function SelectContaDestino({
  value, onChange, label = "Conta de destino", enabled = true,
}: { value: string; onChange: (id: string) => void; label?: string; enabled?: boolean }) {
  const { data: contas = [] } = useContasFinanceiras(enabled);
  const [novaOpen, setNovaOpen] = useState(false);

  useEffect(() => {
    if (!value && contas.length > 0) onChange(contas[0].id);
  }, [contas, value, onChange]);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome} · {brl(c.saldo)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" title="Cadastrar conta bancária" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <DialogNovaConta open={novaOpen} onOpenChange={setNovaOpen} onCreated={(id) => onChange(id)} />
    </div>
  );
}

export function DialogNovaConta({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [tipo, setTipo] = useState("banco");
  const [saldo, setSaldo] = useState("0");

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome da conta");
      const { data, error } = await supabase
        .from("contas_bancarias")
        .insert({ nome: nome.trim(), instituicao: instituicao.trim() || null, tipo, saldo: Number(saldo) || 0 })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Conta cadastrada");
      setNome(""); setInstituicao(""); setSaldo("0");
      ["contas-financeiras", "bal-bancos", "contas-bancarias-credito"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onCreated?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar conta"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cadastrar conta bancária</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-1">
          <div><Label>Nome da conta *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Banco do Brasil — CC 1234" autoFocus /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Instituição</Label><Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Banco / fintech" /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Conta bancária</SelectItem>
                  <SelectItem value="aplicacao">Aplicação financeira</SelectItem>
                  <SelectItem value="outros_creditos">Outros créditos</SelectItem>
                  <SelectItem value="caixa">Caixa / tesouraria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Saldo inicial</Label><Input type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={salvar.isPending || !nome} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando…" : "Cadastrar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
