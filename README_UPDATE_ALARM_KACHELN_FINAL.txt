UPDATE FINAL - Alarm + Kopf-Kacheln

Geändert ohne bestehende Funktionen/Daten zu löschen:

1. Kopf-Kacheln repariert
- Artikel öffnet die MHD-Artikelliste.
- Abgelaufen öffnet abgelaufene/heute fällige Artikel.
- Bald öffnet Artikel in 1-3 Tagen.
- Woche öffnet Artikel bis 7 Tage.
- Beim Klick wird automatisch nach oben gescrollt.
- Chef/Stationsleitung laden bei Klick die komplette MHD-Liste nach.

2. Alarm beim App-Öffnen
- Für alle Benutzer, sobald heute fällige oder abgelaufene Artikel vorhanden sind.
- Alarmton + Vibration läuft maximal 15 Sekunden.
- Antippen der grünen Warnmeldung stoppt den Alarm sofort.
- Hinweis: Android/Browser können Ton erst nach Nutzeraktion erlauben. Dann startet er spätestens nach Login/erstem Klick.

3. Text/Logik geprüft
- Heute fällige Artikel zählen bei Abgelaufen mit.
- Grammatik korrigiert: „in 1 Tag“ statt „in 1 Tagen“.

Prüfung:
- npm install erfolgreich
- npm run build erfolgreich
