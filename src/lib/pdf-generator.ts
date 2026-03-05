import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { LatenessRecord } from "@/types/secullum";

interface PDFOptions {
  dataInicio: string;
  dataFim: string;
  departamento: string;
  tolerancia: number;
  somenteAtrasados: boolean;
  bankName: string;
}

export function generatePDF(records: LatenessRecord[], options: PDFOptions) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Pontualidade", 14, 20);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Banco: ${options.bankName}`, 14, 28);
  doc.text(
    `Período: ${format(parseISO(options.dataInicio), "dd/MM/yyyy")} a ${format(parseISO(options.dataFim), "dd/MM/yyyy")}`,
    14,
    34
  );
  doc.text(`Departamento: ${options.departamento}`, 14, 40);
  if (options.somenteAtrasados) {
    doc.text(`Filtro: Somente atrasados (tolerância: ${options.tolerancia} min)`, 14, 46);
  }

  const startY = options.somenteAtrasados ? 52 : 46;

  // Summary
  const atrasados = records.filter((r) => r.atrasado).length;
  const pontuais = records.filter((r) => !r.atrasado).length;
  doc.setFontSize(9);
  doc.text(
    `Total: ${records.length} | Atrasados: ${atrasados} | Pontuais: ${pontuais}`,
    14,
    startY
  );

  // Table
  autoTable(doc, {
    startY: startY + 6,
    head: [
      [
        "Funcionário",
        "Data",
        "Dia",
        "Departamento",
        "H. Esperado",
        "H. Real",
        "Horário Completo",
        "Status",
        "Atraso (min)",
      ],
    ],
    body: records.map((r) => [
      r.nome,
      format(parseISO(r.data), "dd/MM/yyyy"),
      r.diaSemana,
      r.departamento,
      r.horarioEsperado,
      r.horarioReal,
      r.horarioCompleto,
      r.atrasado ? "ATRASADO" : "PONTUAL",
      r.atrasado ? String(r.minutosAtraso) : "—",
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 203], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      7: {
        fontStyle: "bold",
        halign: "center",
      },
      8: {
        halign: "right",
      },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        if (data.cell.raw === "ATRASADO") {
          data.cell.styles.textColor = [220, 38, 38];
        } else {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`relatorio-pontualidade-${options.dataInicio}-${options.dataFim}.pdf`);
}
