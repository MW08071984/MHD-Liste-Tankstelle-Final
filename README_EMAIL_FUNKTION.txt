MHD KONTROLLE – E-MAIL FUNKTION

In dieser ZIP ist die Supabase Edge Function enthalten:

supabase/functions/daily-mhd-report/index.ts

Was die Mail enthält:
- Artikel, die morgen ablaufen
- Artikel, die heute ablaufen
- bereits abgelaufene Artikel
- Abschriften vom Vortag
- Kontrollen vom Vortag

Empfänger:
- wird über Supabase Secret REPORT_TO_EMAIL gesetzt
- bei dir: shell5682@gmx.de

Bereits erledigt bei dir:
- RESEND_API_KEY ist in Supabase Secrets angelegt
- REPORT_TO_EMAIL ist in Supabase Secrets angelegt

Noch zu erledigen in Supabase:
1. Edge Functions öffnen
2. Function daily-mhd-report erstellen
3. Inhalt aus supabase/functions/daily-mhd-report/index.ts einfügen
4. Function deployen
5. Test ausführen
6. Scheduler/Cron täglich 07:00 Uhr Europe/Berlin auf daily-mhd-report setzen

Wichtig:
Diese ZIP ändert nichts an Artikelliste, Scanner, Login oder Speichern.
