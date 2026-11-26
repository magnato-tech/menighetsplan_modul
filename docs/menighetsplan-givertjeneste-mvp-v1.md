# Givertjeneste MVP 1.0 – produkt- og implementeringsplan

*Versjon 1, 26. november 2026. **Godkjent samme dag. Leveranse 1 er bygget; leveranse 2–4 er ikke bygget.***
*Grunnlag: `origin/main` = `4571b4d`. Oppsett hos en menighet: [givertjeneste-oppsett.md](givertjeneste-oppsett.md).*

## Avgjort etter godkjenningen (26. november 2026)

| Spørsmål | Beslutning |
|:---|:---|
| Innlogging med Google for giverdata | **Krav** |
| «Givere» kan lese hele personregisteret | **Ja** |
| Demoen | Modulen **vises for alle** i demoen, med eksempeldata. Det erstatter «aldri i demoen» i teksten under |
| Testing og visning | Sendes inn til demoen og ses der. Java lastes ikke ned: regeltestene kjøres på GitHub |
| Lillesand | **Ikke slippes** |

Avvik fra teksten under: menypunktet heter **Gaveinnstillinger**. Den som er administrator uten rettighet, kan åpne siden og får se hvorfor den er stengt.

Slik leses planen. Hver opplysning hører til én av fire slag:

| Merke | Betyr |
|:---|:---|
| **Finnes** | Bekreftet i koden eller dokumentasjonen |
| **Krav** | Bestilt av produkteier |
| **Forslag** | Teknisk eller praktisk forslag i denne planen |
| **Uavklart** | Må avgjøres (samlet i kapittel 11) |

---

## 1. Anbefalt løsning i korte trekk

Alt i dette kapittelet er **forslag**.

1. Givertjeneste blir et **tillegg under Moduler**, med egne sider i admin. Av til noen slår det på, og aldri med i demoen.
2. **Egne rettigheter** som ikke følger av noen rolle. De ligger i en ny samling som en vanlig administrator ikke kan skrive til, og håndheves i databasereglene.
3. Individuelle giveropplysninger krever i tillegg **innlogging med Google**, låst til den Google-kontoen rettigheten ble tatt i bruk med.
4. **Gaveformål finnes ikke i dag** og lages som en liten, felles liste i admin.
5. **Ingen ny server og ingen ny teknologi.** Nettleseren snakker rett med menighetens database, som ellers i appen.
6. Den som bare skal se samlede tall, leser en **publisert oppsummering** og aldri enkeltgaver.
7. Gaver slettes aldri. Hver endring tar vare på det som sto der før.

---

## 2. Hva som finnes i dag (kontrollert)

### 2.1 Personregister og innlogging

| Finnes | Betydning for givertjenesten |
|:---|:---|
| Registeret er `persons`. En administrator leser og skriver alt. En frivillig leser bare seg selv. Protokollansvarlig leser hele registeret | Gjenbrukes. Økonomiansvarlig må kunne lese registeret for å koble en giver til en person |
| `logins/<e-post>` sier hvilken person en konto er. Skrives av administratorens nettleser fra registeret | **En administrator kan endre hvem en e-postadresse peker på.** Giverrettigheter kan derfor ikke bygge på dette alene |
| Innlogging: Google, e-postlenke, og «innloggingslenke» i e-post fra admin | De to lenkene kan leses av den som har tilgang til utsendingstjenesten. De bør ikke åpne giveropplysninger |
| Sletting av en person (`personDeletion.ts`) kjenner ikke til givere | Giveren må tåle at personen forsvinner fra registeret |

### 2.2 Tilgangsstyring

| Finnes | Betydning |
|:---|:---|
| Roller på personen: administrator, nettredaktør, medlem, pluss haken «Protokollansvarlig» | **Ingen modell for egne rettigheter.** Alle disse kan settes av en administrator, så de kan ikke brukes til giverdata |
| Protokollansvarlig kommer inn i admin med bare sine faner | Mønsteret gjenbrukes: økonomiansvarlig uten annen admintilgang får bare givertjenesten |
| `firestore.rules`: lukket for alle utenfor registeret, ingen samleregel som åpner alt | Nye samlinger er stengt til de får en regel |
| `firestore.demo.rules`: alt åpent | Modulen må aldri være med i demoen |
| Reglene limes inn for hånd i hver menighets Firebase-prosjekt | Hver regelendring er et eget steg ved slipp |
| `npm run test:rules` krever Java 21. Java ble ikke funnet på utviklingsmaskinen, og GitHub-sjekken (`sjekk.yml`) kjører ikke regeltestene | **Må løses i første leveranse.** `CLAUDE.md` sier at endringene fra sikkerhetsgjennomgangen ikke er prøvd mot emulatoren |

