// Edge Function: scheduler-tick
// Runs every 5 minutes via pg_cron. Picks active schedules whose cron
// expression matches the current minute, and dispatches them to
// generate-scheduled-report. Also handles 1-time retries for executions
// marked next_retry_at <= now().
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Cron matcher (5 fields: minute hour day month weekday) ──
function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  // Comma list
  for (const part of field.split(",")) {
    // Step: */N or A-B/N or A/N
    let stepMatch = part.match(/^(.*)\/(\d+)$/);
    let base = part;
    let step = 1;
    if (stepMatch) {
      base = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
      if (!step) continue;
    }
    let lo = min;
    let hi = max;
    if (base === "*") {
      // already lo..hi
    } else if (base.includes("-")) {
      const [a, b] = base.split("-").map((n) => parseInt(n, 10));
      lo = a;
      hi = b;
    } else {
      const n = parseInt(base, 10);
      if (Number.isNaN(n)) continue;
      if (stepMatch) {
        lo = n;
        hi = max;
      } else {
        if (n === value) return true;
        continue;
      }
    }
    if (value < lo || value > hi) continue;
    if ((value - lo) % step === 0) return true;
  }
  return false;
}

function cronMatches(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [m, h, dom, mon, dow] = parts;
  const minute = now.getMinutes();
  const hour = now.getHours();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay(); // 0=Sun
  return (
    matchField(m, minute, 0, 59) &&
    matchField(h, hour, 0, 23) &&
    matchField(dom, dayOfMonth, 1, 31) &&
    matchField(mon, month, 1, 12) &&
    matchField(dow, dayOfWeek, 0, 6)
  );
}

// Get current time in a specific IANA timezone as a Date-like object.
function nowInTimezone(tz: string): Date {
  // Build a Date based on the formatted parts in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Hour can be "24" in some locales when midnight; normalize
  const hour = map.hour === "24" ? "00" : map.hour;
  return new Date(
    `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const dispatched: Array<{ schedule_id: string; reason: string }> = [];

    // ── 1. Active schedules that match cron right now ──
    const { data: schedules, error: schedErr } = await admin
      .from("report_schedules")
      .select("id, cron_expression, timezone")
      .eq("is_active", true);
    if (schedErr) throw schedErr;

    for (const s of schedules ?? []) {
      const tzNow = nowInTimezone(s.timezone || "America/Sao_Paulo");
      if (cronMatches(s.cron_expression, tzNow)) {
        // Fire-and-forget invoke (don't await response — they can take long)
        invokeGenerate(supabaseUrl, serviceKey, s.id);
        dispatched.push({ schedule_id: s.id, reason: "cron-match" });
      }
    }

    // ── 2. Retries: executions with status=error AND retry_count=0 AND next_retry_at <= now() ──
    const nowIso = new Date().toISOString();
    const { data: retries, error: retryErr } = await admin
      .from("report_executions")
      .select("id, schedule_id, retry_count")
      .eq("status", "error")
      .lt("retry_count", 1)
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", nowIso);
    if (retryErr) throw retryErr;

    for (const exec of retries ?? []) {
      // Bump retry count first to prevent duplicate retries
      await admin
        .from("report_executions")
        .update({ retry_count: 1, next_retry_at: null })
        .eq("id", exec.id);
      invokeGenerate(supabaseUrl, serviceKey, exec.schedule_id);
      dispatched.push({ schedule_id: exec.schedule_id, reason: "retry" });
    }

    // ── 3. Schedule first retry for executions that just errored without retry ──
    // Mark next_retry_at = errored_at + 5 min, only if retry_count = 0 and next_retry_at is null
    await admin
      .from("report_executions")
      .update({
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq("status", "error")
      .eq("retry_count", 0)
      .is("next_retry_at", null);

    return new Response(
      JSON.stringify({ success: true, dispatched, count: dispatched.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[scheduler-tick]", msg, error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function invokeGenerate(
  supabaseUrl: string,
  serviceKey: string,
  scheduleId: string
) {
  // Fire-and-forget — function may take 30-60s, don't block tick
  fetch(`${supabaseUrl}/functions/v1/generate-scheduled-report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ schedule_id: scheduleId }),
  }).catch((err) => console.error("invoke failed", scheduleId, err));
}
