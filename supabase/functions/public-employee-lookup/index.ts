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
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Secullum Token error:", res.status, text.slice(0, 300));
    throw new Error(`Falha de autenticação Secullum (HTTP ${res.status})`);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Secullum Token returned non-JSON:", text.slice(0, 300));
    throw new Error("Resposta inválida do autenticador Secullum");
  }
  if (!data?.access_token) throw new Error("Token Secullum ausente na resposta");
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ownerUserId, numeroFolha, requestedEmail } = await req.json();

    if (!ownerUserId) throw new Error("Link inválido");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Carrega config do link público
    const { data: settings, error: settingsErr } = await admin
      .from("public_link_settings")
      .select("bank_id, bank_name, is_enabled")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    if (!settings || !settings.is_enabled) {
      return new Response(JSON.stringify({ error: "Link público não está ativo" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Carrega credenciais Secullum do dono
    const { data: creds, error: credsErr } = await admin
      .from("secullum_credentials")
      .select("secullum_username, secullum_password, client_id")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (credsErr) throw credsErr;
    if (!creds) {
      return new Response(JSON.stringify({ error: "Credenciais Secullum não configuradas pelo administrador" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getSecullumToken(creds.secullum_username, creds.secullum_password, creds.client_id || "7");

    // Busca lista de funcionários
    const empRes = await fetch(`${API_BASE}/Funcionarios`, {
      headers: {
        Authorization: `Bearer ${token}`,
        secullumidbancoselecionado: String(settings.bank_id),
        Accept: "application/json",
      },
    });
    const empText = await empRes.text();
    if (!empRes.ok) {
      console.error("Secullum Funcionarios error:", empRes.status, empText.slice(0, 500));
      throw new Error(`Falha ao buscar funcionários (HTTP ${empRes.status})`);
    }
    let allEmployees: any[];
    try {
      allEmployees = JSON.parse(empText);
    } catch (e) {
      console.error("Failed to parse Funcionarios JSON. First 500 chars:", empText.slice(0, 500));
      throw new Error("Resposta inválida da Secullum ao listar funcionários");
    }
    if (!Array.isArray(allEmployees)) {
      throw new Error("Resposta inesperada da Secullum (não é lista)");
    }

    const folhaSearch = String(numeroFolha ?? "").trim();
    if (!folhaSearch) throw new Error("Informe o código (Número da Folha)");

    const employee = (allEmployees as any[]).find(
      (e) => String(e.NumeroFolha ?? "").trim() === folhaSearch && !e.Demissao
    );

    if (!employee) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: lookup -> retorna apenas nome
    if (action === "lookup") {
      return new Response(
        JSON.stringify({
          name: employee.Nome,
          numeroFolha: employee.NumeroFolha,
          currentEmail: employee.Email ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: submit -> cria solicitação
    if (action === "submit") {
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

      if (insErr) throw insErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
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
