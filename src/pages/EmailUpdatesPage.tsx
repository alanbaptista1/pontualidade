import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, X, Link2, Copy, Mail, RefreshCw, Power } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSecullum } from "@/contexts/SecullumContext";
import { supabase } from "@/integrations/supabase/client";
import { listBanks } from "@/lib/secullum-api";
import type { SecullumBank } from "@/types/secullum";

interface EmailRequest {
  id: string;
  numero_folha: string;
  employee_name: string;
  current_email: string | null;
  requested_email: string;
  bank_name: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

interface LinkSettings {
  bank_id: string;
  bank_name: string;
  is_enabled: boolean;
}

const EmailUpdatesPage = () => {
  const { user } = useAuth();
  const { auth } = useSecullum();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<EmailRequest[]>([]);
  const [settings, setSettings] = useState<LinkSettings | null>(null);
  const [banks, setBanks] = useState<SecullumBank[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [draftBankId, setDraftBankId] = useState<string>("");
  const [draftEnabled, setDraftEnabled] = useState(true);

  const publicUrl = user ? `${window.location.origin}/publico/atualizar-email/${user.id}` : "";

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [reqRes, setRes] = await Promise.all([
      supabase
        .from("email_update_requests")
        .select("id, numero_folha, employee_name, current_email, requested_email, bank_name, status, rejection_reason, created_at, processed_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("public_link_settings")
        .select("bank_id, bank_name, is_enabled")
        .maybeSingle(),
    ]);

    if (reqRes.data) setRequests(reqRes.data as EmailRequest[]);
    if (setRes.data) {
      setSettings(setRes.data);
      setDraftBankId(setRes.data.bank_id);
      setDraftEnabled(setRes.data.is_enabled);
    }

    // Carrega bancos se temos sessão Secullum
    if (auth?.token) {
      try {
        const list = await listBanks(auth.token);
        setBanks(list);
        if (!setRes.data && list[0]) {
          setDraftBankId(String(list[0].id));
        }
      } catch (e) {
        console.warn("Falha ao listar bancos:", e);
      }
    }

    setLoading(false);
  }, [user, auth]);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async () => {
    if (!user || !draftBankId) {
      toast({ title: "Selecione um banco", variant: "destructive" });
      return;
    }
    const bank = banks.find((b) => String(b.id) === draftBankId);
    if (!bank) {
      toast({ title: "Banco inválido", variant: "destructive" });
      return;
    }
    setSavingSettings(true);
    const { error } = await supabase
      .from("public_link_settings")
      .upsert(
        {
          user_id: user.id,
          bank_id: draftBankId,
          bank_name: bank.nome,
          is_enabled: draftEnabled,
        },
        { onConflict: "user_id" }
      );
    setSavingSettings(false);
    if (error) {
      toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Configuração salva" });
    await load();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copiado" });
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const { data, error } = await supabase.functions.invoke("approve-email-update", {
      body: { requestId: id, action: "approve" },
    });
    setProcessingId(null);
    if (error || data?.error) {
      toast({
        title: "Falha ao aprovar",
        description: data?.error ?? error?.message ?? "Erro",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "E-mail atualizado na Secullum" });
    await load();
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    const { data, error } = await supabase.functions.invoke("approve-email-update", {
      body: { requestId: id, action: "reject", rejectionReason: rejectReason },
    });
    setProcessingId(null);
    setRejectReason("");
    if (error || data?.error) {
      toast({
        title: "Falha ao rejeitar",
        description: data?.error ?? error?.message ?? "Erro",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Solicitação rejeitada" });
    await load();
  };

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-5xl space-y-6 px-4 py-8"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Atualizações de E-mail</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie solicitações vindas do link público e aprove para enviar à Secullum
          </p>
        </div>

        {/* Configuração do link público */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" /> Link público
            </CardTitle>
            <CardDescription>
              Compartilhe este link para que funcionários solicitem atualização de e-mail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!auth && (
              <Alert>
                <AlertTitle>Conecte ao Secullum primeiro</AlertTitle>
                <AlertDescription>
                  Faça login na tela inicial para selecionar o banco usado pelo link público.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Banco usado no link</Label>
                <Select value={draftBankId} onValueChange={setDraftBankId} disabled={!banks.length}>
                  <SelectTrigger>
                    <SelectValue placeholder={banks.length ? "Selecione" : "Conecte ao Secullum"} />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3">
                  <Power className="h-4 w-4 text-muted-foreground" />
                  <Switch checked={draftEnabled} onCheckedChange={setDraftEnabled} />
                  <span className="text-sm">{draftEnabled ? "Ativo" : "Desativado"}</span>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={savingSettings || !draftBankId} size="sm">
              {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar configuração
            </Button>

            {settings && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL pública</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-xs" />
                  <Button onClick={handleCopyLink} variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Banco: <span className="font-medium">{settings.bank_name}</span> ·{" "}
                  {settings.is_enabled ? "Ativo" : "Desativado"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Solicitações pendentes
                {pending.length > 0 && <Badge>{pending.length}</Badge>}
              </CardTitle>
              <CardDescription>Aprove para aplicar a alteração na Secullum</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : pending.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{r.employee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Folha: {r.numero_folha} · {r.bank_name}
                        </p>
                        <div className="mt-2 grid gap-1 text-sm">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">De:</span>
                            <span>{r.current_email ?? <em className="text-muted-foreground">vazio</em>}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Para:</span>
                            <span className="font-medium text-primary">{r.requested_email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(r.id)}
                          disabled={processingId === r.id}
                        >
                          {processingId === r.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Aprovar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <X className="mr-2 h-4 w-4" /> Rejeitar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rejeitar solicitação</AlertDialogTitle>
                              <AlertDialogDescription>
                                Informe um motivo (opcional)
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Motivo da rejeição..."
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReject(r.id)}>
                                Rejeitar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
            <CardDescription>Solicitações já processadas</CardDescription>
          </CardHeader>
          <CardContent>
            {processed.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nada por aqui ainda</p>
            ) : (
              <div className="space-y-2">
                {processed.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{r.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Folha {r.numero_folha} → {r.requested_email}
                      </p>
                      {r.rejection_reason && (
                        <p className="text-xs text-destructive">Motivo: {r.rejection_reason}</p>
                      )}
                    </div>
                    <Badge variant={r.status === "approved" ? "default" : "destructive"}>
                      {r.status === "approved" ? "Aprovada" : "Rejeitada"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.main>
    </div>
  );
};

export default EmailUpdatesPage;
