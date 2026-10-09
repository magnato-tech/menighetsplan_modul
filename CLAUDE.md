# Prosjektdokument: Menighetsplan-appen
*Sist oppdatert: 2026-10-09*

> **Ny økt? Start her.** Produktet, hva som er levert og planen videre står i `PRODUKTDOKUMENTASJON.md`. Oppbygningen står i `ARKITEKTUR.md`.

---

## 1. Hva dette repoet er
Ett adminpanel som styrer en webapp og en nettside i samme format. Det er én React-app med tre flater som deler samme Firestore-database:

1. **Adminpanelet (Admin Studio)** på `/admin`: planlegging (samlinger, oppgaver, grupper, personer) og CMS (sider, nyheter, taler, stab, design, innstillinger).
2. **Webappen (Min side)** for frivillige og gruppeledere (`/minside`, `/leder`, `/husfellesskap`, `/oppgave/:id` …).
3. **Nettsiden** til menigheten (`/`, `/hva-skjer`, `/taler`, `/fellesskap`, `/om-oss` …).

I tillegg serverer `server.ts` et offentlig JSON-API (`/api/offentlig/arrangementer` og `/api/public/*`) som eksterne nettsider kan lese. Kontrakten står i `INTEGRASJON-MENIGHETSPLAN.md`.

**Én installasjon per menighet.** Appen selges til flere menigheter, og hver får sin egen installasjon: eget Firebase-prosjekt, egen database og egen adresse. Koden er den samme for alle, og hvilken database en installasjon hører til, står i innstillingene dens (`.env.example`), aldri i koden.

**Dette repoet er selve appen.** Salgssiden menighetsplan.no (presentasjon, priser, påmelding, senere kundeportal) bygges for seg i Google AI Studio. Ikke bygg salgsside, kundeportal eller betalingsløsning her. Det appen og salgssiden er enige om, og planen «Klar for flere menigheter» med trinnene i rekkefølge, står i kapittel 14 i `PRODUKTDOKUMENTASJON.md`. Følg trinnene uten å utvide dem.

Det finnes også et eldre, eksternt CMS-repo (`magnato-tech/menighetsplan_ClaudeCMS`) som leser API-et. Koden der hører ikke hjemme her.

---

## 2. Kommandoer
| Kommando | Gjør |
|---|---|
| `npm run dev` | Starter Express + Vite på port 3000. Krever `.env.local` med installasjonens innstillinger (kopier `.env.example`) |
| `npm run build` | Bygger klienten til `dist/` |
| `npm run lint` | Typesjekk (`tsc --noEmit`) |
| `npm test` | Kjører testene i `tests/` med Vitest (`npx vitest` følger med mens du jobber) |
| `npm run first-admin -- <e-post> "<navn>"` | Legger første administrator inn i registeret til installasjonen i `.env.local` |
| `npm run reset-demo -- <prosjekt>` | Nullstiller demoens database: fyller den med eksempelmenigheten og fjerner alt annet. Bare demoen, og navnet på prosjektet må skrives. Innstillingene leses fra `.env.demodb.local` |

Kjør `npm run lint` og `npm test` før en endring regnes som ferdig.

---