### 2.3 Gaveformål og kollekt

| Finnes | Finnes ikke |
|:---|:---|
| Vipps-nummer, Vipps-tekst, kontonummer og organisasjonsnummer i nettside-innstillingene (`cms_settings/global`) | **Register over gaveformål** |
| Innholdsblokken «Givertjeneste & Vipps» og bunnen av nettsiden viser disse | **Kollektplanlegging eller kollektadministrasjon** |
| «Kollekt» som programpunkt i mal og kjøreplan, og i instrukser til møteleder | Noen registrering av beløp, gaver eller givere |
| «Givertjeneste» står som navn på en planlagt modul (`pages/admin/addons.ts`) | Noen kode bak navnet |

Følge: Det finnes ingen kollektdata å hente, og ingen parallelle registre å rydde. Planen lager **bare** gaveformålslisten i admin. Kollektadministrasjon bygges ikke.

### 2.4 Menighetsisolasjon

**Finnes (bekreftet):** Én installasjon per menighet. `src/installation.ts` leser databasen fra installasjonens innstillinger, uten reserve. Dokumentene har ingen menighets-id, og reglene gjelder én database. En konto fra et annet Firebase-prosjekt godtas ikke. Serverfunksjonene kontrollerer at tjenestenøkkelen hører til samme prosjekt.

Isolasjonen ligger altså i oppsettet, ikke i datamodellen. **Forslag:** ingen menighets-id i giverdataene. Det som må passes på, er at hver installasjon får egne innstillinger. Demoens flere «menigheter» deler én database og er ikke isolert, så modulen holdes ute.

**Adressen:** `lmk.menighetsplan.no` og `lillesandmisjonskirke.menighetsplan.no` svarte begge 26. november 2026 med samme versjon av appen og samme Firebase-prosjekt (`menighetsplan-lillesand`). Det er **samme installasjon og samme data**. Planen bruker `lmk.menighetsplan.no`. **Uavklart:** at `lmk` står blant godkjente domener for innlogging i Firebase, er ikke kontrollert.

### 2.5 Annet som gjenbrukes

| Finnes | Brukes til |
|:---|:---|
| Moduler: `utils/addons.ts`, `AddonGate`, menyen | Slå modulen av og på |
| Adminskallet, `studio.ts`, `studioTheme`, `ConfirmDialog`, `useTimedMessage` | Sider og design |
| CSV-lesing (`parseCsv`, `decodeCsvBytes`, `csvFileError` i `cornerstoneImport.ts`) | Import. Flyttes til en felles `utils/csv.ts` |
| CSV-skriving med vern mot regnearkformler (`utils/analytics/export.ts`) | Eksport |
| `newDocuments.ts`, `newId()`, `sanitizeForFirestore`, `forUpdate`, `reportWriteError` | Skriving |
| Firestore uten lagring på disk (standard i `firebase.ts`) | Giverdata blir ikke liggende på maskinen. Skal forbli slik |
| Vitest og `rules-tests/` | Testing |
| Revisjonslogg | **Finnes ikke** generelt (bare `updatedBy` enkelte steder, sidehistorikk og medlemslogg). Lages for givertjenesten |

---

## 3. Tilgang og sikkerhet

### 3.1 Rettigheter (krav: tildeles enkeltvis)

| Rettighet | Gir | Gir ikke |
|:---|:---|:---|
| **Oversikt** | Publiserte samlede tall og budsjett | Enkeltgaver, givere, avtaler |
| **Budsjett** | Det samme, og opprette og endre gavebudsjett | Enkeltgaver, givere, avtaler |
| **Givere** (individuell givertjeneste) | Givere, avtaler, gaver, import, eksport, publisering av tall. Lesing av personregisteret | Å tildele tilgang |
| **Tilganger** | Se, gi og fjerne rettigheter for andre | Egne rettigheter, og giverdata uten «Givere» |

Ingen rolle gir noen av dem: ikke administrator, pastor, styreleder eller gruppeleder.

### 3.2 Hvordan det håndheves (forslag)

Ny samling `givingAccess/<e-postadresse>` med person, de fire rettighetene og Google-kontoens id.

Reglene slipper noen til giverdata bare når **alt** dette stemmer:

1. Innlogget, bekreftet e-post, og i registeret (`isMember()`).
2. Innlogget **med Google** i denne økten.
3. Det finnes et tilgangsdokument for e-postadressen, for samme person, med rettigheten.
4. Google-kontoen er den som ble lagret da rettigheten ble tatt i bruk.
5. Modulen er slått på.

