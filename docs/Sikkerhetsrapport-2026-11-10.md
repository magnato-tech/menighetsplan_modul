# Sikkerhetsrapport – Menighetsplan
*10. november 2026. Gjennomgått: `main` (commit 36b21dc). Rettelsene ligger på grenen `sikkerhet-2026-11`, i to commits: `a522265` (avhengigheter) og `0eeb798` (regler og kode).*

## Kort fortalt

1. **Det viktigste er ikke en feil i koden, men hvilke regler som ligger i databasen hos Lillesand.** `CLAUDE.md` sier at de lukkede reglene ikke er publisert noe sted. Det stemmer ikke helt: `PRODUKTDOKUMENTASJON.md` (kapittelet «Første menighet i drift») sier at Lillesand fikk de lukkede reglene **slik de var 12. oktober kl. 19**. Den versjonen er mye åpnere enn den som ligger i repoet i dag. Med den kan **alle som står i registeret med en e-postadresse, logge inn og lese hele registeret**: navn, telefon, e-post og fødselsdato fra Cornerstone. De kan også lese alle gruppemeldinger og endre eller slette andres oppgaver. Besøkende uten innlogging slipper ikke til. Se funn H1.
2. **Koden er i hovedsak godt bygget.** Ingen steder settes innhold inn som HTML. React 19 stopper `javascript:`-lenker av seg selv. E-post kan bare sendes av en administrator, og nøkkelen til e-posttjenesten kommer aldri til nettleseren. Det offentlige API-et slipper bare ut felt som er valgt ut. Ingen hemmelige nøkler ligger i koden eller i git-historikken.
3. **Jeg har rettet ti ting** på grenen `sikkerhet-2026-11`: fem sårbare pakker, tre hull i databasereglene, ett i reglene for fillageret, kontrollen av e-postkontoen, toppbildet i nyhetsbrevet, kalenderimporten (SSRF), Spotify-spilleren og sikkerhetshodene. `npm run lint` og `npm test` (221 filer, 2794 tester) består, og bygget går.
4. **Reglene i repoet virker ikke hos en menighet før de er limt inn i Firebase for hånd.** Hva som må gjøres i drift, står til slutt.

### Alvorlighetsgrad
| Grad | Betyr |
|---|---|
| **Kritisk** | Hvem som helst kan få tak i personopplysninger eller ta over løsningen, nå |
| **Høy** | En som er logget inn (eller demoen) kan se eller endre mye mer enn den skal |
| **Middels** | Krever en innlogget person eller et spesielt oppsett, men gir reell skade |
| **Lav** | Liten skade, eller beskyttet av noe annet i tillegg |

Ingen funn er **kritiske**: jeg fant ingen vei inn i registeret for en som ikke står i det.

---

## Oversikt over funnene

