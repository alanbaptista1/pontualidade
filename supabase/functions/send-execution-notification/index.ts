// Edge Function: send-execution-notification
// Sends an email via Resend (through the Lovable connector gateway) notifying
// the user about a scheduled report execution result (success or failure).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
// Without a verified domain, Resend only allows sending to the account owner's email.
const FROM_ADDRESS = "Pontualidade DuBrasil Soluções <onboarding@resend.dev>";

interface RequestPayload {
  execution_id: string;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildSuccessHtml(opts: {
  scheduleName: string;
  bankName: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalRecords: number | null;
  finishedAt: string | null;
  downloadUrl: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6fa;font-family:Helvetica,Arial,sans-serif;color:#1f2937;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:#2962cb;padding:24px 32px;color:#ffffff;">
<h1 style="margin:0;font-size:20px;font-weight:600;">✅ Relatório pronto</h1>
<p style="margin:6px 0 0;font-size:13px;opacity:0.9;">${opts.scheduleName}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Seu relatório agendado foi gerado com sucesso e está disponível para download.</p>
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 24px;">
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Banco</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${opts.bankName}</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Período</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${fmtDate(opts.periodStart)} a ${fmtDate(opts.periodEnd)}</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Registros</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${opts.totalRecords ?? 0}</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Gerado em</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${fmtDateTime(opts.finishedAt)}</td></tr>
</table>
<p style="margin:0 0 8px;font-size:14px;color:#1f2937;">Link de download:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${opts.downloadUrl}" style="color:#2962cb;text-decoration:underline;">${opts.downloadUrl}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">O link de download é válido por 7 dias.</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">Pontualidade DuBrasil Soluções · Notificação automática</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildErrorHtml(opts: {
  scheduleName: string;
  bankName: string;
  periodStart: string | null;
  periodEnd: string | null;
  errorMessage: string;
  finishedAt: string | null;
  retryCount: number;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6fa;font-family:Helvetica,Arial,sans-serif;color:#1f2937;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:#dc2626;padding:24px 32px;color:#ffffff;">
<h1 style="margin:0;font-size:20px;font-weight:600;">⚠️ Falha na geração do relatório</h1>
<p style="margin:6px 0 0;font-size:13px;opacity:0.9;">${opts.scheduleName}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">A execução agendada falhou após ${opts.retryCount} tentativa(s). Você pode tentar executar manualmente pela tela de agendamentos.</p>
<table width="100%" cellspacing="0" cellpadding="0" style="background:#fef2f2;border-radius:8px;padding:16px;margin:0 0 24px;border-left:3px solid #dc2626;">
<tr><td style="font-size:13px;color:#991b1b;font-family:monospace;line-height:1.5;">${opts.errorMessage}</td></tr>
</table>
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 24px;">
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Banco</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${opts.bankName}</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Período</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${fmtDate(opts.periodStart)} a ${fmtDate(opts.periodEnd)}</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding:4px 0;">Falhou em</td><td style="font-size:13px;color:#1f2937;text-align:right;font-weight:500;">${fmtDateTime(opts.finishedAt)}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">Pontualidade DuBrasil Soluções · Notificação automática</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const payload = (await req.json()) as RequestPayload;
    if (!payload?.execution_id) {
      return new Response(JSON.stringify({ error: "execution_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load execution + schedule
    const { data: execution, error: execErr } = await adminClient
      .from("report_executions")
      .select("*")
      .eq("id", payload.execution_id)
      .maybeSingle();
    if (execErr || !execution) throw new Error("Execução não encontrada");

    const { data: schedule, error: schedErr } = await adminClient
      .from("report_schedules")
      .select("name, bank_name, notify_email, notification_email, user_id")
      .eq("id", execution.schedule_id)
      .maybeSingle();
    if (schedErr || !schedule) throw new Error("Agendamento não encontrado");

    if (!schedule.notify_email) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "notify_email disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve recipient: schedule.notification_email > user account email
    let recipient = schedule.notification_email?.trim() || null;
    if (!recipient) {
      const { data: userData } = await adminClient.auth.admin.getUserById(
        schedule.user_id
      );
      recipient = userData?.user?.email ?? null;
    }
    if (!recipient) throw new Error("Destinatário não encontrado");

    let subject: string;
    let html: string;

    if (execution.status === "success") {
      // Generate signed URL valid 7 days
      const { data: signed, error: signErr } = await adminClient.storage
        .from("reports")
        .createSignedUrl(execution.pdf_path!, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) {
        throw new Error(`Falha ao gerar link de download: ${signErr?.message}`);
      }

      subject = `✅ Relatório pronto: ${schedule.name}`;
      html = buildSuccessHtml({
        scheduleName: schedule.name,
        bankName: schedule.bank_name,
        periodStart: execution.period_start,
        periodEnd: execution.period_end,
        totalRecords: execution.total_records,
        finishedAt: execution.finished_at,
        downloadUrl: signed.signedUrl,
      });
    } else {
      subject = `⚠️ Falha no relatório: ${schedule.name}`;
      html = buildErrorHtml({
        scheduleName: schedule.name,
        bankName: schedule.bank_name,
        periodStart: execution.period_start,
        periodEnd: execution.period_end,
        errorMessage: execution.error_message || "Erro desconhecido",
        finishedAt: execution.finished_at,
        retryCount: execution.retry_count,
      });
    }

    const sendRes = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipient],
        subject,
        html,
      }),
    });

    const sendBody = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      throw new Error(
        `Resend [${sendRes.status}]: ${JSON.stringify(sendBody).slice(0, 300)}`
      );
    }

    console.log(
      `[send-execution-notification] sent to=${recipient} status=${execution.status} id=${sendBody?.id}`
    );

    return new Response(
      JSON.stringify({ success: true, message_id: sendBody?.id, recipient }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[send-execution-notification]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
