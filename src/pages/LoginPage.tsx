import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { login, listBanks } from "@/lib/secullum-api";
import { useSecullum } from "@/contexts/SecullumContext";
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
  const { setAuth } = useSecullum();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }
  }, []);

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
      toast({ title: "Autenticado com sucesso!", description: "Selecione um banco para continuar." });
    } catch (err: any) {
      toast({ title: "Erro na autenticação", description: err.message, variant: "destructive" });
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
            Controle de Pontualidade
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Relatório de atrasos · Secullum Ponto Web
          </p>
        </div>

        {!token ? (
          <Card className="shadow-[var(--shadow-elevated)]">
            <CardHeader className="pb-4 pt-6">
              <p className="text-sm font-medium text-muted-foreground">
                Entre com suas credenciais do Secullum
              </p>
            </CardHeader>
            <CardContent>
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
                <Button type="submit" className="w-full" disabled={loading}>
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
