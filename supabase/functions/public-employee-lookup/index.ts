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
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedBody: {
      action?: string;
      ownerUserId?: string;
      numeroFolha?: string;
      requestedEmail?: string;
    };

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ownerUserId, numeroFolha, requestedEmail } = parsedBody;

    if (!ownerUserId) {
      return new Response(JSON.stringify({ error: "Link inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "lookup" && action !== "submit") {
      return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folhaSearch = String(numeroFolha ?? "").trim();
    if (!folhaSearch) {
      return new Response(JSON.stringify({ error: "Informe o código (Número da Folha)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: settings, error: settingsErr } = await admin
      .from("public_link_settings")
      .select("bank_id, bank_name, is_enabled")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (settingsErr) {
      throw settingsErr;
    }

    if (!settings || !settings.is_enabled) {
      return new Response(JSON.stringify({ error: "Link público não está ativo" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creds, error: credsErr } = await admin
      .from("secullum_credentials")
      .select("secullum_username, secullum_password")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (credsErr) {
      throw credsErr;
    }

    if (!creds) {
      return new Response(JSON.stringify({ error: "Credenciais Secullum não configuradas pelo administrador" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginResponse = await callSecullumProxy({
      action: "login",
      payload: {
        username: creds.secullum_username,
        password: creds.secullum_password,
      },
    }) as { access_token?: string };

    if (!loginResponse?.access_token) {
      throw new Error("Não foi possível obter token da Secullum");
    }

    const allEmployees = await callSecullumProxy({
      action: "api-request",
      payload: {
        token: loginResponse.access_token,
        bankId: settings.bank_id,
        endpoint: "Funcionarios",
        method: "GET",
      },
    });

    if (!Array.isArray(allEmployees)) {
      throw new Error("Resposta inesperada da Secullum ao listar funcionários");
    }

    const employee = allEmployees.find(
      (item: any) => String(item.NumeroFolha ?? "").trim() === folhaSearch && !item.Demissao
    );

    if (!employee) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "lookup") {
      return new Response(
        JSON.stringify({
          name: employee.Nome,
          numeroFolha: employee.NumeroFolha,
          currentEmail: employee.Email ?? null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const email = String(requestedEmail ?? "").trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailValid) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insErr } = await admin.from("email_update_requests").insert({
      owner_user_id: ownerUserId,
      bank_id: String(settings.bank_id),
      bank_name: settings.bank_name,
      numero_folha: String(employee.NumeroFolha),
      employee_name: employee.Nome,
      employee_secullum_id: employee.Id ?? null,
      employee_payload: employee,
      current_email: employee.Email ?? null,
      requested_email: email,
      status: "pending",
    });

    if (insErr) {
      throw insErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("public-employee-lookup error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
