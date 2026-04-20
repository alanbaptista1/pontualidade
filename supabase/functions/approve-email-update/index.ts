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

function buildSecullumPayload(employee: Record<string, unknown>, requestedEmail: string) {
  const horario = employee.Horario as { Numero?: unknown } | undefined;
  const departamento = employee.Departamento as { Descricao?: unknown } | undefined;
  const funcao = employee.Funcao as { Descricao?: unknown } | undefined;
  const empresa = employee.Empresa as { Documento?: unknown } | undefined;

  return {
    Nome: employee.Nome ?? null,
    NumeroFolha: employee.NumeroFolha ?? null,
    NumeroIdentificador: employee.NumeroIdentificador ?? null,
    Cpf: employee.Cpf ?? null,
    Admissao: employee.Admissao ?? null,
    EmpresaCnpjCpf: empresa?.Documento ?? employee.EmpresaCnpjCpf ?? null,
    HorarioNumero: horario?.Numero ?? employee.HorarioNumero ?? null,
    DepartamentoDescricao: departamento?.Descricao ?? employee.DepartamentoDescricao ?? null,
    FuncaoDescricao: funcao?.Descricao ?? employee.FuncaoDescricao ?? null,
    DuplicarDemitido: false,
    Email: requestedEmail,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { requestId, action, rejectionReason } = await req.json();
    if (!requestId || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: request, error: reqErr } = await admin
      .from("email_update_requests")
      .select("*")
      .eq("id", requestId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (reqErr) throw reqErr;
    if (!request) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (request.status !== "pending") {
      return new Response(JSON.stringify({ error: "Solicitação já processada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      await admin
        .from("email_update_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason ?? null,
          processed_at: new Date().toISOString(),
          processed_by: userId,
        })
        .eq("id", requestId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creds, error: credsErr } = await admin
      .from("secullum_credentials")
      .select("secullum_username, secullum_password")
      .eq("user_id", userId)
      .maybeSingle();
    if (credsErr) throw credsErr;
    if (!creds) throw new Error("Credenciais Secullum não configuradas");

    const loginResponse = (await callSecullumProxy({
      action: "login",
      payload: {
        username: creds.secullum_username,
        password: creds.secullum_password,
      },
    })) as { access_token?: string };

    if (!loginResponse?.access_token) {
      throw new Error("Não foi possível obter token da Secullum");
    }

    const employee = request.employee_payload as Record<string, unknown>;
    const payload = buildSecullumPayload(employee, request.requested_email);

    console.log("approve-email-update payload:", JSON.stringify({
      endpoint: "Funcionarios",
      method: "POST",
      bankId: String(request.bank_id),
      body: payload,
    }));

    const secullumResponse = await callSecullumProxy({
      action: "api-request",
      payload: {
        token: loginResponse.access_token,
        bankId: String(request.bank_id),
        endpoint: "Funcionarios",
        method: "POST",
        body: payload,
      },
    });

    const nowIso = new Date().toISOString();

    await admin
      .from("email_update_requests")
      .update({
        status: "approved",
        secullum_response: secullumResponse,
        processed_at: nowIso,
        processed_by: userId,
      })
      .eq("id", requestId);

    // Marca o funcionário como atualizado via link na tabela de rastreamento
    await admin
      .from("public_link_employees")
      .update({
        current_email: request.requested_email,
        status: "updated_via_link",
        email_updated_at: nowIso,
      })
      .eq("owner_user_id", userId)
      .eq("bank_id", String(request.bank_id))
      .eq("numero_folha", String(request.numero_folha));

    return new Response(JSON.stringify({ success: true, secullum: secullumResponse, sentPayload: payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("approve-email-update error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});