| # | Grad | Funn | Rettelse |
|---|---|---|---|
| H1 | **Høy** | Lillesand kjører reglene fra 12. oktober: alle med innlogging leser hele registeret og alle meldinger, og endrer alle tildelinger | **Må gjøres i drift**: publisere reglene på nytt (se til slutt) |
| H2 | **Høy** | Demoens database er åpen for skriving for alle, og ble brukt av en funksjon som henter adresser fra den (SSRF) | SSRF: **gjort** (`0eeb798`). Åpen database: kjent valg |
| M1 | Middels | Kalenderimporten (`/api/kalender-innhold`) kunne hente fra hvilken som helst adresse, også interne | **Gjort** (`0eeb798`) |
| M2 | Middels | En frivillig kunne skrive meldinger i en hvilken som helst gruppe | **Gjort** i `firestore.rules` (må publiseres) |
| M3 | Middels | Fem pakker med kjente sårbarheter (vite, body-parser, qs, re2js, undici) | **Gjort** (`a522265`) |
| M4 | Middels | Ingen beskyttelse mot at en annen nettside legger admin inni seg (klikkapring), og ingen sikkerhetshoder | **Gjort** i `vercel.json` (`0eeb798`) |
| L1 | Lav | E-postfunksjonen sjekket ikke at kontoens adresse er bekreftet | **Gjort** (`0eeb798`) |
| L2 | Lav | Et oppmøtetall kunne lagres under navnet til en innstilling som ennå ikke finnes (f.eks. toppbildet) | **Gjort** i `firestore.rules` (må publiseres) |
| L3 | Lav | Toppbildet i nyhetsbrevet sjekket ikke merket sitt, og kunne sende besøkende videre til en fremmed side | **Gjort** (`0eeb798`) |
| L4 | Lav | En frivillig kunne ta over en annens svar på et arrangement | **Gjort** i `firestore.rules` (må publiseres) |
| L5 | Lav | Fillageret tok imot alle filtyper og alle størrelser fra admin og nettredaktør | **Gjort** i `storage.rules` (må publiseres) |
| L6 | Lav | Spotify-spilleren la inn hvilken som helst side med `/embed/` i adressen | **Gjort** (`0eeb798`) |
| L7 | Lav | En frivillig kan gi seg selv lov til å se navnene på et hvilket som helst arrangement | Foreslått |
| L8 | Lav | En frivillig kan sette status på hvilken som helst oppgave, og lage en tildeling med feil gruppe | Foreslått |
| L9 | Lav | Alle frivillige kan lese alle dokumentene i `cms_settings` (andres svar på semesterplanen, notater) | Foreslått |
| L10 | Lav | Besøkstallene kan settes til hva som helst av hvem som helst | Kjent (står i CLAUDE.md), foreslått |
| L11 | Lav | Gjenstående sårbarheter som krever ny hovedversjon (`@grpc/grpc-js` i firebase, verktøy i `rules-tests/`) | Foreslått, ikke utnyttbart her |
| L12 | Lav | Den lokale serveren (`server.ts`) svarer på hele nettverket og viser feilmeldinger | Foreslått (gjelder bare utviklermaskinen) |
| L13 | Lav | Demoens eierkode er et fingeravtrykk i den publiserte koden | Kjent valg, foreslått |
| I1 | Info | Prosjektinnstillingene til en tidlig database ligger i git-historikken | Ikke en hemmelighet; se forklaring |

---

## Funnene i detalj

### H1 · Høy · Lillesand kjører en eldre og åpnere versjon av reglene
**Hvor:** reglene i Firebase-prosjektet `menighetsplan-lillesand`. Versjonen er `firestore.rules` fra commit `c087d37` (12. oktober kl. 17:39), ifølge `PRODUKTDOKUMENTASJON.md` («Reglene som er publisert hos Lillesand, er fra 12. oktober kl. 19»). `CLAUDE.md` kapittel 5 sier at reglene «ikke er publisert i noen database». Det er utdatert, og bør rettes.

**Hva den gamle versjonen tillater** (sammenlignet med `firestore.rules` i dag):
| | Gammel versjon (i drift) | I repoet nå |
|---|---|---|
| `persons` | Alle med innlogging leser **hele registeret** | Bare sitt eget kort; admin leser alt |
| `groupMessages` | Alle med innlogging leser **alle gruppers meldinger** | Bare egne grupper |
| `assignments` | Alle med innlogging kan **lese, lage, endre og slette alle** | Bare sine egne svar, og ledere for sine |
| `groups` | En leder kan legge hvem som helst inn som medlem eller leder | Lederen kan bare ta ut |
| `gatheringAttendances` | Alle leser alle svar | Eget, og egne grupper |

**Hvordan det kan utnyttes:** Innloggingen er åpen: hvem som helst kan be om en innloggingslenke til sin egen adresse på `/logg-inn`. Står adressen på én person i registeret, og speilet har skrevet en innlogging (`logins`) for den, slipper personen inn, også uten invitasjon. Speilet skriver en innlogging for **alle** med en unik e-postadresse (`loginsOf` i `src/utils/logins.ts`). En frivillig kan da åpne nettleserens utviklerverktøy og lese hele registeret, med fødselsdatoene, og alle meldinger i alle grupper, eller slette andres oppgaver.

