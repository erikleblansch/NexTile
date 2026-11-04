# Validatie — NexTile 0.3.0

Datum: 4 november 2026. GNOME Shell / Mutter **48.7** op de doelcomputer.

| Controle | Resultaat |
| --- | --- |
| Pure indelingslogica | 1.558 assertions geslaagd met GJS. |
| Balkgeometrie en contrast | 11.451 assertions geslaagd: centrering, continue beweging, schaalfactoren, sRGB-helderheid, omschakelmarge en lokale kleurmetingen. |
| GSettings-schema | `glib-compile-schemas --strict --dry-run` geslaagd. |
| GNOME X11 in Xephyr | 82 runtime-assertions geslaagd met echte GTK 3-vensters. |
| GNOME Wayland, twee virtuele schermen | 85 runtime-assertions geslaagd met echte GTK 3-vensters. |
| Shell-log | Geen `JS ERROR`, GJS-critical, CSS-parsefout of NexTile-zoek-/contrastfout in beide finale runs, inclusief afsluiten van Shell. |
| ZIP | Gebouwd uit een expliciete bestandslijst; testdriver uitgesloten. |

De runtime-controles testen laden, grootste tegel halveren, stabiele andere tegels, sluiten, minimaliseren, fullscreen, handmatig maximaliseren, zwevend maken, vensterafstand, splitsrichting, werkruimtewissels, verwisselen via de drop-geometrie, het openen van Quick Settings, focusbehoud en de zweefactie in dat menu. Ook herstel bij uitschakelen, het verwijderen van signalen/timers en opnieuw inschakelen zijn gecontroleerd. De Wayland-run controleert daarnaast verplaatsing tussen twee monitoren en de gedeelde indeling op het tweede scherm.

De nieuwe balkcontroles verifiëren volledige transparantie, de klok links, de kalender, zwart/witcontrast op effen en gemengde achtergronden, compositorkleurwijzigingen zonder instellingenwijziging, kleurkeuze per werkruimteknop en stilstand zonder terugkerende timers. De genummerde knoppen zijn getest op aantallen toevoegen/verwijderen, klikken, tussenliggende animatieframes, centrering van de eerste/middelste/laatste actieve werkruimte, cirkel-/pilafmetingen en het openen van het overzicht. De aparte balkschakelaar en het terugzetten van de oorspronkelijke GNOME-balk zijn eveneens gecontroleerd.

De zoekcontroles sturen virtuele toetsenbord- en muisapparaten door Mutter: Super, direct typen, pijltjestoetsen, muiswiel, Enter, Escape en klikken buiten de zoekbalk. Twee tijdelijke desktopbestanden leveren echte GTK-testprogramma’s. Gecontroleerd zijn focusbehoud, zoeken via de native GNOME-provider, starten op de geselecteerde werkruimte, tussenliggende groeianimatieframes, herstel van de normale Super-toets en uitschakelen tijdens een vertraagde zoekopdracht. Enter tijdens een lopende zoekopdracht en het negeren van te laat ontvangen resultaten zijn ook getest. De reguliere tests sluiten Shell af met gesloten zoekbalk en controleren daarna het Shell-log.

De volledige assertionlijsten staan in [runtime-x11.txt](runtime-x11.txt) en [runtime-wayland.txt](runtime-wayland.txt). De [menuafbeelding](quick-settings.png), [bovenbalk](topbar.png) en [zoekbalk](search.png) zijn echte opnamen uit de geïsoleerde X11-test, met een synthetische achtergrond.

## Grenzen

- Een aanvullende proef die de geïsoleerde compositor beëindigt terwijl de zoekbalk toetsenbordfocus heeft, geeft bij het afsluiten GNOME/IBus-meldingen over al vernietigde invoerwidgets. De zoekbediening en het gewone uitschakelen tijdens een geopende zoekopdracht slagen. Deze aanvullende afsluitproef telt niet als geslaagde runtimecontrole.

- De gebruiker heeft 0.1.0 en 0.2.0 werkend bevestigd. De bestaande ingelogde desktop is voor deze update niet herstart. De lokale installatie van 0.3.0 is voorbereid voor de volgende aanmelding; deze nieuwe zoekmodus is in de gebruikerssessie nog niet bevestigd.
- Fysiek aansluiten/loskoppelen van schermen, gemengde HiDPI-schaling, vergrendelen/ontgrendelen en langdurig dagelijks gebruik zijn niet afzonderlijk runtime-getest.
- Het verwisselen is getest door de drop-geometrie aan te roepen; geen geautomatiseerde fysieke muissleepactie.
- De balkanimaties zijn in de geïsoleerde sessies met `--force-animations` getest. Fysieke touchpadgebaren, invoermethoden met pre-edit, het schermtoetsenbord, schermlezers en het uitschakelen van animaties zijn niet afzonderlijk runtime-getest.
- Minimumafmetingen zijn gecontroleerd met GTK 3. Gedrag van afzonderlijke andere apps blijft afhankelijk van hun vensterconstraints.
- Geen aparte CPU-/geheugenbenchmark. De implementatie gebruikt signalen en begrensde eenmalige timers. Geen terugkerende kleurmetingen op een stabiele desktop is wel runtime-gecontroleerd.
- GitHub Actions controleert geometrie, schema en packaging. Het draait geen GNOME-compositorsessie.

Reproduceren: zie de commando's in [README.md](../README.md). De testdriver wordt alleen in de tijdelijke testextensiemap geïnstalleerd.
