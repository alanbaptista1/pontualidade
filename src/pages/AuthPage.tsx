import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, LogIn, Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import authHero from "@/assets/auth-hero.jpg";
import dubrasilLogo from "@/assets/dubrasil-logo.png";

const REMEMBERED_EMAIL_KEY = "pontualidade:remembered-email";

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(80),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
});

const AuthPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [signUp, setSignUp] = useState({ displayName: "", email: "", password: "" });
  const [rememberEmail, setRememberEmail] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setSignIn((p) => ({ ...p, email: saved }));
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse(signIn);
    if (!parsed.success) {
      toast({ title: "Dados inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase().includes("invalid")
        ? "E-mail ou senha incorretos."
        : error.message;
      toast({ title: "Falha no login", description: msg, variant: "destructive" });
      return;
    }
    if (rememberEmail) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, parsed.data.email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(signUp);
    if (!parsed.success) {
      toast({ title: "Dados inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: parsed.data.displayName },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase().includes("already")
        ? "E-mail já cadastrado. Faça login."
        : error.message;
      toast({ title: "Falha no cadastro", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Conta criada!", description: "Você já está logado." });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left side - Hero */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
        <img
          src={authHero}
          alt="Controle de pontualidade"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/60 to-background/85" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center"
          >
            <img
              src={dubrasilLogo}
              alt="Grupo DuBrasil Soluções"
              className="h-12 w-auto xl:h-14"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-xl space-y-6"
          >
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground xl:text-5xl">
              Controle a pontualidade da sua equipe com clareza.
            </h1>
            <p className="text-lg text-muted-foreground xl:text-xl">
              Relatórios precisos, agendamentos automáticos e visão completa dos atrasos —
              tudo em um único lugar.
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm text-muted-foreground/80"
          >
            © {new Date().getFullYear()} Pontualidade DuBrasil Soluções. Todos os direitos reservados.
          </motion.p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex w-full flex-col items-center justify-center p-6 sm:p-10 lg:w-1/2 xl:w-[45%]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center lg:hidden">
            <img
              src={dubrasilLogo}
              alt="Grupo DuBrasil Soluções"
              className="h-12 w-auto"
            />
          </div>

          <div className="mb-8 space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Entre com seu e-mail e senha para acessar."
                : "Preencha os dados abaixo para começar."}
            </p>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signin-email">E-mail</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="h-11 rounded-lg"
                  value={signIn.email}
                  onChange={(e) => setSignIn((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 rounded-lg"
                  value={signIn.password}
                  onChange={(e) => setSignIn((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-email"
                  checked={rememberEmail}
                  onCheckedChange={(c) => setRememberEmail(c === true)}
                />
                <Label
                  htmlFor="remember-email"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  Salvar meu e-mail
                </Label>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-lg text-base font-semibold shadow-[var(--shadow-elevated)]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Entrar
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Criar conta
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  className="h-11 rounded-lg"
                  value={signUp.displayName}
                  onChange={(e) => setSignUp((p) => ({ ...p, displayName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="h-11 rounded-lg"
                  value={signUp.email}
                  onChange={(e) => setSignUp((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className="h-11 rounded-lg"
                  value={signUp.password}
                  onChange={(e) => setSignUp((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-lg text-base font-semibold shadow-[var(--shadow-elevated)]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Criar conta
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Entrar
                </button>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