## 3. Hvor ting ligger
| Sti | Innhold |
|---|---|
| `server.ts`, `server/publicApi.ts`, `server/pageMeta.ts` | Express-server, de rene funksjonene bak det offentlige API-et, og tittel og delingskort i HTML-en som sendes |
| `src/App.tsx` | Ruter og de tre layoutene |
| `src/firebase.ts` | Oppstart av Firebase |
| `src/services/firestore.ts` | Lesing og skriving mot Firestore, uten React |
| `src/context/FirebaseDataContext.tsx` | `FirebaseDataProvider` / `useFirebase`: planleggingsdata og handlingene som endrer dem |
| `src/context/CmsContext.tsx` | CMS-innhold: sider, nyheter, taler, stab, innstillinger |
| `src/data/collections.ts` | Navn på alle Firestore-samlinger |
| `src/data/newDocuments.ts` | Bygger nye personer, grupper, samlinger, oppgaver, tildelinger og meldinger |
| `src/hooks/` | Hooks per rolle: `memberHooks`, `leaderHooks`, `adminHooks`, `useHusfellesskap`. `useAppHooks.ts` eksporterer alle |
| `src/utils/` | Rene funksjoner: `staffing` (bemanning), `visibility` (hva som er offentlig), `publicProfile` (samtykke), `firestoreData` (klargjøring før skriving), `menu` (sidetreet og menyen), `gatherings` (kommende samlinger og forsidens utvalg), `groups` (hvem som er med i en gruppe), `runSheet` (kjøreplanen), `dates`. `routes` (hvilken flate en adresse hører til). For CMS-et: `themeUtils` og `colorScale` (design), `siteSeo` og `seoUtils` (søk og deling), `imageUpload` (bilder) |
| `src/components/cms/CmsContentRenderer.tsx` | Tolker innholdsblokkene på en CMS-side og tegner dem |
| `src/services/writeErrors.ts` | Melder mislykkede skrivinger til `WriteErrorBanner` |
| `src/services/databaseAdmin.ts` | Fyll databasen med demodata / slett alt |
| `src/utils/dataset.ts`, `src/services/datasetService.ts`, `src/components/admin/DatasetPanel.tsx` | Datasett: alt innholdet i databasen som én fil. Formatet og kontrollen av en fil, nedlasting og innhenting, og panelet under Database i admin. Databasen tømmes bare når admin svarer ja i `DatasetImportDialog.tsx`, og da tas en kopi først |
| `src/utils/dataParts.ts` | De to delene av databasen, som fylles og tømmes hver for seg: nettsiden (sider, nyheter, taler, stab, innstillinger og arrangementer åpne for alle) og planleggeren (personer, grupper, roller, oppgaver, interne samlinger). Testdata skriver bare planleggeren (`testdataService.ts`); datasett kan lastes ned, hentes inn og tømmes per del |
| `src/services/operatingMode.ts`, `src/components/admin/OperatingModePanel.tsx` | Driftsmodus: demo eller produksjon, lagret som et merket dokument i `cms_settings`. I produksjon nekter alt som tømmer databasen (`clearDatabase`, `clearTestdata`, `deleteAllData`) via `ensureDeletionAllowed`. Uten dokumentet står appen i demo |
| `public/demosett/`, `src/services/demoSets.ts`, `src/services/churchSwitch.ts`, `src/services/previousSetup.ts`, `src/components/admin/ChurchPickerPanel.tsx` | «Velg menighet» under Database: bytter nettsiden til en annen menighets, for demonstrasjon. Settene er datasettfiler laget fra menighetenes egne nettsider, uten e-postadresser og telefonnumre (kontrollert i `tests/demo-sets.test.ts`). Nettsiden som var, lagres som «Forrige oppsett» i nettleseren før den slettes. Planleggeren røres ikke |
| `public/bildebibliotek/`, `src/services/stockImages.ts`, `src/components/admin/StockImageGrid.tsx` | Bildene som følger med appen: arkivbilder fra Pixabay og Unsplash, skalert (1600 px og 480 px) og beskrevet i `index.json` med tittel, bildetekst, emneord, fotograf og kilde. Vises i Mediebibliotek og under «Bibliotek» i bildevelgeren, og trenger ikke bildelageret. En side lagrer adressen (`/bildebibliotek/…jpg`). Et slikt bilde kan ikke brukes som delebilde |
| `src/utils/churchAnalytics.ts` | Alt Analysebord regner ut for en periode. `useAdminAnalytics` i `adminHooks.ts` kaller den, fanen ligger i `src/pages/admin/tabs/AnalyticsTab.tsx` med delene i `tabs/analytics/`. Modulene og rekkefølgen står i `src/utils/analyticsModules.ts` |
| `src/utils/headcount.ts`, `src/services/headcounts.ts` | Oppmøtetall: hva som kan telles og hvordan skjemaet leses, og hvor tallene lagres |
| `src/data/simulatedChurchLife.ts`, `src/services/simulationService.ts` | Simulert historikk for å prøve Analysebord, og skriving og fjerning av den |
| `src/utils/siteTraffic.ts`, `src/utils/visitTracker.ts`, `src/hooks/useSiteTraffic.ts`, `src/services/siteTraffic.ts` | Besøk på nettsiden, telt anonymt: hvilken adresse et besøk telles på, dag og time i norsk tid, og alt bordet regner ut (`siteTraffic.ts`); hva ett besøk er mens det skjer (`visitTracker.ts`); koblingen til siden som vises (`useSiteTraffic.ts`, kalt ett sted i `App.tsx`); og hvor summene lagres (`services/siteTraffic.ts`) |
| `src/pages/admin/tabs/SiteTrafficTab.tsx` med delene i `tabs/traffic/`, `src/hooks/useSiteTrafficBoard.ts`, `src/data/simulatedSiteTraffic.ts` | Bordet «Besøk på nettsiden» (del av modulen Analyse), det bordet henter og kan gjøre, og eksempeltallene for demonstrasjon |
| `src/utils/addons.ts`, `src/services/addons.ts`, `src/pages/admin/addons.ts`, `src/pages/admin/AddonGate.tsx`, `src/pages/admin/tabs/AddonsTab.tsx` med delene i `tabs/addons/` | Moduler: hvilke tillegg som finnes og om ett er på (`utils/addons.ts`), lagringen av valget, listen over produktmodulene og hva hvert tillegg legger i menyen, sperren foran en fane, og siden «Moduler» |
| `src/pages/admin/` | Admin Studio: `AdminStudio.tsx` er skallet, `StudioSidebar.tsx` menyen, og `tabs/` har én fil per fane |
| `src/installation.ts`, `.env.example`, `src/components/NotConfiguredNotice.tsx` | Hvilken database installasjonen hører til: innstillingene den leses fra, og meldingen som vises når de mangler |
| `src/utils/session.ts`, `src/services/auth.ts`, `src/components/SessionGate.tsx`, `src/pages/SignInPage.tsx`, `src/components/AccountMenu.tsx`, `src/utils/firstAdmin.ts` | Innlogging og roller: hvem en konto er i registeret og hvilken rolle personen har (`session.ts`), de to innloggingsmåtene, sperren foran Min side og admin, innloggingssiden, hvem som er logget inn, og første administrator |
| `src/utils/level.ts`, `src/hooks/useLevel.ts`, `src/pages/admin/levelTabs.ts`, `src/pages/admin/LevelGate.tsx` | De to nivåene, Menighetsplattform og Menighetsplan: hva de heter og om et nivå har planleggeren, hvilket nivå som gjelder, hvilke faner i admin et nivå har, og sperren foran en fane |
| `src/demo.ts`, `src/services/demoLevel.ts`, `src/components/DemoStrip.tsx`, `src/utils/demoDoor.ts`, `src/pages/DemoDoor.tsx`, `src/pages/admin/demoTabs.ts`, `src/pages/admin/DemoGate.tsx` | Demoen: om installasjonen er demoen (`DEMO`, fra `VITE_DEMO`), nivået den besøkende har valgt, stripen øverst, hvem man går inn som uten innlogging og siden man velger på, og fanene i admin som demoen er uten, med sperren foran dem |
| `src/utils/liveDates.ts`, `DEMO_CONTENT_WEEK` i `src/data/mockDocuments.ts` | Demoinnholdet følger kalenderen: uka innholdet er skrevet for, og flyttingen av alle datoer hele uker fram til i dag, med klokka som i Norge |
| `src/utils/demoReset.ts`, `scripts/reset-demo.ts`, `.github/workflows/nullstill-demo.yml`, `firestore.demo.rules` | Nullstillingen av demoen: reglene for hvilken database som kan nullstilles og hva som skrives og fjernes, skriptet som gjør det, tidsplanen som starter det hver natt, og de åpne reglene demoens database har |
| `src/utils/demoSite.ts`, `src/services/demoSite.ts`, `src/demoSite.ts`, `src/services/demoSiteList.ts`, `src/hooks/useDemoSites.ts` | Menigheten en besøkende ser på i demoen: reglene for valget og adressen, valget i nettleseren, `DEMO_SITE` (lest én gang når appen lastes), hvilke menigheter som ligger klare i demoens database, og lista i stripen |
| `src/utils/demoOwner.ts`, `src/services/demoOwner.ts`, `src/hooks/useDemoOwner.ts`, `src/pages/admin/tabs/DemoSetupTab.tsx` | Eieren av demoen: eierkoden og fingeravtrykket av den, om den som sitter ved nettleseren er eieren, og fanen «Demo-oppsett» der eieren bestemmer hvilke menigheter som står i lista for alle |
| `src/data/settingsRecords.ts` | Merkene på dokumentene som ligger i `cms_settings` ved siden av innstillingene (tjenesteroller, oppmøtetall, driftsmodus), uten databasen, så et skript lagrer dem som appen gjør |
| `src/pages/myPage/` | Min side: `useMyPage.ts` regner ut alt som vises, resten er én fil per seksjon |
| `src/pages/leaderGroup/` | Delene av gruppesiden (`LeaderGroupDetailPage.tsx`) |
| `src/components/gathering/` | Dialogene i samlingsvisningen (`GatheringDetailView.tsx`) |
| `src/components/husfellesskap/` | Fanene og dialogene i husfellesskapsvisningen (`HusfellesskapView.tsx`) |
| `src/pages/`, `src/components/` | Øvrige sider og komponenter |
| `tests/` | Tester (Vitest). `assert(betingelse, navn)` fra `tests/assert.ts` registrerer én navngitt sjekk. `tests/support/offlineFirestore.ts` gir en ekte Firestore-klient uten nett til tester av datalaget |
| `firestore.rules` | Sikkerhetsregler |

