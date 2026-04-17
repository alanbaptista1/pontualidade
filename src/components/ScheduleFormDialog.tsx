import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { listBanks, listFuncionarios, login as secullumLogin } from "@/lib/secullum-api";
import {
  PERIOD_TYPE_LABELS,
  type SchedulePeriodType,
  dailyCronAt,
  parseDailyCron,
  isValidCronExpression,
  describeCron,
} from "@/lib/schedule-helpers";

interface BankOption {
  id: string;
  nome: string;
}

export interface WhatsappRecipient {
  name: string;
  phone: string;
}

export interface ScheduleRecord {
  id: string;
  name: string;
  bank_id: string;
  bank_name: string;
  period_type: SchedulePeriodType;
  custom_start_date: string | null;
  custom_end_date: string | null;
  tolerance_minutes: number;
  cron_expression: string;
  is_active: boolean;
  notify_email: boolean;
  notification_email: string | null;
  department_filter: string | null;
  only_late: boolean;
  whatsapp_recipients: WhatsappRecipient[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleRecord | null;
  onSaved: () => void;
}

const formSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome").max(120),
  bank_id: z.string().min(1, "Selecione um banco"),
  bank_name: z.string().min(1),
  period_type: z.enum([
    "last_7_days",
    "last_30_days",
    "yesterday",
    "current_month_until_yesterday",
    "previous_month",
    "last_week",
    "custom_range",
  ]),
  custom_start_date: z.string().nullable(),
  custom_end_date: z.string().nullable(),
  tolerance_minutes: z.number().int().min(0).max(120),
  cron_expression: z.string().min(1),
  is_active: z.boolean(),
  notify_email: z.boolean(),
  notification_email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .or(z.literal(""))
    .nullable(),
  department_filter: z.string().nullable(),
  only_late: z.boolean(),
});

const PERIOD_OPTIONS: SchedulePeriodType[] = [
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_week",
  "current_month_until_yesterday",
  "previous_month",
  "custom_range",
];

