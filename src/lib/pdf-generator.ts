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

function addHeader(doc: jsPDF, title: string, subtitle: string, period: string) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, 28);
  doc.text(period, 14, 34);
}

function addFooter(doc: jsPDF) {
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
}

export function generatePDF(records: LatenessRecord[], options: PDFOptions) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Pontualidade", 14, 20);

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

  const atrasados = records.filter((r) => r.atrasado).length;
  const pontuais = records.filter((r) => !r.atrasado).length;
  doc.setFontSize(9);
  doc.text(
    `Total: ${records.length} | Atrasados: ${atrasados} | Pontuais: ${pontuais}`,
    14,
    startY
  );

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
      7: { fontStyle: "bold", halign: "center" },
      8: { halign: "right" },
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

  addFooter(doc);
  doc.save(`relatorio-pontualidade-${options.dataInicio}-${options.dataFim}.pdf`);
}

// ── Analytics PDF exports ──

interface AnalyticsPDFOptions {
  dataInicio: string;
  dataFim: string;
  bankName: string;
}

export function generateSectorRankingPDF(
  data: { departamento: string; totalRegistros: number; totalAtrasos: number; percentualAtraso: number; mediaMinutosAtraso: number }[],
  options: AnalyticsPDFOptions
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const period = `Período: ${format(parseISO(options.dataInicio), "dd/MM/yyyy")} a ${format(parseISO(options.dataFim), "dd/MM/yyyy")}`;
  addHeader(doc, "Ranking de Atrasos por Setor", `Banco: ${options.bankName}`, period);

  autoTable(doc, {
    startY: 40,
    head: [["#", "Setor", "Registros", "Atrasos", "% Atraso", "Média (min)"]],
    body: data.map((s, i) => [i + 1, s.departamento, s.totalRegistros, s.totalAtrasos, `${s.percentualAtraso}%`, s.mediaMinutosAtraso]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [41, 98, 203], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { halign: "center", cellWidth: 15 }, 4: { halign: "center", fontStyle: "bold" }, 5: { halign: "right" } },
  });

  addFooter(doc);
  doc.save(`ranking-setor-${options.dataInicio}-${options.dataFim}.pdf`);
}

export function generateEmployeeRankingPDF(
  data: { nome: string; departamento: string; totalRegistros: number; totalAtrasos: number; percentualAtraso: number; mediaMinutosAtraso: number; totalMinutosAtraso: number }[],
  options: AnalyticsPDFOptions
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const period = `Período: ${format(parseISO(options.dataInicio), "dd/MM/yyyy")} a ${format(parseISO(options.dataFim), "dd/MM/yyyy")}`;
  addHeader(doc, "Ranking de Atrasos por Colaborador", `Banco: ${options.bankName}`, period);

  autoTable(doc, {
    startY: 40,
    head: [["#", "Colaborador", "Setor", "Registros", "Atrasos", "% Atraso", "Média (min)", "Total (min)"]],
    body: data.map((e, i) => [i + 1, e.nome, e.departamento, e.totalRegistros, e.totalAtrasos, `${e.percentualAtraso}%`, e.mediaMinutosAtraso, e.totalMinutosAtraso]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 203], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { halign: "center", cellWidth: 12 }, 5: { halign: "center", fontStyle: "bold" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
  });

  addFooter(doc);
  doc.save(`ranking-colaborador-${options.dataInicio}-${options.dataFim}.pdf`);
}

export function generateWeekdayTrendPDF(
  data: { dia: string; totalRegistros: number; totalAtrasos: number; percentualAtraso: number; mediaMinutosAtraso: number }[],
  options: AnalyticsPDFOptions
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const period = `Período: ${format(parseISO(options.dataInicio), "dd/MM/yyyy")} a ${format(parseISO(options.dataFim), "dd/MM/yyyy")}`;
  addHeader(doc, "Tendência de Atraso por Dia da Semana", `Banco: ${options.bankName}`, period);

  autoTable(doc, {
    startY: 40,
    head: [["Dia da Semana", "Registros", "Atrasos", "% Atraso", "Média (min)"]],
    body: data.map((w) => [w.dia, w.totalRegistros, w.totalAtrasos, `${w.percentualAtraso}%`, w.mediaMinutosAtraso]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [41, 98, 203], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 3: { halign: "center", fontStyle: "bold" }, 4: { halign: "right" } },
  });

  addFooter(doc);
  doc.save(`tendencia-dia-semana-${options.dataInicio}-${options.dataFim}.pdf`);
}

export function generateRecurrencePDF(
  data: { nome: string; departamento: string; totalAtrasos: number; totalRegistros: number; percentualAtraso: number; mediaMinutosAtraso: number; totalMinutosAtraso: number }[],
  options: AnalyticsPDFOptions
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const period = `Período: ${format(parseISO(options.dataInicio), "dd/MM/yyyy")} a ${format(parseISO(options.dataFim), "dd/MM/yyyy")}`;
  addHeader(doc, "Recorrência de Atrasos", `Banco: ${options.bankName}`, period);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text(`Total de colaboradores recorrentes (2+ atrasos): ${data.length}`, 14, 40);

  autoTable(doc, {
    startY: 46,
    head: [["#", "Colaborador", "Setor", "Dias c/ Atraso", "Total Registros", "% Atraso", "Média (min)", "Total (min)"]],
    body: data.map((e, i) => [i + 1, e.nome, e.departamento, e.totalAtrasos, e.totalRegistros, `${e.percentualAtraso}%`, e.mediaMinutosAtraso, e.totalMinutosAtraso]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 203], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { halign: "center", cellWidth: 12 }, 3: { halign: "center", fontStyle: "bold" }, 5: { halign: "center" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
  });

  addFooter(doc);
  doc.save(`recorrencia-atrasos-${options.dataInicio}-${options.dataFim}.pdf`);
}
