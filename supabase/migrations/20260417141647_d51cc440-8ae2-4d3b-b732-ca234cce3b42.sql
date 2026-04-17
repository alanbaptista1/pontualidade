-- Add filter columns to report_schedules
ALTER TABLE public.report_schedules
  ADD COLUMN IF NOT EXISTS department_filter text,
  ADD COLUMN IF NOT EXISTS only_late boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.report_schedules.department_filter IS 'Optional department name to filter records (NULL = all departments)';
COMMENT ON COLUMN public.report_schedules.only_late IS 'If true, only records with delay > tolerance_minutes are included in the PDF';