```
function givingMay(right) {
  let grant = /databases/$(database)/documents/givingAccess/$(request.auth.token.email.lower());
  return isMember()
    && request.auth.token.firebase.sign_in_provider == 'google.com'
    && exists(grant)
    && get(grant).data.personId == me()
    && get(grant).data.googleId in request.auth.token.firebase.identities['google.com']
    && get(grant).data.get(right, false) == true
    && get(/databases/$(database)/documents/cms_settings/addons).data.get('on', {}).get('givertjeneste', false) == true;
}
```

(Skisse. Skrives ferdig og prøves mot emulatoren i leveranse 1.)

Hvorfor punkt 2 og 4: En innloggingslenke på e-post kan i verste fall brukes av andre enn mottakeren, og den som er inne på en konto, kan knytte en annen Google-konto til den. Med begge kravene hjelper ingen av delene.

| Hva en vanlig administrator kan | Virkning |
|:---|:---|
| Slå modulen på | Ingen innsyn |
| Slå modulen av, eller slette personen eller innloggingen | Tilgangen **stenges**. Den åpnes ikke for andre |
| Endre e-post eller hvem en adresse peker på | Tilgangen stenges |
| Skrive i `givingAccess` | Avvises |

**Første tildeling** gjøres for hånd i Firebase-konsollen av den som eier prosjektet, etter en skrevet oppskrift. Deretter bruker den med «Tilganger» siden Innstillinger: e-postadressen skrives inn, og appen slår opp den ene innloggingen for å finne personen (reglene åpner for det oppslaget, ikke for hele listen). Ingen kan endre sitt eget dokument, eller gi rettigheter til sin egen person.

**Grensen for hva appen kan beskytte mot** (må forstås før godkjenning): Den som eier Firebase- eller Google-prosjektet, har tjenestenøkkelen (ligger hos Vercel), kan publisere regler eller kan legge ut ny kode, kan teknisk komme til alle data. Det gjelder uansett hvilken rolle personen har i appen. Menigheten må vite hvem dette er, og velge det bevisst. Det samme gjelder den som kan tilbakestille passordet til økonomiansvarligs Google-konto. Den med «Tilganger» er også en betrodd person: alt logges, men to-personers godkjenning bygges ikke.

### 3.3 Sporing

