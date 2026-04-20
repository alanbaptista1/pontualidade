import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Search, Users, Mail, MailCheck, MailX, Download } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type EmployeeStatus = "had_email" | "updated_via_link" | "no_email";

interface EmployeeRow {
  id: string;
  bank_id: string;
  bank_name: string;
  numero_folha: string;
  employee_name: string;
  original_email: string | null;
  current_email: string | null;
  status: EmployeeStatus;
  last_synced_at: string;
  email_updated_at: string | null;
}

interface BankOption {
  bank_id: string;
  bank_name: string;
}

const statusLabel: Record<EmployeeStatus, string> = {
  had_email: "Já tinha email",
  updated_via_link: "Atualizado pelo link",
  no_email: "Sem email",
};

const statusVariant: Record<EmployeeStatus, "default" | "secondary" | "destructive" | "outline"> = {
  had_email: "secondary",
  updated_via_link: "default",
  no_email: "outline",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const EmployeesListPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadBanks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("public_link_employees")
      .select("bank_id, bank_name")
      .eq("owner_user_id", user.id);
    if (data) {
      const map = new Map<string, BankOption>();
      data.forEach((row) => {
        if (!map.has(row.bank_id)) map.set(row.bank_id, row);
      });
      const list = Array.from(map.values());
      setBanks(list);
      if (list.length && !selectedBank) {
        setSelectedBank(list[0].bank_id);
      }
    }
  }, [user, selectedBank]);

  const loadEmployees = useCallback(async () => {
    if (!user || !selectedBank) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("public_link_employees")
      .select("id, bank_id, bank_name, numero_folha, employee_name, original_email, current_email, status, last_synced_at, email_updated_at")
      .eq("owner_user_id", user.id)
      .eq("bank_id", selectedBank)
      .order("employee_name");
    if (error) {
      toast({ title: "Falha ao carregar funcionários", description: error.message, variant: "destructive" });
    } else if (data) {
      setEmployees(data as EmployeeRow[]);
      const latest = data.reduce<string | null>((acc, row) => {
        if (!acc || row.last_synced_at > acc) return row.last_synced_at;
        return acc;
      }, null);
      setLastSync(latest);
    }
    setLoading(false);
  }, [user, selectedBank, toast]);

  useEffect(() => { loadBanks(); }, [loadBanks]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const handleSync = async () => {
    const bank = banks.find((b) => b.bank_id === selectedBank);
    if (!bank) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-bank-employees", {
      body: { bankId: bank.bank_id, bankName: bank.bank_name },
    });
    setSyncing(false);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Falha ao sincronizar",
        description: (data as { error?: string })?.error ?? error?.message ?? "Erro",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Sincronização concluída",
      description: `${(data as { total?: number })?.total ?? 0} funcionários atualizados`,
    });
    await loadEmployees();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.employee_name.toLowerCase().includes(q) ||
        e.numero_folha.toLowerCase().includes(q) ||
        (e.current_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [employees, search, statusFilter]);

  const counts = useMemo(() => {
    const acc = { had_email: 0, updated_via_link: 0, no_email: 0 };
    employees.forEach((e) => { acc[e.status]++; });
    return acc;
  }, [employees]);

  const handleExportCsv = () => {
    const header = ["Nome", "Folha", "Email original", "Email atual", "Status", "Atualizado em"];
    const lines = filtered.map((e) => [
      e.employee_name,
      e.numero_folha,
      e.original_email ?? "",
      e.current_email ?? "",
      statusLabel[e.status],
      e.email_updated_at ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funcionarios_${selectedBank}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Funcionários do link público</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe quem já cadastrou e-mail e quem ainda está pendente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!filtered.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing || !selectedBank}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar agora
            </Button>
          </div>
        </div>

        {banks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum banco sincronizado ainda. Vá em <strong>Atualizações</strong>, configure o link público e a lista será carregada automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employees.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Já tinham email</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{counts.had_email}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Atualizaram pelo link</CardTitle>
                  <MailCheck className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{counts.updated_via_link}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sem email</CardTitle>
                  <MailX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{counts.no_email}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label>Banco</Label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.bank_id} value={b.bank_id}>{b.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[260px] flex-1 space-y-2">
                    <Label>Buscar</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Nome, folha ou email"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                {lastSync && (
                  <CardDescription className="pt-2">
                    Última sincronização: {formatDate(lastSync)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">Todos ({employees.length})</TabsTrigger>
                    <TabsTrigger value="updated_via_link">Pelo link ({counts.updated_via_link})</TabsTrigger>
                    <TabsTrigger value="had_email">Já tinham ({counts.had_email})</TabsTrigger>
                    <TabsTrigger value="no_email">Sem email ({counts.no_email})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado</p>
                ) : (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Folha</TableHead>
                          <TableHead>Email atual</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Atualizado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.employee_name}</TableCell>
                            <TableCell className="text-muted-foreground">{e.numero_folha}</TableCell>
                            <TableCell>
                              {e.current_email ?? <span className="text-muted-foreground italic">vazio</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[e.status]} className="gap-1">
                                {e.status === "updated_via_link" && <MailCheck className="h-3 w-3" />}
                                {statusLabel[e.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(e.email_updated_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.main>
    </div>
  );
};

export default EmployeesListPage;
