import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LatenessRecord } from "@/types/secullum";

interface LatenessTableProps {
  records: LatenessRecord[];
}

const LatenessTable = ({ records }: LatenessTableProps) => {
  if (records.length === 0) {
    return (
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum registro encontrado com os filtros atuais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Funcionário</TableHead>
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="font-semibold">Dia</TableHead>
                <TableHead className="font-semibold">Departamento</TableHead>
                <TableHead className="font-semibold">Horário Esperado</TableHead>
                <TableHead className="font-semibold">Horário Real</TableHead>
                <TableHead className="font-semibold">Horário Completo</TableHead>
                <TableHead className="text-center font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Atraso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec, i) => (
                <TableRow key={`${rec.funcionarioId}-${rec.data}-${i}`} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">{rec.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(rec.data), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rec.diaSemana}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rec.departamento}</TableCell>
                  <TableCell className="font-mono text-sm">{rec.horarioEsperado}</TableCell>
                  <TableCell className="font-mono text-sm">{rec.horarioReal}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rec.horarioCompleto}</TableCell>
                  <TableCell className="text-center">
                    {rec.atrasado ? (
                      <Badge variant="destructive" className="text-xs">
                        Atrasado
                      </Badge>
                    ) : (
                      <Badge className="bg-on-time text-on-time-foreground text-xs hover:bg-on-time/90">
                        Pontual
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {rec.atrasado ? (
                      <span className="font-semibold text-late">{rec.minutosAtraso} min</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
};

export default LatenessTable;
