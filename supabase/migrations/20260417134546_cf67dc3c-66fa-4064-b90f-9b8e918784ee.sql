ALTER TABLE public.report_schedules
ADD COLUMN notification_email text;

COMMENT ON COLUMN public.report_schedules.notification_email IS 'Email to send notifications to when execution completes (success or failure). If null, falls back to user account email.';