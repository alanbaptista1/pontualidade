import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, LogIn, Loader2, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { login, listBanks } from "@/lib/secullum-api";
import { useSecullum } from "@/contexts/SecullumContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SecullumBank } from "@/types/secullum";
import BankSelector from "@/components/BankSelector";

const SAVED_EMAIL_KEY = "secullum_saved_email";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [banks, setBanks] = useState<SecullumBank[]>([]);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const { setAuth } = useSecullum();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
      if (user) {
        const { data } = await supabase
          .from("secullum_credentials")
          .select("secullum_username")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) {
          setEmail(data.secullum_username);
          setHasSavedCreds(true);
        }
      }
    };
    init();
  }, [user]);

  const handleQuickLogin = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("secullum_credentials")
        .select("secullum_username, secullum_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) throw new Error("Credenciais não encontradas. Cadastre em Conta.");
      const accessToken = await login(data.secullum_username, data.secullum_password);
      setToken(accessToken);
      const bankList = await listBanks(accessToken);
      setBanks(bankList);
      toast({ title: "Autenticado!", description: "Selecione um banco." });
    } catch (err: any) {
      toast({ title: "Falha no login rápido", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (rememberEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    try {
      const accessToken = await login(email, password);
      setToken(accessToken);
      const bankList = await listBanks(accessToken);
      setBanks(bankList);

      // Auto-save credentials on first successful login
      if (user && !hasSavedCreds) {
        const { error: saveError } = await supabase
          .from("secullum_credentials")
          .upsert(
            {
              user_id: user.id,
              secullum_username: email,
              secullum_password: password,
              client_id: "7",
            },
            { onConflict: "user_id" },
          );
        if (!saveError) {
          setHasSavedCreds(true);
          toast({
            title: "Credenciais salvas",
            description: "Suas credenciais Secullum ficam disponíveis em Conta para próximos acessos.",
          });
        }
      } else {
        toast({ title: "Autenticado com sucesso!", description: "Selecione um banco para continuar." });
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      const isUnauthorized = msg.includes("401") || msg.includes("unauthorized") || msg.includes("não autorizado") || msg.includes("invalid") || msg.includes("incorreto") || msg.includes("senha") || msg.includes("email");
      const userMessage = isUnauthorized
        ? "Login ou senha inválidos. Verifique suas credenciais e tente novamente."
        : err.message || "Erro ao conectar com o servidor. Tente novamente.";
      toast({ title: "Falha no login", description: userMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBankSelect = (bank: SecullumBank) => {
    if (!token) return;
    setAuth({ token, bankId: bank.id, bankName: bank.nome });
    navigate("/relatorio");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Digite aqui suas credenciais Secullum
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma vez digitado ficará salvo no seu login
          </p>
        </div>

        {!token ? (
          <Card className="shadow-[var(--shadow-elevated)]">
            <CardHeader className="pb-4 pt-6">
              <p className="text-sm font-medium text-muted-foreground">
                Entre com suas credenciais do Secullum
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasSavedCreds && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <Button
                    type="button"
                    onClick={handleQuickLogin}
                    className="w-full"
                    disabled={loading}
                    variant="default"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Entrar com credencial salva
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    ou entre manualmente abaixo
                  </p>
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberEmail}
                    onCheckedChange={(checked) => setRememberEmail(checked === true)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Lembrar meu e-mail
                  </Label>
                </div>
                <Button type="submit" className="w-full" variant={hasSavedCreds ? "outline" : "default"} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <BankSelector banks={banks} onSelect={handleBankSelect} />
        )}
      </motion.div>
    </div>
  );
};

export default LoginPage;
