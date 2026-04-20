import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function callSecullumProxy(body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/secullum-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Falha na integração Secullum (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { bankId, bankName } = await req.json();
    if (!bankId || !bankName) {
      return new Response(JSON.stringify({ error: "bankId e bankName obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: creds, error: credsErr } = await admin
      .from("secullum_credentials")
      .select("secullum_username, secullum_password")
      .eq("user_id", userId)
      .maybeSingle();
    if (credsErr) throw credsErr;
    if (!creds) throw new Error("Credenciais Secullum não configuradas");

    const loginResponse = await callSecullumProxy({
      action: "login",
      payload: { username: creds.secullum_username, password: creds.secullum_password },
    }) as { access_token?: string };

    if (!loginResponse?.access_token) throw new Error("Falha ao obter token Secullum");

    const allEmployees = await callSecullumProxy({
      action: "api-request",
      payload: {
        token: loginResponse.access_token,
        bankId: String(bankId),
        endpoint: "Funcionarios",
        method: "GET",
      },
    });

    if (!Array.isArray(allEmployees)) {
      throw new Error("Resposta inesperada da Secullum");
    }

    // Buscar registros já existentes para preservar status "updated_via_link"
    const { data: existing } = await admin
      .from("public_link_employees")
      .select("numero_folha, status, original_email")
      .eq("owner_user_id", userId)
      .eq("bank_id", String(bankId));

    const existingMap = new Map<string, { status: string; original_email: string | null }>();
    (existing ?? []).forEach((row) => {
      existingMap.set(String(row.numero_folha), {
        status: row.status,
        original_email: row.original_email,
      });
    });

    const now = new Date().toISOString();
    const activeEmployees = allEmployees.filter(
      (e: Record<string, unknown>) => !e.Demissao && e.NumeroFolha != null
    );

    const rows = activeEmployees.map((emp: Record<string, unknown>) => {
      const numeroFolha = String(emp.NumeroFolha);
      const currentEmail = (emp.Email as string | null) ?? null;
      const prev = existingMap.get(numeroFolha);

      let status: "had_email" | "updated_via_link" | "no_email";
      let originalEmail: string | null;

      if (prev) {
        // Mantém histórico
        originalEmail = prev.original_email;
        if (prev.status === "updated_via_link") {
          status = "updated_via_link";
        } else if (currentEmail) {
          status = originalEmail ? "had_email" : "updated_via_link";
        } else {
          status = "no_email";
        }
      } else {
        originalEmail = currentEmail;
        status = currentEmail ? "had_email" : "no_email";
      }

      return {
        owner_user_id: userId,
        bank_id: String(bankId),
        bank_name: bankName,
        employee_secullum_id: emp.Id ?? null,
        numero_folha: numeroFolha,
        employee_name: String(emp.Nome ?? ""),
        original_email: originalEmail,
        current_email: currentEmail,
        status,
        employee_payload: emp,
        last_synced_at: now,
      };
    });

    // Upsert em batches
    const batchSize = 200;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error: upErr } = await admin
        .from("public_link_employees")
        .upsert(batch, { onConflict: "owner_user_id,bank_id,numero_folha" });
      if (upErr) throw upErr;
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, total: upserted, syncedAt: now }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("sync-bank-employees error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
