import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Comercio = { id: string; nome: string };
type AuthCtx = {
  user: User | null;
  session: Session | null;
  comercio: Comercio | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshComercio: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadComercio = async (uid: string | undefined) => {
    if (!uid) { setComercio(null); return; }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("comercio_id, comercios(id, nome)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const c = (roles as any)?.comercios;
    if (c) setComercio({ id: c.id, nome: c.nome });
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => loadComercio(s?.user?.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      loadComercio(s?.user?.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshComercio = async () => { await loadComercio(user?.id); };

  return <Ctx.Provider value={{ user, session, comercio, loading, signOut, refreshComercio }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
