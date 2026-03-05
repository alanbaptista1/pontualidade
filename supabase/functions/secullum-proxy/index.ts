import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTH_BASE = "https://autenticador.secullum.com.br";
const API_BASE = "https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    // ACTION: login
    if (action === "login") {
      const { username, password } = payload;
      const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&client_id=3`;

      const res = await fetch(`${AUTH_BASE}/Token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error_description || "Falha na autenticação" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: list-banks
    if (action === "list-banks") {
      const { token } = payload;
      const res = await fetch(`${AUTH_BASE}/ContasSecullumExterno/ListarBancos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: api-request (generic proxy for Secullum API)
    if (action === "api-request") {
      const { token, bankId, endpoint, method = "GET", body: reqBody } = payload;

      const fetchOptions: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          secullumidbancoselecionado: String(bankId),
          "Content-Type": "application/json",
        },
      };

      if (reqBody && method !== "GET") {
        fetchOptions.body = JSON.stringify(reqBody);
      }

      const url = `${API_BASE}/${endpoint}`;
      const res = await fetch(url, fetchOptions);

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
