-- MHD Kontrolle: E-Mail Function / Cron Vorbereitung

-- Diese Datei ändert keine Artikeldaten.
-- Sie ist nur als Check/Notiz für die automatische E-Mail gedacht.

-- Benötigte Supabase Edge Function:
-- supabase/functions/daily-mhd-report/index.ts

-- Benötigte Secrets unter Edge Functions -> Secrets:
-- RESEND_API_KEY = re_...
-- REPORT_TO_EMAIL = shell5682@gmx.de
-- optional REPORT_FROM_EMAIL = MHD Kontrolle <deine-verifizierte-absenderadresse>

-- Zeitplan:
-- täglich 07:00 Uhr Europe/Berlin
-- Function: daily-mhd-report

-- Falls du pg_cron + pg_net nutzen möchtest, kann der Aufruf so aussehen.
-- Besser ist aber der Supabase Dashboard Scheduler, falls verfügbar.
-- Wichtig: <PROJECT_REF> ersetzen.

-- select cron.schedule(
--   'daily-mhd-report-0700',
--   '0 7 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.functions.supabase.co/daily-mhd-report',
--     headers := jsonb_build_object('Content-Type','application/json'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
