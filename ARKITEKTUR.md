# Arkitektur – Menighetsplan-appen
*Sist oppdatert: 2026-10-05 – beskriver koden slik den faktisk er i dette repoet.*

## Kort fortalt
Menighetsplan er ett adminpanel som styrer to ting i samme kodebase: webappen for frivillige og ledere, og den offentlige nettsiden. Alt leser og skriver til samme Firestore-database. En liten Express-server leverer appen og et offentlig JSON-API for eksterne nettsider. Hva produktet skal være, og hva som er levert og planlagt, står i `PRODUKTDOKUMENTASJON.md`.

```
 Besøkende ───────▶ Offentlig nettside ─┐
 Frivillige/ledere ▶ Min side ──────────┼─▶ Firestore (europe-west3)
 Admin ───────────▶ Admin Studio ───────┘        ▲
                                                 │ leses av
 Eksterne nettsider ◀── JSON ── Express-server (`server.ts`)
```

## Teknologi
| Område | Valg |
|---|---|
| Klient | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 |
| Data | Cloud Firestore via Firebase klient-SDK, sanntidslyttere |
| Server | Express (`server.ts`), kjøres med `tsx` |
| Hosting | Én installasjon per menighet (se Installasjonen). Lokalt: Express + Vite på port 3000 |
| PWA | `public/sw.js` og `public/manifest.webmanifest` |

## Installasjonen
Appen installeres én gang per menighet: eget Firebase-prosjekt, egen database og egen adresse. Koden er den samme for alle.

