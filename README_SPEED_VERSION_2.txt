MHD Kontrolle - Speed Version 2

Geändert:
- Start lädt nicht mehr alle großen Tabellen komplett.
- Übersicht lädt zuerst nur MHD-Artikel bis 30 Tage in die Zukunft.
- Mitarbeiter sehen dadurch nur wichtige/bald ablaufende Artikel.
- Chef/Stationsleitung hat in der Artikelliste den Button "Alle MHD laden".
- Abschriften, Kontrollen, fehlende Artikel und Stammdaten werden erst geladen, wenn der Tab geöffnet wird.
- Nach Speichern/Löschen/Bearbeiten wird nicht mehr überall die komplette App neu geladen.
- Mengenfeld bleibt beim Erfassen leer.
- Formular wird nach erfolgreichem Speichern wieder leer gemacht.
- Vibration/Signalton bei erfolgreichen Aktionen bleibt enthalten.
- Fehler mit interner localItems-Funktion wurde durch setItems ersetzt.

Optional aber empfohlen:
- SQL_SPEED_INDEXE.sql im Supabase SQL Editor ausführen. Das löscht keine Daten und beschleunigt Abfragen.