**Ikke utnyttbart:** Ingen kan gjøre seg selv til administrator eller nettredaktør, verken i den gamle eller den nye versjonen. Rollen står i `logins`, som bare en administrator kan skrive, og den følger av `persons`, som bare en administrator kan endre. En besøkende uten innlogging leser ikke registeret i noen av versjonene. En konto med en adresse som ikke er bekreftet, slipper ikke inn.

**Rettelse:** Publisere `firestore.rules` fra repoet hos Lillesand, i rekkefølgen som står i `CLAUDE.md` kapittel 5 (se «Hva som må gjøres i drift» nederst). Til det er gjort: ikke send ut lenken til innloggingen til vanlige medlemmer.

**Kontroller selv** (jeg fikk ikke lov til å spørre produksjonsdatabasen): i Firebase Console for `menighetsplan-lillesand`, åpne *Firestore → Regler*, og se om regelen for `persons` sier `allow read: if isMember();` (gammel) eller `allow get: if isAdmin() || (isMember() && personId == me());` (ny). Se også under *Firestore → Data* hvor mange dokumenter `logins` har: så mange personer kan logge inn i dag.

### H2 · Høy · Demoens database er åpen, og en funksjon på Vercel leste en adresse fra den
**Hvor:** `firestore.demo.rules:12` (`allow read, write: if true`), `server/icalImport.ts`, `api/kalender-innhold.js`.

**Hvordan det kan utnyttes:** Demoen har med vilje ingen innlogging og åpne regler. Det betyr at hvem som helst kan endre alt innholdet i demoen, og at endringen vises for alle til nullstillingen om natten (falske nyheter eller lenker til svindelsider på `demo.menighetsplan.no`). I tillegg kunne en angriper skrive en adresse inn i `cms_settings/surfaces` i demoen og så kalle `/api/kalender-innhold`. Da hentet Vercel-funksjonen den adressen, også interne adresser som `http://127.0.0.1:…` eller `169.254.169.254`, og fortalte hva som kom tilbake (statuskoden, og innholdet når det så ut som en kalender). Dette heter SSRF.

**Rettelse:** SSRF-delen er **gjort** (se M1). At demoen er åpen, er et valg som står i `ARKITEKTUR.md`. Det er ingen ekte personer der. Foreslått: la nullstillingen gå oftere enn én gang i døgnet, eller vurder om demoen kan lese fra åpne regler men bare skrive til en kopi per besøkende (stort arbeid, ikke gjort).

### M1 · Middels · Kalenderimporten kunne hente fra interne adresser (SSRF)
**Hvor:** `server/icalImport.ts` (før: linje 45, `httpFetch(feedUrl, …)` uten kontroll). `validHttpsUrl` i `src/utils/surfaces.ts:31` sjekker bare at adressen begynner med `http`.

**Hvordan det kan utnyttes:** Hos en menighet kan bare en administrator lagre adressen, så risikoen er liten der. I demoen kunne hvem som helst (se H2). Funksjonen fulgte også videresendinger, uten tidsgrense og uten grense for størrelse.

**Rettelse (gjort, `0eeb798`):** `feedAddressRefusal` (`server/icalImport.ts:59`) avviser adresser som peker inn i et lukket nett: `localhost`, private nett (10.x, 172.16–31.x, 192.168.x), lenkelokale adresser (169.254.x, der skyleverandører har nøklene sine), IPv6-varianter, og navn som slås opp til slike adresser. Videresendinger følges for hånd (`redirect: "manual"`, linje 134), høyst tre ganger, og hver ny adresse sjekkes på nytt. Svaret må komme innen 10 sekunder og være under 5 MB. Prøvene står i `tests/ical-import.test.ts`.
*Gjenstår:* et navn som bytter adresse mellom kontrollen og hentingen («DNS rebinding»), stoppes ikke helt. Det krever at angriperen også styrer navnetjeneren, og hos en menighet at angriperen er administrator.

