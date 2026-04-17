import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Save, Trash2, ShieldCheck, User as UserIcon } from "lucide-react";
import { z } from "zod";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { login as secullumLogin } from "@/lib/secullum-api";

const credentialsSchema = z.object({
  secullum_username: z.string().trim().min(3, "Informe o usuário Secullum").max(120),
  secullum_password: z.string().min(1, "Informe a senha").max(200),
  client_id: z.string().trim().min(1).max(20).default("7"),
});

const AccountPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [form, setForm] = useState({ secullum_username: "", secullum_password: "", client_id: "7" });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [profileRes, credsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("secullum_credentials").select("secullum_username, client_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileRes.data) setDisplayName(profileRes.data.display_name ?? "");
      if (credsRes.data) {
        setHasCredentials(true);
        setForm({
          secullum_username: credsRes.data.secullum_username,
          secullum_password: "",
          client_id: credsRes.data.client_id,
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // If updating and password empty, fetch existing one (don't overwrite blank)
    let password = form.secullum_password;
    if (hasCredentials && !password) {
      toast({
        title: "Informe a senha",
        description: "Para atualizar, digite a senha novamente por segurança.",
        variant: "destructive",
      });
      return;
    }

    const parsed = credentialsSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Dados inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("secullum_credentials").upsert(
      {
        user_id: user.id,
        secullum_username: parsed.data.secullum_username,
        secullum_password: parsed.data.secullum_password,
        client_id: parsed.data.client_id,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);

    if (error) {
      toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setHasCredentials(true);
    setForm((p) => ({ ...p, secullum_password: "" }));
    toast({ title: "Credenciais salvas", description: "Já podem ser usadas pelos agendamentos." });
  };

  const handleTest = async () => {
    if (!form.secullum_username || !form.secullum_password) {
      toast({ title: "Preencha usuário e senha para testar", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      await secullumLogin(form.secullum_username, form.secullum_password);
      toast({ title: "Conexão validada", description: "Credenciais Secullum funcionam." });
    } catch (err: any) {
      toast({
        title: "Falha no teste",
        description: err.message ?? "Não foi possível autenticar na Secullum.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("Remover suas credenciais Secullum? Agendamentos deixarão de funcionar.")) return;
    const { error } = await supabase.from("secullum_credentials").delete().eq("user_id", user.id);
    if (error) {
      toast({ title: "Falha ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setHasCredentials(false);
    setForm({ secullum_username: "", secullum_password: "", client_id: "7" });
    toast({ title: "Credenciais removidas" });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      toast({ title: "Nome muito curto", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Falha ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil atualizado" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl space-y-6 px-4 py-8"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Minha Conta</h2>
          <p className="text-sm text-muted-foreground">Perfil e credenciais para automações</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4" /> Perfil
            </CardTitle>
            <CardDescription>Como você é identificado no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de exibição</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
            </div>
            <Button onClick={handleSaveProfile} variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" /> Salvar perfil
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Credenciais Secullum
            </CardTitle>
            <CardDescription>
              Necessárias para que os relatórios agendados rodem automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Armazenamento seguro</AlertTitle>
              <AlertDescription>
                Suas credenciais ficam guardadas no banco protegido e só são acessíveis pela sua conta.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secullum-user">Usuário Secullum (e-mail)</Label>
                <Input
                  id="secullum-user"
                  type="email"
                  value={form.secullum_username}
                  onChange={(e) => setForm((p) => ({ ...p, secullum_username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secullum-pass">Senha Secullum</Label>
                <Input
                  id="secullum-pass"
                  type="password"
                  placeholder={hasCredentials ? "•••••••• (digite para atualizar)" : ""}
                  value={form.secullum_password}
                  onChange={(e) => setForm((p) => ({ ...p, secullum_password: e.target.value }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {hasCredentials ? "Atualizar credenciais" : "Salvar credenciais"}
                </Button>
                <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Testar conexão
                </Button>
                {hasCredentials && (
                  <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.main>
    </div>
  );
};

export default AccountPage;