---

## 4. Regler for kodeendringer
- **Nye dokumenter bygges ett sted.** Bruk funksjonene i `src/data/newDocuments.ts`. ID-er lages med `newId()` fra `src/utils/id.ts`, aldri med `Date.now()` alene.
- **Ingen stille feil.** En skriving som feiler skal meldes med `reportWriteError` (eller `save` i `FirebaseDataContext.tsx`, `attempt` i `CmsContext.tsx`). Skriv aldri en tom `catch`.
- **Listene endres bare av lytterne.** En handling i `FirebaseDataContext.tsx` sender skrivingen og lar lytteren vise resultatet. Legg aldri til en `setX((prev) => …)` ved siden av skrivingen; da kan skjermen vise noe som ikke er lagret.
- **Ikke les før du skriver.** Lister og kart i et dokument endres med `arrayUnion`, `arrayRemove` eller feltsti, og det som hører sammen skrives i én `writeBatch`. Se `src/services/firestore.ts`.
- **`undefined` før skriving.** Firestore avviser `undefined`. Et nytt dokument går gjennom `sanitizeForFirestore`, som fjerner slike felt. En oppdatering går gjennom `forUpdate`, som sletter feltet i databasen. Bruker du `sanitizeForFirestore` på en oppdatering, blir et tømt felt stående med gammel verdi.
- **Navnet på en samling skrives bare i `src/data/collections.ts`.** Bruk `COLLECTIONS` og `CMS_COLLECTIONS`, aldri navnet som tekst. I demoen har navnene id-en til menigheten den besøkende ser på, foran (`sogne-cms_pages`), og det er slik hver menighet der har sitt eget innhold. Det som skal ha de vanlige navnene uansett (datasett, nullstillingen), bruker `PLAIN_COLLECTIONS`. `tests/demo-site.test.ts` feiler ellers.
- **Nye samlinger** legges inn i `src/data/collections.ts` og får en regel i `firestore.rules`. En test feiler hvis regelen mangler. **Reglene i drift er eldre enn filen** og avviser nye samlinger til de publiseres. Prøv en skriving mot databasen før en funksjon bygges på en ny samling; tjenesteroller, oppmøtetall og besøkstall ligger derfor i `cms_settings` med `recordType`. En lytter på `cms_settings` spør etter sitt eget merke, aldri etter hele samlingen: besøkstallene der endres ved hvert besøk.
- **Ingenting om én menighet i koden.** Ikke et navn, en adresse, et kirkesamfunn eller en database. Det en menighet er og har, kommer fra innstillingene (`cms_settings`) eller fra installasjonens innstillinger (`src/installation.ts`), og et felt som er tomt, tegnes ikke. Eksempelmenigheten er oppdiktet, også navnet, og hører hjemme i demodataene (`src/data/cmsData.ts`, `src/data/mockData.ts`) og ingen andre steder. Heller ikke demodataene nevner en ekte menighet eller et kirkesamfunn. `tests/neutral-code.test.ts` feiler ellers.
- **Demoinnholdet er skrevet for én uke.** Hver dato i `mockData.ts` og `cmsData.ts` settes som om i dag var en dag i uka som begynner `DEMO_CONTENT_WEEK`: det som er gjort, dateres før den uka, og et oppmøtetall gjelder en samling som er holdt. Teksten nevner ingen årstid, høytid, måned eller dato, for innholdet vises hele året. Datoene flyttes når dokumentene lages (`getCustomMockDocuments(counts, now)`), så en test som trenger faste datoer, gir `now`. `tests/live-demo-data.test.ts` feiler ellers.
- **Valget av menighet i demoen er den besøkendes eget.** Det ligger i nettleseren og bestemmer hvilke samlinger appen leser (`DEMO_SITE`). Ingenting i demoen bytter ut innhold for alle: «Velg menighet» under Database gjør det, og er derfor ikke med i demoen. Det en menighet i demoen består av, bestemmes i `siteDocuments` i `src/utils/demoReset.ts`.
- **Ingen bilder av ansatte i demoen.** Demoen presenterer produktet, og et bilde av en person brukes ikke til det uten samtykke. En ekte menighets nettside går gjennom `withoutStaffPictures` (`src/utils/demoPortraits.ts`) før den legges i demoens database. Et nytt felt eller en ny blokk som kan holde et bilde av en person, må tas med der. `tests/demo-portraits.test.ts` prøver alle settene.
- **Eieren av demoen kjennes på en kode, og bare i demoen.** Det eieren alene kan gjøre, spør `useDemoOwner()` og tegnes ikke for andre. Koden står aldri i koden eller i innstillingene: der står fingeravtrykket (`VITE_DEMO_OWNER_CODE_HASH`). Koden beskytter skjermen, ikke databasen, så ingenting som må være hemmelig eller trygt, legges bak den.
- **Bare demoen nullstilles.** Ingenting i appen tømmer demoens database, og ingenting utenfor appen tømmer en menighets. Det som fyller eller tømmer en database utenfra, spør `resetRefusal` i `src/utils/demoReset.ts` først.
- **Hvem brukeren er, avgjøres ett sted.** Spør `session` og `currentUser` fra `useFirebase()`. Rollen følger av personen i registeret (`roleOf` i `src/utils/session.ts`), aldri av kontoen. Lag ingen vei inn utenom innlogging, og ingen skjerm bak innlogging utenfor `SessionGate`. Demoen er eneste unntak, og veien inn der er den som finnes: `mayStandIn` og `DemoDoor`. I tester sier `tests/support/session.ts` hvem som er logget inn.
- **Analysebordet anslår aldri.** Et tall uten grunnlag er `null` og vises som strek. Et svar («Kommer») er ikke oppmøte. Nye tall legges i `src/utils/churchAnalytics.ts` med test, og datagrunnlaget sier hva de bygger på.
- **Besøk telles anonymt.** Tellingen lagrer ingenting i den besøkendes nettleser, og lagrer ingenting om den besøkende eller utstyret: ikke henviser, skjermstørrelse eller nettleser. Nettleserens navn ses bare på for å kjenne igjen roboter, og sendes ikke videre. Et nytt tall må kunne telles av det nettsiden selv vet (hvilken side, når, hvor lenge, hvilken knapp). Alt annet krever samtykke fra den besøkende (ekomloven § 3-15) og bygges ikke uten at det er bestemt. En adresse er en side når `seoForPath` sier det.
- **En modul slås på, den er ikke der fra før.** En del av admin som ikke alle menigheter skal ha, er et tillegg: navngi det i `src/utils/addons.ts`, beskriv det i `src/pages/admin/addons.ts`, og gi fanen plass som andre faner. Menyen, siden Moduler og sperren foran fanen følger listen. Spør alltid `isAddonOn`, og la det som er av, verken lese eller telle. Valget er ikke innhold, og følger ikke med i et datasett.
- **Nivået spørres ett sted.** En skjerm som er ulik på de to nivåene, spør `useLevel()` og `hasPlanner(level)`. Les aldri valget i nettleseren direkte: det gjelder bare i demoen. Det som finnes på begge nivå, spør ikke.
- **Demoen er en innstilling, ikke egen kode.** Det som bare finnes i demoen, spør `DEMO` fra `src/demo.ts` og tegnes ikke når den er `null`. Ingenting om demoen lagres i databasen, med ett unntak: eierens oppsett av demoen (`DEMO_SETUP_DOC_ID` i `src/utils/demoSite.ts`), som nullstillingen lar ligge. Noe som festes øverst på skjermen, festes med `top-[var(--demo-strip,0px)]`, så det står under stripen i demoen.
- **Demoens database deles av alle som ser på den.** En fane som tømmer eller bytter ut innhold for alle, og en fane som hører til et tillegg, føres opp i `src/pages/admin/demoTabs.ts`. En funksjon som sletter mer enn det brukeren selv har pekt på, kaller `ensureDeletionAllowed` først.
- **De planlagte modulene er bare navn.** Givertjeneste, Utleie, Arrangement, Kommunikasjon, Skjemaer og AI-assistent står i modullisten uten innhold, og Analyse utvides ikke. Ingen funksjon bygges i dem før produkteier ber om det uttrykkelig (beskjed 7. oktober 2026). Regnskap er ikke en egen modul.
- **`visibility` er eneste bryter** for om en samling er offentlig. Les med `isPubliclyVisible` og skriv med `visibilityFields` fra `src/utils/visibility.ts`. `isPublic` lagres bare som et speil. Hva som er kommende, hva som er en gudstjeneste og hva forsiden løfter fram, hentes fra `src/utils/gatherings.ts`.
- **En gruppe vises utad bare når `isGroupPublic` sier det.** Det gjelder nettsiden og `server/publicApi.ts`.
- **Ikke dikt opp innhold.** Mangler noe i databasen, vises det som manglende: ingen standardprogram, ingen navn, ingen gruppe-ID-er eller datoer fra demodataene i koden. Kjøreplanen bygges av `buildRunSheet` i `src/utils/runSheet.ts`, og en samling uten sted vises med `locationOf` fra `src/utils/gatherings.ts`.
- **Ikke lag skjema som ikke lagrer.** Et felt en besøkende fyller ut skal enten lagres og kunne leses av noen, eller ikke finnes. Det samme gjelder et valg i admin: det skal virke der det sier at det virker.
- **Ingen utviklerord i skjermbildene.** Feltnavn (`isPublic`, `Group.leaderIds`), ID-er, «mock» og «prototype» hører hjemme i koden. Brukeren ser norske ord for det samme.
- **Nettsiden bruker temafargene.** På offentlige sider (`src/pages/public/`, `src/components/public/`, `src/components/cms/`) heter hovedfargene `primary-*` og `accent-*`, aldri `indigo-*` eller `amber-*`. Da følger siden designet som er valgt i admin. Farger med fast betydning (rødt for avlyst, gult for varsel, grønt for bekreftet) er unntatt. En test feiler hvis regelen brytes.
- **Meldinger som forsvinner av seg selv** bruker `useTimedMessage` fra `src/hooks/`. Skriv ikke `setTimeout(() => setX(null), …)` ved siden av en `useState`.
- **Ingen person vises offentlig uten registrert samtykke.** Offentlige sider henter personer gjennom `toPublicProfile` / `publicProfilesOf` i `src/utils/publicProfile.ts`, som bare gir navn og kontaktinfo utad. Bruk aldri `person.phone` eller `person.email` på en offentlig side.
- **Persondata skal ikke ut i det offentlige API-et.** Nye felt i `server/publicApi.ts` må hvitelistes bevisst.
- **Én fane eller dialog per fil.** En ny fane eller dialog får sin egen fil med egen tilstand. Siden over eier bare hva som vises, og kaller sidens hook én gang og sender resultatet ned.
- **Oppgavens status følger av tildelingene.** Sett aldri `task.status` for hånd. Alt som endrer hvem som står på en oppgave, eller hvor mange den trenger, går gjennom handlingene i `FirebaseDataContext.tsx`. De lagrer statusen fra `taskStatusFor` i samme skriving. Ledige plasser leses med `countSlots`, ikke fra statusen. Begge ligger i `src/utils/staffing.ts`.
- **Tidspunkt lagres som eksakte øyeblikk.** Bruk `combineDateAndTimeToIso` fra `src/utils/dates.ts` når et skjema har dato og klokkeslett. En streng uten tidssone (`2026-10-18T11:00:00`) leses ulikt i nettleseren og på serveren.
- **Test den ekte koden.** Regler og utregninger legges i `src/utils/` som rene funksjoner og testes derfra. En test skal aldri ha sin egen kopi av logikken.
- **Interne ruter** må stå i `MIN_SIDE_SECTIONS` i `src/utils/routes.ts`. Det styrer layouten, om planleggingsdata lastes, og om serveren holder adressen utenfor søkeresultatene. Lenker til Min side skal gå til `/minside`; `/` er den offentlige forsiden.
- **Tittel og delingskort bestemmes ett sted.** En ny offentlig side får tittelen og beskrivelsen sin i `seoForPath` i `src/utils/siteSeo.ts`. Serveren og nettleseren spør begge der. Sett aldri `document.title` i en side.

