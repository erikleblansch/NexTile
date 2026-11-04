# Validatie — NexTile 0.5.1

Datum: 4 november 2026. GNOME Shell / Mutter **48.7** op de doelcomputer.

| Controle | Resultaat |
| --- | --- |
| Pure indelingslogica | 2.431 assertions geslaagd met GJS. |
| Balkgeometrie en contrast | 102.075 assertions geslaagd: centrering, continue beweging, schaalfactoren, sRGB-helderheid, omschakelmarge en lokale kleurmetingen, rekbare zoekruimte en het opzij schuiven van naburige werkruimtes, plus monotone beweging in beide richtingen bij vier pil-/zoekbalkbreedtes en twee schaalfactoren. |
| GSettings-schema | `glib-compile-schemas --strict --dry-run` geslaagd. |
| GNOME X11 in Xephyr | 124 runtime-assertions geslaagd met echte GTK 3-vensters. |
| GNOME Wayland, twee virtuele schermen | 127 runtime-assertions geslaagd met echte GTK 3-vensters. |
| Shell-log | Geen `JS ERROR`, GJS-critical, CSS-parsefout of NexTile-zoek-/contrastfout in beide finale runs, inclusief afsluiten van Shell. |
| Afsluiten met open tegels | Aanvullende [X11-proef](runtime-shutdown-x11.txt) met 65 assertions geslaagd; geen GJS-fouten tijdens het beëindigen van Shell met twee open testvensters. |
| ZIP | Twee builds leveren dezelfde SHA-256 op; expliciete bestandslijst, testdriver uitgesloten. |

De runtime-controles testen laden, grootste tegel halveren, stabiele andere tegels, sluiten, minimaliseren, fullscreen, handmatig maximaliseren, zwevend maken, vensterafstand, splitsrichting, werkruimtewissels, invoegen door een echte muissleepactie via de titelbalk, het openen van Quick Settings, focusbehoud en de zweefactie in dat menu. Ook herstel bij uitschakelen, het verwijderen van signalen/timers en opnieuw inschakelen zijn gecontroleerd. De Wayland-run controleert daarnaast verplaatsing tussen twee monitoren en een onafhankelijke indeling op het tweede scherm.

De balkcontroles verifiëren volledige transparantie, de klok links, de kalender, zwart/witcontrast op effen en gemengde achtergronden, compositorkleurwijzigingen zonder instellingenwijziging, kleurkeuze per werkruimteknop en stilstand zonder terugkerende timers. De genummerde knoppen zijn getest op aantallen toevoegen/verwijderen, klikken, tussenliggende animatieframes, centrering van de eerste/middelste/laatste actieve werkruimte, cirkel-/pilafmetingen en het openen van het overzicht. De aparte balkschakelaar en het terugzetten van de oorspronkelijke GNOME-balk zijn eveneens gecontroleerd.

De zoekcontroles sturen virtuele toetsenbord- en muisapparaten door Mutter: Super, direct typen, pijltjestoetsen, muiswiel, Enter, Escape en klikken buiten de zoekbalk. Twee tijdelijke desktopbestanden leveren echte GTK-testprogramma’s. Gecontroleerd zijn focusbehoud, zoeken via de native GNOME-provider, starten op de geselecteerde werkruimte, tussenliggende groeianimatieframes, herstel van de normale Super-toets en uitschakelen tijdens een vertraagde zoekopdracht. Enter tijdens een lopende zoekopdracht en het negeren van te laat ontvangen resultaten zijn ook getest. De controles verifiëren dat de zoekbalk binnen de bovenbalk de actieve pil vervangt, naburige rondjes opzij duwt en ook na scrollen gecentreerd blijft. Een asynchrone testprovider wordt geregistreerd in GNOME’s gewone providerregister: de native categorieweergave toont vijf resultaten en de telling voor drie overige resultaten. Resultaatactivering en de providerknop sluiten NexTile zonder het overzicht te openen; de oorspronkelijke overzichtwidgets blijven intact. De algemene achtergrond is transparant; de achtergrondkleur van de native categoriepanelen heeft een alfa van 128/255. Bij scrollen in de zoekmodus worden ook tussenliggende posities van een naburige cirkel gemeten, voorwaarts en achterwaarts; geen daarvan mag terugveren. De reguliere tests sluiten Shell af met gesloten zoekbalk en controleren daarna het Shell-log.

De nieuwe venstercontroles openen echte GTK-vensters die vóór het tonen of 200 ms daarna maximaliseren. Beide moeten zonder muisactie normaal betegeld worden. Een derde testapp voert na terugzetten uit de gemaximaliseerde stand nog een vertraagde eigen maatwijziging uit; de tegelmaat wordt automatisch hersteld. Minimaliseren/terughalen en later bewust maximaliseren blijven getest.

