# NexTile

**Ruimte voor elk venster.** Een kleine automatische tiling-extensie voor GNOME Shell 48.

NexTile deelt bij een nieuw venster de **grootste tegel in tweeën**. De overige tegels blijven staan. Sluit je een venster, dan vult de overgebleven buur de ruimte. Alles is bereikbaar vanuit één knop in GNOME Quick Settings.

![NexTile-instellingen in het GNOME Quick Settings-uitklapmenu](docs/quick-settings.png)

Vanaf **0.2.0** heeft NexTile ook een transparante bovenbalk: de klok staat links, genummerde werkruimtes staan in het midden en tekst en pictogrammen kiezen automatisch zwart of wit op basis van de zichtbare achtergrond.

![Transparante bovenbalk met de klok links en genummerde werkruimtes in het midden, op een lichte en donkere testachtergrond](docs/topbar.png)

Vanaf **0.4.0** verandert de actieve werkruimtepil bij **Super** op zijn eigen plek in een zoekbalk. De andere werkruimteknoppen schuiven opzij. Daaronder verschijnen GNOME's gewone programma-iconen en categorieën met zoekresultaten, boven het zichtbare bureaublad zonder algemene grijze achtergrond. Vanaf **0.5.0** hebben de resultaatcategorieën weer een halfdoorzichtig paneel.

![Zoekbalk op de plek van de actieve pil](docs/search.png)

![Native programma-iconen en halfdoorzichtige resultaatpanelen](docs/search-results.png)

```text
       1 venster             2 vensters            3 vensters
    ┌─────────────┐      ┌──────┬──────┐       ┌──────┬──────┐
    │             │      │      │      │       │  1   │      │
    │      1      │  →   │  1   │  2   │   →   ├──────┤  2   │
    │             │      │      │      │       │  3   │      │
    └─────────────┘      └──────┴──────┘       └──────┴──────┘
```

## Installeren