---

## 5. Kjente mangler
Disse er ikke løst ennå. Rekkefølgen de skal løses i står i kapittel 14 i `PRODUKTDOKUMENTASJON.md`, og detaljene i `ARKITEKTUR.md`.

- Opplastede bilder lagres som tekst inne i sidedokumentene, og kan derfor ikke brukes som delebilde.
- Forsidens faste tekster står i koden, og standardtekstene i innholdsmodulene passer ikke alle menigheter.
- Stab vises fra to kilder: personregisteret med samtykke, og `cms_staff` uten.
- Innloggingen sperrer skjermene, ikke dataene. Reglene i databasen kjenner ennå ikke koblingen fra konto til person (trinn 4).
- `firestore.rules` slipper gjennom lesing og skriving uten innlogging.
- De offentlige sidene laster hele personregisteret til nettleseren, selv om de bare viser personer med samtykke.
- En besøkende kan ikke melde interesse for en gruppe i appen; `/fellesskap` viser hvem man kan kontakte.
- Innmeldingsdato i en gruppe lagres, men eldre meldinger skjules ikke for nye medlemmer.
- De to bryterne fra før modulene (kalender, meldinger) lagres bare i nettleseren til den som endrer dem, og styrer ikke noe innhold.
- Moduler kan slås av og på av hvem som helst i admin. Tildeling av moduler per menighet finnes ikke.
- Nivået styrer bare menyen og fanene i admin. Min side, arrangementssiden, oversikten og gruppene på nettsiden er like på begge nivå (trinn 3c), og hos en menighet kan nivået ikke settes (trinn 4).
- Reglene i databasen i drift er eldre enn `firestore.rules`. Nye samlinger avvises der til reglene publiseres.
- Besøkstallene kan endres og slettes av hvem som helst så lenge reglene er åpne. Med innlogging trenger de en egen samling der en besøkende bare kan legge til i summene.
