Fix Fehlende Artikel Synchronisation

- Fehlende Artikel werden beim Öffnen der Liste immer neu aus Supabase geladen.
- Lokale Alt-Einträge vom Handy werden automatisch nach Supabase synchronisiert.
- Die Liste aktualisiert sich in der Ansicht alle 5 Sekunden.
- Wenn Supabase die Tabelle nicht lesen/speichern kann, erscheint jetzt eine klare Fehlermeldung statt still nur lokal zu speichern.

Wichtig: Falls eine Meldung erscheint, dass fehlende Artikel zentral noch nicht eingerichtet sind, FINAL_SQL_FEHLENDE_ARTIKEL.sql einmal im Supabase SQL Editor ausführen.