| Hendelse | Hvordan | Hvor sikkert |
|:---|:---|:---|
| Opprettelse og endring av giver, avtale, gave, referanse | Skrivingen avvises hvis historikken ikke skrives i samme sending | Håndheves av reglene |
| Tildeling og fjerning av tilgang | Samme prinsipp, i `givingLog` | Håndheves av reglene |
| Eksport og åpning av giverkort | Appen skriver i `givingLog` | **Bare appen.** Direkte oppslag i databasen logges ikke slik |
| Alle lesinger i databasen | Google Cloud sine revisjonslogger («Data Access») kan slås på for Firestore | Utenfor appen. **Uavklart:** om sluttbrukeren navngis, og hva det koster, er ikke bekreftet ([dokumentasjon](https://docs.cloud.google.com/firestore/docs/audit-logging)) |

Loggene inneholder id-er, aldri navn eller beløp (unntatt historikken, som bare «Givere» leser). Importrader skrives aldri til konsoll eller feillogger. Den opplastede filen lagres ikke.

### 3.4 Samlede tall uten enkeltgivere

Med rundt 20 givere kan en oppdeling lett avsløre enkeltpersoner. **Forslag:**

- Den med «Givere» ser nøyaktige tall direkte.
- Andre ser bare det den med «Givere» har **publisert**, og bare for avsluttede måneder. Da kan ingen følge totalen gave for gave.
- Publisert: gaver til drift per måned, sum hittil, budsjett og avvik. Fordeling på formål og gavetype **per kvartal**.
- Et tall vises bare når minst **5 givere** står bak. Ellers slås måneder sammen («januar–februar»), og små formål samles i «Andre», til kravet er oppfylt. Kontantkollekt er unntatt, for den er allerede en fellessum.
- Avtalt fast givertjeneste og antall faste givere vises bare ved minst 5.
- Ingen egne filtre eller krysstabeller for denne visningen.

Gjenstående risiko: én stor giver kan fortsatt anes i en liten menighet, og en korrigering publisert på nytt viser en forskjell. Det kan ikke fjernes helt.

### 3.5 Personvern før ekte data (krav)

Gaveopplysninger til en menighet kan vise religiøs tilhørighet, som er en særlig kategori personopplysninger (personvernforordningen artikkel 9). Dette er ikke juridisk rådgivning. Før første ekte gave registreres, må menigheten ha avklart og skrevet ned:

- [ ] behandlingsgrunnlag etter artikkel 6 og 9
- [ ] lagringstid, blant annet hva regnskapsreglene krever (avklares med regnskapsfører)
- [ ] om det trengs en vurdering av personvernkonsekvenser (DPIA)
- [ ] databehandleravtaler (leverandøren av appen, Google)
- [ ] informasjon til giverne, og hvordan innsyn, retting og sletting håndteres
- [ ] hvor databasen ligger, og at sikkerhetskopi er slått på
- [ ] totrinnsbekreftelse på Google-kontoene med tilgang, og hvem som eier Firebase og Vercel

Fødselsnummer samles ikke inn. Ingen fritekstfelt om giveren (da skrives lett noe sensitivt der).

---

## 4. Sider og komponenter (forslag)

### 4.1 Meny

Under overskriften **Givertjeneste** i admin, synlig bare for den med rettigheten. En side vises først når leveransen den hører til, er levert.

| Side | Ser den | Innhold | Leveranse |
|:---|:---|:---|:---:|
| **Oversikt** | Oversikt, Budsjett, Givere | Tallene i 4.3 | 4 |
| **Givere** | Givere | Tabell: navn, avtalt per måned, mottatt i år, status. Søk. Åpner giverkortet | 2 |
| Giverkort (under Givere) | Givere | Opplysninger, avtaler, historikk, sum per år, betalingsreferanser (fra 3) | 2 |
| **Innbetalinger** | Givere | Liste med filtre, registrer gave, «Må behandles», korriger. Import og eksport fra 3 | 2, 3 |
| **Budsjett** | Oversikt (lese), Budsjett | Per år: sum, fordeling på formål og måneder, faktisk og avvik | 4 |
| **Innstillinger** | Tilganger; Givere (regnskapskonto) | Hvem har tilgang. Betalingsinformasjon vist fra nettside-innstillingene (endres der). Regnskapskonto per formål (fra 3) | 1, 3 |

Utenfor modulen, i admin: **Gaveformål** (bare administrator, synlig når modulen er på): navn, «Ordinær drift» eller «Øremerket», i bruk eller ikke. Formål slettes ikke, og «drift/øremerket» kan ikke endres etter opprettelsen, så gammel statistikk ikke flytter seg.

Slå modulen av og på: siden **Moduler**, som i dag. Ingen tomme sider eller innstillinger for noe som ikke er bygget.

### 4.2 Filer

| Hva | Hvor |
|:---|:---|
| Regler og utregninger (tilgang, summer, budsjett, publisering, import, duplikater) | `src/utils/giving/` |
| Lesing og skriving (engangslesing, ingen faste lyttere utover eget tilgangsdokument) | `src/services/giving/` |
| Tilgangen til den innloggede | `src/hooks/useGivingAccess.ts` |
| Sidene, lastet først når de åpnes | `src/pages/admin/tabs/giving/` |
| Gaveformål | `src/pages/admin/tabs/GivingPurposesTab.tsx` |
| Hvem som får åpne hvilke faner | Én ren funksjon som slår sammen reglene for nettredaktør, protokollansvarlig og givertilgang. `SessionGate` må slippe inn den som bare har givertilgang |

### 4.3 Oversikten

Velg år. Årets budsjett, mottatt hittil, avvik, avtalt fast gave per måned, **årstakt** (avtalt per måned × 12), antall aktive faste givere, gaver per måned, fordeling på formål og på gavetype, og antall innbetalinger som må behandles (bare «Givere»).

Faste definisjoner:

- **Gavetype** (fast, enkeltgave, kollekt) og **gaveformål** er to felt på samme gave. «Øremerket» er en egenskap ved formålet, ikke en type. Hver gave telles én gang.
- **Budsjettet** gjelder gaver til ordinær drift. Øremerkede formål vises for seg.
- **Avvik** regnes til og med siste avsluttede måned.
- **Avtalt** = sum av aktive avtaler regnet om til måned. **Mottatt** = registrerte gaver. De blandes aldri.

---

## 5. Datamodell (forslag)

Beløp i **øre som heltall**. Datoer `ÅÅÅÅ-MM-DD`. Id-er fra `newId()`. Samlingsnavn bare i `data/collections.ts`. Ingen av samlingene er med i datasett, testdata, demo eller «Slett alt».

| Samling | Felt | Leses av | Skrives av |
|:---|:---|:---|:---|
| `givingPurposes/<id>` | name, usage (`drift`/`oremerket`), active | Administrator, alle med givertilgang | Administrator. Ikke slette |
| `givingAccess/<e-post>` | personId, name, overview, budget, individual, manage, googleId, version | Eget dokument; «Tilganger» | «Tilganger», aldri sitt eget. Eieren av dokumentet skriver bare `googleId`, én gang |
| `givers/<id>` | personId?, name, email?, phone? (kontakt bare for eksterne), active, version | Givere | Givere. Ikke slette |
| `giftAgreements/<id>` | giverId, purposeId, amountOre, frequency (måned/kvartal/år), startDate, endDate?, method, status (aktiv/pause/avsluttet), externalRef?, version | Givere | Givere. Ikke slette |
| `gifts/<id>` | date, year, amountOre, purposeId, type, source (vipps/bank/kontant/annet), identification (kjent/anonym/uidentifisert), giverId?, agreementId?, gatheringId?, externalRef?, settlementRef?, payerText?, importId?, status (gyldig/annullert), voidReason?, version | Givere | Givere. **Aldri slette** |
| `giverReferences/<avtrykk>` *(lev. 3)* | giverId, source, label, confirmedBy | Givere | Givere |
| `givingEvents/<type_id_versjon>` | at, by, type, docId, version, hele dokumentet slik det ble | Givere | Bare sammen med endringen. Aldri endre eller slette |
| `givingLog/<id>` | at, by, action, targetId?, antall rader | Tilganger | Opprettes av dem med givertilgang. Aldri endre eller slette |
| `givingSettings/accounts` *(lev. 3)* | regnskapskonto per formål | Givere | Givere |
| `givingBudgets/<år>` *(lev. 4)* | totalOre, months[12], purposeOre, updatedBy | Alle med givertilgang | Budsjett |
| `givingSummaries/<år>` *(lev. 4)* | publiserte, skjermede tall, til og med måned, publishedBy | Alle med givertilgang | Givere |

Valg som må forstås:

- **Ingen dobbelt person.** En giver knyttet til registeret får personens id som sin id, så den ikke kan opprettes to ganger. Kontaktopplysninger hentes fra registeret. Bare navnet lagres i tillegg, så giveren fortsatt kan kjennes igjen hvis personen slettes. En ekstern giver som senere knyttes til en person, beholder id-en; appen hindrer at personen allerede er giver.
- **Min givertjeneste senere:** `personId` er koblingen til brukerkontoen. Ingenting mer bygges nå.
- **Avtaler** er registrert **hensikt**. De vises aldri som aktive hos Vipps eller bank. Nytt beløp: avslutt den gamle og opprett en ny. Uteblitte gaver gir ingen gjeld eller purring.
- **Kontantkollekt** er én anonym gave av typen kollekt, eventuelt knyttet til gudstjenesten (`gatheringId`). Vipps-gaver i samme kollekt kommer med importen og telles ikke på nytt i kontantsummen.
- **Korrigering:** gaven endres med ny versjon, eller annulleres med grunn. Det gamle står i historikken.
- **Samme transaksjon bare én gang:** importerte gaver får id av transaksjonsreferansen (`vipps-<PSP-referanse>`). Databasen avviser da en ny opprettelse.
- **Teknisk grense:** reglene tåler få oppslag per sending, så hver gave lagres i sin egen sending med historikken. En avbrutt import kan kjøres på nytt uten dubletter.
- **Lesing:** ett års gaver hentes når siden åpnes (noen hundre til få tusen dokumenter). Ingen bakgrunnsjobber.

---

## 6. Arbeidsflyten for økonomiansvarlig

**Én gang:** Modulen slås på → administrator legger inn gaveformål → første tilgang gis → økonomiansvarlig logger inn med Google → legger inn givere og faste avtaler → lager årets budsjett.

**Løpende:**

1. **Kontant og annet:** Innbetalinger → Registrer gave. Alle valg starter tomme.
2. **Import (hver måned):**
   1. Last opp CSV. Filen leses i nettleseren og lagres ikke.
   2. Forhåndsvisning.
   3. Duplikater merkes. Utbetalinger fra Vipps på bankkontoen (tekst «Utb. … Vippsnr …») merkes «ikke ny gave».
   4. Gaveformål velges for filen, og kan endres per rad.
   5. Giver foreslås når referansen er bekreftet før. Usikre treff (bare likt navn) må godkjennes rad for rad.
   6. Godkjenn. Resten ligger under «Må behandles».
3. **Må behandles:** koble til giver, opprett ekstern giver, eller marker anonym.
4. **Avstemming:** eksporter til regnskapet.
5. **Etter månedsslutt:** «Publiser tall til og med …» for dem som bare ser oversikten.

**To eksporter:**

| Eksport | Innhold | Personopplysninger |
|:---|:---|:---|
| **Til regnskapet** (Tripletex) | Dato, formål, regnskapskonto, kilde, oppgjørsreferanse, antall, sum | Ingen navn. En linje med én gave kan likevel kjennes igjen, så filen behandles fortrolig |
| **Innbetalinger** | Radene i det valgte filteret, med giver | Ja. Eget spørsmål før nedlasting, og logges |

### Vipps og bank

**Undersøkt 26. november 2026 i offisiell dokumentasjon:**

| Funn | Kilde |
|:---|:---|
| Donations-API-et gjelder bare produktet Donations, som menigheten må være godkjent for. Finnes ikke i testmiljø | [Donations API](https://developer.vipps.no/docs/APIs/donations-api/), [oppstart](https://developer.vipps.no/docs/APIs/donations-api/quick-start/) |
| API-et gir betalinger med avtale-id, giver (navn, telefon) og referanser, men ingen avstemming mot utbetaling | [spørsmål og svar](https://developer.vipps.no/docs/APIs/donations-api/faq/) |
| Samtykke til skattefradrag, med fødselsnummer, kan hentes for organisasjoner godkjent for ordningen | [skattesamtykker](https://developer.vipps.no/docs/APIs/donations-api/tax-deduction-consents/) |
| Portalen gir CSV med én linje per transaksjon: tid, type, beløp, gebyr, kundens navn, **maskert** telefonnummer, melding, PSP-referanse, ordrereferanse og utbetalingsnummer | [oppgjør](https://developer.vipps.no/docs/knowledge-base/settlements/) |
| Banktekst for utbetaling i Norge: `Utb. {mottaker} Vippsnr {utbetalingsnummer}` | samme |

Følger: PSP-referansen brukes mot dubletter. Portalfilen har ingen dokumentert fast giver-id, så navn og siste sifre er et **forslag**, ikke et sikkert treff. Bare betalingsrader blir gaver; gebyr og utbetaling hoppes over, og tilbakebetaling behandles for hånd. Gaven registreres med beløpet før gebyr.

**Uavklart:** hva menighetens avtale faktisk gir (Donations eller vanlig Vippsnummer), de norske kolonnenavnene, og bankens filformat. Til leveranse 3 trengs **bare overskriftslinjen** fra hver fil, aldri rader med personer.

Bankimport: brukeren velger hvilke kolonner som er dato, beløp, tekst og referanse. Uten fast transaksjons-id lages nøkkelen av dato, beløp, tekst, referanse og nummer blant like rader. Mulige dubletter (også mot håndregistrerte) vises til avgjørelse.

---

## 7. Leveranser og akseptansekriterier

Hver leveranse planlegges, bygges, vurderes, testes, vises på egen maskin og godkjennes før neste. Ingenting slippes til `stabil` uten produkteiers beskjed.

### Leveranse 1 – Grunnmur og tilgang *(første)*

**Innhold:** regeltester i GitHub-sjekken (og dagens tester grønne) · modulen under Moduler, sperret i demo · `givingAccess` med aktivering og logg · Innstillinger med tilgangsstyring · Gaveformål i admin · ferdige regler for givere, avtaler, gaver og historikk · lesing av personregisteret for «Givere» · oppskrift for første tildeling og publisering av regler.

**Godkjennes når:**

- [ ] Administrator, nettredaktør, protokollansvarlig, gruppeleder, medlem, ukjent konto og besøkende **avvises** av databasen for alle giversamlinger: lese ett, liste, opprette, endre, slette.
- [ ] Det samme gjelder «Givere» innlogget med innloggingslenke eller e-postlenke, med feil Google-konto, med modulen av, og etter at tilgangen er fjernet.
- [ ] En administrator kan ikke gi seg selv noen giverrettighet. Den med «Tilganger» kan ikke endre egne.
- [ ] En skriving uten tilhørende historikk avvises. Historikk og logg kan ikke endres eller slettes.
- [ ] Økonomiansvarlig uten annen admintilgang ser bare givertjenesten.
- [ ] Gaveformål kan opprettes og tas ut av bruk, men ikke slettes.
- [ ] Datasett, demo, testdata og serverfunksjoner berører ingen giversamling.
- [ ] Alle gamle tester er grønne, og modulen av gir ingen synlig endring.

### Leveranse 2 – Givere og avtaler

**Innhold:** giverliste, giverkort, avtaler, manuell gaveregistrering, anonym gave, historikk, korrigering og annullering.

**Godkjennes når:**

- [ ] Giver kan være person i registeret, ekstern, eller uten konto. Samme person kan ikke bli giver to ganger.
- [ ] En giver kan ha flere avtaler, som kan opprettes, endres, pauses og avsluttes. Skjermen sier at de ikke er bekreftet hos Vipps eller bank.
- [ ] Anonym gave lagres uten giver.
- [ ] Summer per år og per måned stemmer for oppdiktede testdata. Annullerte gaver teller ikke.
- [ ] Det går an å se hvem som endret hva, og verdien før.
- [ ] Giveren vises fortsatt hvis personen slettes fra registeret.

### Leveranse 3 – Innbetalinger

**Innhold:** CSV-import (Vipps, deretter bank), forhåndsvisning, duplikater, giverforslag, «Må behandles», huskede referanser, annullering av en hel import, filtre, begge eksportene, regnskapskonto per formål.

**Godkjennes når:**

- [ ] Samme fil importert to ganger gir ingen nye gaver. Overlappende filer gir bare de nye.
- [ ] Vipps-utbetaling i bankfilen blir ikke ny gave.
- [ ] Ingenting lagres før «Godkjenn». Usikre treff kobles aldri av seg selv.
- [ ] En avbrutt import kan kjøres om uten dubletter.
- [ ] Æ, ø, å, semikolon, komma i beløp og formeltegn i tekst håndteres.
- [ ] Regnskapseksporten har ingen navn, og summen stemmer med appen. Eksport logges.

### Leveranse 4 – Oversikt og budsjett

**Innhold:** gavebudsjett, oversikt, publisering, månedlig oppfølging, avtalt fast givertjeneste, tidligere år.

**Godkjennes når:**

- [ ] Årsbudsjett fordeles likt på 12 måneder (øre går opp), og kan justeres så summen stadig stemmer.
- [ ] Avvik, avtalt, årstakt og mottatt stemmer mot et fasiteksempel.
- [ ] «Oversikt» alene får ingen enkeltdata, heller ikke ved direkte oppslag.
- [ ] Ingen publisert verdi bygger på færre enn 5 givere (kontantkollekt unntatt), og skjulte tall kan ikke regnes ut ved å trekke fra.
- [ ] Hver gave telles én gang i type, formål og total.

**Før ekte data:** sjekklisten i 3.5 er fylt ut, reglene er publisert og kontrollert hos menigheten, og leveranse 1 er godkjent der.

---

## 8. Tester

| Slag | Hva |
|:---|:---|
| **Regeltester** (`rules-tests/`) | Tabell over alle besøkstyper × alle giversamlinger × handlinger. Innloggingsmåte, Google-id, modul av, fjernet tilgang, endret `logins`, selvtildeling, historikk-kravet, ny opprettelse av samme importnøkkel. En konto uten innlogging i denne databasen får ingenting |
| **Rene funksjoner** | Summer, budsjettfordeling, avvik, avtaler per måned, publisering og skjerming (også forsøk på å regne ut skjulte tall), CSV-lesing, duplikatnøkler, giverforslag, eksport |
| **Skjermer** | Meny og faner per rettighet, modul av/på, demo, giverliste og kort, registrering, korrigering, importflyten |
| **Vakter** | `server/` og `api/` nevner ingen giversamling. Giversamlingene står ikke i `ALL_COLLECTIONS`. Ingen testdataknapper i modulen |
| **For hånd** | Hos menigheten, med en egen testkonto uten giverrettigheter, etter publisering av reglene |

Alle testdata er oppdiktede.

**Visning på egen maskin:** modulen krever ekte innlogging, så «gå inn som en person» virker ikke. **Forslag:** et eget Firebase-testprosjekt med lukkede regler og oppdiktede data, uten kodeendring.

---

## 9. Hva som ikke bygges

Kollektplanlegging og -administrasjon, administrasjon av gaveformål inne i modulen, strategisk årsplan, kampanjer, prognoser, rapportgenerator, Vipps-API, Tripletex-API, bokføring, bank, KID/OCR, AvtaleGiro, skatterapportering, årsoppgaver, automatiske e-poster, Min givertjeneste og integrasjonsrammeverk.

Naturlige utvidelsespunkter: `source` og `externalRef` på gaver og avtaler, `settlementRef`, og `personId` på giveren.

---

## 10. Risikoer

| Risiko | Tiltak |
|:---|:---|
| Prosjekteier, tjenestenøkkel og kodeutlegging gir teknisk full tilgang | Vite hvem, totrinnsbekreftelse, få personer. Skrive det i personvernvurderingen |
| Reglene limes inn for hånd; gamle eller feil regler | Oppskrift, kontroll med testkonto etter publisering. Nye samlinger er stengt uten regel |
| Regeltestene har ikke vært kjørt jevnlig | Inn i GitHub-sjekken først i leveranse 1 |
| Små tall avslører givere | Skjerming i 3.4. Vurdere om «bare oversikt» trengs (kapittel 12) |
| Økonomiansvarlig mister tilgang når registeret endres | Stenger heller enn å åpne. Gis på nytt av «Tilganger» |
| Feil i import gir mange feil gaver | Forhåndsvisning, annullering per import |
| Ingen sikkerhetskopi av databasen er bygget | Slå på Firestores sikkerhetskopi før ekte data |
| Nettredaktør og administrator kan endre Vipps-nummer og kontonummer på nettsiden, så gaver sendes feil | Utenfor MVP. Vurderes som egen sak |
| Bunnen av nettsiden har en fast setning om skattefradrag | Kjent mangel (kapittel 13 i produktdokumentasjonen) |
| Slipp til `stabil` tar med hele `main` | Modulen er av til den slås på, og stengt uten publiserte regler |

---

## 11. Uavklarte beslutninger

| # | Spørsmål | Anbefaling | Trengs før |
|:---:|:---|:---|:---|
| 1 | Hvem får «Tilganger», og hvem får «Givere»? | To ulike personer. «Tilganger» f.eks. til styrets leder | Lev. 1 tas i bruk |
| 2 | Har disse en Google-konto på adressen i registeret? Er Google-kravet greit? | Ja | Lev. 1 |
| 3 | Hvem eier Firebase og Vercel for menigheten, og er det greit at den teknisk kan se alt? | Avklares og skrives ned | Ekte data |
| 4 | Kan «Givere» lese hele personregisteret (også fødselsdato), slik protokollansvarlig gjør? | Ja. Alternativet er en egen navneliste som må holdes ved like | Lev. 1 |
| 5 | Er grensen på 5 givere riktig? | Ja | Lev. 4 |
| 6 | Hvordan vise modulen på egen maskin? | Eget testprosjekt | Lev. 1 |
| 7 | Skal lesing logges på databasenivå (Google revisjonslogg)? | Undersøke kostnad og innhold i lev. 1 | Ekte data |
| 8 | Hva gir Vipps-avtalen, og hvordan ser filen ut? | Se i Vipps-portalen. Send bare overskriftslinjen | Lev. 3 |
| 9 | Hvilken bank, og hvordan ser filen ut? | Som over | Lev. 3 |
| 10 | Skatterapportering selv eller via Misjonskirken Norge? | Kan vente | Etter MVP |
| 11 | Personvernsjekklisten i 3.5 | Menigheten eier den | Ekte data |

---

## 12. Mulige forenklinger

| Forenkling | Sparer | Koster | Anbefaling |
|:---|:---|:---|:---|
| **Ingen «bare oversikt» i MVP:** styret får tallene av økonomiansvarlig | Publisering, skjerming og største avsløringsrisiko | Kravet om tilgang til samlede tall uten individuelle opplysninger utsettes | **Verdt å vurdere** |
| Ingen tilgangsside: tilgang settes i Firebase-konsollen | Rettigheten «Tilganger» og en side | Hver endring krever prosjekteieren | Bare hvis 1–2 personer og sjelden endring |
| Bare Vipps-import og manuell registrering først | Bankimporten og de vanskeligste dublettene | Bankgaver føres for hånd | **Ja, hvis bankgavene er få** |
| Budsjett uten fordeling på formål | Litt skjerm og regning | Mindre oppfølging | Kan vente |
| Bare månedlige avtaler | Omregning | Kvartal og år må regnes om for hånd | Nei, lite å spare |
| Droppe historikk-kravet i reglene | Enklere regler | Svekker sporbarheten | **Nei** |

---

## 13. Når planen er godkjent

- `CLAUDE.md` sier at de planlagte modulene bare er navn. Godkjenningen oppdateres der for Givertjeneste.
- Planen og status legges inn i kapittel 14 i `PRODUKTDOKUMENTASJON.md`, og kapittel 2.6 oppdateres når modulen finnes.
- `ARKITEKTUR.md` og `CLAUDE.md` får de nye filene og samlingene etter hver leveranse.
