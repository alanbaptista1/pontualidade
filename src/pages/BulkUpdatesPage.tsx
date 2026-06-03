import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, Layers, RefreshCw, Check, AlertCircle, Play } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSecullum } from "@/contexts/SecullumContext";
import { listFuncionarios, upsertFuncionario } from "@/lib/secullum-api";
import type { SecullumFuncionario } from "@/types/secullum";

const DELAY_MS = 1500;

type FieldKind = "estrutura" | "horario" | "centroCustos";

interface OptionItem {
  id: number;
  label: string;
}

interface ExecResult {
  funcionarioId: number;
  nome: string;
  ok: boolean;
  error?: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getEstrutura = (f: SecullumFuncionario): { Id: number; Descricao: string } | null => {
  const e = (f as { Estrutura?: { Id?: number; Descricao?: string } }).Estrutura;
  if (e && typeof e.Id === "number") return { Id: e.Id, Descricao: e.Descricao ?? `#${e.Id}` };
  return null;
};

const getCentrosCustos = (f: SecullumFuncionario): string[] => {
  const list = (f as { ListaCentroDeCustos?: Array<{ Descricao?: string }> }).ListaCentroDeCustos;
  if (!Array.isArray(list)) return [];
  return list.map((c) => (c?.Descricao ?? "").trim()).filter(Boolean);
};

const BulkUpdatesPage = () => {
  const { auth } = useSecullum();
  const { toast } = useToast();

  const [funcionarios, setFuncionarios] = useState<SecullumFuncionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEstrutura, setFilterEstrutura] = useState<string>("all");
  const [filterHorario, setFilterHorario] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [fieldKind, setFieldKind] = useState<FieldKind>("horario");
  const [newValueId, setNewValueId] = useState<string>("");
  const [selectedCentrosCustos, setSelectedCentrosCustos] = useState<Set<string>>(new Set());

  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExecResult[]>([]);

