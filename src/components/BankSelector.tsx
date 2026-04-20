import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SecullumBank } from "@/types/secullum";

interface BankSelectorProps {
  banks: SecullumBank[];
  onSelect: (bank: SecullumBank) => void;
}

const BankSelector = ({ banks, onSelect }: BankSelectorProps) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(
      (b) =>
        b.nome.toLowerCase().includes(q) ||
        String(b.id).toLowerCase().includes(q),
    );
  }, [banks, query]);

  return (
    <Card className="shadow-[var(--shadow-elevated)]">
      <CardHeader className="pb-4 pt-6 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Selecione o banco de dados
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar banco por nome ou ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {banks.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {banks.length} bancos
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {filtered.map((bank, i) => (
          <motion.button
            key={bank.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            onClick={() => onSelect(bank)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent hover:border-primary/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground">{bank.nome}</p>
              <p className="text-xs text-muted-foreground">ID: {bank.id}</p>
            </div>
          </motion.button>
        ))}
        {banks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum banco disponível
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum banco encontrado para "{query}"
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default BankSelector;
