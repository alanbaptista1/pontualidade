import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScheduleFormDialog, type ScheduleRecord } from "@/components/ScheduleFormDialog";
import ExecutionsHistory from "@/components/ExecutionsHistory";
import { PERIOD_TYPE_LABELS, describeCron } from "@/lib/schedule-helpers";

const SchedulesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("report_schedules")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar agendamentos", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setSchedules((data ?? []) as unknown as ScheduleRecord[]);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (s: ScheduleRecord) => {
    const next = !s.is_active;
    const { error } = await supabase
      .from("report_schedules")
      .update({ is_active: next })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Falha ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("report_schedules").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Falha ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento excluído" });
      setSchedules((prev) => prev.filter((x) => x.id !== deleteId));
    }
    setDeleteId(null);
  };

  const handleRunNow = async (s: ScheduleRecord) => {
    setRunningId(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scheduled-report", {
        body: { schedule_id: s.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Relatório gerado",
        description: `${data?.total_records ?? 0} registros. Veja em "Histórico".`,
      });
    } catch (err: any) {
      toast({
        title: "Falha na execução",
        description: err.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setRunningId(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (s: ScheduleRecord) => {
    setEditing(s);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Agendamentos</h1>
            <p className="text-sm text-muted-foreground">
              Configure relatórios automáticos para serem gerados em horários definidos.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo agendamento
          </Button>
        </div>

        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schedules">Agendamentos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : schedules.length === 0 ? (
              <Card className="shadow-[var(--shadow-elevated)]">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CalendarClock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-foreground">Nenhum agendamento ainda</h3>
                  <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                    Crie seu primeiro agendamento para gerar relatórios automaticamente sem precisar entrar no sistema.
                  </p>
                  <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar agendamento
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {schedules.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="shadow-[var(--shadow-elevated)]">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-base">{s.name}</CardTitle>
                              <Badge variant={s.is_active ? "default" : "secondary"}>
                                {s.is_active ? "Ativo" : "Pausado"}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1">{s.bank_name}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={s.is_active}
                              onCheckedChange={() => handleToggleActive(s)}
                              aria-label="Ativar/pausar"
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Frequência</p>
                            <p className="font-medium text-foreground">{describeCron(s.cron_expression)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Período</p>
                            <p className="font-medium text-foreground">{PERIOD_TYPE_LABELS[s.period_type]}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Tolerância</p>
                            <p className="font-medium text-foreground">{s.tolerance_minutes} min</p>
                          </div>
                        </div>
                        {(s.department_filter || s.only_late) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {s.department_filter && (
                              <Badge variant="outline" className="font-normal">
                                Depto: {s.department_filter}
                              </Badge>
                            )}
                            {s.only_late && (
                              <Badge variant="outline" className="font-normal">
                                Somente atrasados
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleRunNow(s)}
                            disabled={runningId === s.id}
                          >
                            {runningId === s.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-2 h-4 w-4" />
                            )}
                            Executar agora
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <ExecutionsHistory />
          </TabsContent>
        </Tabs>
      </main>

      <ScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento será removido permanentemente, junto com seu histórico de execuções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulesPage;
