MHD KONTROLLE - SPEED VERSION 3

Änderung gegenüber Version 2:
- Chef/Stationsleitung: Wenn die komplette MHD-Liste einmal über "Alle MHD laden" geladen wurde, bleibt sie im Speicher.
- Beim Wechsel zwischen Tabs wird die komplette Liste nicht erneut aus Supabase geladen.
- Bestehende MHD-Daten werden nicht verändert oder gelöscht.
- Beim Rückgängig-machen einer Abschrift wird nicht mehr die komplette MHD-Liste neu geladen, sondern die Anzeige lokal aktualisiert.
- Kleiner Fehler behoben: Beim Löschen eines MHD-Eintrags konnte eine interne Variable fehlen.

Build-Test:
- npm run build erfolgreich.

Wichtig:
- Diese Version ändert nur den App-Code, nicht die Datenbank-Inhalte.
- Die SQL-Dateien bleiben unverändert als Hilfsdateien in der ZIP.
