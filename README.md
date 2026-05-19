# MHD Kontrolle Final DB-kompatibel

Diese Version speichert Abschriften sowohl in `artikel` als auch in `name`.
Dadurch funktioniert sie mit deiner bestehenden alten Supabase Tabelle.

Wichtig:
1. SUPABASE_FIX_FINAL.sql im Supabase SQL Editor ausführen.
2. ZIP-Inhalt in GitHub hochladen.
3. Vercel redeploy.


Feinschliff:
- Menge bei Backwaren wird nach erfolgreicher Abschrift automatisch geleert.
- Artikelzeile blinkt grün und Button zeigt ✓ Fertig.
- Abschriften werden übersichtlich nach Datum gruppiert.


FINALER DB-FIX: SUPABASE_FIX_FINAL.sql ausführen. Dieser Fix ergänzt jetzt auch fehlende Spalten in mhd_artikel, z.B. artikelnummer.
