SETUP NACH DEM HOCHLADEN

1) Vercel
- Diese ZIP wie gewohnt hochladen/deployen.
- Danach auf dem Handy die Seite öffnen und 'Zum Startbildschirm hinzufügen'.
- Das neue MHD-App-Symbol erscheint automatisch.

2) Supabase SQL
- Datei FINAL_SQL_PWA_EMAIL_REMINDER.sql im Supabase SQL Editor ausführen.

3) E-Mail morgens 07:00 Uhr
- Bei resend.com API-Key erstellen.
- In Supabase unter Edge Functions / Secrets setzen:
  RESEND_API_KEY = re_xxxxx
- Optional:
  REPORT_FROM_EMAIL = MHD Kontrolle <deine-verifizierte-absenderadresse>
- Edge Function deployen:
  supabase functions deploy daily-mhd-report
- Cron/Scheduled Function täglich 07:00 Uhr Europe/Berlin:
  daily-mhd-report aufrufen.
- Empfänger ist fest: shell5682@gmx.de

4) MHD-Erinnerung
- Läuft in der App für eingeloggte Benutzer.
- Reminder für Artikel, die morgen ablaufen.
- Zeiten: 09:00 Uhr und 16:30 Uhr.
- Wegklicken = 10 Minuten Ruhe, danach kommt es wieder.
- Sobald Artikel abgeschrieben/kontrolliert ist, verschwindet er automatisch aus der Erinnerung.
- Damit Browser-Benachrichtigungen angezeigt werden, muss der Benutzer beim ersten Mal Benachrichtigungen erlauben.
