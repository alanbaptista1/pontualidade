import { supabase } from "@/integrations/supabase/client";
import type {
  SecullumBank,
  SecullumFuncionario,
  SecullumBatida,
  SecullumHorario,
} from "@/types/secullum";

const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];
const horarioRequestCache = new Map<string, Promise<SecullumHorario[]>>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    RETRYABLE_STATUS.some((status) => normalized.includes(`${status}`))
  );
}

async function callProxy(action: string, payload: Record<string, unknown>, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const { data, error } = await supabase.functions.invoke("secullum-proxy", {
      body: { action, payload },
    });

    if (!error && !data?.error) {
      return data;
    }

    lastError = new Error(error?.message || data?.error || "Erro na comunicação");
    if (attempt === maxRetries - 1 || !isRetryableError(lastError.message)) {
      throw lastError;
    }

    await wait(400 * (attempt + 1));
  }

  throw lastError ?? new Error("Erro na comunicação");
}

export async function login(username: string, password: string): Promise<string> {
  const data = await callProxy("login", { username, password }, 1);
  return data.access_token;
}

export async function listBanks(token: string): Promise<SecullumBank[]> {
  return callProxy("list-banks", { token });
}

export async function listFuncionarios(
  token: string,
  bankId: number
): Promise<SecullumFuncionario[]> {
  return callProxy("api-request", {
    token,
    bankId,
    endpoint: "Funcionarios",
  });
}

export async function listBatidas(
  token: string,
  bankId: number,
  dataInicio: string,
  dataFim: string,
  funcionarioPis?: string,
  funcionarioCpf?: string
): Promise<SecullumBatida[]> {
  let endpoint = `Batidas?dataInicio=${dataInicio}&dataFim=${dataFim}`;
  if (funcionarioPis) endpoint += `&funcionarioPis=${funcionarioPis}`;
  if (funcionarioCpf) endpoint += `&funcionarioCpf=${funcionarioCpf}`;

  return callProxy("api-request", { token, bankId, endpoint });
}

export async function getHorario(
  token: string,
  bankId: number,
  numero: number
): Promise<SecullumHorario[]> {
  const cacheKey = `${bankId}:${numero}`;
  const cached = horarioRequestCache.get(cacheKey);
  if (cached) return cached;

  const request = callProxy("api-request", {
    token,
    bankId,
    endpoint: `Horarios?numero=${numero}`,
  }).then((result) => result as SecullumHorario[]);

  horarioRequestCache.set(cacheKey, request);
  return request;
}
