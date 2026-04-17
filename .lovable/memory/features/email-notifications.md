---
name: email-notifications
description: Phase 4 — email notifications for scheduled report executions via Resend connector
type: feature
---
Email notifications for scheduled report executions.

**Provider:** Resend via Lovable connector gateway (`https://connector-gateway.lovable.dev/resend`).
**Secret:** `RESEND_API_KEY` (from connector). Auth header: `Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${RESEND_API_KEY}`.
**FROM:** `Pontualidade <onboarding@resend.dev>` (Resend default — without verified domain, only the Resend account owner can receive).

**Edge function:** `send-execution-notification` — receives `{ execution_id }`, loads execution+schedule, resolves recipient (`schedule.notification_email` || user account email via auth.admin.getUserById), generates 7-day signed URL for the PDF (success), and sends branded HTML.

**Triggers:**
- Success: from `generate-scheduled-report` after upload + status update.
- Failure: from `generate-scheduled-report` only when `retry_count >= 1` (after scheduler-tick retry, so we don't spam on transient errors).
- Both respect `schedule.notify_email` flag.

**Schema:** `report_schedules.notification_email TEXT NULL` — optional per-schedule recipient override.

**Templates:** Inline HTML in the edge function (success = blue header + download button; error = red header + error block). Whitelabel-friendly inline styles.
