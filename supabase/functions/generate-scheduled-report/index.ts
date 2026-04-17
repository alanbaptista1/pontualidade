// Edge Function: generate-scheduled-report
// Executes a single report schedule end-to-end:
// fetches Secullum data, computes lateness, builds PDF, uploads to storage,
// and updates report_executions row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTH_BASE = "https://autenticador.secullum.com.br";
const API_BASE =
  "https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna";

const DIAS_SEMANA = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

interface LatenessRecord {
  nome: string;
  departamento: string;
  data: string; // YYYY-MM-DD
  diaSemana: string;
  horarioEsperado: string;
  horarioReal: string;
  horarioCompleto: string;
  atrasado: boolean;
  minutosAtraso: number;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ddmmyyyy(s: string) {
  // s = YYYY-MM-DD
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function getDiaSemanaIndex(dateStr: string): number {
  // dateStr from Secullum: usually "YYYY-MM-DDTHH:..." or "YYYY-MM-DD"
  const date = new Date(dateStr);
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

// ── Period resolution (mirrors src/lib/schedule-helpers.ts) ──
function resolvePeriod(
  periodType: string,
  custom: { start: string | null; end: string | null }
): { start: Date; end: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  switch (periodType) {
    case "yesterday":
      return { start: yesterday, end: yesterday };
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      return { start, end: yesterday };
    }
    case "last_30_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { start, end: yesterday };
    }
    case "current_month_until_yesterday": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: yesterday };
    }
    case "previous_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    }
    case "last_week": {
      const dow = today.getDay() || 7;
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dow);
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);
      return { start: lastMonday, end: lastSunday };
    }
    case "custom_range": {
      if (!custom.start || !custom.end) return null;
      return { start: new Date(custom.start), end: new Date(custom.end) };
    }
  }
  return null;
}

// ── Secullum API ──
async function secullumLogin(username: string, password: string): Promise<string> {
  const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&client_id=3`;
  const res = await fetch(`${AUTH_BASE}/Token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || "Falha na autenticação Secullum");
  }
  return data.access_token;
}

async function secullumApi<T>(
  token: string,
  bankId: string,
  endpoint: string
): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      secullumidbancoselecionado: String(bankId),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Secullum ${endpoint}: ${res.status} ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    await Promise.all(batch.map(worker));
  }
}

