Finaler Fix: Fehlende Artikel werden zentral in Supabase gespeichert und beim Öffnen der Liste neu geladen.

Wichtig:
- Die Tabelle public.fehlende_artikel muss in Supabase vorhanden sein.
- Falls nicht vorhanden, FINAL_SQL_FEHLENDE_ARTIKEL.sql einmal im Supabase SQL Editor ausführen.
- Lokale alte Meldungen werden beim Öffnen der fehlenden Artikel automatisch in Supabase übertragen, sofern möglich.
- Keine 5-Sekunden-Daueraktualisierung eingebaut.
