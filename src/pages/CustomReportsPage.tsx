import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBarChart, Loader2, Play, AlertTriangle, Download } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useSecullum } from "@/contexts/SecullumContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { listFuncionarios, listFonteDados } from "@/lib/secullum-api";
import { supabase } from "@/integrations/supabase/client";
import type { SecullumFuncionario } from "@/types/secullum";

interface EquipamentoRow {
  equipamento_id: number;
  descricao: string | null;
}

interface FonteDadosRow {
  Id?: number;
  Data?: string;
  Hora?: string;
  EquipamentoId?: number;
  FuncionarioCpf?: string;
}

export default function CustomReportsPage() {
  const { auth } = useSecullum();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [equipamentos, setEquipamentos] = useState<EquipamentoRow[]>([]);
  const [funcionarios, setFuncionarios] = useState<SecullumFuncionario[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [funcionarioCpf, setFuncionarioCpf] = useState<string>("all");
  const [equipamentoFiltro, setEquipamentoFiltro] = useState<string>("all");

  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<FonteDadosRow[] | null>(null);

  useEffect(() => {
    if (!auth) navigate("/");
  }, [auth, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user || !auth) return;
      setLoadingInit(true);
      try {
        const { data: eqs, error } = await supabase
          .from("secullum_equipamentos")
          .select("equipamento_id, descricao")
          .eq("user_id", user.id)
          .eq("bank_id", auth.bankId)
          .order("equipamento_id", { ascending: true });
        if (error) throw new Error(error.message);
        setEquipamentos((eqs ?? []) as EquipamentoRow[]);

        const funcs = await listFuncionarios(auth.token, auth.bankId);
        setFuncionarios(
          funcs
            .filter((f) => f.Cpf)
            .sort((a, b) => (a.Nome ?? "").localeCompare(b.Nome ?? ""))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar dados";
        toast({ title: "Falha ao carregar", description: message, variant: "destructive" });
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, [user, auth, toast]);

  const equipamentoMap = useMemo(() => {
    const m = new Map<number, string>();
    equipamentos.forEach((e) => m.set(e.equipamento_id, e.descricao ?? `#${e.equipamento_id}`));
    return m;
  }, [equipamentos]);

  const funcionarioByCpf = useMemo(() => {
    const m = new Map<string, SecullumFuncionario>();
    funcionarios.forEach((f) => {
      if (f.Cpf) m.set(f.Cpf, f);
    });
    return m;
  }, [funcionarios]);

  const equipamentosFaltando = equipamentos.length === 0;

  const handleExecutar = async () => {
    if (!auth) return;
    if (equipamentosFaltando) {
      toast({
        title: "Sincronize os equipamentos",
        description: "Vá em Equipamentos e clique em Sincronizar antes de rodar o relatório.",
        variant: "destructive",
      });
      return;
    }
    if (!dataInicio || !dataFim) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Data Início e Data Fim.",
        variant: "destructive",
      });
      return;
    }
    if (funcionarioCpf === "all" && equipamentoFiltro === "all") {
      toast({
        title: "Selecione um filtro",
        description: "Informe um funcionário ou um equipamento.",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setResults(null);
    try {
      const equipamentoId =
        equipamentoFiltro !== "all" ? Number(equipamentoFiltro) : undefined;
      const data = await listFonteDados(auth.token, auth.bankId, {
        dataInicio,
        dataFim,
        funcionarioCpf: funcionarioCpf !== "all" ? funcionarioCpf : undefined,
        equipamentoId,
      });
      setResults((data ?? []) as FonteDadosRow[]);
      toast({ title: "Relatório gerado", description: `${data.length} registro(s).` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar";
      toast({ title: "Falha", description: message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const formatData = (d?: string) => {
    if (!d) return "—";
    const [date] = d.split("T");
    if (!date) return d;
    const [y, m, day] = date.split("-");
    return `${day}/${m}/${y}`;
  };

  const handleExportCsv = () => {
    if (!results || results.length === 0) return;
    const header = ["Data", "Hora", "CPF", "Nome", "Departamento", "Equipamento ID", "Equipamento"];
    const lines = [header.join(";")];
    results.forEach((r) => {
      const eqDesc = r.EquipamentoId !== undefined ? equipamentoMap.get(r.EquipamentoId) ?? "" : "";
      const func = r.FuncionarioCpf ? funcionarioByCpf.get(r.FuncionarioCpf) : undefined;
      lines.push(
        [
          formatData(r.Data),
          r.Hora ?? "",
          r.FuncionarioCpf ?? "",
          func?.Nome ?? "",
          func?.Departamento?.Descricao ?? "",
          r.EquipamentoId ?? "",
          eqDesc,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fonte-dados-${dataInicio}-a-${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <FileBarChart className="h-6 w-6 text-primary" />
            Relatórios Personalizados
          </h2>
          <p className="text-sm text-muted-foreground">
            Fonte de Dados — batidas brutas por funcionário e período.
          </p>
        </div>

        {equipamentosFaltando && !loadingInit && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Equipamentos não sincronizados</AlertTitle>
            <AlertDescription>
              É preciso sincronizar os equipamentos antes de rodar este relatório.{" "}
              <Button
                variant="link"
                className="h-auto p-0 underline"
                onClick={() => navigate("/equipamentos")}
              >
                Ir para Equipamentos
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Funcionário (CPF)</Label>
              <Select value={funcionarioCpf} onValueChange={setFuncionarioCpf}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingInit ? "Carregando..." : "Todos"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.Id} value={f.Cpf ?? ""}>
                      {f.Nome} — {f.Cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipamento (opcional)</Label>
              <Select value={equipamentoFiltro} onValueChange={setEquipamentoFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {equipamentos.map((e) => (
                    <SelectItem key={e.equipamento_id} value={String(e.equipamento_id)}>
                      #{e.equipamento_id} — {e.descricao ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <Button onClick={handleExecutar} disabled={executing || equipamentosFaltando}>
                {executing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Gerar relatório
              </Button>
            </div>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{results.length} registro(s)</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={results.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum registro encontrado para os filtros.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Equipamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={r.Id ?? i}>
                        <TableCell>{formatData(r.Data)}</TableCell>
                        <TableCell className="font-medium">{r.Hora ?? "—"}</TableCell>
                        <TableCell>{r.FuncionarioCpf ?? "—"}</TableCell>
                        <TableCell>
                          {r.EquipamentoId !== undefined ? (
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary">{r.EquipamentoId}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {equipamentoMap.get(r.EquipamentoId) ?? "Não cadastrado"}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
