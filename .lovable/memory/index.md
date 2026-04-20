# Project Memory

## Core
- Secullum API calls via Supabase Edge Function proxy to bypass CORS and propagate errors.
- Secullum reqs MUST include Bearer Token and 'secullumidbancoselecionado' header.
- Secullum limits: max 4 concurrent requests, cache schedules, auto-retry.
- Lateness logic: Compare first punch (Entrada1) with scheduled time (Entrada1 in 'Dias', 0=Mon).
- Extract friendly error messages from proxy responses using keyword matching (e.g., '401', 'senha').
- Persist report state/filters globally; save login email in localStorage.
- Layout uses top summary cards and global nav (Report vs Analytics vs Agendamentos vs Conta). Export to CSV/PDF.
- App auth: Supabase email/password. Secullum credentials stored per-user in secullum_credentials table.
- Email notifications use Resend via Lovable connector gateway (no own domain). FROM_ADDRESS=onboarding@resend.dev. Without verified domain, sends only to Resend account owner email.

## Memories
- [Lateness Report Logic](mem://features/lateness-report) — How lateness is calculated and displayed
- [Report Filters](mem://features/report-filters) — Supported filters like tolerance, department, CPF
- [Secullum API](mem://integrations/secullum-api) — Auth flow and required headers
- [API Proxy](mem://infrastructure/api-proxy) — Supabase Edge Functions proxy details
- [Analytics Dashboard](mem://features/analytics-dashboard) — Ranking, trends, and recurrence analytics
- [Layout Structure](mem://style/layout-structure) — Summary cards and global navigation
- [Login Persistence](mem://features/login-persistence) — Email localStorage autocomplete
- [State Persistence](mem://features/state-persistence) — Global persistence of report data and filters
- [API Optimization](mem://integrations/secullum-api-optimization) — Rate limits, caching, and retry logic
- [Error Messaging](mem://ui/error-messaging) — Friendly error parsing and keyword detection
- [Monetization](mem://features/monetization) — Planned payment provider (Paddle)
- [Scheduled Reports](mem://features/scheduled-reports) — Phase 2 schedule CRUD: tables, dialog, helpers
- [Employees Tracking](mem://features/employees-tracking) — Sync employees per bank and track email update status
- [Email Notifications](mem://features/email-notifications) — Resend connector, success/failure templates, per-schedule recipient
