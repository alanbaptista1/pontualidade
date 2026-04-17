import type { Database } from "@/integrations/supabase/types";

export type ReportExecution = Database["public"]["Tables"]["report_executions"]["Row"];
export type ReportSchedule = Database["public"]["Tables"]["report_schedules"]["Row"];
