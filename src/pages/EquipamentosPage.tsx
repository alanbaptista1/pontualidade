import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, HardDrive, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSecullum } from "@/contexts/SecullumContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { listEquipamentos } from "@/lib/secullum-api";
import { supabase } from "@/integrations/supabase/client";

interface EquipamentoRow {
  equipamento_id: number;
  descricao: string | null;
  raw: Record<string, unknown>;
}

export default function EquipamentosPage() {
  const { auth } = useSecullum();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [equipamentos, setEquipamentos] = useState<EquipamentoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth) navigate("/");
  }, [auth, navigate]);

  const loadFromDb = useCallback(async () => {
    if (!user || !auth) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("secullum_equipamentos")
      .select("equipamento_id, descricao, raw")
      .eq("user_id", user.id)
      .eq("bank_id", auth.bankId)
      .order("equipamento_id", { ascending: true });

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      return;
    }
    setEquipamentos((data ?? []) as EquipamentoRow[]);
  }, [user, auth, toast]);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const handleSync = async () => {
    if (!auth || !user) return;
    setSyncing(true);
    try {
      const data = await listEquipamentos(auth.token, auth.bankId);

      if (!Array.isArray(data)) {
        throw new Error("Resposta inesperada do servidor");
      }

      const rows = data
        .map((item) => {
          const obj = item as Record<string, unknown>;
          const id = Number(obj.Id ?? obj.id);
          if (!Number.isFinite(id)) return null;
          const descricao =
            (obj.Descricao as string | undefined) ??
            (obj.descricao as string | undefined) ??
            null;
          return {
            user_id: user.id,
            bank_id: auth.bankId,
            equipamento_id: id,
            descricao,
            raw: obj as unknown as never,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length === 0) {
        toast({ title: "Nenhum equipamento encontrado" });
      } else {
        const { error } = await supabase
          .from("secullum_equipamentos")
          .upsert(rows, { onConflict: "user_id,bank_id,equipamento_id" });

        if (error) throw new Error(error.message);

        toast({
          title: "Sincronizado",
          description: `${rows.length} equipamento(s) salvos.`,
        });
      }

      await loadFromDb();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao sincronizar";
      toast({ title: "Falha na sincronização", description: message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = equipamentos.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(e.equipamento_id).includes(q) ||
      (e.descricao ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <HardDrive className="h-6 w-6 text-primary" />
              Equipamentos
            </h2>
            <p className="text-sm text-muted-foreground">
              Lista de equipamentos do banco {auth?.bankName} salvos para uso futuro.
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar com Secullum
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">
              {filtered.length} equipamento(s)
            </CardTitle>
            <Input
              placeholder="Buscar por ID ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum equipamento cadastrado. Clique em "Sincronizar com Secullum".
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">ID</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((eq) => (
                    <TableRow key={eq.equipamento_id}>
                      <TableCell>
                        <Badge variant="secondary">{eq.equipamento_id}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {eq.descricao ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