- **Hvilken database** en installasjon hører til, står i innstillingene dens, aldri i koden: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` og `VITE_FIREBASE_APP_ID` må være med, og `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_DATABASE_ID` og `VITE_TENANT_ID` kan være med. `src/installation.ts` er eneste sted de leses, og nettleseren (`src/firebase.ts`), serveren (`server.ts`) og skriptene går gjennom den. Lokalt ligger de i `.env.local`, som ikke er med i repoet (`.env.example` viser navnene).
- **Mangler en innstilling**, tegnes ikke appen. `src/main.tsx` viser `NotConfiguredNotice` med navnene som mangler, og ingen database leses. Serveren starter ikke. Det finnes ingen reserve: en installasjon som ikke er satt opp, kobler seg aldri til en annen menighets database.
- **Databasenavnet.** Et nytt prosjekt bruker standarddatabasen, og `firebase.json` peker på den. Den første databasen, fra Google AI Studio, har et eget navn og oppgis med `VITE_FIREBASE_DATABASE_ID`.
- **Ingenting om én menighet i koden.** Før en menighet har egne innstillinger, gjelder `emptyCmsSettings` (`src/data/cmsData.ts`): navnet «Menigheten» og ellers ingenting. Nettsiden tegner ikke felt som er tomme. Eksempelmenigheten i demodataene (`demoCmsSettings`, `mockData.ts`) vises bare når demodataene er lagt i databasen. `tests/neutral-code.test.ts` går gjennom koden og feiler hvis noe annet nevner én menighet, ett kirkesamfunn eller én database.
- **Salgssiden** menighetsplan.no er en egen kodebase. Det den og appen er enige om, står i kapittel 14 i `PRODUKTDOKUMENTASJON.md`.

## Innlogging og roller
- **To ord.** En *konto* er det noen logger inn med. En *person* er en rad i registeret. `src/utils/session.ts` er reglene for hvordan de henger sammen, som rene funksjoner: `sessionOf` gjør kontoen og registeret om til en økt (`loading`, `signedOut`, `notInRegister` med grunn, eller `member` med personen), og `roleOf` sier om personen er administrator, gruppeleder eller medlem. Kontoens bekreftede e-postadresse må stå på nøyaktig én person.
- **`src/services/auth.ts`** er eneste sted Firebase Auth brukes: Google-konto og lenke på e-post, og `describeSignInError` som gjør feilkodene om til norsk. Adressen en lenke ble sendt til, huskes på enheten den ble bestilt fra.
- **`FirebaseDataProvider`** følger kontoen og gir `session`, `currentUser` og `signOut` til alle flater. `currentUser` er personen bare mens økten er `member`; ellers er den ingen (uten navn og id). Planleggingsdataene følges bare på interne ruter *og* for et medlem, og tømmes når noen logger ut.
- **Sperren** er `SessionGate` (`src/components/SessionGate.tsx`), lagt rundt Min side og admin i `src/App.tsx`. Den som ikke er medlem, sendes til `/logg-inn?neste=…`. Admin krever i tillegg administrator. Innloggingssiden (`src/pages/SignInPage.tsx`) er verken en del av nettsiden eller bak innlogging (`isSignInPath` i `src/utils/routes.ts`), og fører bare videre til adresser i appen (`destinationAfterSignIn`).
- **Ingen vei inn utenom.** Testbryteren er fjernet. På en utviklers egen maskin (`import.meta.env.DEV`) kan en person fra registeret stå inn for en innlogget, valgt på innloggingssiden. Den publiserte appen bygges uten: der er `standInAs` udefinert, og et lagret valg leses ikke.
- **Første administrator** legges inn utenfra med `scripts/first-admin.ts`, som skriver det `planFirstAdmin` (`src/utils/firstAdmin.ts`) sier må skrives.
- **I tester** står `tests/support/session.ts` inn for `src/services/auth`: testen sier hvem som er logget inn.
- **Det som gjenstår til reglene (trinn 4).** Koblingen fra konto til person gjøres i dag i nettleseren, av det den har lest. Reglene i databasen trenger sin egen, pålitelige kobling fra kontoens id til personen før rollen kan håndheves der.

## Bygg og lasting
Vite bygger klienten med `manualChunks` for `firebase` og `react-vendor`. Offentlige sider importeres statisk i `src/App.tsx`; admin, Min side og admin-detaljsider lastes med `React.lazy` og `Suspense` bare på de grenene. Hver admin-fane har sin egen lazy-import i `src/pages/admin/studioTabLoaders.ts`, med forhåndshent ved hover, fokus og touch fra `StudioSidebar.tsx`.

En besøkende på nettsiden laster fortsatt Firebase-klienten (~710 KB) fordi både `CmsProvider` og `FirebaseDataProvider` lytter på Firestore. Admin- og Min-side-kode (inkludert CMS-panelet på ~110 KB) kommer ikke med i det første besøket.

Ved utdatert JavaScript etter deploy: `ChunkErrorBoundary` prøver én automatisk reload på rute-nivå (`src/utils/lazyImport.ts`). I admin-faner viser `StudioTabErrorBoundary` en manuell «Last på nytt»-knapp, slik at et utkast i en annen fane ikke forsvinner.

## De tre flatene
`src/App.tsx` velger layout ut fra adressen:

| Flate | Ruter | Hovedfiler |
|---|---|---|
| Offentlig nettside | `/`, `/hva-skjer`, `/taler`, `/fellesskap`, `/lederskap`, `/om-oss`, `/kontakt`, `/side/:slug`, `/artikkel/:id` | `src/pages/public/` |
| Min side | `/minside`, `/leder`, `/oppgave/:id`, `/gruppe/:id`, `/samling/:id`, `/husfellesskap`, og detaljsidene under `/admin/…` | `src/pages/` |
| Admin Studio | `/admin` (faner via `?tab=`) | `src/pages/admin/` |

Hvilke adresser som er interne, står i `MIN_SIDE_SECTIONS` i `src/utils/routes.ts`. Sammenligningen gjelder hele ledd i adressen, slik at `/leder` ikke fanger den offentlige siden `/lederskap`. Samme fil avgjør hva som er en offentlig adresse (`isPublicPath`), og brukes av både nettleseren og serveren.

Admin Studio er delt slik: `AdminStudio.tsx` er et skall som eier fanevalg og tilbakemeldinger, `StudioSidebar.tsx` er menyen, og hver fane ligger i `tabs/` med sin egen tilstand og sine egne dialoger. En fane monteres første gang den åpnes og skjules deretter bare, slik at et utkast overlever et fanebytte.

De andre store sidene følger samme mønster. Siden kaller sin hook én gang, eier hva som vises, og sender resultatet ned til deler som har sin egen tilstand:

| Side | Deler |
|---|---|
| `MyPage.tsx` | `src/pages/myPage/`: `useMyPage.ts` og én fil per seksjon |
| `LeaderGroupDetailPage.tsx` | `src/pages/leaderGroup/`: rediger-skjema, møteplan, aktiviteter, medlemmer |
| `GatheringDetailView.tsx` | `src/components/gathering/`: de fem dialogene og raden i kjøreplanen |
| `HusfellesskapView.tsx` | `src/components/husfellesskap/`: to faner og to dialoger |
| `AdminCmsPanel.tsx` (fanen «Sider & innhold») | `src/pages/admin/tabs/pages/`: sidetre, redigering, blokkvelger, hovedbilde, forhåndsvisning, slettedialog |

To små byggeklosser brukes på tvers: `useTimedMessage` (`src/hooks/`) er en melding som forsvinner av seg selv, og `AdminAccessRequired` (`src/components/`) er skjermen et medlem får på en side som bare er for administratorer.

## Datalag
- **`src/services/firestore.ts`** inneholder alle lese- og skrivekall mot Firestore, uten React: én lytter per samling (`subscribeCollection`), tre generelle skrivinger (`createDocument`, `updateDocument`, `deleteDocument`) og de få som gjelder flere felt eller dokumenter.
- **`FirebaseDataProvider`** (`src/context/FirebaseDataContext.tsx`) holder det lytterne leverer, og tilbyr oppslag og handlinger. Komponenter henter den med `useFirebase()`.
  - Alltid: `persons`, `groups`, `gatherings`.
  - Bare på interne ruter: `tasks`, `assignments`, `groupMessages`, `gatheringAttendances`, tjenesteroller og oppmøtetall. En besøkende på den offentlige nettsiden får aldri disse.
  - Tjenesteroller og oppmøtetall ligger i `cms_settings`, merket med `recordType`, fordi reglene i drift avviser nye samlinger (se Kjente avvik). Hvor de lagres, bestemmes ett sted: `src/services/volunteerRoles.ts` og `src/services/headcounts.ts`. Nettsiden leser bare dokumentet `cms_settings/global`, så den får dem ikke.
  - Besøkstallene ligger samme sted, ett dokument per dag (`recordType: "siteTraffic"`, navn `traffic-ÅÅÅÅ-MM-DD`). Lytterne bak nettsiden spør bare etter sitt eget merke, så tallene, som endres ved hvert besøk, leveres ikke til andre enn bordet. Hvor de lagres, bestemmes i `src/services/siteTraffic.ts`.
- **`CmsProvider`** (`src/context/CmsContext.tsx`) lytter på `cms_pages`, `cms_news`, `cms_sermons`, `cms_staff` og `cms_settings`. Det siste som ble mottatt mellomlagres i `localStorage`, slik at nettsiden har innhold å vise før Firestore har svart, og beholder det når den åpnes uten nett. En lagring i CMS-et venter på svar fra serveren (i motsetning til planleggingsdataene), slik at redigeringsskjemaet kan bli stående åpent med teksten hvis lagringen feiler.
- **Hooks per rolle** (`src/hooks/`: `memberHooks`, `leaderHooks`, `adminHooks`, `useHusfellesskap`) setter sammen rådataene til det hver side trenger.
- **Rene funksjoner** (`src/utils/`) holder reglene, og testene i `tests/` (Vitest) kjører mot dem: `staffing`, `visibility`, `publicProfile`, `firestoreData`, `menu`, `groups`, `dates`, `headcount` og `churchAnalytics`.
- **Sidetreet** (`src/utils/menu.ts`) er felles for den offentlige menyen og sidelisten i admin. Når en hovedfane slettes, flyttes underfanene opp til toppnivå i samme skriving.

### Skriving
1. Et nytt dokument bygges én gang i `src/data/newDocuments.ts`, med ID fra `newId()`.
2. Handlingen sender skrivingen til Firestore og er ferdig. Firestore-klienten legger endringen inn lokalt med én gang, og lytterne viser den uten å vente på serveren. Ingen handling endrer listene i minnet selv, så det som vises er alltid det klienten faktisk har.
3. En oppdatering går gjennom `forUpdate`: et felt som er satt til `undefined` slettes i databasen, slik at et tømt skjemafelt faktisk blir tomt.
4. Lister og kart inne i et dokument (medlemmer, innmeldingsdato, varslingsvalg) endres uten å lese dokumentet først, med `arrayUnion`, `arrayRemove` og feltsti. To endringer som gjøres samtidig kan dermed ikke overskrive hverandre.
5. Det som hører sammen skrives i én batch: en tildeling og oppgavens status, et forfall og oppgavens status, en slettet side og undersidene dens.
6. Feiler skrivingen, meldes det via `src/services/writeErrors.ts` og vises i `WriteErrorBanner`. Lytterne setter da tilbake det som faktisk er lagret.

### Bemanning
Reglene i kapittel 3 i `PRODUKTDOKUMENTASJON.md` ligger i `src/utils/staffing.ts`:

- `countSlots` er ligningen *ledige plasser = behov − bekreftet − venter*. Den som har avslått eller meldt forfall, holder ingen plass.
- `taskStatusFor` gir statusen en oppgave skal ha ut fra behovet og tildelingene: `confirmed` når alle plasser er bekreftet, `assigned` når alle plasser er opptatt men noen ikke har svart, `open` når en plass er ledig, og `vacant` når plassen ble ledig ved et akutt forfall (mindre enn 48 timer før samlingen, `isAcuteForfall`).
- Hver handling som endrer en tildeling eller behovet, lagrer denne statusen i samme skriving. Statusen kan derfor ikke si noe annet enn tildelingene.
- En direkte tildeling og en oppgave et medlem tar selv er bekreftet med en gang. En forespørsel står som «venter» til medlemmet svarer på oppgavesiden eller på Min side. Tildelinger får `assignedAt` når de opprettes og `respondedAt` når svaret registreres. Et forfall lagres som `withdrawn` med valgfri grunn; et nei på en forespørsel som `declined`.

### Kjøreplan
Samlingsvisningen (`GatheringDetailView.tsx`) viser programmet og oppgavene på én tidslinje. `buildRunSheet` i `src/utils/runSheet.ts` bygger den av det som er registrert, og ikke noe annet:

- Et programpunkt (`programSchedule`) vises med klokkeslett og tittel. Er det lenket til en oppgave (`taskId`), vises oppgaven og hvem som står på den der.
- Et programpunkt uten oppgave har ingen ansvarlig. En samling uten program viser bare oppgavene sine.
- En oppgave utenfor programmet står på oppmøtetiden når instruksen åpner med den («Møt opp kl. 09:30 …»), ellers til slutt.

Det finnes ennå ikke noe skjermbilde for å redigere programmet; bare demodataene har et.

### Analysebordet
- **`buildChurchAnalytics`** (`src/utils/churchAnalytics.ts`) regner ut alt bordet viser for en periode, fra rådataene: oppmøte, samlinger, frivillighet, grupper, personregisteret, nettsiden og datagrunnlaget. Den er en ren funksjon med `now` som argument, så den testes med faste datoer. Et tall uten grunnlag er `null`, og skjermen viser det som strek (`src/utils/analyticsFormat.ts`).
- **`useAdminAnalytics`** (`src/hooks/adminHooks.ts`) henter planleggingsdata fra `useFirebase()` og innhold fra `useCms()`, og kaller funksjonen én gang. Fanen (`src/pages/admin/tabs/AnalyticsTab.tsx`) eier bare periodevalget og hvilken samling som telles. Delene ligger i `src/pages/admin/tabs/analytics/`, én fil per seksjon og dialog.
- **Oppmøtetall** (`GatheringHeadcount`) har ID-en `headcount-<samling>`, slik at en ny telling erstatter den gamle. Hva som kan telles og hvordan skjemaet leses, står i `src/utils/headcount.ts`.
- **Modulene** står i `src/utils/analyticsModules.ts`, i den rekkefølgen de vises. Fanen viser en modul når `isModuleShown` sier det. Hva personen har skjult, lagres på personen (`analyticsHiddenModules`) med `arrayUnion` / `arrayRemove` (`setAnalyticsModuleHidden` i `src/services/firestore.ts`), så to endringer samtidig ikke overskriver hverandre. Bemanning per arrangement, flere oppgaver på samme samling og engasjement per person og måned regnes av `summarizeFullStaffing`, `summarizeMultiTasks` og `summarizeEngagement`.
- **Simulert menighetsliv** (`src/data/simulatedChurchLife.ts`) er en ren generator med fast frø: samme utgangspunkt gir samme historikk. Alt den lager har ID med `sim-` eller peker på en samling med `sim-`, og `isSimulatedDocument` kjenner det igjen. `src/services/simulationService.ts` skriver og fjerner det; en ny simulering fjerner den gamle først.
- **Diagrammene** er tegnet med HTML og Tailwind, uten diagrambibliotek. Seriefargene (`--viz-1`, `--viz-2`) og statusfargene (`--studio-good`, `--studio-warn`, `--studio-bad`) er definert for lyst og mørkt innhold i `src/index.css`, og statusen vises alltid med ikon og ord.

### Moduler
- **To ord.** En *produktmodul* er det en menighet har eller ikke har («Analyse»). Et *tillegg* (`addon` i koden) er en del av en modul som slås på for seg («Analysebord»). Produktmodulene og delene deres står i `src/pages/admin/addons.ts`. En modul uten deler er planlagt, og bare et navn.
- **Hva som er på**, lagres i ett dokument, `cms_settings/addons` (`recordType: "addons"`, ett felt per tillegg), og skrives med sammenfletting, så to som velger samtidig, ikke overskriver hverandre (`src/services/addons.ts`). Et tillegg som ikke er nevnt, er av. Dokumentet er ikke innhold: `datasetService` verken laster det ned eller tømmer det.
- **Ett sted å spørre.** `CmsProvider` følger dokumentet og gir `addons` og `addonsState` til alle flater. All kode spør `isAddonOn(addons, id)` (`src/utils/addons.ts`). Ingenting mellomlagres i nettleseren, og ingenting er på før databasen har svart.
- **Tre steder følger listen**, uten å kjenne det enkelte tillegget: menyen (`addonMenuSections` i `StudioSidebar.tsx`), siden Moduler (`tabs/AddonsTab.tsx`) og sperren foran en fane (`AddonGate.tsx`, lagt rundt hver fane i `AdminStudio.tsx`). En fane som hører til et tillegg som er av, tegnes ikke, så den verken leser eller teller.
- **Det et tillegg styrer utenfor admin**, spør samme sted: nettsiden teller besøk bare når `visitCounting(addons, settings)` sier `"counted"` (`src/utils/siteTraffic.ts`).
- **Tilgang kommer oppå valget.** I dag er alt som finnes, tilgjengelig. Når en menighet skal ha noen moduler og ikke andre, legges det til ett lag: hva menigheten *har* (satt av leverandøren), i tillegg til hva den *har slått på*. `CmsProvider` gir da bare videre det som er både tildelt og valgt, så menyen, sperren og tellingen følger med uten endring. Laget krever innlogging, og regler som lar bare leverandøren skrive tildelingen.

### Testing av datalaget
`tests/data-provider.test.tsx` og `tests/cms-provider.test.tsx` kjører `FirebaseDataProvider` og `CmsProvider` mot den ekte Firestore-klienten, koblet fra nettet (`tests/support/offlineFirestore.ts`). `tests/member-flow.test.tsx` gjør det samme med det et medlem ser og gjør: ta en oppgave, svare på en forespørsel, melde forfall. Testene ser dermed det samme som appen: en skriving når listene gjennom lytterne. Ingenting sendes til en server.

## CMS-et
Nettsiden bygges av fem samlinger: `cms_pages`, `cms_news`, `cms_sermons`, `cms_staff` og ett innstillingsdokument i `cms_settings`.

- **Sider og meny.** `src/utils/menu.ts` bygger sidetreet (to nivåer), den offentlige menyen og adressen til en side. `isPagePublished` avgjør om en side er synlig: ikke kladd, og ikke planlagt fram i tid. Den brukes av både menyen og `PublicStaticPage.tsx`.
- **Innhold.** `content` er tekst med blokker (`:::callout`, `:::media-left`, `:::grid`, `:::quote`, `[Knapp: …](…)`). `CmsContentRenderer.tsx` tolker teksten og tegner faste komponenter. Innholdet settes aldri inn som HTML. Syntaksen står i kapittel 8.3 i `PRODUKTDOKUMENTASJON.md`.
- **Bilder.** `compressImageFile` i `src/utils/imageUpload.ts` skalerer et opplastet bilde ned og gjør det om til tekst, som lagres i sidens `heroImage`.
- **Design.** De offentlige sidene bruker to temafarger, `primary-*` og `accent-*` (`bg-primary-700`, `text-accent-300`), som er definert i `src/index.css`. `getThemeCssVariables` i `src/utils/themeUtils.ts` gjør temaet om til CSS-variabler: elleve toner av hver farge, sidens bakgrunn, skriftene og Tailwinds avrundinger (`--radius-xl` …). Variablene settes på den offentlige layouten i `App.tsx` sammen med klassen `site-theme`, og alt innenfor følger da temaet. Forhåndsvisningene i admin bruker samme funksjon og samme klasser, så de viser det nettsiden faktisk får. Tonene bygges i `src/utils/colorScale.ts`: lysheten på hvert trinn er fast (OKLCH), fargetonen kommer fra fargen som er valgt, og varme farger går mot gult når de blir lysere. Dermed holder kontrasten for alle fargevalg. `tests/site-theme.test.ts` feiler hvis en offentlig side bruker `indigo-*` eller `amber-*` som fast farge.
- **Søk og deling.** `src/utils/siteSeo.ts` avgjør hva hver adresse sier om seg selv: `seoForPath` finner siden, artikkelen eller den innebygde siden bak adressen, og `resolvePageSeo` fyller inn det som mangler (ingressen for en manglende beskrivelse, hovedbildet for et manglende delebilde). Samme regler brukes to steder. Serveren (`sendApp` i `server.ts`, med `server/pageMeta.ts`) skriver resultatet inn i `index.html` før den sendes, slik at tjenester som viser en lenke uten å kjøre appen, ser det. Nettleseren (`useSiteSeo` i `App.tsx`, med `injectPageSeo` i `src/utils/seoUtils.ts`) holder fanetittelen i takt når man går fra side til side. Serveren leser sider, nyheter og innstillinger på nytt hvert minutt i bakgrunnen, og holder aldri en side tilbake for å vente på databasen. En adresse uten publisert side får status 404 og `noindex`.

## Offentlig API
`server.ts` leser `gatherings` og `groups` og sender dem gjennom rene funksjoner i `server/publicApi.ts`. Bare hvitelistede felt slipper ut. Medlemslister og kontaktinformasjon eksponeres ikke.

| Endepunkt | Innhold |
|---|---|
| `GET /api/offentlig/arrangementer` | Kontrakt v1, tider med norsk offset (`+01:00` / `+02:00`) |
| `GET /api/public/gatherings`, `/groups`, `/recurring`, `/all` | Utvidet v1.1-format |

Kontrakten for eksterne lesere står i **[INTEGRASJON-MENIGHETSPLAN.md](INTEGRASJON-MENIGHETSPLAN.md)**.

## Hva som er offentlig
Tre regler avgjør hva en besøkende ser, og hver av dem ligger ett sted:

- **Samlinger:** feltet `visibility` (`intern`, `offentlig`, `fremhevet`) er eneste bryter. Både de offentlige sidene og API-et leser det gjennom `isPubliclyVisible` i `src/utils/visibility.ts`, og alt som skriver bruker `visibilityFields`. `isPublic` lagres bare som et speil for eldre dokumenter. `src/utils/gatherings.ts` avgjør resten: hva som er en gudstjeneste (`isWorshipService`), hva som er kommende, og hvilken samling forsiden løfter fram (`pickHighlight`): en fremhevet samling først, ellers neste gudstjeneste, ellers det som kommer først. En avlyst samling løftes aldri fram.
- **Grupper:** en gruppe vises utad til en administrator fjerner krysset «Vis gruppen på nettsiden» (`isPublic: false`). `isGroupPublic` brukes av `/fellesskap`, `/lederskap` og API-et, som da verken gir fra seg gruppen eller møtetiden dens.
- **Personer:** en person vises bare når `isPublicProfile` er satt og et samtykke er registrert (`consentToPublishGivenAt`, `consentGivenBy`). `src/utils/publicProfile.ts` gir da navn, tittel utad og kontaktinfo utad. Privat telefon og e-post er aldri med. Samtykket registreres på personkortet i admin, og fjernes når krysset tas bort.

## Kjente avvik fra målbildet
`PRODUKTDOKUMENTASJON.md` beskriver hvor løsningen skal, og kapittel 14 der sier i hvilken rekkefølge. Koden er ikke der ennå på disse punktene:

| Område | Mål | I dag |
|---|---|---|
| Innlogging | Brukere logger inn; roller styrer tilgang | Levert for skjermene (se Innlogging og roller). Rollen håndheves ikke i databasen før reglene lukkes, og reglene har ennå ingen pålitelig kobling fra konto til person |
| Sikkerhetsregler | Bare admin endrer offentlige profilfelt; medlemmer endrer bare sitt eget | Reglene tillater lesing av alt og skriving uten innlogging |
| Regler i drift | Reglene i `firestore.rules` er de som gjelder | Reglene i drift er eldre og avviser nye samlinger (prøvd 5. oktober: `volunteer_roles` og `gatheringHeadcounts`). Tjenesteroller og oppmøtetall lagres i `cms_settings` til reglene er publisert. Da endres bare `volunteerRoles.ts` og `headcounts.ts` |
| Besøkstall | En egen samling der en besøkende bare kan legge til i dagens summer, og bare administratorer kan lese og slette | Dagene ligger i `cms_settings`, der reglene tillater skriving for alle. Tallene kan derfor endres og slettes av hvem som helst, som alt annet. Når innlogging og strammere regler kommer, må de flyttes: da endres bare `src/services/siteTraffic.ts` |
| Moduler | En menighet har de modulene den er tildelt, og slår dem av og på selv | Alle tillegg som finnes, kan slås på av hvem som helst i admin. Tildeling per menighet finnes ikke. Kalender og Meldinger er brytere fra før, lagret i nettleseren |
| Personvern på nettsiden | Besøkende får bare offentlige data | Sidene viser bare personer med samtykke, og laster ikke oppgaver, tildelinger, meldinger eller oppmøte. Hele personregisteret lastes likevel til nettleseren; det kan først stenges med innlogging og strammere regler |
| Bli med i en gruppe | En besøkende kan melde interesse for en gruppe | `/fellesskap` viser hvem man kan kontakte. Det finnes ikke noe skjema som lagrer en henvendelse; det krever en egen samling, regler og et sted lederen kan lese dem |
| Bilder | Bilder ligger i en bildelagring | Et opplastet bilde lagres som tekst i sidedokumentet. Alle sider lastes til alle besøkende, og kopien i `localStorage` (ca. 5 MB) rekker bare til et titalls bilder |
| Kladder | Bare administratorer får kladder og planlagte sider | Alle sider leveres til nettleseren, og skjules i visningen |
| Stab | Én kilde for mennesker som vises utad | `/lederskap` bruker personregisteret med samtykke. `/om-oss` viser `cms_staff`, en egen liste uten samtykkelogg |
| Forsiden | Alt innhold kommer fra CMS-et | Tre infobokser, fellesskapsseksjonen og gaveteksten står i `PublicHomePage.tsx`, og standardtekstene i innholdsmodulene (`src/utils/modulePresentation.ts`) passer ikke alle menigheter |
| Forfall med grunn | Medlemmet skriver en grunn, lederen ser den | Datalaget lagrer `withdrawalReason`, men ingen skjerm skriver eller viser den |
| Filstørrelse | Én komponent per fane/modal | Gjort for alle sidene over 1 000 linjer. Størst nå er redigeringsskjemaet for sider (`PageEditModal.tsx`, ca. 750 linjer) og gruppekortet i admin (`AdminGroupDetailPage.tsx`, ca. 650) |
| Lasting | Admin og CMS lastes først når de åpnes | Offentlige ruter er statiske; admin, Min side og faner lastes ved behov. Firebase-klienten lastes på alle besøk (~710 KB) |
| Gruppemeldinger | Testverktøyet på husfellesskapssiden sier at et nytt medlem ikke skal se eldre meldinger | Innmeldingsdato lagres (`memberJoinedAt`), men brukes ikke: et medlem ser alle meldingene i gruppen |
| Modulbrytere | Kalender og meldinger slås av og på for hele menigheten | Valget lagres bare i nettleseren til den som endrer det |