export function ScheduleFormDialog({ open, onOpenChange, schedule, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!schedule;

  const [loadingBanks, setLoadingBanks] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cronMode, setCronMode] = useState<"daily" | "advanced">("daily");
  const [dailyTime, setDailyTime] = useState("08:00");
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [secullumToken, setSecullumToken] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    bank_id: "",
    bank_name: "",
    period_type: "yesterday" as SchedulePeriodType,
    custom_start_date: "" as string,
    custom_end_date: "" as string,
    tolerance_minutes: 0,
    cron_expression: dailyCronAt(8, 0),
    is_active: true,
    notify_email: true,
    notification_email: "",
    department_filter: "",
    only_late: false,
  });

  const [whatsappRecipients, setWhatsappRecipients] = useState<WhatsappRecipient[]>([]);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");

  const addRecipient = () => {
    const name = newRecipientName.trim();
    const phone = newRecipientPhone.trim();
    if (!name || !phone) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    if (name.length > 80) {
      toast({ title: "Nome muito longo (máx. 80)", variant: "destructive" });
      return;
    }
    if (phone.length > 30) {
      toast({ title: "Telefone muito longo (máx. 30)", variant: "destructive" });
      return;
    }
    setWhatsappRecipients((prev) => [...prev, { name, phone }]);
    setNewRecipientName("");
    setNewRecipientPhone("");
  };

  const removeRecipient = (idx: number) => {
    setWhatsappRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  // Reset/populate when dialog opens
  useEffect(() => {
    if (!open) return;
    if (schedule) {
      setForm({
        name: schedule.name,
        bank_id: schedule.bank_id,
        bank_name: schedule.bank_name,
        period_type: schedule.period_type,
        custom_start_date: schedule.custom_start_date ?? "",
        custom_end_date: schedule.custom_end_date ?? "",
        tolerance_minutes: schedule.tolerance_minutes,
        cron_expression: schedule.cron_expression,
        is_active: schedule.is_active,
        notify_email: schedule.notify_email,
        notification_email: schedule.notification_email ?? "",
        department_filter: schedule.department_filter ?? "",
        only_late: schedule.only_late ?? false,
      });
      setWhatsappRecipients(
        Array.isArray(schedule.whatsapp_recipients) ? schedule.whatsapp_recipients : [],
      );
      const parsed = parseDailyCron(schedule.cron_expression);
      if (parsed) {
        setCronMode("daily");
        setDailyTime(`${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`);
      } else {
        setCronMode("advanced");
      }
    } else {
      setForm({
        name: "",
        bank_id: "",
        bank_name: "",
        period_type: "yesterday",
        custom_start_date: "",
        custom_end_date: "",
        tolerance_minutes: 0,
        cron_expression: dailyCronAt(8, 0),
        is_active: true,
        notify_email: true,
        notification_email: "",
        department_filter: "",
        only_late: false,
      });
      setWhatsappRecipients([]);
      setCronMode("daily");
      setDailyTime("08:00");
    }
    setNewRecipientName("");
    setNewRecipientPhone("");
    setDepartments([]);
  }, [open, schedule]);

  // Sync daily picker -> cron expression
  useEffect(() => {
    if (cronMode !== "daily") return;
    const [hh, mm] = dailyTime.split(":").map(Number);
    if (Number.isInteger(hh) && Number.isInteger(mm)) {
      setForm((prev) => ({ ...prev, cron_expression: dailyCronAt(hh, mm) }));
    }
  }, [cronMode, dailyTime]);

  // Load banks (using saved Secullum credentials)
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingBanks(true);
      setBanksError(null);
      try {
        const { data: creds, error } = await supabase
          .from("secullum_credentials")
          .select("secullum_username, secullum_password, client_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!creds) {
          setBanksError("Cadastre suas credenciais Secullum em 'Conta' antes de criar agendamentos.");
          return;
        }
        const token = await secullumLogin(creds.secullum_username, creds.secullum_password);
        const list = await listBanks(token);
        if (cancelled) return;
        setSecullumToken(token);
        setBanks(list.map((b) => ({ id: String(b.id), nome: b.nome })));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erro ao carregar bancos.";
        setBanksError(message);
      } finally {
        if (!cancelled) setLoadingBanks(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // Load departments for the selected bank (used by department filter)
  useEffect(() => {
    if (!open || !secullumToken || !form.bank_id) {
      setDepartments([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingDepts(true);
      try {
        const funcs = await listFuncionarios(secullumToken, Number(form.bank_id));
        if (cancelled) return;
        const set = new Set<string>();
        for (const f of funcs) {
          if (!f.Demissao && !f.Invisivel && f.Departamento?.Descricao) {
            set.add(f.Departamento.Descricao);
          }
        }
        setDepartments(Array.from(set).sort((a, b) => a.localeCompare(b)));
      } catch {
        if (!cancelled) setDepartments([]);
      } finally {
        if (!cancelled) setLoadingDepts(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, secullumToken, form.bank_id]);

  const cronDescription = useMemo(() => {
    if (!isValidCronExpression(form.cron_expression)) return "Expressão cron inválida";
    return describeCron(form.cron_expression);
  }, [form.cron_expression]);

  const handleBankChange = (id: string) => {
    const bank = banks.find((b) => b.id === id);
    setForm((prev) => ({ ...prev, bank_id: id, bank_name: bank?.nome ?? "", department_filter: "" }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    const parsed = formSchema.safeParse({
      ...form,
      custom_start_date: form.custom_start_date || null,
      custom_end_date: form.custom_end_date || null,
      notification_email: form.notification_email.trim() || null,
      department_filter: form.department_filter || null,
    });
    if (!parsed.success) {
      toast({
        title: "Verifique os campos",
        description: parsed.error.issues[0]?.message ?? "Dados inválidos",
        variant: "destructive",
      });
      return;
    }

    if (parsed.data.period_type === "custom_range" && (!parsed.data.custom_start_date || !parsed.data.custom_end_date)) {
      toast({ title: "Período inválido", description: "Informe data inicial e final.", variant: "destructive" });
      return;
    }

    if (!isValidCronExpression(parsed.data.cron_expression)) {
      toast({ title: "Cron inválido", description: "Use o formato: minuto hora dia mês dia-da-semana", variant: "destructive" });
      return;
    }

    const notificationEmail =
      parsed.data.notification_email && parsed.data.notification_email !== ""
        ? parsed.data.notification_email
        : null;

    setSaving(true);
    try {
      const commonFields = {
        name: parsed.data.name,
        bank_id: parsed.data.bank_id,
        bank_name: parsed.data.bank_name,
        period_type: parsed.data.period_type,
        custom_start_date: parsed.data.custom_start_date,
        custom_end_date: parsed.data.custom_end_date,
        tolerance_minutes: parsed.data.tolerance_minutes,
        cron_expression: parsed.data.cron_expression,
        is_active: parsed.data.is_active,
        notify_email: parsed.data.notify_email,
        notification_email: notificationEmail,
        department_filter: parsed.data.department_filter,
        only_late: parsed.data.only_late,
        whatsapp_recipients: whatsappRecipients as unknown as never,
      };

      if (isEditing && schedule) {
        const { error } = await supabase
          .from("report_schedules")
          .update(commonFields)
          .eq("id", schedule.id);
        if (error) throw error;
        toast({ title: "Agendamento atualizado" });
      } else {
        const { error } = await supabase.from("report_schedules").insert({
          user_id: user.id,
          ...commonFields,
        });
        if (error) throw error;
        toast({ title: "Agendamento criado" });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar.";
      toast({ title: "Falha ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            Configure quando e como o relatório de pontualidade será gerado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {banksError && (
          <Alert variant="destructive">
            <AlertDescription>{banksError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sch-name">Nome do agendamento</Label>
            <Input
              id="sch-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Relatório diário Filial 1"
            />
          </div>

          <div className="space-y-2">
            <Label>Banco</Label>
            <Select value={form.bank_id} onValueChange={handleBankChange} disabled={loadingBanks || banks.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={loadingBanks ? "Carregando..." : "Selecione um banco"} />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Período do relatório</Label>
              <Select
                value={form.period_type}
                onValueChange={(v) => setForm((p) => ({ ...p, period_type: v as SchedulePeriodType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {PERIOD_TYPE_LABELS[opt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sch-tol">Tolerância (minutos)</Label>
              <Input
                id="sch-tol"
                type="number"
                min={0}
                max={120}
                value={form.tolerance_minutes}
                onChange={(e) => setForm((p) => ({ ...p, tolerance_minutes: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {form.period_type === "custom_range" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sch-start">Data inicial</Label>
                <Input
                  id="sch-start"
                  type="date"
                  value={form.custom_start_date}
                  onChange={(e) => setForm((p) => ({ ...p, custom_start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sch-end">Data final</Label>
                <Input
                  id="sch-end"
                  type="date"
                  value={form.custom_end_date}
                  onChange={(e) => setForm((p) => ({ ...p, custom_end_date: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Filtros do relatório */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Filtros do relatório</Label>
              <p className="text-xs text-muted-foreground">
                Restringe quais registros entram no PDF. Os mesmos filtros disponíveis na tela de Relatório.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-dept" className="text-sm">Departamento</Label>
              <Select
                value={form.department_filter || "__all__"}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, department_filter: v === "__all__" ? "" : v }))
                }
                disabled={!form.bank_id || loadingDepts}
              >
                <SelectTrigger id="sch-dept">
                  <SelectValue
                    placeholder={
                      !form.bank_id
                        ? "Selecione um banco primeiro"
                        : loadingDepts
                          ? "Carregando departamentos..."
                          : "Todos"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os departamentos</SelectItem>
                  {/* Mantém o valor atual mesmo se o banco ainda não retornou (ex: edição) */}
                  {form.department_filter &&
                    !departments.includes(form.department_filter) && (
                      <SelectItem value={form.department_filter}>
                        {form.department_filter}
                      </SelectItem>
                    )}
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sch-only-late" className="text-sm">Somente atrasados</Label>
                <p className="text-xs text-muted-foreground">
                  Inclui apenas quem atrasou acima da tolerância configurada.
                </p>
              </div>
              <Switch
                id="sch-only-late"
                checked={form.only_late}
                onCheckedChange={(c) => setForm((p) => ({ ...p, only_late: c }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequência</Label>
            <Tabs value={cronMode} onValueChange={(v) => setCronMode(v as "daily" | "advanced")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="daily">Diário</TabsTrigger>
                <TabsTrigger value="advanced">Cron avançado</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="space-y-2 pt-3">
                <Label htmlFor="sch-time">Horário</Label>
                <Input
                  id="sch-time"
                  type="time"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="advanced" className="space-y-2 pt-3">
                <Label htmlFor="sch-cron">Expressão cron (5 campos)</Label>
                <Input
                  id="sch-cron"
                  value={form.cron_expression}
                  onChange={(e) => setForm((p) => ({ ...p, cron_expression: e.target.value }))}
                  placeholder="0 8 * * 1-5"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: minuto hora dia-do-mês mês dia-da-semana. Ex: <code>0 8 * * 1-5</code> = 08h em dias úteis.
                </p>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">{cronDescription}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sch-active" className="text-sm">Ativo</Label>
                <p className="text-xs text-muted-foreground">Desative para pausar a execução automática.</p>
              </div>
              <Switch
                id="sch-active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm((p) => ({ ...p, is_active: c }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sch-notify" className="text-sm">Notificar por e-mail</Label>
                <p className="text-xs text-muted-foreground">Receba um link para baixar o PDF assim que ficar pronto.</p>
              </div>
              <Switch
                id="sch-notify"
                checked={form.notify_email}
                onCheckedChange={(c) => setForm((p) => ({ ...p, notify_email: c }))}
              />
            </div>
            {form.notify_email && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="sch-notif-email" className="text-sm">E-mail de notificação (opcional)</Label>
                <Input
                  id="sch-notif-email"
                  type="email"
                  placeholder="Em branco = e-mail da conta"
                  value={form.notification_email}
                  onChange={(e) => setForm((p) => ({ ...p, notification_email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Sem domínio verificado no Resend, e-mails só chegam no endereço da sua conta. Para enviar para outros e-mails, verifique um domínio em resend.com.
                </p>
              </div>
            )}
          </div>

          {/* Destinatários WhatsApp */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Destinatários do WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                Pessoas que receberão o relatório via WhatsApp. Adicione quantas quiser.
              </p>
            </div>

            {whatsappRecipients.length > 0 && (
              <div className="space-y-2">
                {whatsappRecipients.map((r, idx) => (
                  <div
                    key={`${r.phone}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.phone}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipient(idx)}
                      aria-label="Remover destinatário"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="wa-name" className="text-xs">Nome da pessoa</Label>
                <Input
                  id="wa-name"
                  value={newRecipientName}
                  maxLength={80}
                  placeholder="Ex: João Silva"
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wa-phone" className="text-xs">WhatsApp</Label>
                <Input
                  id="wa-phone"
                  value={newRecipientPhone}
                  maxLength={30}
                  placeholder="Ex: +55 11 99999-9999"
                  onChange={(e) => setNewRecipientPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={addRecipient} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !!banksError}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar alterações" : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
