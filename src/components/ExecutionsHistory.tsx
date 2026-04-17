import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EXECUTION_STATUS_LABELS } from "@/lib/schedule-helpers";
import type { ReportExecution } from "@/types/scheduled-reports";

const statusVariant: Record<
  ReportExecution["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  running: "secondary",
  success: "default",
  error: "destructive",
};

const statusIcon: Record<ReportExecution["status"], JSX.Element> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  error: <AlertTriangle className="h-3.5 w-3.5" />,
};

const ExecutionsHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [scheduleNames, setScheduleNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("report_executions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setExecutions((data ?? []) as ReportExecution[]);

    // Pull schedule names for display
    const ids = [...new Set((data ?? []).map((e) => e.schedule_id))];
    if (ids.length > 0) {
      const { data: schedules } = await supabase
        .from("report_schedules")
        .select("id, name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (schedules ?? []).forEach((s) => {
        map[s.id] = s.name;
      });
      setScheduleNames(map);
    }

    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    load();
    // Subscribe to realtime updates so the user sees status change live
    const channel = supabase
      .channel("report_executions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_executions" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const handleDownload = async (exec: ReportExecution) => {
    if (!exec.pdf_path) return;
    setDownloadingId(exec.id);
    try {
      const { data, error } = await supabase.storage
        .from("reports")
        .createSignedUrl(exec.pdf_path, 60 * 5);
      if (error || !data) throw error ?? new Error("Falha ao gerar link");
      // Trigger browser download
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `relatorio-${exec.period_start}-${exec.period_end}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({
        title: "Erro ao baixar PDF",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Histórico de execuções</h2>
          <p className="text-sm text-muted-foreground">
            Últimas 50 execuções automáticas e manuais. PDFs ficam disponíveis por 30 dias.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma execução ainda. Crie um agendamento e clique em "Executar agora" para testar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agendamento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {scheduleNames[e.schedule_id] || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.period_start && e.period_end
                      ? `${format(parseISO(e.period_start), "dd/MM/yyyy")} – ${format(parseISO(e.period_end), "dd/MM/yyyy")}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[e.status]} className="gap-1">
                      {statusIcon[e.status]}
                      {EXECUTION_STATUS_LABELS[e.status]}
                    </Badge>
                    {e.status === "error" && e.error_message && (
                      <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={e.error_message}>
                        {e.error_message}
                      </p>
                    )}
                    {e.retry_count > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tentativa {e.retry_count + 1}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.started_at
                      ? format(parseISO(e.started_at), "dd/MM HH:mm", { locale: ptBR })
                      : format(parseISO(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">{e.total_records ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {e.pdf_path ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(e)}
                        disabled={downloadingId === e.id}
                      >
                        {downloadingId === e.id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-3.5 w-3.5" />
                        )}
                        Baixar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ExecutionsHistory;