### M2 · Middels · En frivillig kunne skrive i en hvilken som helst gruppe
**Hvor:** `firestore.rules:357` (før: `allow create: if isMember() && request.resource.data.senderPersonId == me();`).

**Hvordan det kan utnyttes:** En innlogget frivillig kunne legge en melding i en gruppe hun ikke er med i, for eksempel sjelesorggruppen, i eget navn. Medlemmene der ville se den.

**Rettelse (gjort, `0eeb798`, må publiseres):** meldingen må gjelde en gruppe avsenderen er med i, eller avsenderen må være administrator. Prøve lagt til i `rules-tests/firestore.rules.test.ts`.

### M3 · Middels · Pakker med kjente sårbarheter
**Hvor:** `package.json` / `package-lock.json` og `rules-tests/package-lock.json`.

| Pakke | Før | Nå | Hva sårbarheten er | Gjelder oss? |
|---|---|---|---|---|
| vite | 6.4.3 | **6.4.6** | Kryssopprinnelse-kjøring og filer utenfor tillatt mappe på utviklerserveren | Bare `npm run dev`, men `server.ts` lytter på hele nettet (L12) |
| body-parser | 1.20.8 | **1.20.9** | Tjenestenekt med komprimert innhold | Bare den lokale serveren |
| qs | 6.16.0 | **6.16.2** | Tjenestenekt | Bare den lokale serveren |
| re2js | 2.8.6 | **2.10.0** | Treg regex (tjenestenekt) | Inne i firebase; lite sannsynlig |
| undici | 8.11.2 | **8.12.4** | Flere, blant annet TLS-kontroll | Bare i testene (jsdom) |
| `rules-tests/` | 29 funn | 19 funn | Verktøyet som prøver reglene lokalt | Kjøres aldri i drift |

Alt er oppgradert innen samme hovedversjon (`npm audit fix`). Lint, tester og bygg består. `firebase` (12.19.0), `express` (4.22.3) og `react-router-dom` (7.18.4) har ingen kjente sårbarheter som treffer oss. Det som gjenstår, er L11.

### M4 · Middels · Ingen sikkerhetshoder, og admin kunne legges inni en annen side
**Hvor:** `vercel.json` (hadde ingen `headers`).

**Hvordan det kan utnyttes:** En fremmed side kunne vise `/admin` usynlig oppå sin egen og lure en innlogget administrator til å trykke på knapper der («klikkapring»).