De tegelgrenzen zijn getest met virtuele muisinvoer door Mutter: beide sleeprichtingen, wijzigingen van beide aangrenzende vensters, behouden verhoudingen na loslaten, Escape en uitschakelen tijdens een actieve muisgrab. De test sleept ook een titelbalk naar een andere tegel en controleert de splitsrichting en het opvullen van de oude ruimte. Een GTK-app met een minimummaat controleert dat een geweigerde grensverplaatsing de vorige verhouding herstelt en de app niet zwevend maakt. Het pad voor een gewone vensterrand wordt apart aangeroepen met een programmatische maatwijziging bij vensterafstand nul; dit is geen echte muissleepactie langs die vensterrand.

De terminalcontrole opent GNOME Terminal 3.56.2 met VTE 0.80.1, een afzonderlijke GTK-configuratie en uitsluitend synthetische tekst. Een pixelmeting vergelijkt de achtergrond met een 50%-menging van de terminalkleur en het testbureaublad: gemeten RGB `(21, 63, 67)`. De vensteractor behoudt volledige dekking; de tekst wordt niet samen met het hele venster vervaagd. De configuratiehelper is ook gecontroleerd op behoud van bestaande CSS, reservekopieën, herhaald toepassen en verwijderen.

De volledige assertionlijsten staan in [runtime-x11.txt](runtime-x11.txt) en [runtime-wayland.txt](runtime-wayland.txt). De afbeeldingen zijn afkomstig uit de 0.5.0-test; de vormgeving is in deze reparatie behouden. De [menuafbeelding](quick-settings.png), [bovenbalk](topbar.png), [zoekbalk](search.png), [zoekresultaten](search-results.png) en [terminal](terminal.png) zijn echte opnamen uit de geïsoleerde X11-test, met een synthetische achtergrond.

## Grenzen

- Een aanvullende proef met versie 0.3.0 die de geïsoleerde compositor beëindigt terwijl de zoekbalk toetsenbordfocus heeft, geeft bij het afsluiten GNOME/IBus-meldingen over al vernietigde invoerwidgets. De zoekbediening en het gewone uitschakelen tijdens een geopende zoekopdracht slagen. Dit is niet als opgelost geclaimd in 0.5.1. Deze aanvullende afsluitproef telt niet als geslaagde runtimecontrole.

- De bestaande ingelogde desktop is voor deze update niet herstart. De lokale installatie van 0.5.1 is voorbereid voor de volgende aanmelding; deze versie is in de gebruikerssessie nog niet bevestigd.
- De categorieweergave en activatie zijn gecontroleerd met een asynchrone testprovider in het echte GNOME-register. De afzonderlijke externe providers voor bijvoorbeeld Bestanden, Software en Instellingen zijn niet allemaal afzonderlijk doorgetest; hun beschikbaarheid en gedrag blijven afhankelijk van de geïnstalleerde apps en GNOME-instellingen.
- Twee eerdere Wayland-runs stopten bij de bestaande contrastproef voor een rechtstreeks gewijzigde compositorachtergrond. De kleurwisseling werd daar niet waargenomen; de oorzaak is nog niet vastgesteld. De test wacht nu begrensd op het resultaat en geeft bij fouten aanvullende toestand mee. Dit staat los van de nieuwe animatie- en venstercontroles.
- Fysiek aansluiten/loskoppelen van schermen, gemengde HiDPI-schaling, vergrendelen/ontgrendelen en langdurig dagelijks gebruik zijn niet afzonderlijk runtime-getest.
- De balkanimaties zijn in de geïsoleerde sessies met `--force-animations` getest. Fysieke touchpadgebaren, invoermethoden met pre-edit, het schermtoetsenbord, schermlezers en het uitschakelen van animaties zijn niet afzonderlijk runtime-getest.
- Opstartnormalisatie vangt opgeslagen maximale afmetingen tot één seconde na de eerste tegelplaatsing op. Een later maximalisatieverzoek wordt als bewuste maximalisatie behandeld; Mutter geeft hier geen afzonderlijke herkomst voor app- en gebruikersverzoeken.
- Minimumafmetingen bij invoegen en grensverplaatsingen zijn gecontroleerd met GTK 3. Gedrag van afzonderlijke andere apps blijft afhankelijk van hun vensterconstraints.
- Geen aparte CPU-/geheugenbenchmark. De implementatie gebruikt signalen en begrensde eenmalige timers. Geen terugkerende kleurmetingen op een stabiele desktop is wel runtime-gecontroleerd.
- GitHub Actions controleert geometrie, schema en packaging. Het draait geen GNOME-compositorsessie.

Reproduceren: zie de commando's in [README.md](../README.md). De testdriver wordt alleen in de tijdelijke testextensiemap geïnstalleerd.
