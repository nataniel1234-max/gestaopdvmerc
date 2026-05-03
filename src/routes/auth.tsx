import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Store } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Mercadinho" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  };

  const onSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const nome_comercio = String(fd.get("nome_comercio"));
    const display_name = String(fd.get("display_name"));
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome_comercio, display_name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 gap-2">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Mercadinho — PDV & Gestão</h1>
          <p className="text-sm text-muted-foreground">Cada comércio com seus dados isolados.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Entre ou cadastre seu comércio</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={onLogin} className="space-y-3">
                  <div><Label>Email</Label><Input name="email" type="email" required autoComplete="email" /></div>
                  <div><Label>Senha</Label><Input name="password" type="password" required autoComplete="current-password" /></div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={onSignup} className="space-y-3">
                  <div><Label>Nome do comércio</Label><Input name="nome_comercio" required placeholder="Mercadinho do José" /></div>
                  <div><Label>Seu nome</Label><Input name="display_name" required placeholder="José" /></div>
                  <div><Label>Email</Label><Input name="email" type="email" required autoComplete="email" /></div>
                  <div><Label>Senha</Label><Input name="password" type="password" required minLength={6} autoComplete="new-password" /></div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Criando..." : "Criar conta"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
