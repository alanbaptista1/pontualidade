import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  TrendingUp,
  RepeatIcon,
  Download,
  CalendarDays,
  Search,
  Loader2,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useSecullum } from "@/contexts/SecullumContext";
import { listFuncionarios, listBatidas, getHorario } from "@/lib/secullum-api";
import type {
  SecullumFuncionario,
  SecullumBatida,
  SecullumHorario,
  LatenessRecord,
} from "@/types/secullum";
import {
  generateSectorRankingPDF,
  generateEmployeeRankingPDF,
  generateWeekdayTrendPDF,
  generateRecurrencePDF,
} from "@/lib/pdf-generator";
import AppHeader from "@/components/AppHeader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function getDiaSemanaIndex(dateStr: string): number {
  const date = parseISO(dateStr);
  const jsDay = date.getDay();
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

interface SectorRanking {
  departamento: string;
  totalRegistros: number;
  totalAtrasos: number;
  percentualAtraso: number;
  mediaMinutosAtraso: number;
}

interface EmployeeRanking {
  nome: string;
  departamento: string;
  totalRegistros: number;
  totalAtrasos: number;
  percentualAtraso: number;
  mediaMinutosAtraso: number;
  totalMinutosAtraso: number;
}

interface WeekdayTrend {
  dia: string;
  totalRegistros: number;
  totalAtrasos: number;
  percentualAtraso: number;
  mediaMinutosAtraso: number;
}

const BAR_COLORS = [
  "hsl(0, 72%, 51%)",
  "hsl(15, 72%, 51%)",
  "hsl(30, 72%, 51%)",
  "hsl(38, 92%, 50%)",
  "hsl(50, 80%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(220, 70%, 50%)",
];

