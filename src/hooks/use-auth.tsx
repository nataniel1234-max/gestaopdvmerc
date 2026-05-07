import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";

type Comercio = { id: string; nome: string };
type Assinatura = {
  id: string;
  valor_mensal: number;
  dias_carencia: number;
  data_inicio: string;
  proximo_vencimento: string;
  ultimo_pagamento: string | null;
  ativa: boolean;
  status: "ativa" | "em_carencia" | "vencida" | "bloqueada";
  diasRestantes: number;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  comercio: Comercio | null;
  assinatura: Assinatura | null;
  isSuperadmin: boolean;
  isDono: boolean;
  podeEscrever: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshComercio: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

function calcStatus(a: any): Assinatura {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(a.proximo_vencimento + "T00:00:00");
  const limite = new Date(venc); limite.setDate(limite.getDate() + (a.dias_carencia ?? 0));
  const diasRestantes = Math.ceil((limite.getTime() - hoje.getTime()) / 86400000);
  let status: Assinatura["status"];
  if (!a.ativa) status = "bloqueada";
  else if (hoje <= venc) status = "ativa";
  else if (hoje <= limite) status = "em_carencia";
  else status = "vencida";
  return { ...a, status, diasRestantes };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isDono, setIsDono] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessaoIdRef = useRef<string | null>(null);

  const loadDados = async (uid: string | undefined) => {
    if (!uid) {
      setComercio(null); setAssinatura(null); setIsSuperadmin(false); setIsDono(false);
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, comercio_id, comercios(id, nome)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    const lista = (roles ?? []) as any[];
    setIsSuperadmin(lista.some((r) => r.role === "superadmin"));
    const donoRow = lista.find((r) => r.role === "dono") ?? lista.find((r) => r.role !== "superadmin");
    setIsDono(!!donoRow && donoRow.role === "dono");
    const c = donoRow?.comercios;
    if (c) {
      setComercio({ id: c.id, nome: c.nome });
      const { data: a } = await supabase.from("assinaturas").select("*").eq("comercio_id", c.id).maybeSingle();
      if (a) setAssinatura(calcStatus(a));
    } else {
      setComercio(null); setAssinatura(null);
    }
  };

  const iniciarSessao = async (u: User) => {
    if (sessaoIdRef.current) return;
    const { data: roles } = await supabase
      .from("user_roles").select("comercio_id").eq("user_id", u.id).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("sessoes_acesso")
      .insert({ user_id: u.id, comercio_id: (roles as any)?.comercio_id ?? null, email: u.email, user_agent: navigator.userAgent } as never)
      .select("id").single();
    if (!error && data) {
      sessaoIdRef.current = (data as any).id;
      registrarAuditoria({ acao: "login", entidade: "sessao", entidade_id: (data as any).id });
    }
  };

  const encerrarSessao = async () => {
    const id = sessaoIdRef.current;
    if (!id) return;
    sessaoIdRef.current = null;
    const { data } = await supabase.from("sessoes_acesso").select("iniciada_em").eq("id", id).maybeSingle();
    const iniciada = (data as any)?.iniciada_em ? new Date((data as any).iniciada_em).getTime() : Date.now();
    const dur = Math.floor((Date.now() - iniciada) / 1000);
    await supabase.from("sessoes_acesso").update({ encerrada_em: new Date().toISOString(), duracao_segundos: dur } as never).eq("id", id);
    registrarAuditoria({ acao: "logout", entidade: "sessao", entidade_id: id });
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" && s?.user) setTimeout(() => iniciarSessao(s.user!), 50);
      if (event === "SIGNED_OUT") encerrarSessao();
      setTimeout(() => loadDados(s?.user?.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) iniciarSessao(s.user);
      loadDados(s?.user?.id).finally(() => setLoading(false));
    });
    const onUnload = () => { encerrarSessao(); };
    window.addEventListener("beforeunload", onUnload);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener("beforeunload", onUnload); };
  }, []);

  const signOut = async () => { await encerrarSessao(); await supabase.auth.signOut(); };
  const refreshComercio = async () => { await loadDados(user?.id); };

  const podeEscrever = isSuperadmin || !assinatura || assinatura.status === "ativa" || assinatura.status === "em_carencia";

  return (
    <Ctx.Provider value={{ user, session, comercio, assinatura, isSuperadmin, isDono, podeEscrever, loading, signOut, refreshComercio }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
