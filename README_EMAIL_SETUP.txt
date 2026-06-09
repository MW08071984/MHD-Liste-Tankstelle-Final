INSTALLATION

1. ZIP in Vercel hochladen.
2. FINAL_SQL_EMAIL_ARTIKELSUCHE.sql in Supabase SQL Editor ausführen.
3. Für tägliche E-Mail:
   - Resend API Key erstellen.
   - Supabase Edge Function daily-mhd-report deployen.
   - Secret RESEND_API_KEY setzen.
   - Optional REPORT_FROM_EMAIL setzen.
   - Supabase Cron/Scheduled Function täglich 07:00 Uhr Europe/Berlin auf daily-mhd-report setzen.

Empfänger ist fest eingebaut:
shell5682@gmx.de

Hinweis:
Automatische E-Mail um 07:00 Uhr funktioniert nur mit Supabase Edge Function + Resend/Cron.
Die App allein kann keine E-Mail senden, wenn niemand die App geöffnet hat.
