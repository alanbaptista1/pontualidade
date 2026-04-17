-- Enum for schedule period types
CREATE TYPE public.schedule_period_type AS ENUM (
  'last_7_days',
  'last_30_days',
  'yesterday',
  'current_month_until_yesterday',
  'previous_month',
  'last_week',
  'custom_range'
);

-- Enum for execution status
CREATE TYPE public.execution_status AS ENUM (
  'pending',
  'running',
  'success',
  'error'
);

-- Table: report_schedules
CREATE TABLE public.report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  period_type public.schedule_period_type NOT NULL,
  custom_start_date DATE,
  custom_end_date DATE,
  tolerance_minutes INTEGER NOT NULL DEFAULT 0,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON public.report_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON public.report_schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON public.report_schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON public.report_schedules FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_report_schedules_user_id ON public.report_schedules(user_id);
CREATE INDEX idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE is_active = true;

-- Table: report_executions
CREATE TABLE public.report_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.report_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status public.execution_status NOT NULL DEFAULT 'pending',
  pdf_path TEXT,
  pdf_size_bytes BIGINT,
  period_start DATE,
  period_end DATE,
  total_records INTEGER,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions"
  ON public.report_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own executions"
  ON public.report_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own executions"
  ON public.report_executions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_report_executions_schedule_id ON public.report_executions(schedule_id);
CREATE INDEX idx_report_executions_user_id ON public.report_executions(user_id);
CREATE INDEX idx_report_executions_created_at ON public.report_executions(created_at DESC);