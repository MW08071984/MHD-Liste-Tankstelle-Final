# MHD Kontrolle Final DB-kompatibel

Diese Version speichert Abschriften sowohl in `artikel` als auch in `name`.
Dadurch funktioniert sie mit deiner bestehenden alten Supabase Tabelle.

Wichtig:
1. SUPABASE_FIX_FINAL.sql im Supabase SQL Editor ausführen.
2. ZIP-Inhalt in GitHub hochladen.
3. Vercel redeploy.


Update Dienstplan:
- Tab "Dienstplan" hinzugefügt
- Mai 2026 und Juni 2026 sind fest enthalten
- Pläne sind zoombar/scrollbar und als Bild groß öffnbar

Update Online Status:
- Neuer Tab "Mitarbeiter" für Chef/Stationsleitung/Michael
- Online / zuletzt aktiv automatisch
- Statistik-Karten sind klickbar und öffnen die Artikelliste
- SUPABASE_FIX_FINAL.sql einmal ausführen, damit online_status Tabelle angelegt wird

Update komplette Einstellungen:
- Tab Artikel öffnet die Artikelliste
- Statistik-Karten öffnen Artikel
- Tab Bilder erlaubt Bildverwaltung direkt in der App
- Dienstpläne können durch Berechtigte direkt ersetzt werden
- Tab Einstellungen erklärt Admin-Funktionen
- app_settings Tabelle wird benötigt; SUPABASE_FIX_FINAL.sql einmal ausführen

Update:
- Chris und andere Mitarbeiter bekommen klare Erfolgsrückmeldung bei Backwaren-Abschriften.
- Backwaren-Menge wird nach Speichern geleert.
- Abschriften können bearbeitet/gelöscht werden: Chef/Stationsleitung alle, Mitarbeiter eigene.
- Chef/Stationsleitung/Michael können Artikel vollständig bearbeiten: Artikelnummer, Name, Kategorie, MHD, Menge, Barcode, Bild.
- Bilder per Upload/Screenshot und Anzeige überall.
- SUPABASE_FIX_FINAL.sql einmal ausführen.
