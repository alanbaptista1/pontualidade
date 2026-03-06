import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  LogOut,
  Download,
  Filter,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  CalendarDays,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSecullum } from "@/contexts/SecullumContext";
import { listFuncionarios, listBatidas, getHorario } from "@/lib/secullum-api";
import type {
  SecullumFuncionario,
  SecullumBatida,
  SecullumHorario,
  LatenessRecord,
  SecullumDepartamento,
} from "@/types/secullum";
import LatenessTable from "@/components/LatenessTable";
import { generatePDF } from "@/lib/pdf-generator";
import AppHeader from "@/components/AppHeader";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function getDiaSemanaIndex(dateStr: string): number {
  const date = parseISO(dateStr);
  const jsDay = date.getDay(); // 0=sunday
  // Secullum: 0=monday ... 6=sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}

function timeToMinutes(time: string | null): number {
  if (!time) return -1;
  const parts = time.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatHorarioCompleto(dia: any): string {
  const parts: string[] = [];
  if (dia.Entrada1 && dia.Saida1) parts.push(`${dia.Entrada1} - ${dia.Saida1}`);
  if (dia.Entrada2 && dia.Saida2) parts.push(`${dia.Entrada2} - ${dia.Saida2}`);
  if (dia.Entrada3 && dia.Saida3) parts.push(`${dia.Entrada3} - ${dia.Saida3}`);
  return parts.join(" | ");
}

const ReportPage = () => {
  const { auth, logout } = useSecullum();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LatenessRecord[]>([]);
  const [departments, setDepartments] = useState<SecullumDepartamento[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [showOnlyLate, setShowOnlyLate] = useState(false);
  const [tolerance, setTolerance] = useState<string>("0");
  const [hasSearched, setHasSearched] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  const handleSearch = useCallback(async () => {
    if (!auth) return;
    if (!dataInicio || !dataFim) {
      toast({ title: "Preencha as datas", variant: "destructive" });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // 1. List employees
      const funcionarios: SecullumFuncionario[] = await listFuncionarios(auth.token, auth.bankId);
      const activeFuncs = funcionarios.filter((f) => !f.Demissao && !f.Invisivel);

      // Extract unique departments
      const deptMap = new Map<number, SecullumDepartamento>();
      activeFuncs.forEach((f) => {
        if (f.Departamento) {
          deptMap.set(f.Departamento.Id, f.Departamento);
        }
      });
      setDepartments(Array.from(deptMap.values()));

      // 2. Fetch horarios (unique)
      const horarioIds = [...new Set(activeFuncs.map((f) => f.Horario?.Numero).filter(Boolean))];
      const horarioMap = new Map<number, SecullumHorario>();

      // Fetch in batches
      const horarioPromises = horarioIds.map(async (num) => {
        const result = await getHorario(auth.token, auth.bankId, num);
        if (Array.isArray(result) && result.length > 0) {
          horarioMap.set(result[0].Numero, result[0]);
        }
      });
      await Promise.all(horarioPromises);

      // 3. Fetch batidas for all employees
      const allBatidas: SecullumBatida[] = await listBatidas(
        auth.token,
        auth.bankId,
        dataInicio,
        dataFim
      );

      // 4. Build lateness records
      const latenessRecords: LatenessRecord[] = [];

      for (const func of activeFuncs) {
        const horario = horarioMap.get(func.Horario?.Numero);
        if (!horario?.Dias) continue;

        const funcBatidas = allBatidas.filter((b) => b.FuncionarioId === func.Id);

        for (const batida of funcBatidas) {
          const diaSemanaIdx = getDiaSemanaIndex(batida.Data);
          const horarioDia = horario.Dias.find((d) => d.DiaSemana === diaSemanaIdx);
          if (!horarioDia || !horarioDia.Entrada1) continue;

          const entrada1Real = batida.Entrada1;
          if (!entrada1Real) continue; // no clock-in

          const esperadoMin = timeToMinutes(horarioDia.Entrada1);
          const realMin = timeToMinutes(entrada1Real);

          const atraso = realMin - esperadoMin;
          const atrasado = atraso > 0;

          latenessRecords.push({
            funcionarioId: func.Id,
            nome: func.Nome,
            departamento: func.Departamento?.Descricao || "N/A",
            data: batida.Data,
            diaSemana: DIAS_SEMANA[diaSemanaIdx] || "N/A",
            horarioEsperado: horarioDia.Entrada1,
            horarioReal: entrada1Real,
            atrasado,
            minutosAtraso: atrasado ? atraso : 0,
            horarioCompleto: formatHorarioCompleto(horarioDia),
          });
        }
      }

      setRecords(latenessRecords);
      toast({
        title: "Relatório gerado",
        description: `${latenessRecords.length} registros encontrados.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao gerar relatório", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [auth, dataInicio, dataFim, toast]);

  if (!auth) {
    navigate("/");
    return null;
  }

  const filteredRecords = records.filter((r) => {
    if (selectedDept !== "all" && r.departamento !== selectedDept) return false;
    if (showOnlyLate && !r.atrasado) return false;
    if (showOnlyLate && r.minutosAtraso <= parseInt(tolerance || "0")) return false;
    return true;
  });

  const stats = {
    total: filteredRecords.length,
    atrasados: filteredRecords.filter((r) => r.atrasado).length,
    pontual: filteredRecords.filter((r) => !r.atrasado).length,
  };

  const handleExportPDF = () => {
    if (filteredRecords.length === 0) return;
    generatePDF(filteredRecords, {
      dataInicio,
      dataFim,
      departamento: selectedDept === "all" ? "Todos" : selectedDept,
      tolerancia: parseInt(tolerance || "0"),
      somenteAtrasados: showOnlyLate,
      bankName: auth.bankName,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Controle de Pontualidade</h1>
              <p className="text-xs text-muted-foreground">{auth.bankName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {/* Search Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Período de Consulta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-2">
                  <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Gerar Relatório
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters + Stats */}
        {hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="shadow-[var(--shadow-card)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total de registros</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-[var(--shadow-card)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-late/10">
                    <AlertTriangle className="h-5 w-5 text-late" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-late">{stats.atrasados}</p>
                    <p className="text-xs text-muted-foreground">Atrasados</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-[var(--shadow-card)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-on-time/10">
                    <CheckCircle2 className="h-5 w-5 text-on-time" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-on-time">{stats.pontual}</p>
                    <p className="text-xs text-muted-foreground">Pontuais</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Row */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="flex flex-wrap items-end gap-4 p-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Filtros:</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Departamento</Label>
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.Id} value={d.Descricao}>
                          {d.Descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={showOnlyLate} onCheckedChange={setShowOnlyLate} />
                  <Label className="text-sm">Somente atrasados</Label>
                </div>

                {showOnlyLate && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    className="space-y-1"
                  >
                    <Label className="text-xs">Tolerância (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={tolerance}
                      onChange={(e) => setTolerance(e.target.value)}
                      placeholder="0"
                    />
                  </motion.div>
                )}

                <div className="ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    disabled={filteredRecords.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <LatenessTable records={filteredRecords} />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default ReportPage;