  const loadFuncionarios = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setSelected(new Set());
    setResults([]);
    try {
      const list = await listFuncionarios(auth.token, auth.bankId);
      const active = list.filter((f) => !f.Demissao && !f.Invisivel);
      setFuncionarios(active);
    } catch (e) {
      toast({
        title: "Falha ao carregar funcionários",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [auth, toast]);

  useEffect(() => { loadFuncionarios(); }, [loadFuncionarios]);

  const estruturas = useMemo<OptionItem[]>(() => {
    const map = new Map<number, string>();
    funcionarios.forEach((f) => {
      const e = getEstrutura(f);
      if (e) map.set(e.Id, e.Descricao);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [funcionarios]);

  const horarios = useMemo<Array<OptionItem & { numero: number }>>(() => {
    const map = new Map<number, { label: string; numero: number }>();
    funcionarios.forEach((f) => {
      if (f.Horario?.Id) {
        map.set(f.Horario.Id, {
          label: f.Horario.Descricao ?? `#${f.Horario.Id}`,
          numero: f.Horario.Numero ?? 0,
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, label: v.label, numero: v.numero }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [funcionarios]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return funcionarios.filter((f) => {
      if (q && !f.Nome.toLowerCase().includes(q) && !(f.NumeroFolha ?? "").toLowerCase().includes(q)) return false;
      if (filterEstrutura !== "all") {
        const e = getEstrutura(f);
        if (!e || String(e.Id) !== filterEstrutura) return false;
      }
      if (filterHorario !== "all") {
        if (!f.Horario?.Id || String(f.Horario.Id) !== filterHorario) return false;
      }
      return true;
    });
  }, [funcionarios, search, filterEstrutura, filterHorario]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.Id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((f) => next.delete(f.Id));
    } else {
      filtered.forEach((f) => next.add(f.Id));
    }
    setSelected(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const currentOptions = fieldKind === "estrutura" ? estruturas : horarios;
  const newOption = currentOptions.find((o) => String(o.id) === newValueId);

  const targets = funcionarios.filter((f) => selected.has(f.Id));

  const buildMinimalPayload = (f: SecullumFuncionario): Record<string, unknown> => {
    const horario = f.Horario as { Numero?: number } | undefined;
    const departamento = f.Departamento as { Descricao?: string } | undefined;
    const funcao = f.Funcao as { Descricao?: string } | undefined;
    const empresa = (f as { Empresa?: { Documento?: string } }).Empresa;
    const estrutura = getEstrutura(f);

    const payload: Record<string, unknown> = {
      Nome: f.Nome ?? null,
      NumeroFolha: f.NumeroFolha ?? null,
      NumeroIdentificador: (f as { NumeroIdentificador?: unknown }).NumeroIdentificador ?? null,
      Cpf: f.Cpf ?? null,
      Admissao: (f as { Admissao?: unknown }).Admissao ?? null,
      EmpresaCnpjCpf: empresa?.Documento ?? (f as { EmpresaCnpjCpf?: unknown }).EmpresaCnpjCpf ?? null,
      HorarioNumero: horario?.Numero ?? (f as { HorarioNumero?: unknown }).HorarioNumero ?? null,
      DepartamentoDescricao: departamento?.Descricao ?? (f as { DepartamentoDescricao?: unknown }).DepartamentoDescricao ?? null,
      FuncaoDescricao: funcao?.Descricao ?? (f as { FuncaoDescricao?: unknown }).FuncaoDescricao ?? null,
      EstruturaDescricao: estrutura?.Descricao ?? (f as { EstruturaDescricao?: unknown }).EstruturaDescricao ?? null,
      Email: (f as { Email?: unknown }).Email ?? null,
      DuplicarDemitido: false,
    };

    if (fieldKind === "horario" && newOption) {
      const h = horarios.find((o) => o.id === newOption.id);
      payload.HorarioNumero = h?.numero ?? newOption.id;
    } else if (fieldKind === "estrutura" && newOption) {
      payload.EstruturaDescricao = newOption.label;
    }
    return payload;
  };

  const handleExecute = async () => {
    if (!auth || !newOption || targets.length === 0) return;
    setExecuting(true);
    setResults([]);
    setProgress(0);

    const out: ExecResult[] = [];
    for (let i = 0; i < targets.length; i++) {
      const f = targets[i];
      try {
        await upsertFuncionario(auth.token, auth.bankId, buildMinimalPayload(f));
        out.push({ funcionarioId: f.Id, nome: f.Nome, ok: true });
      } catch (e) {
        out.push({
          funcionarioId: f.Id,
          nome: f.Nome,
          ok: false,
          error: e instanceof Error ? e.message : "Erro",
        });
      }
      setResults([...out]);
      setProgress(Math.round(((i + 1) / targets.length) * 100));
      if (i < targets.length - 1) await wait(DELAY_MS);
    }

    setExecuting(false);
    const okCount = out.filter((r) => r.ok).length;
    const failCount = out.length - okCount;
    toast({
      title: "Alteração em massa finalizada",
      description: `${okCount} sucesso(s)${failCount ? ` · ${failCount} falha(s)` : ""}`,
      variant: failCount ? "destructive" : "default",
    });
    if (okCount > 0) await loadFuncionarios();
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Conecte ao Secullum</AlertTitle>
            <AlertDescription>Faça login na tela inicial e selecione um banco para usar a alteração em massa.</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const totalEta = targets.length > 0 ? Math.ceil((targets.length * DELAY_MS) / 1000) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl space-y-6 px-4 py-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Layers className="h-6 w-6 text-primary" /> Alterações em massa
            </h2>
            <p className="text-sm text-muted-foreground">
              Filtre, selecione e altere <strong>estrutura</strong> ou <strong>horário</strong> de vários colaboradores de uma vez.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadFuncionarios} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recarregar lista
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Filtrar colaboradores</CardTitle>
            <CardDescription>Banco atual: <strong>{auth.bankName}</strong> · {funcionarios.length} ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Buscar (nome ou folha)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite o nome..." className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estrutura atual</Label>
                <Select value={filterEstrutura} onValueChange={setFilterEstrutura}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ({estruturas.length})</SelectItem>
                    {estruturas.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horário atual</Label>
                <Select value={filterHorario} onValueChange={setFilterHorario}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos ({horarios.length})</SelectItem>
                    {horarios.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela com seleção */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Selecionar ({selected.size} de {filtered.length} exibidos)
            </CardTitle>
            <CardDescription>Marque os colaboradores que receberão a alteração</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Folha</TableHead>
                      <TableHead>Estrutura</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((f) => {
                      const e = getEstrutura(f);
                      return (
                        <TableRow key={f.Id} className="cursor-pointer" onClick={() => toggleOne(f.Id)}>
                          <TableCell onClick={(ev) => ev.stopPropagation()}>
                            <Checkbox checked={selected.has(f.Id)} onCheckedChange={() => toggleOne(f.Id)} />
                          </TableCell>
                          <TableCell className="font-medium">{f.Nome}</TableCell>
                          <TableCell className="text-muted-foreground">{f.NumeroFolha}</TableCell>
                          <TableCell className="text-xs">{e?.Descricao ?? "—"}</TableCell>
                          <TableCell className="text-xs">{f.Horario?.Descricao ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum colaborador com esses filtros
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Definir alteração */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Definir a alteração</CardTitle>
            <CardDescription>Escolha o campo e o novo valor a ser aplicado em todos os selecionados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Campo a alterar</Label>
                <Select value={fieldKind} onValueChange={(v) => { setFieldKind(v as FieldKind); setNewValueId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horario">Horário</SelectItem>
                    <SelectItem value="estrutura">Estrutura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo valor</Label>
                <Select value={newValueId} onValueChange={setNewValueId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {currentOptions.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-sm">
                <p>
                  <strong>{targets.length}</strong> colaborador(es) selecionado(s) ·{" "}
                  Intervalo entre requisições: <strong>{DELAY_MS}ms</strong>
                </p>
                {targets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tempo estimado: ~{totalEta}s
                  </p>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!newOption || targets.length === 0 || executing}>
                    {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Aplicar alteração
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar alteração em massa</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>
                          Você está prestes a alterar o campo <strong>{fieldKind === "horario" ? "Horário" : "Estrutura"}</strong>{" "}
                          para <strong>{newOption?.label}</strong> em <strong>{targets.length}</strong> colaborador(es).
                        </p>
                        <p className="text-xs">Esta ação é aplicada diretamente na Secullum e não pode ser desfeita automaticamente.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="max-h-60 overflow-auto rounded border border-border p-2 text-xs">
                    {targets.map((f) => (
                      <div key={f.Id} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                        <span>{f.Nome}</span>
                        <span className="text-muted-foreground">Folha {f.NumeroFolha}</span>
                      </div>
                    ))}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleExecute}>Confirmar e aplicar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Progresso / resultado */}
        {(executing || results.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execução</CardTitle>
              <CardDescription>
                {executing ? "Aplicando alterações..." : "Resultado final"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={progress} />
              <div className="flex gap-4 text-sm">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" /> {results.filter((r) => r.ok).length} OK
                </Badge>
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> {results.filter((r) => !r.ok).length} falha(s)
                </Badge>
              </div>
              <div className="max-h-60 overflow-auto rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.funcionarioId}>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell>
                          {r.ok ? (
                            <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Sucesso</Badge>
                          ) : (
                            <Badge variant="destructive">Falha</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.error ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.main>
    </div>
  );
};

export default BulkUpdatesPage;
