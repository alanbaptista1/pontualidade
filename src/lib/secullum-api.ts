import { supabase } from "@/integrations/supabase/client";
import type {
  SecullumBank,
  SecullumFuncionario,
  SecullumBatida,
  SecullumHorario,
} from "@/types/secullum";

async function callProxy(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("secullum-proxy", {
    body: { action, payload },
  });

  if (error) throw new Error(error.message || "Erro na comunicação");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function login(username: string, password: string): Promise<string> {
  const data = await callProxy("login", { username, password });
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
  return callProxy("api-request", {
    token,
    bankId,
    endpoint: `Horarios?numero=${numero}`,
  });
}
