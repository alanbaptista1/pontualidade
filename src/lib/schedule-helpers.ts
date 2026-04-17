import type { Database } from "@/integrations/supabase/types";

export type SchedulePeriodType = Database["public"]["Enums"]["schedule_period_type"];
export type ExecutionStatus = Database["public"]["Enums"]["execution_status"];

export const PERIOD_TYPE_LABELS: Record<SchedulePeriodType, string> = {
  last_7_days: "Últimos 7 dias",
  last_30_days: "Últimos 30 dias",
  yesterday: "Ontem",
  current_month_until_yesterday: "Mês atual (até ontem)",
  previous_month: "Mês anterior completo",
  last_week: "Semana passada",
  custom_range: "Intervalo personalizado",
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  pending: "Pendente",
  running: "Em execução",
  success: "Sucesso",
  error: "Erro",
};

export interface CronPreset {
  label: string;
  expression: string;
  description: string;
}

/**
 * Build a cron expression for daily execution at a specific time.
 * Format: "minute hour * * *"
 */
export function dailyCronAt(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

/**
 * Try to parse a daily cron back into hour/minute. Returns null if not a simple daily cron.
 */
export function parseDailyCron(expr: string): { hour: number; minute: number } | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*" || dow !== "*") return null;
  const minute = Number(m);
  const hour = Number(h);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) return null;
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  return { hour, minute };
}

/**
 * Validate a cron expression has 5 space-separated fields with allowed chars.
 * This is a lightweight syntactic check — full validation happens server-side.
 */
export function isValidCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const allowed = /^[0-9*/,\-]+$/;
  return parts.every((p) => allowed.test(p));
}

/**
 * Human-readable summary of a cron expression.
 */
export function describeCron(expr: string): string {
  const daily = parseDailyCron(expr);
  if (daily) {
    const hh = String(daily.hour).padStart(2, "0");
    const mm = String(daily.minute).padStart(2, "0");
    return `Diariamente às ${hh}:${mm}`;
  }
  return `Cron customizado: ${expr}`;
}

/**
 * Resolve a relative period type into actual start/end dates (DD/MM/YYYY format used by Secullum).
 */
export function resolvePeriod(
  periodType: SchedulePeriodType,
  custom?: { start?: string | null; end?: string | null },
): { start: Date; end: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  switch (periodType) {
    case "yesterday":
      return { start: yesterday, end: yesterday };
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      return { start, end: yesterday };
    }
    case "last_30_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { start, end: yesterday };
    }
    case "current_month_until_yesterday": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: yesterday };
    }
    case "previous_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    }
    case "last_week": {
      // Monday of last week to Sunday of last week
      const dow = today.getDay() || 7; // 1..7 (Mon..Sun)
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dow);
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);
      return { start: lastMonday, end: lastSunday };
    }
    case "custom_range": {
      if (!custom?.start || !custom?.end) return null;
      return { start: new Date(custom.start), end: new Date(custom.end) };
    }
  }
}