Download het `.shell-extension.zip`-bestand bij [Releases](https://github.com/erikleblansch/NexTile/releases/latest) en installeer het:

```sh
gnome-extensions install --force nextile@erikleblansch.github.io.shell-extension.zip
```

Log uit en weer in, en schakel de extensie in:

```sh
gnome-extensions enable nextile@erikleblansch.github.io
```

Vanuit deze repository kan het ook met `make install`. Daarvoor zijn Python 3, GJS, GLib-tools en `gnome-extensions` nodig. Er zijn geen npm-pakketten of achtergrondservices.

## Bediening

Open het systeemmenu rechtsboven. Klik op **NexTile** om automatisch tegelen aan of uit te zetten. Het pijltje naast de knop opent de instellingen:

| Instelling | Werking |
| --- | --- |
| Vensterafstand | 0–32 logische pixels tussen vensters en langs de schermrand; standaard 8. |
| Splitsrichting | Automatisch langs de langste zijde, naast elkaar of boven elkaar. Geldt voor nieuwe splitsingen. |
| Actief venster laten zweven | Haalt het actieve venster uit de indeling en herstelt zijn oorspronkelijke maat. Nogmaals schakelen voegt het weer toe. |
| Opnieuw indelen | Bouwt de indelingen opnieuw op met de gekozen splitsrichting. Zwevende vensters blijven zweven. |
| Vensters herstellen bij uitschakelen | Herstelt de oorspronkelijke afmetingen en positie bij uitschakelen; standaard aan. |
| Transparante bovenbalk | Schakelt de aangepaste balk, kleurkeuze en werkruimte-indicator samen aan/uit, onafhankelijk van automatisch tegelen. |
| Super opent zoeken | Opent de zoekbalk in de bovenbalk met Super; standaard aan. Uitzetten herstelt het gewone Activiteitenoverzicht met Super. |

Sleep de titelbalk van een venster naar een andere tegel. De overgebleven vensters vullen de vrijgekomen ruimte; de doeltegel wordt langs zijn langste zijde gehalveerd om het versleepte venster op te nemen. De helft waarop je loslaat bepaalt de plaatsing. Dit gebruikt altijd de langste zijde, onafhankelijk van de ingestelde splitsrichting voor nieuwe vensters.

Sleep de **grens tussen tegels** om beide kanten samen te vergroten of verkleinen. De grens licht op onder de muis en blijft ook met vensterafstand nul grijpbaar. **Escape** herstelt de verhouding van vóór het slepen. Vergroten via een gewone gedeelde vensterrand past dezelfde splitsing aan. Verhoudingen blijven behouden tot opnieuw indelen of het uitschakelen van tegelen. Als een app de gevraagde maat weigert, wordt de vorige verhouding hersteld. Laat een venster zweven voor vrije plaatsing.

Elke combinatie van scherm en werkruimte heeft een eigen indeling. Staat GNOME ingesteld op werkruimtes alleen op het hoofdscherm, dan behouden de andere schermen één gedeelde indeling. Minimaliseren en fullscreen maken tijdelijk ruimte vrij; terugkeren voegt het venster opnieuw toe. Nieuwe normale vensters worden bij het openen uit de gemaximaliseerde stand gehaald en direct betegeld. NexTile vangt ook apps op die hun opgeslagen maximale grootte in de eerste seconde na het tegelen terugzetten. Later handmatig maximaliseren wordt gerespecteerd; terugzetten naar de normale grootte of terughalen na minimaliseren deelt het venster opnieuw in, ook als de app zijn maat vertraagd aanpast. Bij de eerste inschakeling worden bestaande normale vensters, ook gemaximaliseerde, meegenomen.

Dialoogvensters, vaste venstermaten en hulppanelen blijven vrij. Vensters op alle werkruimtes blijven eveneens vrij, behalve op schermen met een gedeelde indeling. Als een app niet in een tegel past door zijn minimumafmetingen, wordt hij na een korte controle automatisch zwevend. De kleinste aangeboden tegel is 120 × 80 logische pixels. Zwevende vensters kunnen bewust boven tegels liggen. Hun status geldt voor de huidige inschakelperiode; de instellingen worden permanent opgeslagen.

## Bovenbalk en werkruimtes

De balk is 36 logische pixels hoog. De datum en tijd staan links; klikken opent de gewone GNOME-kalender. In het midden staan genummerde rondjes van 24 pixels. De actieve werkruimte is een pil van 48 pixels breed, precies in het midden van het scherm.

Klik op een nummer om die werkruimte te openen. Klik op het actieve nummer voor het Activiteitenoverzicht. Scrollen over de indicator wisselt van werkruimte. Bij wisselen schuift de rij vloeiend mee en verandert het rondje in een pil. Ook met de zoekbalk geopend blijven de rondjes in één richting bewegen, zonder tussentijdse terugslag. Touchpadbewegingen volgen de door GNOME aangeleverde voortgang; directe wisselingen krijgen een korte, uitlopende animatie. De normale GNOME-instelling voor verminderde animaties wordt gerespecteerd.

Het aantal knoppen volgt GNOME, ook bij dynamisch toegevoegde of verwijderde werkruimtes. Lange rijen vervagen aan de randen en worden afgeknipt, zodat de klok en systeemknoppen hun plek houden. Ook de eerste en laatste actieve werkruimte blijven gecentreerd.

De tekstkleur wordt per balkonderdeel en werkruimteknop gekozen. Daarvoor leest NexTile bij veranderingen twee pixelrijen aan de bovenrand van de transparante balk in het geheugen. De relatieve helderheid bepaalt zwart of wit; een kleine omschakelmarge voorkomt knipperen. Tijdens het schuiven gebruiken de rondjes dezelfde kleurmeting op hun nieuwe positie. Een subtiele tekstschaduw helpt bij onrustige achtergronden.

Deze kleurmeting schrijft geen screenshots naar schijf en verstuurt niets. Ze reageert op achtergrond-, venster-, werkruimte- en schermwijzigingen, zonder periodieke polling. Continu bewegende videoachtergronden worden daarom niet per videoframe gevolgd. Uitschakelen herstelt de oorspronkelijke klokpositie, Activiteitenknop, balkhoogte en kleuren.

## Zoeken met Super

Druk op **Super** en begin te typen. De actieve pil wordt tijdelijk de zoekbalk; de andere rondjes houden hun formaat en maken vloeiend ruimte. Bij sluiten krimpt de balk terug en sluit de werkruimterij weer aan.

De resultaten gebruiken GNOME's eigen raster voor programma's en lijsten per zoekprovider, met pictogrammen, beschrijvingen en de knop voor meer resultaten. Ze volgen de providers en volgorde uit **GNOME Instellingen → Zoeken**, inclusief door extensies geregistreerde providers. Er verschijnen dus ook bestanden, instellingen en andere categorieën die je gewoonlijk in het Activiteitenoverzicht ziet. De algemene achtergrond is volledig transparant. Categoriepanelen hebben een donkere achtergrond met **50% dekking**, zodat de resultaten herkenbaar blijven en het bureaublad erdoorheen zichtbaar blijft.

- **Enter** opent het geselecteerde resultaat; **↑/↓** of **Tab/Shift+Tab** kiezen een ander resultaat. Klikken op een resultaat werkt ook. Klik op de providernaam om verder te zoeken in die app.
- **Muiswiel** wisselt van werkruimte zolang de zoekmodus open is, met behoud van zoektekst en toetsenbordfocus. Een nieuw programmavenster opent op de gekozen werkruimte; een al geopend programma volgt GNOME's normale activeergedrag.
- **Escape**, opnieuw **Super** of klikken buiten de zoekbalk/resultaten sluit de zoekmodus. Het kruisje wist de zoektekst.
- Het volledige Activiteitenoverzicht blijft bereikbaar door op het actieve werkruimtenummer te klikken. Met de aangepaste bovenbalk uit blijft de gewone Activiteitenknop beschikbaar.

De zoekmodus werkt onafhankelijk van tegelen en de bovenbalk. Zonder aangepaste werkruimterij groeit de zoekbalk midden bovenaan. Uitschakelen herstelt GNOME's oorspronkelijke Super-afhandeling, zonder blijvende wijzigingen aan sneltoetsen.

## Halfdoorzichtige terminal

Voor **GNOME Terminal** bevat de repository een optionele GTK 3-stijl. Deze maakt alleen de terminalachtergrond 50% doorzichtig; letters blijven volledig zichtbaar en de titelbalk behoudt zijn gewone uiterlijk. Installeer vanuit deze repository:

```sh
python3 tools/configure-terminal.py
```

De helper voegt een afgebakend blok toe aan `~/.config/gtk-3.0/gtk.css` (of de map uit `XDG_CONFIG_HOME`) en maakt vooraf een reservekopie. Andere GTK-stijlen blijven behouden. Gebruik in de Terminal-profielvoorkeuren **Kleuren van systeemthema gebruiken**. Sluit alle terminalvensters en open Terminal opnieuw, of meld opnieuw aan, om de stijl te laden. Deze instelling staat los van de extensieschakelaar.

![GNOME Terminal met halfdoorzichtige achtergrond en ondoorzichtige tekst](docs/terminal.png)

Alleen deze aanpassing verwijderen:

```sh
python3 tools/configure-terminal.py --remove
```

## Compatibiliteit en controle

Ondersteunde versie: **GNOME Shell 48**, ontwikkeld op **48.7**. Er wordt geen compatibiliteit met andere Shell-versies geclaimd.

```sh
make test                 # Geometriecontroles en schemavalidatie
make pack                 # Reproduceerbaar ZIP-bestand in dist/
bash tests/runtime.sh     # Geïsoleerde GNOME/Wayland-test met echte GTK-vensters
bash tests/runtime.sh x11 # Geïsoleerde GNOME/X11-test in Xephyr
```

De runtime-tests vereisen GNOME Shell 48, Python GObject/GTK 3, GNOME Terminal, D-Bus en voor X11 Xephyr plus een beschikbaar X-display. Zij gebruiken een eigen sessiebus, instellingenmap en extensiemap. De actieve desktop wordt niet vervangen. Testlogs blijven in een tijdelijke map onder `/tmp/nextile-runtime.*` staan. De testdriver wordt **niet** meegeleverd in de extensie.

Zie [de testresultaten](docs/VALIDATION.md) voor de daadwerkelijk gecontroleerde versie en beperkingen. GitHub Actions controleert geometrie, schema en packaging; de compositor-tests worden lokaal uitgevoerd.

## Ontwerp

- Een binaire boom bewaart de splitsingen en hun verhoudingen. Toevoegen verandert alleen de grootste tegel; verwijderen trekt de overgebleven tak op.
- GNOME-signalen activeren de indeling. Meldingen worden gedurende 40 ms samengevoegd; er is geen periodieke polling.
- Een enkele controle na 250 ms vangt minimumafmetingen van apps op.
- De bovenbalk bundelt kleurmetingen gedurende 450 ms; op een stabiele desktop draait hiervoor geen timer.
- Zoeken bundelt toetsaanslagen gedurende 150 ms. Een gesloten zoekmodus heeft geen zoektimer; verouderde asynchrone resultaten worden genegeerd.
- Alleen gewijzigde geometrie wordt aan Mutter doorgegeven. Vertraagde maatwijzigingen van apps worden via venstersignalen opnieuw met de tegelmaat vergeleken. Bij verplaatsen wacht de indeling op het loslaten; bij vergroten/verkleinen volgen aangrenzende tegels tijdens het slepen.
- Uitschakelen verwijdert alle eigen signalen, timers en menuonderdelen. Herstel respecteert de huidige werkruimte en houdt vensters binnen het huidige scherm.
- Geen eigen achtergrondservice, telemetrie of shellcommando's. Zoekopdrachten gaan naar de ingeschakelde GNOME-zoekproviders; die kunnen hun eigen apps of diensten activeren, net als in het Activiteitenoverzicht.

De native menubediening volgt de [GNOME Quick Settings-API](https://gjs.guide/extensions/topics/quick-settings.html); vensterplaatsing gebruikt de [Mutter Meta.Window-API](https://mutter.gnome.org/meta/class.Window.html). De geïnstalleerde GNOME 48-API en runtime-tests bepalen de ondersteunde versie.

## Verwijderen

```sh
gnome-extensions disable nextile@erikleblansch.github.io
gnome-extensions uninstall nextile@erikleblansch.github.io
```

GPL-3.0-or-later. Zie [LICENSE](LICENSE).
