Update Push-Abfrage einmalig nach Login

Geändert:
- Beim nächsten manuellen Login fragt die App pro Mitarbeiter/Gerät genau 1x nach Benachrichtigungen.
- Wenn erlaubt, erscheint eine Test-Benachrichtigung "MHD Kontrolle aktiviert".
- Die automatische Abfrage beim MHD-Alarm wurde entfernt, damit die Berechtigung nicht dauernd neu gefragt wird.
- Der App-Alarm beim Öffnen bleibt unverändert: 15 Sekunden Ton, Vibration soweit Android/Browser erlaubt.

Hinweis:
Echte Push-Benachrichtigungen im Hintergrund brauchen zusätzlich Server/Push-Abo. Diese Version aktiviert die Browser-/PWA-Berechtigung und lokale Benachrichtigungen der geöffneten App.
