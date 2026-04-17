---
name: Scheduled Reports
description: Schedule CRUD with cron, period helpers, executions history, email notifications, report filters and WhatsApp recipients list
type: feature
---

# Scheduled Reports

## Tables
- `report_schedules`: agendamento (bank, period_type, custom dates, tolerance_minutes, cron_expression, is_active, notify_email, notification_email, **department_filter**, **only_late**, **whatsapp_recipients (jsonb [{name, phone}])**, last_run_at, next_run_at)
- `report_executions`: histórico (status, started/finished_at, pdf_path, retry_count, error_message)

## Filters (mirror ReportPage)
- **department_filter** (text, nullable): if set, only records whose `departamento` exactly matches are included.
- **only_late** (bool): when true, only records with `minutosAtraso > tolerance_minutes` are included.
- Lateness aligned with frontend: `atrasado = atraso > 0`. Tolerance is filter, not definition.

## WhatsApp Recipients
- `whatsapp_recipients`: jsonb array of `{name, phone}` stored on `report_schedules`. Dynamic list managed in `ScheduleFormDialog` (Add/Remove). Storage only — sending integration TBD.

## Edge functions
- `scheduler-tick`: cron `*/5 * * * *`, dispatches due schedules + retries.
- `generate-scheduled-report`: end-to-end (login Secullum → fetch funcionarios/horarios/batidas → compute lateness → apply filters → build PDF → upload → notify).
- `send-execution-notification`: Resend email with 7-day signed URL (plain link, not button).

## UI download UX
- Email: plain `<a>` showing the full signed URL (word-break:break-all).
- App `ExecutionsHistory`: "Copiar link" button generates a 7-day signed URL and copies to clipboard (no direct download button).
