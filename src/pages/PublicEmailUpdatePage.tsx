import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Search, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-employee-lookup`;

interface EmployeeFound {
  name: string;
  numeroFolha: string;
  currentEmail: string | null;
}

const PublicEmailUpdatePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();

  const [numeroFolha, setNumeroFolha] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employee, setEmployee] = useState<EmployeeFound | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callFn = async (action: "lookup" | "submit", body: Record<string, unknown>) => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ownerUserId: userId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha na requisição");
    return data;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroFolha.trim()) return;
    setSearching(true);
    setError(null);
    setEmployee(null);
    try {
      const data = await callFn("lookup", { numeroFolha: numeroFolha.trim() });
      setEmployee(data);
      setNewEmail("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !newEmail.trim()) return;
    setSubmitting(true);
    try {
      await callFn("submit", {
        numeroFolha: employee.numeroFolha,
        requestedEmail: newEmail.trim(),
      });
      setSubmitted(true);
      toast({ title: "Solicitação enviada", description: "Aguarde a aprovação do RH." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Falha ao enviar", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setNumeroFolha("");
    setEmployee(null);
    setNewEmail("");
    setSubmitted(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Atualização de E-mail
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Solicite a atualização do seu e-mail cadastrado
            </p>
          </div>

          {submitted ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Solicitação enviada!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O RH vai revisar e atualizar seu cadastro em breve.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  Nova solicitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {employee ? "Confirme seus dados" : "Buscar funcionário"}
                </CardTitle>
                <CardDescription>
                  {employee
                    ? "Verifique se o nome está correto e informe o novo e-mail."
                    : "Digite seu código (Número da Folha) para começar."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!employee ? (
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="folha">Código (Número da Folha)</Label>
                      <Input
                        id="folha"
                        value={numeroFolha}
                        onChange={(e) => setNumeroFolha(e.target.value)}
                        placeholder="Ex: 1234"
                        autoFocus
                        required
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Não encontrado</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full" disabled={searching}>
                      {searching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Buscar
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Funcionário
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-foreground">
                        {employee.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Código: {employee.numeroFolha}
                      </p>
                      {employee.currentEmail && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          E-mail atual: {employee.currentEmail}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newEmail">Novo e-mail</Label>
                      <Input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        autoFocus
                      />
                    </div>
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        A solicitação passará por aprovação do RH antes de ser aplicada.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleReset} className="flex-1">
                        Voltar
                      </Button>
                      <Button type="submit" className="flex-1" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar solicitação
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PublicEmailUpdatePage;
