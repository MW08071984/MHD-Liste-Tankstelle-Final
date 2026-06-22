MHD_KONTROLLE_FINALE_VERSION

Basis: MHD_KONTROLLE_SPEED_VERSION_7_MENGE_NUR_KONTROLLE(1).zip

Eingebaut:
- MHD-Feld: manuelle Eingabe TT.MM.JJJJ oder Kalenderauswahl.
- Prüfung: Bitte MHD eingeben.
- Prüfung: MHD liegt bereits in der Vergangenheit.
- Suchfeld in Alle MHD für Chef/Stationsleitung: Name, Artikelnummer, EAN, Groß-/Kleinschreibung egal.
- Suchfeld in Artikelliste für Chef/Stationsleitung.
- Backwaren Tagesende bleibt Hauptfunktion.
- Backwaren Sonderabschrift: nur MHD oder Bruch.
- Backwarenliste kann durch Chef/Stationsleitung erweitert werden.
- Abschriften zeigen die Gründe getrennt: Backwaren Tagesende, Backwaren MHD, Backwaren Bruch sowie normale Gründe MHD, Bruch, Eigenbedarf.
- Beim Öffnen der App prüft die App auf Artikel mit MHD heute und bereits abgelaufene Artikel.
- Bei Treffer: Meldung, lange Vibration und kurzer Alarmton, soweit das Handy/der Browser das erlaubt.

Nicht verändert:
- Bestehende Supabase-Daten werden nicht gelöscht.
- Keine DROP/DELETE-SQL für Tabellen enthalten.
- Benutzer, Rollen, Scanner, Bilder und gespeicherte Einträge bleiben erhalten.

Hinweis:
Vibration/Ton beim App-Öffnen hängt von Android/Browser/PWA-Berechtigungen ab. Am zuverlässigsten funktioniert es, wenn Benachrichtigungen erlaubt sind und der Ton am Handy eingeschaltet ist.
