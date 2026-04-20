import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTH_BASE = "https://autenticador.secullum.com.br";
const API_BASE = "https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getSecullumToken(username: string, password: string, clientId: string) {
  const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&client_id=${clientId}`;
  const res = await fetch(`${AUTH_BASE}/Token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Falha de autenticação Secullum");
  return data.access_token as string;
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

    // APPROVE: enviar à Secullum
    const { data: creds, error: credsErr } = await admin
      .from("secullum_credentials")
      .select("secullum_username, secullum_password, client_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (credsErr) throw credsErr;
    if (!creds) throw new Error("Credenciais Secullum não configuradas");

    const token = await getSecullumToken(creds.secullum_username, creds.secullum_password, creds.client_id);

    const emp = request.employee_payload as Record<string, unknown>;

    // Mantém TODOS os dados originais do funcionário, alterando apenas o Email
    // e garantindo DuplicarDemitido = false
    const payload: Record<string, unknown> = {
      ...emp,
      HorarioNumero:
        (emp.Horario as { Numero?: unknown } | undefined)?.Numero ?? emp.HorarioNumero,
      DepartamentoDescricao:
        (emp.Departamento as { Descricao?: unknown } | undefined)?.Descricao ??
        emp.DepartamentoDescricao,
      FuncaoDescricao:
        (emp.Funcao as { Descricao?: unknown } | undefined)?.Descricao ?? emp.FuncaoDescricao,
      DuplicarDemitido: false,
      Email: request.requested_email,
    };

    const url = `${API_BASE}/Funcionarios/`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        secullumidbancoselecionado: String(request.bank_id),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      await admin
        .from("email_update_requests")
        .update({
          secullum_response: { status: res.status, body: parsed },
        })
        .eq("id", requestId);

      const msg = typeof parsed === "string" ? parsed : (parsed as any)?.Message ?? `Erro HTTP ${res.status}`;
      throw new Error(`Secullum recusou: ${msg}`);
    }

    await admin
      .from("email_update_requests")
      .update({
        status: "approved",
        secullum_response: { status: res.status, body: parsed },
        processed_at: new Date().toISOString(),
        processed_by: userId,
      })
      .eq("id", requestId);

    return new Response(JSON.stringify({ success: true, secullum: parsed }), {
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