// ── PDF generation (mirrors src/lib/pdf-generator.ts) ──
function buildPDF(
  records: LatenessRecord[],
  options: {
    dataInicio: string;
    dataFim: string;
    bankName: string;
    tolerance: number;
    departmentFilter: string | null;
    onlyLate: boolean;
  }
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Pontualidade", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Banco: ${options.bankName}`, 14, 28);
  doc.text(
    `Período: ${ddmmyyyy(options.dataInicio)} a ${ddmmyyyy(options.dataFim)}`,
    14,
    34
  );
  doc.text(`Tolerância aplicada: ${options.tolerance} min`, 14, 40);

  const filtersLine: string[] = [];
  filtersLine.push(`Departamento: ${options.departmentFilter || "Todos"}`);
  filtersLine.push(`Somente atrasados: ${options.onlyLate ? "Sim" : "Não"}`);
  doc.text(filtersLine.join("  ·  "), 14, 46);

  const atrasados = records.filter((r) => r.atrasado).length;
  const pontuais = records.length - atrasados;
  doc.setFontSize(9);
  doc.text(
    `Total: ${records.length} | Atrasados: ${atrasados} | Pontuais: ${pontuais}`,
    14,
    52
  );

  // @ts-ignore - autoTable typings differ in deno
  autoTable(doc, {
    startY: 58,
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
      ddmmyyyy(r.data),
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
    didParseCell: (data: any) => {
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
  const pageCount = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(
      2,
      "0"
    )}:${String(now.getMinutes()).padStart(2, "0")}`;
    doc.text(
      `Gerado em ${stamp} · Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Service-role client (used for storage upload + execution row updates,
  // bypassing RLS — we already validate ownership ourselves).
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let scheduleId: string | null = null;
  let executionId: string | null = null;

  try {
    const payload = await req.json().catch(() => ({}));
    scheduleId = payload.schedule_id ?? null;
    if (!scheduleId) {
      return new Response(
        JSON.stringify({ error: "schedule_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Load schedule
    const { data: schedule, error: schedErr } = await adminClient
      .from("report_schedules")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();
    if (schedErr || !schedule) {
      throw new Error("Agendamento não encontrado");
    }

    const period = resolvePeriod(schedule.period_type, {
      start: schedule.custom_start_date,
      end: schedule.custom_end_date,
    });
    if (!period) throw new Error("Período inválido para este agendamento");

    const dataInicio = ymd(period.start);
    const dataFim = ymd(period.end);

    // 2. Create execution row (status = running)
    const { data: execRow, error: execErr } = await adminClient
      .from("report_executions")
      .insert({
        user_id: schedule.user_id,
        schedule_id: schedule.id,
        status: "running",
        period_start: dataInicio,
        period_end: dataFim,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (execErr || !execRow) throw new Error("Falha ao registrar execução");
    executionId = execRow.id;

    // 3. Load Secullum credentials
    const { data: creds, error: credsErr } = await adminClient
      .from("secullum_credentials")
      .select("secullum_username, secullum_password")
      .eq("user_id", schedule.user_id)
      .maybeSingle();
    if (credsErr || !creds) {
      throw new Error("Credenciais Secullum não configuradas para este usuário");
    }

    // 4. Authenticate to Secullum
    const token = await secullumLogin(
      creds.secullum_username,
      creds.secullum_password
    );

    // 5. Fetch funcionarios + horarios + batidas
    const funcionarios = await secullumApi<any[]>(
      token,
      schedule.bank_id,
      "Funcionarios"
    );
    const activeFuncs = funcionarios.filter(
      (f) => !f.Demissao && !f.Invisivel
    );

    const horarioIds = [
      ...new Set(
        activeFuncs.map((f) => f.Horario?.Numero).filter(Boolean) as number[]
      ),
    ];
    const horarioMap = new Map<number, any>();
    await runWithConcurrency(horarioIds, 4, async (num) => {
      const result = await secullumApi<any[]>(
        token,
        schedule.bank_id,
        `Horarios?numero=${num}`
      );
      if (Array.isArray(result) && result.length > 0) {
        horarioMap.set(result[0].Numero, result[0]);
      }
    });

    const allBatidas = await secullumApi<any[]>(
      token,
      schedule.bank_id,
      `Batidas?dataInicio=${dataInicio}&dataFim=${dataFim}`
    );

    const batidasByFuncionario = new Map<number, any[]>();
    for (const b of allBatidas) {
      const arr = batidasByFuncionario.get(b.FuncionarioId) ?? [];
      arr.push(b);
      batidasByFuncionario.set(b.FuncionarioId, arr);
    }

    // 6. Compute lateness
    const records: LatenessRecord[] = [];
    for (const func of activeFuncs) {
      const horario = horarioMap.get(func.Horario?.Numero);
      if (!horario?.Dias) continue;
      const funcBatidas = batidasByFuncionario.get(func.Id) ?? [];
      for (const batida of funcBatidas) {
        const idx = getDiaSemanaIndex(batida.Data);
        const horarioDia = horario.Dias.find((d: any) => d.DiaSemana === idx);
        if (!horarioDia || !horarioDia.Entrada1) continue;
        const realTime = batida.Entrada1;
        if (!realTime) continue;

        const esperadoMin = timeToMinutes(horarioDia.Entrada1);
        const realMin = timeToMinutes(realTime);
        const atraso = realMin - esperadoMin;
        const atrasado = atraso > schedule.tolerance_minutes;

        records.push({
          nome: func.Nome,
          departamento: func.Departamento?.Descricao || "N/A",
          data: batida.Data.slice(0, 10),
          diaSemana: DIAS_SEMANA[idx] || "N/A",
          horarioEsperado: horarioDia.Entrada1,
          horarioReal: realTime,
          horarioCompleto: formatHorarioCompleto(horarioDia),
          atrasado,
          minutosAtraso: atrasado ? atraso : 0,
        });
      }
    }

    // 7. Build PDF
    const pdfBytes = buildPDF(records, {
      dataInicio,
      dataFim,
      bankName: schedule.bank_name,
      tolerance: schedule.tolerance_minutes,
    });

    // 8. Upload to storage at <user_id>/<execution_id>.pdf
    const path = `${schedule.user_id}/${executionId}.pdf`;
    const { error: upErr } = await adminClient.storage
      .from("reports")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    // 9. Mark execution success
    await adminClient
      .from("report_executions")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        pdf_path: path,
        pdf_size_bytes: pdfBytes.length,
        total_records: records.length,
      })
      .eq("id", executionId);

    // 10. Update schedule last_run_at
    await adminClient
      .from("report_schedules")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", schedule.id);

    // 11. Send success notification (best-effort, never blocks the response)
    try {
      await adminClient.functions.invoke("send-execution-notification", {
        body: { execution_id: executionId },
      });
    } catch (notifyErr) {
      console.error("[generate-scheduled-report] notification failed:", notifyErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        pdf_path: path,
        total_records: records.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[generate-scheduled-report]", msg, error);

    // Mark execution as error if we already created it
    if (executionId) {
      await adminClient
        .from("report_executions")
        .update({
          status: "error",
          error_message: msg.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", executionId);

      // Send failure notification only when we've exhausted retries (retry_count >= 1).
      // For the first failure, scheduler-tick will retry once before notifying.
      try {
        const { data: execAfter } = await adminClient
          .from("report_executions")
          .select("retry_count")
          .eq("id", executionId)
          .maybeSingle();
        if ((execAfter?.retry_count ?? 0) >= 1) {
          await adminClient.functions.invoke("send-execution-notification", {
            body: { execution_id: executionId },
          });
        }
      } catch (notifyErr) {
        console.error("[generate-scheduled-report] failure notification error:", notifyErr);
      }
    }

    return new Response(
      JSON.stringify({ error: msg, execution_id: executionId }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
