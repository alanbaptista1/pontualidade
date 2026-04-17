ALTER TABLE public.report_schedules
ADD COLUMN whatsapp_recipients jsonb NOT NULL DEFAULT '[]'::jsonb;