**Rettelse (gjort, `0eeb798`):** `vercel.json` sender nå med på alle svar:
- `Content-Security-Policy: frame-ancestors 'self' https://menighetsplan.no https://*.menighetsplan.no; object-src 'none'; base-uri 'self'`: bare appen selv og salgssiden kan vise den i en ramme (forhåndsvisningen i admin virker som før).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000` og `Permissions-Policy` (ingen kamera, mikrofon, posisjon eller betaling).

Prøve i `tests/security-headers.test.ts`. *Bør prøves i demoen etter innsending*: at innlogging med Google, forhåndsvisningen og Spotify/kart virker. *Foreslått senere:* en full innholdspolicy (`script-src` osv.). Den krever at alle adressene Firebase og innloggingen bruker, listes opp, og bør prøves for seg.

### L1 · Lav · E-postfunksjonen godtok en konto med en adresse som ikke var bekreftet
**Hvor:** `server/emailSending.ts:81–90` (`emailOfToken`).

**Hvordan det kan utnyttes:** Firebase lar hvem som helst lage en konto med passord og en annens e-postadresse; adressen er da ikke bekreftet. Funksjonen leste adressen fra kontoen og sammenlignet den med registeret. Det stoppes i dag av databasereglene, som ikke slipper ubekreftede kontoer til registeret. Men under regler som slipper alle innloggede til (som eldre åpne regler), kunne en slik konto ha sendt e-post til hele menigheten i en administrators navn.

**Rettelse (gjort, `0eeb798`):** en konto uten `email_verified: true` regnes ikke som noen, slik reglene gjør (linje 86). Prøve i `tests/email-sending.test.tsx`.

### L2 · Lav · Et oppmøtetall kunne ta plassen til en innstilling
**Hvor:** `firestore.rules:449` (før: alle med innlogging kunne lage et dokument med hvilket som helst navn i `cms_settings`, bare det var merket `gatheringHeadcount`).

**Hvordan det kan utnyttes:** En frivillig kunne lage `cms_settings/newsletter-banner`, `surfaces` eller `year-wheel` før administrator hadde lagret dem, og fylle dem med hva som helst. Appen sjekker merket på de fleste av dem, men toppbildet på Vercel gjorde ikke det (L3).

**Rettelse (gjort, `0eeb798`, må publiseres):** et oppmøtetall kan bare lagres under navnet `headcount-…`, som appen bruker. Prøve lagt til.

### L3 · Lav · Toppbildet i nyhetsbrevet sjekket ikke merket sitt
**Hvor:** `server/newsletterBanner.ts:37`.

**Hvordan det kan utnyttes:** Sammen med L2 (eller i demoen) kunne `/api/nyhetsbrevbilde` sende besøkende videre til en fremmed adresse, fra menighetens egen adresse («åpen videresending»).

**Rettelse (gjort, `0eeb798`):** bare dokumentet merket `newsletterBanner` gis ut, slik appen og e-postfunksjonen allerede gjorde. Prøve i `tests/newsletter.test.tsx`.

### L4 · Lav · En frivillig kunne ta over en annens svar på et arrangement
**Hvor:** `firestore.rules:368–377` (`gatheringAttendances`). Før: `allow create, update: if … request.resource.data.personId == me()`.

**Hvordan det kan utnyttes:** Ved å skrive sin egen id inn i en annens svar kunne en frivillig fjerne den andres «kommer». Liten skade.

**Rettelse (gjort, må publiseres):** en endring krever at svaret allerede er ens eget.

### L5 · Lav · Fillageret tok imot alle filtyper
**Hvor:** `storage.rules:21–27`.

**Hvordan det kan utnyttes:** En administrator eller nettredaktør (eller en som har overtatt en slik konto) kunne laste opp en nettside eller et skript, og dele lenken. Filen vises fra Googles adresse, ikke menighetens, så den kan ikke lese noe fra appen. Men den kan brukes til svindel, og store filer koster lagring.

**Rettelse (gjort, må publiseres):** bare bilder (`image/*`), og under 20 MB. Appen laster bare opp bilder. Prøver lagt til i `rules-tests/storage.rules.test.ts`.

### L6 · Lav · Spotify-spilleren kunne legge inn en hvilken som helst side
**Hvor:** før: `getSpotifyEmbedUrl` i `src/components/cms/modules/SermonModule.tsx:14` og `src/pages/public/PublicSermonsPage.tsx:21` (to kopier). En adresse med `/embed/` i seg ble lagt rett inn i en ramme på nettsiden.

**Hvordan det kan utnyttes:** En nettredaktør (eller hvem som helst i demoen) kunne vise en fremmed side, for eksempel et falskt innloggingsskjema, som en del av menighetens nettside.

**Rettelse (gjort):** én funksjon, `spotifyEmbedUrl` i `src/utils/spotify.ts`, som bare godtar `https://open.spotify.com/…`. Prøve i `tests/spotify.test.ts`.

### L7 · Lav · En frivillig kan gi seg selv lesemerket til et hvilket som helst arrangement
**Hvor:** `firestore.rules:227–240` (`gatheringReaders`, første `isMember()`-grein).

**Hvordan det kan utnyttes:** Lesemerket skal gis til den som står på en oppgave. Regelen sjekker ikke det, så en frivillig kan lage merket for et hvilket som helst arrangement og lese navnene og svarene til dem som står der.

**Foreslått:** gi tildelingen en id regelen kan finne (f.eks. `<oppgave>_<person>`), og kreve at den finnes (`exists(...)`) før merket lages. Ikke gjort: det endrer hvordan tildelinger lagres, og krever prøvene av reglene, som ikke kunne kjøres her.

### L8 · Lav · Status på oppgaver, og gruppen på en tildeling
**Hvor:** `firestore.rules:291–294` (en frivillig kan endre `status` på alle oppgaver, bortsett fra til og fra avlyst) og `firestore.rules:313–316` (en frivillig som melder seg på, skriver selv `gatheringGroupId` og `gatheringPublic`).

**Hvordan det kan utnyttes:** En frivillig kan få en oppgave til å se dekket ut, eller la navnet sitt bli synlig for en annen gruppe. Ingen personopplysninger om andre.

**Foreslått:** la regelen hente gruppen og synligheten fra arrangementet (`get(...)`) i stedet for å stole på det som sendes, og knytte statusendringen til en tildeling i samme sending (`getAfter`).

### L9 · Lav · Alle frivillige leser alt i `cms_settings`
**Hvor:** `firestore.rules:443` (`allow list: if isMember();`) og `get` for alle innloggede.

**Hvordan det kan utnyttes:** En frivillig kan lese andres svar på semesterplanen («Kan ikke» på hvilke arrangementer), notatene på samlingene og besøkstallene.

**Foreslått:** gi semestersvarene og notatene egne regler etter navnet (`semester-answer-…`, `gathering-note-…`), slik besøkstallene har.

### L10 · Lav · Besøkstallene kan settes til hva som helst
**Hvor:** `firestore.rules` (`isTrafficDay`, linje 452 og 464). Kjent, står i `CLAUDE.md` kapittel 5.

**Foreslått:** sjekke at tallene er tall, og at de bare øker. Det er begrenset hva regler kan sjekke i et kart med vilkårlige nøkler.

### L11 · Lav · Sårbarheter som krever ny hovedversjon
- `@grpc/grpc-js` 1.9.16 (inne i `firebase` 12.19.0): to sårbarheter som gjelder en gRPC-*tjener* og klientsertifikater. Firebase-klienten i nettleseren bruker ikke gRPC, og Vercel-funksjonene bruker Firestores REST-adresse. Bare `server.ts` lokalt laster den. Den nyeste firebase (13.2.0) bruker fortsatt grpc-js 1.9, så en oppgradering hjelper ikke. **Ikke utnyttbart her.** `npm audit fix --force` foreslår å gå *ned* til firebase 9; det skal ikke gjøres.
- `rules-tests/`: 19 funn i `firebase-tools` og pakkene den bruker (grpc-js, glob, minimatch, uuid, opentelemetry). Kjøres bare på utviklermaskinen. **Foreslått:** oppgrader `firebase-tools` til neste hovedversjon når prøvene av reglene kan kjøres (krever Java 21).

### L12 · Lav · Den lokale serveren
**Hvor:** `server.ts:496` (`app.listen(port, '0.0.0.0', …)`), `server.ts:56–64` (`Access-Control-Allow-Origin: *`), og flere `res.status(500).json({ …, message: err.message })` (f.eks. linje 135).

**Hvordan det kan utnyttes:** `server.ts` kjører ikke der løsningen er i drift (Vercel). Men på en utviklers maskin svarer den, med Vites utviklerserver, til alle på samme nett (kafé, hotell). Med de gamle Vite-sårbarhetene kunne en annen på nettet lese filer. CORS `*` er riktig for de offentlige API-ene, og feilmeldingene røper bare tekniske detaljer.

**Foreslått:** lytt på `127.0.0.1` når `NODE_ENV` ikke er `production`, og send en fast feilmelding i stedet for `err.message`.

### L13 · Lav · Demoens eierkode
**Hvor:** `VITE_DEMO_OWNER_CODE_HASH` (`src/installation.ts:44`, `src/utils/demoOwner.ts`).

Fingeravtrykket (SHA-256) ligger i koden som sendes til alle besøkende i demoen. En kort kode kan derfor gjettes på egen maskin. Koden beskytter bare skjermen «Demo-oppsett», og demoens database er åpen uansett. **Foreslått:** bruk en lang, tilfeldig kode (minst 16 tegn). Ingenting å rette i koden.

### I1 · Info · Prosjektinnstillinger i git-historikken
**Hvor:** commit `d1520bc` og `cfc6c6b` (fjernet 7. oktober): en fil med `projectId`, `apiKey` og databasenavnet til den første databasen (fra Google AI Studio).

Dette er **ikke** hemmeligheter. Firebase sin «API-nøkkel» står i koden som sendes til hver nettleser, og er bare et navn på prosjektet. Beskyttelsen er reglene. Det betyr likevel at: *hvis den databasen fortsatt har åpne regler og ekte personer, kan hvem som helst lese den.* **Kontroller** i Firebase Console at databasen enten er tom, slettet eller har de lukkede reglene. Det er ingen grunn til å skrive om git-historikken.

Ingen nøkler til Resend, ingen tjenestekontoer og ingen eierkode ligger i koden eller i historikken (søkt i `git log --all -p`). `.env*` er utelatt i `.gitignore`, og `.env.example` har bare tomme navn.

---

## Det som ble sjekket og var i orden

- **Rolle og innlogging** (`src/utils/session.ts`, `src/services/auth.ts`, `src/utils/logins.ts`, speilet): ingen kan gi seg selv rollen administrator eller nettredaktør. Rollen leses fra `logins`, som bare administrator skriver, og som speilet bygger fra `persons`, som bare administrator endrer. En frivillig kan bare endre `analyticsHiddenModules` og `calendarFeedToken` på seg selv (`firestore.rules`, `persons`). Adressen må være bekreftet, både i appen (`session.ts:63`) og i reglene.
- **`CAN_STAND_IN` / `mayStandIn`** (`src/context/FirebaseDataContext.tsx:202`): på bare på utviklermaskinen (`import.meta.env.DEV`, alltid av i et bygg) og i demoen (`VITE_DEMO=true`). En menighet må aldri ha `VITE_DEMO` satt i Vercel. Selv om det skjedde, ville de lukkede reglene stoppe lesingen; bare skjermene ville åpne seg.
- **`SessionGate`** stopper skjermene. Det er reglene i databasen som faktisk beskytter dataene, og det er riktig bygget.
- **XSS:** ingen `dangerouslySetInnerHTML`, `innerHTML` eller `eval` i `src/`. `CmsContentRenderer` bygger React-komponenter av teksten. React 19 bytter ut `javascript:`-lenker med en feil (prøvd), også i `<Link>`. Forhåndsvisningen av e-post ligger i en `sandbox`-ramme uten skript. Meldingene mellom admin og forhåndsvisningen sjekker avsenderen (`src/utils/previewBridge.ts:344–363`). Kartet og Spotify bygger adressen selv.
- **Avmelding fra nyhetsbrevet:** nøkkelen har 192 biter tilfeldighet (`newNewsletterToken`), og regelen krever nøyaktig 32 tegn. Den som har lenken, kan bare melde seg av, ikke angre eller se hvem andre som har gjort det.
- **E-post:** bare administrator kan sende. Nettleseren sier hvilken gruppe, aldri hvilke adresser. Avsendernavnet renses for `"<>` og linjeskift (`senderOf`), og Resend tar imot JSON, så linjeskift i emnet gir ikke nye e-posthoder. Ingen begrensning på antall utsendinger, men bare for administrator.
- **Det offentlige API-et** (`server/publicApi.ts`): bare utvalgte felt, ingen medlemslister eller kontaktinformasjon. Gruppekortene har bare id-ene til personer med samtykke (`publicIds` i `src/utils/groupAccess.ts`).
- **Hemmeligheter:** `RESEND_API_KEY` leses bare på Vercel (uten `VITE_`, så den bygges ikke inn i appen).

---

## Hva som må gjøres i drift

1. **Rett `CLAUDE.md` kapittel 5** (eller la en annen økt gjøre det): reglene *er* publisert hos Lillesand, i versjonen fra 12. oktober. Jeg har ikke endret `CLAUDE.md`, fordi andre økter arbeider i den.
2. **Gå gjennom og send inn grenen `sikkerhet-2026-11`** til `main`, og prøv i demoen at innlogging, forhåndsvisning, Spotify, kart og kalenderimporten virker.
3. **Publiser reglene hos Lillesand** (Firebase Console → `menighetsplan-lillesand` → Firestore → Regler, og Storage → Regler), i rekkefølgen fra `CLAUDE.md` kapittel 5: slipp til `stabil` → lim inn `firestore.rules` og `storage.rules` straks etter → administrator åpner appen og lar speilet fullføre → kontroller speilingen → først da kan vanlige medlemmer inviteres. Denne publiseringen tetter H1, M2, L2, L4 og L5.
   - *Merk:* `storage.rules` slår opp administratorer i databasen `(default)`. Lillesand har et nytt prosjekt, og bruker trolig standarddatabasen; kontroller at `VITE_FIREBASE_DATABASE_ID` er tom der. En menighet med en database med eget navn må få navnet skrevet inn i `storage.rules`, ellers kan ingen laste opp bilder.
4. **Til reglene er publisert:** ikke del innloggingslenken med vanlige medlemmer (H1).
5. **Kontroller den første databasen** fra Google AI Studio (I1): tom, slettet eller lukket.
6. **Ingen nøkler må byttes.** Jeg fant ingen hemmelige nøkler som har vært synlige.
7. **Kontroller i Vercel** for hver menighet at `VITE_DEMO` *ikke* er satt, og at `RESEND_API_KEY` bare ligger der (ikke i noe med `VITE_` foran).
8. **Demoen:** bruk en lang, tilfeldig eierkode (L13).

## Hva som ikke ble undersøkt

- **`npm run test:rules` ble ikke kjørt**: Java finnes ikke på maskinen. Endringene i `firestore.rules`, `storage.rules` og prøvene av dem i `rules-tests/` er derfor **ikke prøvd mot emulatorene**. Kjør `npm run test:rules` med Java 21 før reglene publiseres.
- **Databasen og innstillingene i drift ble ikke lest.** Jeg fikk ikke lov (med rette) til å spørre `menighetsplan-lillesand` direkte, så hva som faktisk er publisert der, bygger på `PRODUKTDOKUMENTASJON.md`. Kontroller det som beskrevet i H1.
- Innstillingene i Firebase Authentication (hvilke innloggingsmåter som er på, autoriserte domener, om e-post og passord er slått på), i Vercel (miljøvariabler, hvem som har tilgang) og i Resend (domenet, SPF/DKIM/DMARC).
- Hvem som har tilgang til Firebase-prosjektene, GitHub-repoet og Vercel, og om de bruker totrinnsinnlogging. Det er den største risikoen som ikke ligger i koden.
- Sikkerhetskopier av databasen, og logging av hvem som gjør hva i admin.
- Det eksterne CMS-repoet (`menighetsplan_ClaudeCMS`) og salgssiden.
- GitHub-arbeidsflyten for nullstilling av demoen (`.github/workflows/nullstill-demo.yml`) ble bare lest overflatisk.
- En full innholdspolicy (`script-src`) og prøving av hodene i en ekte nettleser i drift.