const AnalyticsPage = () => {
  const { auth, reportData, setReportData } = useSecullum();
  const { toast } = useToast();

  const { records, dataInicio, dataFim, hasSearched } = reportData;

  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!auth) return;
    if (!dataInicio || !dataFim) {
      toast({ title: "Preencha as datas", variant: "destructive" });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const funcionarios: SecullumFuncionario[] = await listFuncionarios(auth.token, auth.bankId);
      const activeFuncs = funcionarios.filter((f) => !f.Demissao && !f.Invisivel);

      const horarioIds = [...new Set(activeFuncs.map((f) => f.Horario?.Numero).filter(Boolean))];
      const horarioMap = new Map<number, SecullumHorario>();

      const horarioPromises = horarioIds.map(async (num) => {
        const result = await getHorario(auth.token, auth.bankId, num);
        if (Array.isArray(result) && result.length > 0) {
          horarioMap.set(result[0].Numero, result[0]);
        }
      });
      await Promise.all(horarioPromises);

      const allBatidas: SecullumBatida[] = await listBatidas(auth.token, auth.bankId, dataInicio, dataFim);

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
          if (!entrada1Real) continue;

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
      toast({ title: "Dados carregados", description: `${latenessRecords.length} registros analisados.` });
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Computed analytics
  const sectorRanking = useMemo((): SectorRanking[] => {
    const map = new Map<string, { total: number; atrasos: number; minutos: number }>();
    records.forEach((r) => {
      const curr = map.get(r.departamento) || { total: 0, atrasos: 0, minutos: 0 };
      curr.total++;
      if (r.atrasado) {
        curr.atrasos++;
        curr.minutos += r.minutosAtraso;
      }
      map.set(r.departamento, curr);
    });
    return Array.from(map.entries())
      .map(([dept, v]) => ({
        departamento: dept,
        totalRegistros: v.total,
        totalAtrasos: v.atrasos,
        percentualAtraso: v.total > 0 ? Math.round((v.atrasos / v.total) * 100) : 0,
        mediaMinutosAtraso: v.atrasos > 0 ? Math.round(v.minutos / v.atrasos) : 0,
      }))
      .sort((a, b) => b.percentualAtraso - a.percentualAtraso);
  }, [records]);

  const employeeRanking = useMemo((): EmployeeRanking[] => {
    const map = new Map<number, { nome: string; dept: string; total: number; atrasos: number; minutos: number }>();
    records.forEach((r) => {
      const curr = map.get(r.funcionarioId) || { nome: r.nome, dept: r.departamento, total: 0, atrasos: 0, minutos: 0 };
      curr.total++;
      if (r.atrasado) {
        curr.atrasos++;
        curr.minutos += r.minutosAtraso;
      }
      map.set(r.funcionarioId, curr);
    });
    return Array.from(map.values())
      .map((v) => ({
        nome: v.nome,
        departamento: v.dept,
        totalRegistros: v.total,
        totalAtrasos: v.atrasos,
        percentualAtraso: v.total > 0 ? Math.round((v.atrasos / v.total) * 100) : 0,
        mediaMinutosAtraso: v.atrasos > 0 ? Math.round(v.minutos / v.atrasos) : 0,
        totalMinutosAtraso: v.minutos,
      }))
      .sort((a, b) => b.totalAtrasos - a.totalAtrasos);
  }, [records]);

  const weekdayTrends = useMemo((): WeekdayTrend[] => {
    const map = new Map<string, { total: number; atrasos: number; minutos: number }>();
    DIAS_SEMANA.forEach((d) => map.set(d, { total: 0, atrasos: 0, minutos: 0 }));
    records.forEach((r) => {
      const curr = map.get(r.diaSemana)!;
      curr.total++;
      if (r.atrasado) {
        curr.atrasos++;
        curr.minutos += r.minutosAtraso;
      }
    });
    return DIAS_SEMANA.map((dia) => {
      const v = map.get(dia)!;
      return {
        dia,
        totalRegistros: v.total,
        totalAtrasos: v.atrasos,
        percentualAtraso: v.total > 0 ? Math.round((v.atrasos / v.total) * 100) : 0,
        mediaMinutosAtraso: v.atrasos > 0 ? Math.round(v.minutos / v.atrasos) : 0,
      };
    }).filter((d) => d.totalRegistros > 0);
  }, [records]);

  const recurrenceList = useMemo(() => {
    return employeeRanking
      .filter((e) => e.totalAtrasos >= 2)
      .sort((a, b) => b.totalAtrasos - a.totalAtrasos);
  }, [employeeRanking]);

  const exportCSV = (data: Record<string, any>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(";"),
      ...data.map((row) => headers.map((h) => row[h]).join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!auth) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {/* Period selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-2">
                  <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Carregar Dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {hasSearched && records.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Tabs defaultValue="sector" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sector" className="text-xs sm:text-sm">
                  <Trophy className="mr-1.5 h-3.5 w-3.5 hidden sm:inline" />
                  Por Setor
                </TabsTrigger>
                <TabsTrigger value="employee" className="text-xs sm:text-sm">
                  <Users className="mr-1.5 h-3.5 w-3.5 hidden sm:inline" />
                  Por Colaborador
                </TabsTrigger>
                <TabsTrigger value="trend" className="text-xs sm:text-sm">
                  <TrendingUp className="mr-1.5 h-3.5 w-3.5 hidden sm:inline" />
                  Tendência
                </TabsTrigger>
                <TabsTrigger value="recurrence" className="text-xs sm:text-sm">
                  <RepeatIcon className="mr-1.5 h-3.5 w-3.5 hidden sm:inline" />
                  Recorrência
                </TabsTrigger>
              </TabsList>

              {/* SECTOR RANKING */}
              <TabsContent value="sector" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Ranking por Setor</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportCSV(
                        sectorRanking.map((s) => ({
                          Setor: s.departamento,
                          Registros: s.totalRegistros,
                          Atrasos: s.totalAtrasos,
                          "% Atraso": s.percentualAtraso,
                          "Média (min)": s.mediaMinutosAtraso,
                        })),
                        "ranking-setor"
                      )
                    }
                    disabled={sectorRanking.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>

                {sectorRanking.length > 0 && (
                  <Card className="shadow-[var(--shadow-card)]">
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sectorRanking} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" unit="%" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="departamento" type="category" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(value: number) => [`${value}%`, "Atraso"]}
                          />
                          <Bar dataKey="percentualAtraso" radius={[0, 4, 4, 0]}>
                            {sectorRanking.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? "hsl(0,72%,51%)" : i < 3 ? "hsl(38,92%,50%)" : "hsl(220,70%,50%)"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <Card className="overflow-hidden shadow-[var(--shadow-card)]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-10">#</TableHead>
                          <TableHead className="font-semibold">Setor</TableHead>
                          <TableHead className="font-semibold text-center">Registros</TableHead>
                          <TableHead className="font-semibold text-center">Atrasos</TableHead>
                          <TableHead className="font-semibold text-center">% Atraso</TableHead>
                          <TableHead className="font-semibold text-right">Média (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sectorRanking.map((s, i) => (
                          <TableRow key={s.departamento} className="hover:bg-muted/30">
                            <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium text-foreground">{s.departamento}</TableCell>
                            <TableCell className="text-center">{s.totalRegistros}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-late">{s.totalAtrasos}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={s.percentualAtraso > 50 ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {s.percentualAtraso}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{s.mediaMinutosAtraso} min</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* EMPLOYEE RANKING */}
              <TabsContent value="employee" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Ranking por Colaborador</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportCSV(
                        employeeRanking.map((e) => ({
                          Colaborador: e.nome,
                          Setor: e.departamento,
                          Registros: e.totalRegistros,
                          Atrasos: e.totalAtrasos,
                          "% Atraso": e.percentualAtraso,
                          "Média (min)": e.mediaMinutosAtraso,
                          "Total (min)": e.totalMinutosAtraso,
                        })),
                        "ranking-colaborador"
                      )
                    }
                    disabled={employeeRanking.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>

                <Card className="overflow-hidden shadow-[var(--shadow-card)]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-10">#</TableHead>
                          <TableHead className="font-semibold">Colaborador</TableHead>
                          <TableHead className="font-semibold">Setor</TableHead>
                          <TableHead className="font-semibold text-center">Registros</TableHead>
                          <TableHead className="font-semibold text-center">Atrasos</TableHead>
                          <TableHead className="font-semibold text-center">% Atraso</TableHead>
                          <TableHead className="font-semibold text-right">Média (min)</TableHead>
                          <TableHead className="font-semibold text-right">Total (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeRanking.slice(0, 50).map((e, i) => (
                          <TableRow key={`${e.nome}-${i}`} className="hover:bg-muted/30">
                            <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium text-foreground">{e.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.departamento}</TableCell>
                            <TableCell className="text-center">{e.totalRegistros}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-late">{e.totalAtrasos}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={e.percentualAtraso > 50 ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {e.percentualAtraso}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{e.mediaMinutosAtraso}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-late">
                              {e.totalMinutosAtraso}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* WEEKDAY TREND */}
              <TabsContent value="trend" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Tendência de Atraso por Dia da Semana</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportCSV(
                        weekdayTrends.map((w) => ({
                          Dia: w.dia,
                          Registros: w.totalRegistros,
                          Atrasos: w.totalAtrasos,
                          "% Atraso": w.percentualAtraso,
                          "Média (min)": w.mediaMinutosAtraso,
                        })),
                        "tendencia-dia-semana"
                      )
                    }
                    disabled={weekdayTrends.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>

                <Card className="shadow-[var(--shadow-card)]">
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={weekdayTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                        <YAxis unit="%" tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === "percentualAtraso") return [`${value}%`, "% Atraso"];
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="percentualAtraso" radius={[4, 4, 0, 0]} name="percentualAtraso">
                          {weekdayTrends.map((entry, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden shadow-[var(--shadow-card)]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Dia da Semana</TableHead>
                          <TableHead className="font-semibold text-center">Registros</TableHead>
                          <TableHead className="font-semibold text-center">Atrasos</TableHead>
                          <TableHead className="font-semibold text-center">% Atraso</TableHead>
                          <TableHead className="font-semibold text-right">Média (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weekdayTrends.map((w) => (
                          <TableRow key={w.dia} className="hover:bg-muted/30">
                            <TableCell className="font-medium text-foreground">{w.dia}</TableCell>
                            <TableCell className="text-center">{w.totalRegistros}</TableCell>
                            <TableCell className="text-center font-semibold text-late">{w.totalAtrasos}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={w.percentualAtraso > 40 ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {w.percentualAtraso}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{w.mediaMinutosAtraso} min</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* RECURRENCE */}
              <TabsContent value="recurrence" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Recorrência de Atrasos</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportCSV(
                        recurrenceList.map((e) => ({
                          Colaborador: e.nome,
                          Setor: e.departamento,
                          "Dias com Atraso": e.totalAtrasos,
                          "Total Registros": e.totalRegistros,
                          "% Atraso": e.percentualAtraso,
                          "Média (min)": e.mediaMinutosAtraso,
                          "Total (min)": e.totalMinutosAtraso,
                        })),
                        "recorrencia-atrasos"
                      )
                    }
                    disabled={recurrenceList.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="shadow-[var(--shadow-card)]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-late/10">
                        <RepeatIcon className="h-5 w-5 text-late" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{recurrenceList.length}</p>
                        <p className="text-xs text-muted-foreground">Colaboradores recorrentes</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-[var(--shadow-card)]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                        <TrendingUp className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {recurrenceList.length > 0 ? recurrenceList[0].totalAtrasos : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Maior recorrência (dias)</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-[var(--shadow-card)]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {recurrenceList.length > 0
                            ? Math.round(recurrenceList.reduce((a, b) => a + b.totalMinutosAtraso, 0) / recurrenceList.length)
                            : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Média total (min/pessoa)</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden shadow-[var(--shadow-card)]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-10">#</TableHead>
                          <TableHead className="font-semibold">Colaborador</TableHead>
                          <TableHead className="font-semibold">Setor</TableHead>
                          <TableHead className="font-semibold text-center">Dias com Atraso</TableHead>
                          <TableHead className="font-semibold text-center">Total Registros</TableHead>
                          <TableHead className="font-semibold text-center">% Atraso</TableHead>
                          <TableHead className="font-semibold text-right">Média (min)</TableHead>
                          <TableHead className="font-semibold text-right">Total (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recurrenceList.map((e, i) => (
                          <TableRow key={`${e.nome}-${i}`} className="hover:bg-muted/30">
                            <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium text-foreground">{e.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.departamento}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive" className="text-xs">
                                {e.totalAtrasos}x
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{e.totalRegistros}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={e.percentualAtraso > 50 ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {e.percentualAtraso}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{e.mediaMinutosAtraso}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-late">
                              {e.totalMinutosAtraso}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {hasSearched && records.length === 0 && !loading && (
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado no período selecionado.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AnalyticsPage;
