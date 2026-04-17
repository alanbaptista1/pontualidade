ALTER TABLE public.report_executions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_executions;