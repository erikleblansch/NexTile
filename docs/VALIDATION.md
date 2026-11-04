# Validatie — NexTile 0.1.0

Datum: 4 november 2026. GNOME Shell / Mutter **48.7** op de doelcomputer.

| Controle | Resultaat |
| --- | --- |
| Pure indelingslogica | 1.558 assertions geslaagd met GJS. |
| GSettings-schema | `glib-compile-schemas --strict --dry-run` geslaagd. |
| GNOME X11 in Xephyr | 36 runtime-assertions geslaagd met echte GTK 3-vensters. |
| GNOME Wayland, twee virtuele schermen | 39 runtime-assertions geslaagd met echte GTK 3-vensters. |
| Shell-log | Geen `JS ERROR` of `NexTile:`-fout in beide finale runs. |
| ZIP | Gebouwd uit een expliciete bestandslijst; testdriver uitgesloten. |

De runtime-controles testen laden, grootste tegel halveren, stabiele andere tegels, sluiten, minimaliseren, fullscreen, handmatig maximaliseren, zwevend maken, vensterafstand, splitsrichting, werkruimtewissels, verwisselen via de drop-geometrie, het openen van Quick Settings, focusbehoud en de zweefactie in dat menu. Ook herstel bij uitschakelen, het verwijderen van signalen/timers en opnieuw inschakelen zijn gecontroleerd. De Wayland-run controleert daarnaast verplaatsing tussen twee monitoren en de gedeelde indeling op het tweede scherm.

De volledige assertionlijsten staan in [runtime-x11.txt](runtime-x11.txt) en [runtime-wayland.txt](runtime-wayland.txt). De [menuafbeelding](quick-settings.png) is een echte opname uit de geïsoleerde X11-test.

## Grenzen

- De bestaande ingelogde desktop is niet herstart. De lokale installatie is voorbereid voor de volgende aanmelding; bediening in die gebruikerssessie is nog niet bevestigd.
- Fysiek aansluiten/loskoppelen van schermen, gemengde HiDPI-schaling, vergrendelen/ontgrendelen en langdurig dagelijks gebruik zijn niet afzonderlijk runtime-getest.
- Het verwisselen is getest door de drop-geometrie aan te roepen; geen geautomatiseerde fysieke muissleepactie.
- Minimumafmetingen zijn gecontroleerd met GTK 3. Gedrag van afzonderlijke andere apps blijft afhankelijk van hun vensterconstraints.
- Geen aparte CPU-/geheugenbenchmark. De implementatie gebruikt signalen en begrensde eenmalige timers, zonder periodieke polling.
- GitHub Actions controleert geometrie, schema en packaging. Het draait geen GNOME-compositorsessie.

Reproduceren: zie de commando's in [README.md](../README.md). De testdriver wordt alleen in de tijdelijke testextensiemap geïnstalleerd.
