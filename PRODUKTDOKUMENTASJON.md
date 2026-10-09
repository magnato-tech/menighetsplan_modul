# Produktdokumentasjon: Menighetsplan

> **Dokumentversjon:** 4.9 · **Sist oppdatert:** 2026-10-09
> **Status:** Single Source of Truth (SSOT) for produktet. Dokumentet lever i kildekoden og oppdateres sammen med funksjonaliteten.
> **Plattform:** React 19, TypeScript, Tailwind CSS 4, Cloud Firestore (`europe-west3`, Frankfurt), Express, PWA.
> **Søsterdokumenter:** `ARKITEKTUR.md` (hvordan koden er bygget), `CLAUDE.md` (regler for kodeendringer), `INTEGRASJON-MENIGHETSPLAN.md` (kontrakten for det offentlige API-et).

Dokumentet skiller mellom tre ting, og sier alltid hvilken det er snakk om:

| Merke | Betyr |
|---|---|
| **Levert** | Finnes i løsningen og virker i dag |
| **Delvis** | Finnes, men med en begrensning som er beskrevet |
| **Planlagt** | Besluttet retning, ikke bygget ennå (se kapittel 14) |

---

## 1. Produktet i korte trekk

Menighetsplan er **ett adminpanel som styrer to ting i samme format**:

1. **Webappen** – interaktiv, dynamisk og responsiv. Her ser frivillige og gruppeledere oppgavene sine, svarer på forespørsler, melder forfall og følger gruppene og husfellesskapet sitt. Planleggingsdelen av adminpanelet styrer den.
2. **Nettsiden** – menighetens ansikt utad. Et moderne CMS i adminpanelet styrer den: sider og meny, nyheter, taler, stab, design og innstillinger.

«Samme format» betyr at webappen og nettsiden er én løsning: samme kodebase, samme database, samme designspråk og samme responsive oppførsel på mobil og PC. En samling som opprettes i planleggeren og settes til offentlig, står i kalenderen på nettsiden i samme øyeblikk. Ingenting kopieres mellom systemer.

```
              ┌───────────────────────────────────────────────┐
              │             ADMINPANELET   /admin             │
              │                                               │
              │   Planlegging              Nettside & CMS     │
              │   · Arrangementer          · Sider og meny    │
              │   · Trenger oppfølging     · Nyheter          │
              │   · Grupper                · Taler            │
              │   · Personer               · Stab             │
              │                            · Design           │
              │                            · Innstillinger    │
              └───────────┬───────────────────────┬───────────┘
                          │ styrer                │ styrer
                          ▼                       ▼
              ┌──────────────────────┐ ┌──────────────────────┐
              │ WEBAPPEN   /minside  │ │ NETTSIDEN   /        │
              │ frivillige og ledere │ │ besøkende            │
              └───────────┬──────────┘ └──────────┬───────────┘
                          └── én database (Firestore) ──┘
                                        │
                      offentlig JSON-API for eksterne nettsider
```

### 1.1 Hvem bruker hva

| Rolle | Flate | Gjør |
|---|---|---|
| Besøkende | Nettsiden | Finner neste gudstjeneste, kalender, grupper, taler og kontaktinformasjon |
| Frivillig (medlem) | Webappen, Min side | Ser egne oppgaver, tar ledige oppgaver, svarer på forespørsler, melder forfall, skriver i gruppene sine, svarer på innkalling til husfellesskap |
| Gruppeleder | Webappen, Gruppeleder | Bemanner oppgavene i sine grupper, holder medlemslisten og møteplanen, sender beskjed til gruppen |
| Administrator | Adminpanelet | Alt det over, og i tillegg samlinger, personregister med samtykke, og hele nettsiden |

En gruppeleder er den som står som leder eller nestleder i en gruppe. Administrator er en rolle på personen.

### 1.2 Kjernebeslutninger

* **Én kilde for sannhet.** Ingen parallelle lister. En samling, en gruppe og en person finnes ett sted, og både webappen, nettsiden og API-et leser derfra.
* **Skjermen viser det som er lagret.** Løsningen dikter ikke opp innhold når noe mangler, har ingen skjema som ikke lagrer, og sier fra når en lagring feiler.
* **Reglene ligger ett sted.** Bemanning, synlighet og samtykke er rene funksjoner med tester, og alle skjermbilder bruker de samme.
* **Personvern først.** Ingen person vises offentlig uten registrert samtykke, og persondata går aldri ut i det offentlige API-et.
* **Mobil først, og lesbart for alle.** Status formidles alltid med ikon og tekst, aldri med farge alene (WCAG AA).
* **Bemanning hører hjemme i samlingen**, supplert med oversikten «Trenger oppfølging» over akutte forfall og ubesatte oppgaver.

### 1.3 To nivåer

Produktet selges på to nivåer. Det høyeste inneholder det laveste.

| Nivå | Inneholder |
|---|---|
| **Menighetsplattform** | Nettsiden med CMS-et, kalenderen med arrangementene, personregisteret og en enkel Min side |
| **Menighetsplan** | Alt i Menighetsplattform, og planleggeren: grupper, oppgaver, tjenesteroller, bemanning og hele Min side |

* **Personregisteret er med på begge nivå.** Innloggingen bygger på det (kapittel 10.1), så også en menighet som bare har nettsiden, må kunne si hvem som er administratorer og hvem som kan logge inn.
* **Tilleggsmodulene er noe annet** (kapittel 2.6). De slås på én og én, oppå et nivå.
* **Hvem bestemmer nivået.** Hos en menighet er det leverandøren. *Planlagt (trinn 4):* til det er bygget, har en menighets installasjon alt. I demoen velger den besøkende selv (kapittel 1.4).

| Det nivået styrer | Status |
|---|---|
| Menyen i admin. «Trenger oppfølging», «Grupper & Husfellesskap» og «Roller» står bare på Menighetsplan. Åpnes en slik fane, eller et gruppe- eller oppgavekort, på Menighetsplattform, sier siden at det hører til Menighetsplan | **Levert 8. oktober** |
| Min side, arrangementssiden, oversikten i admin og gruppene på nettsiden | **Planlagt** (trinn 3c) |

### 1.4 Demoen

Demoen er appen installert én gang til, med egen database og egen adresse, og med en innstilling som sier at den er demoen. Den er ikke egen kode og har ikke eget repo. Det samme gjelder hver menighet: samme kode, egen database, egen adresse.

* **Stripen øverst** *(levert 8. oktober)* står på alle skjermer i demoen, og blir stående når man ruller. Den sier at dette er en demo, har velgeren mellom de to nivåene, viser veien inn til den som ikke er inne, og lenker til påmeldingen og tilbake til nettsiden som presenterer produktet. En lenke ut av demoen vises bare når adressen er lagt inn i demoens innstillinger.
* **Veien inn** *(levert 9. oktober)*. Ingen logger inn i demoen. «Gå inn» i stripen, og «Min Side» på nettsiden, fører til en side med tre valg, ett for hver rolle:

  | Valg | Fører til |
  |---|---|
  | **Administrator** | Oversikten i admin |
  | **Gruppeleder** | Gruppeledersiden |
  | **Frivillig** | Min side |

  Den besøkende går inn som en person fra demoens register som har rollen, og siden sier hvem. Valget bestemmer hvor man kommer, også for den som trykket «Min Side» først.
* **CMS-et står under «Administrator»**, og er nevnt først i teksten på valget: «Redigerer nettsiden (CMS), planlegger arrangementer og holder personregisteret». Det hadde sin egen vei inn 9. oktober, og den ble tatt ut samme dag: den førte til samme administrator i samme admin, bare med en annen startside.
* **Bytte rolle.** Den som er inne, har «Bytt rolle» i stripen, som fører til de samme valgene. «Logg ut» gjør det samme.
* **Hvem man går inn som**, følger av registeret: av dem som har rollen, den som er med i flest grupper. Innholdet i demoen kan dermed byttes uten at noe annet må endres.
* **Det demoen er uten** *(levert 9. oktober)*. «Database og Testdata» og «Moduler» står ikke i menyen, og tilleggsmodulene vises ikke, heller ikke om en skulle være slått på i databasen. Skrives adressen til en slik fane inn, sier siden at den ikke er med i demoen. Alt som tømmer databasen, nekter i demoen, uansett hvor det kalles fra.
* **Nivåvelgeren** *(levert 8. oktober)* har to valg. Valget gjelder med en gang på alle skjermer, og huskes i nettleseren til den som ser på. Én besøkendes valg endrer ikke hva en annen ser. Før noe er valgt, vises Menighetsplan.
* **Bare i demoen.** En menighets installasjon tegner aldri stripen, og spør aldri nettleseren om nivået.
* **Forhåndsvisningen i admin** viser nettsiden uten stripe.
* **Eksempelmenigheten** *(levert 9. oktober)*. Demoen viser Fjordvik menighet. Den er oppdiktet: navnet, adressen, personene og innholdet. E-postadressene ender på `.example`, som ingen kan eie. Innholdet nevner ingen årstid, høytid eller måned, for det vises hele året.
* **Datoene regnes fra i dag** *(levert 9. oktober)*. Innholdet er skrevet for én uke, og flyttes hele uker fram når det legges i databasen. En gudstjeneste søndag kl. 11:00 står da alltid på en søndag kl. 11:00, også over skiftet mellom sommertid og vintertid. Det er alltid en gudstjeneste innen en uke, og det som er gjort (meldinger, svar, taler, nyheter og oppmøtetall), ligger alltid bak. Uka skifter natt til mandag. Det samme gjelder når demodataene legges inn fra Database hos en menighet.
* **Nullstilling hver natt** *(bygget 9. oktober, ikke prøvd mot demoens database ennå)*. Hver natt, rundt kl. 03, fylles demoens database med eksempelmenigheten på nytt, og alt en besøkende har endret eller lagt inn, fjernes. Innholdet skrives først og det overflødige fjernes etterpå, så demoen er aldri tom. Nullstillingen gjelder bare demoen: den nekter uten demo-innstillingen, uten at navnet på databasen er skrevet, og når databasen står i produksjon. Den kan også startes for hånd: `npm run reset-demo -- <navnet på prosjektet>`.
* **Hvor den ligger** *(delvis levert 9. oktober)*. Demoen er lagt ut på demo.menighetsplan.no, som salgssidens «Se demo» fører til. Den bygges på nytt av seg selv hver gang noe sendes inn til `main`. Demoen har sin egen database, i Firebase-prosjektet `menighetsplan-demo`, med åpne regler (`firestore.demo.rules`). **Begrensning:** den publiserte demoen leser ennå den tidligere felles databasen. Den byttes over ved at innstillingene i Vercel endres, etter at demoens database er fylt.
* *Planlagt (trinn 3c):* nivåskillet i resten av appen.

---

## 2. Adminpanelet (Admin Studio)

Adminpanelet ligger på `/admin` og har én meny med to deler. Hver fane har sin egen adresse (`/admin?tab=…`), og et påbegynt utkast overlever et fanebytte. Deler av panelet som ikke alle menigheter skal ha, er **moduler**: de slås på under **Moduler** og står først da i menyen (kapittel 2.6).

### 2.1 Planlegging – admin for webappen

| Fane | Hva administratoren gjør | Status |
|---|---|---|
| **Oversikt** | Ser nøkkeltall og hva som haster | Levert |
| **Arrangementer** | Oppretter, endrer og avlyser samlinger. Velger ansvarlig gruppe, synlighet og om det er en gudstjeneste. «Lag neste arrangement» kopierer oppgavene til en ny dato | Levert |
| **Trenger oppfølging** | Ser ubesatte oppgaver og akutte forfall på tvers av samlinger. Tildeler, forespør og åpner purretekst | Levert |
| **Grupper & husfellesskap** | Oppretter grupper, setter leder og nestleder, kategori, møteplan og om gruppen vises på nettsiden | Levert |
| **Personer & roller** | Holder personregisteret: kontaktinfo, rolle, politiattest, perioder personen er borte, og offentlig profil med samtykke | Levert |
| Detaljsider | Samling med kjøreplan, oppgave, gruppe og person har hver sin side | Levert |
| **Database & innstillinger** | Fyller databasen med demodata, simulerer et halvår med menighetsliv (vises når Analysebord er slått på), sletter alt, tester API-et | Levert |
| **Analysebord** (del av modulen Analyse, kapittel 2.6) | Ser menighetens liv i tall for en periode, sammenlignet med perioden før: oppmøte, frivillighet og bemanning, grupper, personregisteret og nettsiden. Registrerer oppmøtetall og laster dem ned som regneark | Levert 5. oktober (kapittel 2.4) |

### 2.2 Nettside & CMS – admin for nettsiden

| Fane | Hva administratoren gjør | Status |
|---|---|---|
| **Sider & innhold** | Bygger sidetreet i to nivåer med dra og slipp. Skriver innhold med ferdige innholdsblokker, laster opp hovedbilde, setter kladd, publisert eller planlagt, fyller ut søk og deling, og forhåndsviser | Levert, med begrensningene i kapittel 8.7 |
| **Aktuelt & nyheter** | Skriver og publiserer artikler | Levert |
| **Taler & prekener** | Legger inn taler med lyd, Spotify og video | Levert |
| **Lederskap & stab** | Holder listen over stab som vises på «Om oss» | Delvis: en egen liste ved siden av personregisteret, uten samtykke (kapittel 13) |
| **Tema & designsystem** | Velger ferdig tema eller egne farger, bakgrunn, skrift og avrunding. Forhåndsvisningen er tegnet med de samme fargene nettsiden får | Levert |
| **Nettside-innstillinger** | Menighetens navn, slagord, velkomsttekst, kontaktinfo, Vipps, konto og sosiale medier | Levert |
| **Forside-overstyring** | Fremhever en samling på forsiden eller skjuler den fra kalenderen | Levert |

### 2.3 Felles for hele panelet

* Panelet er responsivt: fast meny på PC, uttrekksmeny på mobil.
* En handling bekreftes med en melding som forsvinner av seg selv. En lagring som feiler, vises i et rødt banner og blir ikke stående som om den var lagret.
* **Moduler** (under System & Database) viser hvilke moduler produktet har, og slår delene av dem av og på for hele menigheten (kapittel 2.6).
* **Innlogging.** `/admin` er bare for administratorer. Den som ikke er logget inn, sendes til innloggingssiden, og et medlem får beskjed om at det kreves administrator (kapittel 10.1). Nederst i menyen står hvem som er logget inn, og «Logg ut».

### 2.4 Analysebord

Analysebordet er en del av modulen **Analyse**. Det står i menyen under **Analyse** når det er slått på (kapittel 2.6). Det samler det løsningen allerede vet om menighetens liv, slik at ledelsen kan se utviklingen og handle på den: hvem som trenger avlastning, hvilke roller som er vanskelige å bemanne, hvilke grupper som har stilnet, og hvor mange som kommer.

**Prinsipper**

* **Bare det som er lagret.** Hvert tall telles fra databasen. Mangler grunnlaget, vises en strek, aldri null eller et anslag. Feltet **Datagrunnlag** nederst sier hva tallene bygger på og hva som ikke måles.
* **Perioden styrer alt.** Siste 4 uker, 3 måneder (standard) eller 12 måneder (52 hele uker). Hvert tall sammenlignes med like lang periode rett før. Det som er et øyeblikksbilde (tilhørighet, personregisteret), sammenlignes ikke.
* **Svar er ikke oppmøte.** «Kommer» sier hvem som planla å komme. Oppmøtetallet sier hvem som kom. De vises hver for seg.
* **Personer navngis bare der administratoren skal handle:** avlastning, ubrukte frivillige, personer uten gruppe og politiattester. Alt annet er tall.
* **Ingen sporing av besøkende.** Besøk på nettsiden telles anonymt, på et eget bord (kapittel 2.5). Hvem de besøkende er, måles ikke.

**Hva bordet viser**

| Del | Innhold | Definisjon |
|:---|:---|:---|
| Nøkkeltall | Snitt på gudstjeneste, aktive frivillige, bemanningsgrad, andel med i en gruppe | Snittet regnes bare av gudstjenestene som er talt. Aktiv frivillig: har sagt ja til minst én oppgave på en samling som er holdt i perioden. Bemanningsgrad: bekreftede plasser delt på behovet, på holdte samlinger |
| Oppmøte | Søyle per samling (voksne og barn), snittlinje, liste over samlinger som mangler tall, tabellvisning, CSV | En samling uten tall vises som en lav grå strek, aldri som lavt oppmøte. Gruppesamlinger telles ikke her; de følges med svarene |
| Bemanning per arrangement | Hvor mange holdte samlinger med oppgaver som var fullt bemannet, for alle og for gudstjenestene, sammenlignet med perioden før, og listen over dem som ikke var det | Fullt bemannet: alle plasser i alle oppgavene var bekreftet. En samling uten oppgaver telles ikke |
| Flere oppgaver på samme samling | Hvor mange ganger noen har hatt to eller flere oppgaver på samme samling (for eksempel bilde og møteleder), hvem, de vanligste kombinasjonene og de siste gangene | Andel av tjenestene: av gangene noen tjenestegjorde på en samling, hvor ofte de hadde flere oppgaver. «Samme klokkeslett» vises bare der kjøreplanen har klokkeslett for begge oppgavene |
| Oppgaver og aktiviteter per måned | Hvor stor del av personregisteret som har 0, 1, 2 … 8 eller flere oppgaver i en vanlig måned, med omtrent hvor mange personer det er. Kan byttes til aktiviteter. Antall uten oppgave, antall uten både oppgave og gruppe, og andelen med fire eller flere i måneden | En måned er 30 dager. Perioden deles i måneder, og hver person telles i hver måned. Aktiviteter er oppgaver og gruppesamlinger personen har svart «Kommer» på |
| Hver enkelt | Tabell per person: oppgaver, gudstjenester med oppgave (antall og andel av alle gudstjenestene), ganger med flere oppgaver på samme samling, tjenestegrupper, andre grupper, aktiviteter per måned. Kan sorteres | En leder eller nestleder regnes som med i gruppen |
| Frivillighet og bemanning | Forfall (akutte under 48 timer), avslag, svartid (median), de neste fire ukene, hvor ofte hver har stått på, roller som er vanskeligst å bemanne, «Kan trenge avlastning», «Ikke brukt i perioden» | Avlastning: har stått på minst like mange samlinger som halvparten av ukene i perioden, og minst tre. Ikke brukt: medlem av en tjenestegruppe uten oppgave i perioden |
| Grupper og fellesskap | Antall grupper per kategori, nye medlemskap, meldinger, samlinger og svar per gruppe, sist aktiv, personer uten gruppe | Stille gruppe: verken samling eller melding de siste 30 dagene |
| Personregisteret | Personer, administratorer, stab, offentlige profiler med samtykke, borte i dag, politiattester som er utløpt eller går ut innen 60 dager | Øyeblikksbilde |
| Nettsiden | Nyheter publisert, taler lagt ut (med opptak), sider publisert, kladder og planlagte | Besøk telles på bordet «Besøk på nettsiden» (kapittel 2.5) |

**Tilpass bordet.** Bordet er delt i moduler: nøkkeltall, oppmøte, bemanning per arrangement, flere oppgaver på samme samling, oppgaver og aktiviteter per måned, hver enkelt, frivillighet, grupper, personregisteret, nettsiden og datagrunnlag. Hver administrator kan skjule moduler med øyet på modulen eller under **Tilpass bordet**, og ta dem tilbake med **Vis alle**. Valget lagres på den aktive brukeren (`analyticsHiddenModules`). Til innlogging er på plass, deler alle som bruker samme bruker i testbryteren, samme valg. Det som lagres er hva som er skjult, så en ny modul vises for alle til de selv skjuler den.

**Oppmøtetall.** Administratoren trykker på en søyle eller **Registrer** og skriver inn voksne, barn og en valgfri merknad. Ett tall per samling: en ny telling erstatter den gamle, og den kan fjernes. Bare samlinger som er holdt, ikke er avlyst og ikke er gruppesamlinger, kan telles. **Last ned CSV** gir dato, samling, type, voksne, barn, totalt og merknad, klar for årsmeldingen.

**Simulert menighetsliv.** Under **Database og Testdata** kan administratoren fylle databasen med 12, 26 eller 52 uker tenkt historikk, bygget av personene, gruppene og rollene som finnes: gudstjenester med oppmøtetall, oppgaver med ja, nei og forfall, husfellesskap med svar, og meldinger. Alt er merket og fjernes med **Fjern simulert historikk** uten at noe annet berøres. En søndag som allerede har en gudstjeneste, får ikke en til.

### 2.5 Besøk på nettsiden
**Besøk på nettsiden** er den andre delen av modulen **Analyse**. Den står i menyen under **Analyse**, etter Analysebord, når den er slått på (kapittel 2.6). Den viser hvor mye nettsiden brukes, hva som leses, når besøkene kommer og om de fører til noe, sammenlignet med like lang periode rett før. Perioden er siste 7 dager, 4 uker (standard), 3 måneder eller 12 måneder.

**Prinsipper**

* **Nettsiden teller selv, anonymt.** Den vet hvilken side som vises, når, hvor lenge, og hvilke av dens egne knapper som trykkes. Bare summer per dag lagres.
* **Ingenting lagres hos den besøkende.** Tellingen bruker ikke informasjonskapsler og lagrer ingenting i nettleseren. Den lagrer ingenting om den besøkende eller utstyret: ikke hvor de kom fra, ikke skjermstørrelse, ikke nettleser. Nettleserens navn ses bare på for å kjenne igjen søkeroboter, og lagres ikke.
* **Besøk, ikke personer.** Et besøk er én åpning av nettsiden. Kommer samme person tilbake senere, er det et nytt besøk. Nye og faste besøkende kan derfor ikke skilles. Det ville krevd at nettleseren huskes, og etter ekomloven § 3-15 (i kraft 1. januar 2025) krever det samtykke fra hver besøkende. Statistikk er ikke unntatt.
* **Tid er et anslag.** Tid telles bare mens siden er synlig på skjermen, og høyst 30 minutter per visning. Det som er sett, sendes underveis (etter 5, 15, 30 og 60 sekunder, deretter hvert minutt), så en fane som lukkes, mister lite. Tid per visning er sekundene siden var synlig, delt på alle visningene av den.
* **Bare ekte besøk.** Forhåndsvisninger i admin, sider vist i en ramme, søkeroboter, en kopi av nettsiden på utviklerens egen maskin og nettlesere som har bedt om å holdes utenfor, telles ikke. Min side og admin telles aldri.
* **Menigheten bestemmer.** Nettsiden teller bare mens «Besøk på nettsiden» er slått på under Moduler (kapittel 2.6). Mens den er på, kan tellingen settes på vent på bordet. Da telles ingenting før den slås på igjen.

**Hva bordet viser**

| Del | Innhold | Definisjon |
|:---|:---|:---|
| Nøkkeltall | Besøk, sidevisninger, sider per besøk, tid per besøk, andel besøk med bare én side | Hvert tall sammenlignes med perioden før, når noe ble telt da. Sider per besøk: sidevisninger delt på besøk. Tid per besøk: alle sekunder i visning delt på besøk |
| Besøk over tid | Én søyle per dag (opptil 4 uker), per uke (3 måneder) eller per fire uker (12 måneder) | En dag uten besøk har ingen søyle |
| Mest besøkte sider | Tittel, visninger, andel, tid per visning og hvor mange besøk som startet der | Én side har én adresse: `/Om-oss/`, `/side/om-oss` og `/nettside/om-oss` telles sammen. En side som er fjernet, står med adressen og «Finnes ikke lenger» |
| Sider som aldri åpnes | Publiserte sider uten én visning i perioden | Kladder, planlagte sider og menypunkter som bare leder videre, er ikke med. To sider med samme adresse står én gang |
| Hvor besøkene starter | Siden et besøk begynner på | Den første siden som vises etter at nettsiden er åpnet |
| Adresser som ikke finnes | Adresser noen har prøvd å åpne, uten at det finnes en side | Samme regel som for titler og søkemotorer (`seoForPath`). Viser døde lenker, særlig etter flytting fra en gammel nettside |
| Når kommer besøkene? | Sidevisninger per ukedag og time, og den travleste timen | Norsk tid, uansett hvor den besøkendes klokke står |
| Fører besøket til noe? | Trykk på telefonnummer og e-postadresse, abonnement på kalenderen, avspilte taler, mest leste nyheter og mest avspilte taler | En lydfil telles når den spilles, én gang per avspilling. En tale i Spotify eller video telles der den åpnes |
| Slik telles besøkene | Hva tallene bygger på og hva som ikke måles, og de to bryterne **Tell besøk på nettsiden** og **Ikke tell besøk fra denne nettleseren** | Den første gjelder alle besøkende og lagres i innstillingene (`countVisits`): menigheten kan slå tellingen av, og tallene som er telt, blir stående. Den andre huskes i nettleseren til den som redigerer nettsiden |

**Måles ikke:** hvem de besøkende er, nye og faste besøkende, hvor de kommer fra (søk, Facebook), og hva slags utstyr de bruker. Alt dette krever at noe om den besøkende lagres, hos den besøkende eller hos menigheten.

**Eksempeltall.** Mens appen står i demo, kan bordet fylles med 26 uker eksempeltall, laget for sidene som finnes. De legges bare på dager der ingenting er telt, er merket, og fjernes med **Fjern eksempeltallene** uten at en telt dag røres. Bordet sier fra så lenge perioden inneholder eksempeltall.

**Nullstilling.** **Nullstill besøkstallene** sletter alle tall, og er sperret i produksjon. Besøkstallene er ikke innhold: de følger ikke med i et datasett og tømmes ikke sammen med databasen. Når nettsiden byttes under **Velg menighet**, nullstilles de, siden de gjelder nettsiden som byttes ut.

### 2.6 Moduler

En **modul** er en del av produktet som en menighet enten har eller ikke har. Fanen **Moduler** (under System & Database) viser modulene og slår delene av dem av og på. Den er alltid i menyen.

**Produktets tilleggsmoduler** (produkteiers liste 7. oktober 2026):

| Modul | Status |
|:---|:---|
| **Analyse** | **Levert** som to deler med hver sin bryter: **Analysebord** (kapittel 2.4) og **Besøk på nettsiden** (kapittel 2.5) |
| Givertjeneste, Utleie, Arrangement, Kommunikasjon, Skjemaer, AI-assistent | **Planlagt.** Står bare som navn på siden. Ingenting er bygget, og ingenting bygges før produkteier ber om det |

Regnskap er ikke en egen modul. Givertjeneste og Utleie skal registrere inntekter og transaksjoner slik at de senere kan rapporteres og eksporteres til regnskap.

**Slik virker det**

* **Av til den er valgt.** En del er av til noen slår den på. En database der ingen har valgt, har alt av.
* **Valget gjelder hele menigheten.** Det lagres i databasen, ikke i nettleseren, og alle som bruker admin, ser det samme.
* **Av betyr borte, ikke slettet.** En del som er av, står ikke i menyen, og fanen tegnes ikke: den verken leser eller teller. Åpnes adressen likevel, sier siden at delen ikke er slått på, og viser veien til Moduler. Det som er registrert, blir stående, og er der når delen slås på igjen.
* **Hver del for seg.** Å slå én del av eller på rører ikke de andre.
* **Det som følger med.** Er «Besøk på nettsiden» av, teller ikke nettsiden besøk. Er «Analysebord» av, kan ikke oppmøtetall føres, og «Simulert historikk» under Database vises ikke.
* **Ikke innhold.** Valget følger ikke med i et datasett, og verken «Velg menighet» eller tømming av nettsiden eller planleggeren endrer det. Bare «Slett alt i databasen» under Database fjerner det, sammen med alt annet, og da er alt av igjen.

**Under arbeid.** Kalender og Meldinger er to brytere fra før modulene. De står nederst på siden, merket som uferdige: valget huskes bare i nettleseren, og de styrer foreløpig ikke noe innhold.

**Ikke bygget ennå**

* **Tilgang.** Siden skiller ikke mellom hva en menighet *har fått* og hva den *har slått på*: alle delene som finnes, kan slås på av den som er i admin. Tildeling av moduler og nivå per menighet er trinn 4 (kapittel 14), og krever publiserte databaseregler. Nivåene selv står i kapittel 1.3.
* **Flatene.** Moduler styrer i dag faner i admin og tellingen på nettsiden. Min side og den offentlige nettsiden har ingen deler som styres av en modul.

---

## 3. Webappen (Min side)

| Skjerm | Adresse | Innhold | Status |
|---|---|---|---|
| **Min side** | `/minside` | «Trenger svar» (forespørsler, innkallinger, ledige oppgaver i mine grupper), «Neste for deg», neste samling i kirken, mine grupper og mine oppgaver | Levert |
| **Oppgave** | `/oppgave/:id` | Tid, sted, instruks og hvem andre som står på. Ta oppgaven, svar på forespørsel, meld forfall | Delvis: medlemmet kan ikke skrive en grunn for forfallet ennå |
| **Gruppeleder** | `/leder` | Gruppene jeg leder, med bemanningsstatus | Levert |
| **Gruppe** | `/gruppe/:id` | Medlemmer, møteplan, aktiviteter og beskjeder til gruppen, med bilde | Levert |
| **Samling** | `/samling/:id` | Kjøreplan: programmet og oppgavene på én tidslinje, med hvem som står på hva | Delvis: programmet kan ikke redigeres i løsningen ennå |
| **Husfellesskap** | `/husfellesskap` | Neste møte med vert, tema og bibeltekst. «Kommer» / «Kommer ikke». Medlemsliste | Levert |
| Meldinger | `/meldinger` | Valgfri modul for meldinger på tvers av grupper | Planlagt: i dag en plassholderside |
| Kalender | – | Valgfri modul med felles kalender | Planlagt: modulen kan slås på, men har ingen side |
| **Min kalender** | – | Personlig oversikt på Min side | Mulig funksjon, ikke prioritert. Se under |

Min side ligger bak innlogging (kapittel 10.1). Øverst står hvem som er logget inn, rollen og «Logg ut». Et medlem ser bare det som gjelder egne grupper. Løsningen kan installeres på mobilen som app (PWA).

### Mulig funksjon: Min kalender

Ikke bygget. Avtalt innhold, hvis den tas inn senere:

* Kildebasert, ikke bare det medlemmet har bekreftet. Den viser offentlige arrangementer i menigheten, pluss kommende samlinger i gruppene medlemmet er med i.
* Hver kilde (menigheten og hver gruppe) kan slås av og på med et øyeikon. Standard er at alle kilder er på.
* «Kommer ikke» skjuler den ene samlingen. En bekreftet oppgave legges på samlingen den hører til, og lager ikke en egen hendelse.
* Husfellesskap vises bare når innkalling er sendt, eller medlemmet allerede har svart. Andre grupper viser alle kommende gruppesamlinger så lenge kilden er på.
* Den erstatter «Neste for deg» og «Neste i menigheten» på Min side. «Trenger svar», gruppene og oppgavene blir stående.
* Personlig kalenderabonnement (iCal) venter til innlogging finnes. Abonnement på menighetens offentlige kalender hører hjemme på nettsiden, ikke her.

---

## 4. Nettsiden

| Side | Adresse | Innholdet kommer fra | Status |
|---|---|---|---|
| **Forside** | `/` | Velkomsttekst fra innstillingene. Fremhevet samling eller neste gudstjeneste, og de fire neste samlingene, fra planleggeren. Tre siste nyheter og siste tale fra CMS-et | Delvis: tre infobokser, fellesskapsteksten og gaveteksten står fast i koden |
| **Hva skjer** | `/hva-skjer` | Kommende offentlige samlinger fra planleggeren | Levert |
| **Taler** | `/taler` | Talearkivet fra CMS-et, med avspilling | Levert |
| **Fellesskap** | `/fellesskap` | Gruppene som er satt til å vises, med møtetid og hvem man kan kontakte | Levert |
| **Lederskap** | `/lederskap` | Personer med offentlig profil og registrert samtykke | Levert |
| **Faste sider** | `/:slug` | Sidene som er skrevet i CMS-et, for eksempel «Om oss» og «Kontakt» | Levert |
| **Artikkel** | `/artikkel/:id` | En nyhetsartikkel fra CMS-et | Delvis: det finnes ikke noe arkiv med alle artiklene |
| **Meny og bunntekst** | alle sider | Menyen bygges av sidetreet. Bunnteksten henter kontaktinfo fra innstillingene | Levert |

---

## 5. Innholdstyper og felt

Tabellene beskriver dataene slik de faktisk lagres. Felt merket *planlagt* finnes i målbildet, men lagres ikke fra noe skjema i dag.

### 5.1 Arrangement (`Gathering`)
Felles begrep for enhver samling: gudstjeneste, ungdomsmøte, bønnemøte, dugnad, møte i husfellesskap.

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id` | `string` | Ja | Unik identifikator |
| `title` | `string` | Ja | Tittel, f.eks. «Høsttakkefest & gudstjeneste» |
| `startsAt` | ISO 8601 | Ja | Start, lagret som et eksakt øyeblikk |
| `endsAt` | ISO 8601 | Nei | Slutt |
| `location` | `string` | Nei | Sted. Mangler det, vises «Misjonskirken» overalt |
| `groupId` | `string` | Ja | Ansvarlig gruppe |
| `type` | `"arrangement" \| "gruppesamling"` | Nei | En gruppesamling er aldri med i kontrakt v1 av API-et, selv om den er satt til offentlig |
| `isGudstjeneste` | `boolean` | Nei | Om samlingen er en gudstjeneste. Mangler feltet, leses det av tittelen |
| `theme`, `bibleText` | `string` | Nei | Tema og bibeltekst |
| `hostPersonId` | `string` | Nei | Vert, brukt av husfellesskap |
| `invitationSent`, `invitationSentAt` | `boolean`, ISO 8601 | Nei | Om innkalling til husfellesskapet er sendt |
| `visibility` | `"intern" \| "offentlig" \| "fremhevet"` | Ja | Den ene bryteren for synlighet (kapittel 7) |
| `isPublic` | `boolean` | Nei | Speil av `visibility` for eldre dokumenter. Leses aldri alene |
| `cancelled` | `boolean` | Nei | Avlyst |
| `programSchedule` | `ProgramItem[]` | Nei | Program: klokkeslett, tittel, beskrivelse og eventuell kobling til en oppgave |
| `updatedBy`, `updatedAt` | `string`, ISO 8601 | Nei | Hvem som endret sist, og når |

### 5.2 Oppgave (`Task`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `gatheringId`, `groupId` | `string` | Ja | Oppgaven, samlingen den hører til, og gruppen den sorterer under |
| `title` | `string` | Ja | F.eks. «Lydtekniker», «Møteleder», «Kirkekaffe» |
| `neededCount` | `number` | Nei | Hvor mange som trengs. Mangler tallet, regnes det som 1 |
| `description`, `instruction` | `string` | Nei | Kort beskrivelse, og instruks for den frivillige. Åpner instruksen med «Møt opp kl. 09:30», brukes det som oppmøtetid |
| `status` | `"open" \| "assigned" \| "confirmed" \| "vacant" \| "cancelled"` | Ja | **Regnes ut av tildelingene** (kapittel 6). Settes aldri for hånd |
| `lastReminded` | ISO 8601 | Nei | Når noen sist ble purret |
| `updatedBy`, `updatedAt` | `string`, ISO 8601 | Nei | Siste endring |

### 5.3 Tildeling (`Assignment`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `taskId`, `personId` | `string` | Ja | Hvem som står på hvilken oppgave |
| `response` | `"pending" \| "confirmed" \| "declined" \| "withdrawn"` | Ja | Forespurt, akseptert, avslått eller forfall |
| `assignedAt` | ISO 8601 | Nei | Når personen ble tildelt eller forespurt |
| `respondedAt` | ISO 8601 | Nei | Når personen svarte eller meldte forfall |
| `withdrawalReason` | `string` | Nei | Valgfri, privat grunn ved forfall, bare for leder og administrator. *Planlagt i skjermbildene:* feltet kan lagres, men medlemmet har ikke noe sted å skrive grunnen, og lederen ser den ikke |

### 5.4 Person (`Person`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id` | `string` | Ja | Unik identifikator. *Planlagt:* lik brukerens ID ved innlogging |
| `name` | `string` | Ja | Fullt navn |
| `email`, `phone` | `string` | Nei | Privat kontaktinfo. Vises aldri på nettsiden |
| `globalRole` | `"member" \| "admin"` | Ja | Medlem eller administrator |
| `policeCertificateValidUntil` | `YYYY-MM-DD` | Nei | Utløpsdato for politiattest |
| `unavailablePeriods` | `{ from, to, reason? }[]` | Nei | Perioder personen er borte. Vises som advarsel ved tildeling |
| `isPublicProfile` | `boolean` | Nei | Om personen skal vises på nettsiden |
| `publicTitle`, `publicPhone`, `publicEmail` | `string` | Nei | Tittel og kontaktinfo utad |
| `avatarUrl` | `string` | Nei | Profilbilde |
| `consentToPublishGivenAt`, `consentGivenBy` | ISO 8601, `string` | Nei | **Samtykkelogg:** når samtykket ble registrert, og av hvem |
| `analyticsHiddenModules` | `string[]` | Nei | Modulene personen har skjult på Analysebord. Endres med `arrayUnion` / `arrayRemove` |
| `updatedBy`, `updatedAt` | `string`, ISO 8601 | Nei | Siste endring |

### 5.5 Gruppe (`Group`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `name` | `string` | Ja | Gruppen og navnet |
| `description` | `string` | Nei | Kort omtale, vises på «Fellesskap» |
| `category` | `"tjenestegruppe" \| "husgruppe" \| "strategigruppe" \| "ledergruppe" \| "interessegruppe"` | Nei | Kategori |
| `tags` | `string[]` | Nei | Stikkord |
| `isPublic` | `boolean` | Nei | `false` skjuler gruppen på nettsiden og i API-et. Mangler feltet, vises gruppen |
| `memberIds`, `leaderIds`, `deputyLeaderIds` | `string[]` | Ja, Ja, Nei | Medlemmer, ledere og nestledere |
| `meetingSchedule` | `{ weekday, time, frequency }` | Nei | Fast møtetid: hver uke, annenhver uke eller hver måned |
| `memberJoinedAt` | `{ personId: dato }` | Nei | Når hvert medlem ble med |
| `notificationPreferences` | `{ personId: boolean }` | Nei | Om medlemmet vil ha varsler fra gruppen |

### 5.6 Gruppemelding og oppmøte

| Type | Felt | Beskrivelse |
|:---|:---|:---|
| `GroupMessage` | `id`, `groupId`, `senderPersonId`, `senderName`, `content`, `imageUrl?`, `createdAt` | En beskjed i en gruppe, med valgfritt bilde |
| `GatheringAttendance` | `id`, `gatheringId`, `personId`, `status` (`attending` / `declined`), `updatedAt?` | Svaret «Kommer» eller «Kommer ikke» på en samling |
| `GatheringHeadcount` | `id` (`headcount-<samling>`), `gatheringId`, `adults`, `children`, `note?`, `registeredAt`, `registeredBy?` | Hvor mange som var til stede, talt på dagen. Ett per samling. Internt: lastes aldri av nettsiden. Lagres i dag i `cms_settings`, merket `recordType: "gatheringHeadcount"`, fordi reglene i drift ikke slipper inn nye samlinger (kapittel 13) |

### 5.7 Side (`CmsPage`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `title` | `string` | Ja | Siden og overskriften |
| `slug` | `string` | Ja | Adressen, f.eks. `om-oss` |
| `summary` | `string` | Ja | Ingress under tittelen |
| `content` | `string` | Ja | Innholdet, skrevet med innholdsblokker (kapittel 8.3) |
| `isPublished` | `boolean` | Ja | Kladd eller publisert |
| `publishAt` | ISO 8601 | Nei | Tidspunkt for planlagt publisering |
| `status` | `"draft" \| "published" \| "scheduled"` | Nei | Regnes ut av de to feltene over når siden lagres |
| `parentPageId` | `string \| null` | Nei | Hovedfanen siden ligger under. `null` er en hovedfane |
| `menuOrder` | `number` | Nei | Rekkefølge i menyen |
| `inNavMenu` | `boolean` | Nei | Om siden står i menyen |
| `linkUrl` | `string` | Nei | Peker menyvalget til en innebygd side som `/hva-skjer`, eller en ekstern adresse |
| `heroImage` | `string` | Nei | Hovedbilde |
| `metaDescription`, `ogImage` | `string` | Nei | Tekst og bilde for søk og deling |
| `updatedAt` | ISO 8601 | Ja | Sist endret |
| `updatedBy` | `string` | Nei | *Planlagt:* settes når innlogging finnes |

`parentId`, `navOrder` og `publishedAt` lagres som speil av `parentPageId`, `menuOrder` og `publishAt` for eldre dokumenter. `heroCtaText` og `heroCtaLink` lagres tomme og brukes ikke.

### 5.8 Nyhetsartikkel (`CmsNewsArticle`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `title`, `slug` | `string` | Ja | Artikkelen, overskriften og adressen |
| `category` | `"aktuelt" \| "gudstjeneste" \| "ungdom" \| "misjon" \| "familie"` | Ja | Kategori |
| `summary`, `content` | `string` | Ja | Ingress og fulltekst |
| `author` | `string` | Ja | Forfatter, som fritekst |
| `publishedAt` | ISO 8601 | Ja | Publiseringstidspunkt. Nyeste vises først |
| `isPublished` | `boolean` | Ja | Kladd eller publisert |
| `imageUrl` | `string` | Nei | Bilde |
| `expiresAt` | `YYYY-MM-DD` | Nei | *Planlagt:* artikkelen forsvinner fra forsiden etter datoen |
| `gatheringRefId` | `string` | Nei | *Planlagt:* kobling til en samling |

### 5.9 Tale (`CmsSermon`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `title` | `string` | Ja | Talen og tittelen |
| `speaker` | `string` | Ja | Taler, som fritekst |
| `date` | dato | Ja | Når talen ble holdt. Nyeste vises først |
| `bibleText`, `series`, `summary` | `string` | Nei | Bibeltekst, serie og sammendrag |
| `audioUrl`, `spotifyUrl` | `string` | Nei | Lydfil og Spotify-lenke |
| `videoUrl` | `string` | Nei | Video. YouTube-lenker gjøres om til `youtube-nocookie.com` |
| `speakerPersonId`, `guestSpeakerName`, `gatheringId` | `string` | Nei | *Planlagt:* kobling til person og samling |

### 5.10 Stab, innstillinger og design

| Type | Felt |
|:---|:---|
| `CmsStaffMember` | `id`, `name`, `role`, `email`, `phone`, `category` (`pastor`, `stab`, `lederskap`, `barneleder`), `imageUrl?`, `bio?` |
| `CmsSettings` (ett dokument) | `churchName`, `appName`, `tagline`, `welcomeHeadline`, `welcomeSubtext`, `address`, `phone`, `email`, `officeHours`, `vippsNumber`, `vippsDescription`, `bankAccount`, `orgNumber`, lenker til Facebook, Instagram, YouTube og podkast, og `theme` |
| `CmsDesignTheme` | `primaryColor`, `accentColor`, `backgroundTone` (`stone`, `slate`, `warm`, `pure-white`), `headingFont` (`sans`, `serif`), `bodyFont` (`sans`, `serif`), `borderRadius` (`sharp`, `medium`, `smooth`). `spacingDensity` lagres med de ferdige temaene, men brukes ikke, og kan ikke velges |

---

## 6. Bemanningsmotoren

Én ligning gjelder overalt:

$$\text{Ledige plasser} = \text{Behov (neededCount)} - \text{Bekreftet (confirmed)} - \text{Venter (pending)}$$

Den som har avslått eller meldt forfall, holder ingen plass.

### 6.1 Tre måter å komme på en oppgave

| Handling | Hvem | Resultat |
|:---|:---|:---|
| **Tildel** | Leder eller administrator, når vakten alt er avtalt | Bekreftet med en gang |
| **Forespør** | Leder eller administrator | Venter på svar til medlemmet svarer ja eller nei på Min side eller oppgavesiden |
| **Ta oppgaven** | Medlemmet selv, når en plass er ledig i en av medlemmets grupper | Bekreftet med en gang |

### 6.2 Forfall

* Et bekreftet medlem som melder forfall, lagres som **forfall**. Et nei på en forespørsel lagres som **avslått**.
* *Planlagt:* medlemmet kan oppgi en valgfri, privat grunn som bare leder og administrator ser.
* Kommer forfallet eller avslaget **mindre enn 48 timer før samlingen starter**, er det **akutt**: oppgaven merkes og løftes fram i «Trenger oppfølging» til plassen er fylt igjen.
* Hver tildeling får tidspunkt for når den ble opprettet og når den ble besvart.

### 6.3 Oppgavens status følger av tildelingene

| Status | Når |
|:---|:---|
| `confirmed` | Alle plasser er fylt av noen som har sagt ja |
| `assigned` | Alle plasser er opptatt, men noen har ikke svart |
| `open` | Minst én plass er ledig |
| `vacant` | En plass ble ledig ved et akutt forfall, og er ikke fylt igjen |
| `cancelled` | Oppgaven er avlyst |

Statusen lagres i samme skriving som endringen i tildelingene eller behovet. Den kan derfor ikke si noe annet enn tildelingene.

### 6.4 Slik vises bemanningen (WCAG AA)
Alltid ikon og tekst, aldri farge alene:

* 🟢 **Dekket:** hele behovet er bekreftet, f.eks. `Dekket (2/2)`
* 🟡 **Venter på svar:** ingen har bekreftet, men noen er forespurt
* 🔴 **Mangler X:** det mangler folk. Én bekreftet av to er rødt, også når den andre er forespurt. Et forfall holder oppgaven rød til plassen faktisk er dekket

En samling er rød så lenge én oppgave er rød, gul når ingen er røde og minst én er gul, og ellers grønn.

---

## 7. Synlighet og personvern

Tre regler avgjør hva en besøkende ser. Hver av dem ligger ett sted i koden og brukes av både nettsiden og API-et.

### 7.1 Samlinger: én bryter
Feltet `visibility` er den eneste bryteren:

* **`intern`** – bare for medlemmer, ledere og stab. Skjult i kalenderen og i API-et.
* **`offentlig`** – vises i kalenderen på nettsiden.
* **`fremhevet`** – offentlig, og løftet fram øverst på forsiden.

### 7.2 Hva forsiden løfter fram
1. En fremhevet samling som ikke er avlyst og ikke er passert.
2. Ellers neste gudstjeneste.
3. Ellers den neste offentlige samlingen.

En avlyst samling løftes aldri fram. Kalenderen viser bare kommende samlinger.

### 7.3 Grupper
En gruppe vises på «Fellesskap», «Lederskap» og i API-et til en administrator fjerner krysset «Vis gruppen på nettsiden». En skjult gruppe gir verken fra seg navnet eller møtetiden sin.

### 7.4 Personer
En person vises bare når «Vis offentlig» er satt **og** et samtykke er registrert, med tidspunkt og hvem som registrerte det. Da vises navn, tittel utad og kontaktinfo utad. Privat telefon og e-post er aldri med. Tas krysset bort, fjernes samtykket.

---

## 8. CMS-et i detalj

### 8.1 Sider og meny
* Menyen har to nivåer: hovedfaner og underfaner. Rekkefølgen endres med dra og slipp.
* Den offentlige menyen og sidelisten i admin bygges av samme sidetre.
* Slettes en hovedfane, flyttes underfanene opp til toppnivå i samme lagring, slik at ingen side blir uten vei inn.
* Et menyvalg kan peke på en innebygd side (`/hva-skjer`, `/taler`, `/fellesskap`) i stedet for en egen tekstside.

### 8.2 Kladd, publisert og planlagt
* **Kladd:** vises ikke i menyen, og adressen svarer «Siden ble ikke funnet».
* **Publisert:** vises med en gang.
* **Planlagt:** publisert med et tidspunkt fram i tid. Siden blir synlig av seg selv når tidspunktet er passert. Til da sier adressen når siden kommer.

### 8.3 Innholdsblokker
Innholdet skrives som tekst med ferdige blokker. Blokkvelgeren setter dem inn, og redaktøren fyller ut teksten. Innholdet vises aldri som rå HTML.

| Blokk | Skrives slik |
|:---|:---|
| Overskrift | `# Stor`, `## Mellom`, `### Liten` |
| Liste | `- punkt` eller `1. punkt` |
| Uthevet og kursiv | `**fet**`, `*kursiv*` |
| Lenke | `[tekst](/intern-side)` eller `[tekst](https://…)` |
| Infoboks | `:::callout[info] Tittel` … `:::` (også `warning`, `success`, `primary`) |
| Bilde med tekst | `:::media-left[bildeadresse]` eller `:::media-right[bildeadresse]` … `:::` |
| Kort side ved side | `:::grid`, deretter `:::card Tittel` for hvert kort, avsluttet med `:::` |
| Sitat | `:::quote[Kilde]` … `:::` |
| Handlingsknapp | `[Knapp: Tekst](/lenke)` |

### 8.4 Bilder
Et hovedbilde lastes opp fra maskinen, limes inn som adresse eller velges blant ferdige bilder. Et opplastet bilde skaleres ned til maks 1400 piksler og komprimeres i nettleseren.

**Delvis:** bildet lagres inne i selve sidedokumentet, ikke i en bildelagring. Se 8.7.

### 8.5 Design
Fanen «Tema & designsystem» har fem ferdige temaer (Klassisk menighetsblå, Nordisk salvie, Varm terracotta, Dyp vinrød, Moderne indigo) og egne valg. Det som lagres, gjelder hele nettsiden med en gang:

| Valg | Virkning på nettsiden |
|:---|:---|
| **Primærfarge** | Knapper, lenker, menyen, fremhevede bokser og de mørke flatene |
| **Aksentfarge** | Handlingsknapper, merker og ikoner på mørk bakgrunn |
| **Bakgrunnstone** | Bakgrunnen på alle sider |
| **Skrift** | Overskrifter og brødtekst, hver for seg: sans eller serif |
| **Hjørneavrunding** | Kort, bokser, bilder og knapper: skarp, balansert eller myk |

Administratoren velger én farge. Løsningen lager elleve toner av den, fra nesten hvit til nesten svart, slik at hver flate får en tone som passer. Tonene har fast lyshet uansett hvilken farge som velges. Derfor er hvit tekst lesbar på en primærknapp og mørk tekst lesbar på en aksentknapp også når noen velger gult eller lyseblått (WCAG AA, dekket av tester).

Fargene som har en fast betydning, følger ikke temaet: rødt for avlyst, gult for varsel, grønt for bekreftet, og fargen som skiller gruppekategoriene fra hverandre. Adminpanelet og Min side har sitt eget, faste utseende.

### 8.6 Søk og deling
Hver adresse på nettsiden har sin egen tittel, beskrivelse og sitt eget delingskort. De står i siden slik serveren sender den, så både søkemotorer og tjenester som viser en lenke (Facebook, Messenger, Slack) ser dem.

| Adresse | Tittel | Beskrivelse | Bilde |
|:---|:---|:---|:---|
| Forsiden | Menighetens navn og slagord | Velkomstteksten | Forsidens delebilde |
| En CMS-side | Sidens tittel og menighetens navn | Feltet «Beskrivelse i søkeresultater», ellers ingressen | Delebildet, ellers hovedbildet |
| En nyhetsartikkel | Artikkelens tittel og menighetens navn | Ingressen | Artikkelens bilde |
| Kalender, taler, fellesskap, lederskap | Sidens navn og menighetens navn | En fast setning, eller CMS-siden som peker dit | – |

* Mangler et bilde, vises menighetens ikon.
* Et bilde må ha en nettadresse for å kunne deles. Et hovedbilde som er lastet opp fra maskinen, brukes derfor ikke som delebilde.
* En adresse uten publisert side svarer «ikke funnet» (404) og holdes utenfor søkeresultatene. Det gjelder også kladder og sider som er planlagt publisert senere.
* Min side og adminpanelet holdes utenfor søkeresultatene.
* Redaktøren ser en forhåndsvisning av søkeresultatet og delingskortet, bygget av de samme reglene.

Nettstedets adresse leses av forespørselen. Den kan settes fast med miljøvariabelen `SITE_URL` (for eksempel `https://lillesandmisjonskirke.no`).

### 8.7 Kjente begrensninger i CMS-et

| Område | I dag | Konsekvens |
|:---|:---|:---|
| Bilder | Lagres som tekst inne i sidedokumentet | Alle besøkende laster ned alle sidenes bilder ved første besøk. Et dokument kan ikke være større enn 1 MB. Et opplastet bilde kan ikke brukes som delebilde |
| Design | Skriftvalget står mellom skriftene maskinen alt har | Menigheten kan ikke velge en egen skrift eller laste opp logo |
| Kladder | Skjules i visningen, men leveres til nettleseren | En kladd er ikke hemmelig. Løses sammen med innlogging |
| Forside | Tre infobokser, fellesskaps- og gaveteksten står i koden | Kan ikke endres uten en utvikler |
| Stab | «Lederskap & stab» er en egen liste | To kilder for de samme menneskene, og listen har ingen samtykkelogg |
| Nyheter | Ingen arkivside, ingen utløpsdato, ingen kobling til samling | Eldre artikler er bare tilgjengelige via direkte lenke |

---

## 9. Offentlig API

Serveren leverer et åpent JSON-API som eksterne nettsider kan lese. Bare hvitelistede felt slipper ut. Personer, oppgaver, tildelinger og meldinger er aldri med.

| Endepunkt | Innhold |
|:---|:---|
| `GET /api/offentlig/arrangementer?fra=…&til=…` | Kontrakt v1: offentlige samlinger, tider med norsk tidssone |
| `GET /api/public/gatherings` | v1.1: samlinger, med feltet `fremhevet` |
| `GET /api/public/groups` | v1.1: grupper som vises utad |
| `GET /api/public/recurring` | v1.1: faste møtetider |
| `GET /api/public/all` | v1.1: alt samlet |

Kontrakten står i `INTEGRASJON-MENIGHETSPLAN.md`. Det eksterne CMS-et (`menighetsplan_ClaudeCMS`) er en egen løsning som leser dette API-et. Koden for det hører ikke hjemme i dette repoet.

---

## 10. Sikkerhet og tilgang

| Område | Mål | I dag |
|:---|:---|:---|
| Innlogging | Medlemmer logger inn med Google-konto eller en lenke på e-post. Rollen styrer hva man ser og kan gjøre | **Levert 7. oktober** for skjermene: Min side krever at man står i personregisteret, og admin krever administrator (kapittel 10.1) |
| Regler i databasen | Besøkende leser bare offentlige data. Et medlem endrer bare sitt eget. Bare administrator endrer offentlige profilfelt og samtykke | **Planlagt (trinn 4).** Reglene slipper fortsatt gjennom lesing av alt, og skriving uten innlogging. Innloggingen sperrer skjermene, ikke dataene |
| Sporbarhet | `updatedBy` er alltid den innloggede brukeren | **Delvis.** Regelen finnes, men gjelder først når noen er logget inn |
| Personregisteret | Lastes bare for innloggede | **Delvis.** Nettsiden viser bare personer med samtykke, og laster ikke oppgaver, tildelinger eller meldinger. Hele personregisteret lastes likevel til nettleseren |
| Samtykke | Ingen person vises uten registrert samtykke | **Levert** |
| API | Ingen persondata ut | **Levert** |

**Databasen inneholder bare demodata.** Ekte persondata skal ikke legges inn før reglene i databasen er lukket (trinn 4).

### 10.1 Innlogging og roller

**To veier inn, ingen passord.** På `/logg-inn` velger man «Fortsett med Google» eller skriver e-postadressen sin og får en lenke som logger inn. Lenken virker én gang. Åpnes den på en annen enhet enn den ble bestilt fra, må adressen skrives inn på nytt, så en lenke på avveie ikke er nok.

**Kontoen er ikke personen.** En konto er det man logger inn med. En person er en rad i menighetens personregister. De kobles med e-postadressen: kontoens bekreftede adresse må stå på nøyaktig én person i registeret. Store og små bokstaver spiller ingen rolle.

| Den som logger inn | Får |
|:---|:---|
| Står i registeret med adressen | Min side, som den personen |
| Står der som administrator | Min side og admin |
| Står ikke i registeret | Beskjed om å kontakte menigheten, og «Logg ut og prøv en annen konto». Ingenting annet |
| Har en adresse flere personer deler | Beskjed om at adressen ikke sier hvem man er, og at menigheten må rette det |

**Tre roller, og de følger av personen.** *Administrator* står på personen i registeret. *Gruppeleder* er den som leder minst én gruppe, som leder eller stedfortreder. *Medlem* er alle andre i registeret. Rollen lagres ikke på kontoen, så den endres i det personen endres i registeret.

**Bak innlogging.** Min side med undersidene krever at man står i registeret. Admin krever administrator. Den offentlige nettsiden er åpen. Planleggingsdataene (oppgaver, tildelinger, meldinger, oppmøte) hentes bare for den som er inne, og fjernes fra nettleseren ved utlogging.

**Første administrator** legges inn utenfra, én gang, av den som setter opp installasjonen: `npm run first-admin -- e-postadresse "Navn"`. Deretter legger administratoren inn de andre i admin. Uten en administrator i registeret kommer ingen inn i admin.

**Testbryteren er borte.** Det går ikke an å velge hvem man er uten å logge inn. Testverktøyet på husfellesskapssiden er fjernet. På en utviklers egen maskin, og bare der, kan man gå inn som en person fra registeret; den muligheten finnes ikke i en menighets publiserte løsning. Demoen er eneste unntak: der går alle inn uten innlogging (kapittel 1.4), og den har bare eksempeldata.

**Må slås på per installasjon.** I Firebase-prosjektet må innloggingsmåtene «Google» og «E-postlenke» være slått på, og adressen installasjonen ligger på, må stå blant de godkjente domenene. Uten det sier innloggingssiden at innloggingsmåten ikke er slått på.

---

## 11. Planleggingsrutiner

### 11.1 «Lag neste arrangement»
Oppretter en ny samling på valgt dato med samme klokkeslett, og kopierer oppgavene og behovet. Personlisten er tom, slik at nye kan tildeles eller forespørres.

### 11.2 Kjøreplan
Samlingssiden viser programmet og oppgavene på én tidslinje. Et programpunkt som er koblet til en oppgave, viser hvem som står på den. Et programpunkt uten oppgave har ingen ansvarlig, og en samling uten program viser bare oppgavene sine. Løsningen viser aldri et program eller et navn som ikke er registrert.

**Planlagt:** skjermbilde for å redigere programmet.

### 11.3 Purring uten e-post
Til en varslingstjeneste er koblet på: «Purr» lagrer tidspunktet på oppgaven og åpner en ferdig tekst med oppmøtedetaljer, som lederen kopierer og sender på SMS eller Messenger.

### 11.4 YouTube uten sporing
YouTube-lenker på taler gjøres om til `youtube-nocookie.com`, slik at en besøkende ikke får sporingskapsler før videoen spilles av.

---

## 12. Hva som er levert

### Grunnlaget (Google AI Studio, til 28. september 2026)
De tre flatene, Firestore-databasen, bemanningsmotoren, husfellesskap, gruppemeldinger, det offentlige API-et (v1 og v1.1) og første utgave av CMS-et.

### Kvalitet og oppretting (1.–3. oktober 2026)

| Område | Levert |
|:---|:---|
| **Fundament** | Streng typesjekk. Testløp med Vitest: over 430 tester som kjører den ekte koden. Nye dokumenter bygges ett sted. En lagring som feiler, vises for brukeren |
| **Datalaget** | Skjermen viser bare det databasen har. Det som hører sammen, lagres i én operasjon. To samtidige endringer kan ikke overskrive hverandre. Testene kjører mot den ekte Firestore-klienten uten nett |
| **Bemanning** | Oppgavens status regnes ut av tildelingene. Et medlem kan ta en ledig oppgave og svare på en forespørsel. Forfall med 48-timersregel og tidsstempler |
| **Min side** | Bruker dagens dato i stedet for en fast demodato. «Trenger svar» er sortert etter hva som haster |
| **Nettsiden** | Forsiden følger «fremhevet», ellers neste gudstjeneste. Kalenderen viser kommende samlinger. Grupper kan skjules. Et interesseskjema som ikke lagret noe, er erstattet med hvem man kan kontakte. Personer vises bare med samtykke |
| **Kjøreplan** | Viser bare det som er registrert. Et oppdiktet standardprogram og oppdiktede navn er fjernet |
| **CMS** (AI Studio, 2. oktober) | Sidetre med dra og slipp, innholdsblokker, hovedbilde, design-fane, søk og deling, planlagt publisering, forhåndsvisning |
| **Design** (3. oktober) | Temaet som velges i admin, styrer hele nettsiden: farger, bakgrunn, skrift og avrunding. Lesbarheten er sikret for alle fargevalg |
| **Søk og deling** (3. oktober) | Hver adresse har egen tittel, beskrivelse og delingskort i siden slik serveren sender den. Ukjente adresser og kladder svarer «ikke funnet» |
| **Opprydding** | De største filene er delt i én fil per fane og dialog. Hardkodede demo-ID-er, datoer og steder er ute av logikken. Utviklerord er ute av skjermbildene |
| **Ytelse** (5. oktober) | Code splitting: offentlige ruter lastes uten admin, Min side og CMS-panel. Admin-faner hentes ved behov, med forhåndshent ved peker over menyvalg. Firebase og React er egne Vite-biter. Ved utdatert chunk etter deploy: automatisk én gangs reload på ruter, manuell «Last på nytt» i admin-faner |

### Analysebord (5. oktober 2026)

| Område | Levert |
|:---|:---|
| **Analysebord** | Ny fane nederst i menyen (kapittel 2.4), fra 7. oktober en del av modulen Analyse. Utregningene er rene funksjoner med tester (`src/utils/churchAnalytics.ts`) |
| **Oppmøtetall** | Ny datatype `GatheringHeadcount`, registreres og rettes fra bordet. Prøvd mot databasen i drift: lagres, leses tilbake og fjernes |
| **Simulert menighetsliv** | Historikk for å prøve bordet, under Database og Testdata. Prøvd mot databasen i drift: 862 dokumenter skrevet, ingen dobling ved ny kjøring, alt fjernet igjen |
| **Trenger oppfølging** | En oppgave på en samling som er over, telles ikke lenger som ubesatt i menyen og vises ikke under «Trenger oppfølging» eller «Venter på svar». «Alle oppgaver» viser fortsatt alt |
| **Menighetens helse** | Fire nye moduler: bemanning per arrangement, flere oppgaver på samme samling, oppgaver og aktiviteter per måned (0–8 eller flere), og hver enkelt. Simuleringen bemanner nå også møteleder og taler, slik at doble oppgaver forekommer |
| **Tilpass bordet** | Hver administrator velger hvilke moduler som vises. Valget lagres på personen. Prøvd mot databasen i drift |

---
### Besøk på nettsiden (7. oktober 2026)

| Område | Levert |
|:---|:---|
| **Anonym telling** | Nettsiden teller sidevisninger, besøk, tid i visning, adresser uten side og handlinger, som summer per dag. Ingenting lagres hos den besøkende (kapittel 2.5). Reglene er rene funksjoner med tester (`src/utils/siteTraffic.ts`, `src/utils/visitTracker.ts`) |
| **Bordet** | Ny fane **Besøk på nettsiden**, fra samme dag en del av modulen Analyse: nøkkeltall, besøk over tid, mest besøkte sider, sider som aldri åpnes, hvor besøkene starter, adresser som ikke finnes, når besøkene kommer, og handlinger |
| **Eksempeltall og nullstilling** | Eksempeltall for demonstrasjon, merket og fjernbare. Nullstilling er sperret i produksjon |
| **Menighetens valg** | Tellingen kan slås av og på fra bordet. Den som redigerer nettsiden, kan holde sin egen nettleser utenfor |
| **Analysebord** | «Besøk på nettsiden måles ikke» er erstattet av en lenke til det nye bordet |

### Moduler (7. oktober 2026)

| Område | Levert |
|:---|:---|
| **Styringen** | Én liste over produktets moduler og delene som kan slås på (`src/pages/admin/addons.ts`). Menyen, siden Moduler og sperren foran en fane tegnes fra den (kapittel 2.6) |
| **Siden Moduler** | Kort med bryter for hver del av Analyse, de planlagte modulene som navn, og Kalender og Meldinger merket som uferdige |
| **Analyse som modul** | Analysebord og Besøk på nettsiden er av til de slås på. Menyseksjonen heter Analyse (før: Innsikt) og vises bare når noe under den er på. Nettsiden teller besøk bare mens delen er på |
| **Lagring** | Valget lagres for hele menigheten, ett felt per del, og er ikke en del av et datasett |

### Nøytral og flyttbar app (7. oktober 2026)

Trinn 1 av «Klar for flere menigheter» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Databasen** | Appen, serveren og skriptene leser hvilken database de hører til, fra installasjonens innstillinger (`VITE_FIREBASE_*`, se `.env.example`). Fila med én fast database er fjernet |
| **Ikke satt opp** | En installasjon uten innstillinger viser én melding om hva som mangler, og leser ingen database. Den kobler seg aldri til en annen menighets |
| **Ingen menighets opplysninger** | Før en menighet har lagt inn sine egne innstillinger, vises navnet «Menigheten» og ingenting annet. De oppdiktede opplysningene (adresse, telefon, Vipps, konto, organisasjonsnummer) vises bare når demodataene er lagt inn |
| **Tomme felt** | Bunnen av nettsiden, gaveblokken og kontaktsiden viser bare det som er fylt inn. En tom rad eller en lenke til ingenting tegnes ikke |
| **Faste tekster** | Setningen om tilknytning til Misjonskirken Norge, mottoet som sto fast i menyen og på Min side, og «Sprell Levende» i standardtekstene er tatt ut. Standardstedet for et arrangement uten sted er «Kirken» (før: «Misjonskirken» i appen og «Lillesand Misjonskirke» i API-et) |
| **Vakt** | En test går gjennom koden og feiler hvis en fil utenom demodataene nevner én menighet, ett kirkesamfunn eller én database |

### Innlogging og roller (7. oktober 2026)

Trinn 2 av «Klar for flere menigheter» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Innlogging** | Google-konto eller lenke på e-post, på `/logg-inn`. Ingen passord. Feil sies på norsk, uten koder |
| **Konto og person** | Kontoens bekreftede e-postadresse peker ut personen i registeret. Den som ikke står der, eller deler adresse med en annen, kommer ikke inn og får vite hvorfor |
| **Roller** | Administrator står på personen. Gruppeleder følger av gruppene. Medlem er alle andre i registeret |
| **Sperren** | Min side krever at man står i registeret, og admin krever administrator. Planleggingsdataene hentes bare for den som er inne, og fjernes ved utlogging |
| **Testbryteren** | Fjernet fra menyen på nettsiden, Min side og alle undersidene. Testverktøyet på husfellesskapssiden og den gamle innstillingssiden er fjernet |
| **Første administrator** | Legges inn med `npm run first-admin` av den som setter opp installasjonen |
| **Ikke levert her** | Reglene i databasen er fortsatt åpne (trinn 4). Selve innloggingen mot Google og e-post er ikke prøvd i drift: innloggingsmåtene må først slås på i Firebase-prosjektet |

### Nivåene og stripen i demoen (8. oktober 2026)

Trinn 3a av «Klar for flere menigheter» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Demo-innstillingen** | En installasjon er demoen når `VITE_DEMO` er `true`. Adressen til påmeldingen og til nettsiden som presenterer produktet legges inn samme sted (`.env.example`). Uten innstillingen er alt som før |
| **Stripen** | Står øverst på nettsiden, Min side, admin og innloggingssiden i demoen, også når man ruller, på mobil og PC. Menyene som var festet øverst, står under den |
| **Nivåvelgeren** | To valg, Menighetsplattform og Menighetsplan. Valget ligger i nettleseren til den som ser på, og følges mellom faner |
| **Admin følger nivået** | På Menighetsplattform er «Trenger oppfølging», «Grupper & Husfellesskap» og «Roller» ute av menyen, og overskriften heter «Arrangementer & Personer». Fanene og gruppe- og oppgavekortene tegnes ikke, og siden sier hvor de hører til |
| **Ikke levert her** | Min side, arrangementssiden, oversikten og gruppene på nettsiden er like på begge nivå (3c). Ingen kommer inn i demoen uten innlogging (3b). Demoen er ikke lagt ut (3e) |

### Veien inn i demoen (9. oktober 2026)

Trinn 3b av «Klar for flere menigheter» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Veien inn** | I demoen er innloggingssiden byttet ut med tre valg: administrator, gruppeleder og frivillig. Stripen har «Gå inn» for den som ikke er inne, og «Bytt rolle» for den som er det. «Bytt rolle» kom til samme dag, etter at produkteier gikk inn som frivillig og ikke fant CMS-et. Et eget valg for CMS-et kom også til, og ble tatt ut igjen samme dag: det var ikke en egen rolle, bare en annen startside for administratoren. CMS-et er i stedet nevnt først i teksten under «Administrator» |
| **Hvem man er** | En person fra demoens register med rollen, valgt av registeret selv. Min side og admin viser navnet som for en innlogget |
| **Uten databaseverktøy og moduler** | «Database og Testdata», «Moduler» og tilleggsmodulene er ute av menyen i demoen, og fanene tegnes ikke |
| **Sperre mot tømming** | Alt som tømmer databasen, nekter i demoen. Demoens database fylles og nullstilles utenfra |
| **Prøvd som publisert** | Appen er bygget både som demo og som en menighets installasjon og åpnet i nettleseren: demoen har stripen og veien inn, menighetens har bare innlogging |
| **Ikke levert her** | Min side og de andre skjermene er like på begge nivå (3c). Demodataene har faste datoer (3d). Demoen er ikke lagt ut, og nullstilles ikke (3e) |

### Demodata som lever, og nullstillingen (9. oktober 2026)

Trinn 3d, og nullstillingen i trinn 3e, av «Klar for flere menigheter» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Eksempelmenigheten** | Heter Fjordvik menighet og er oppdiktet. Før het den som en ekte menighet, med e-postadresser på den menighetens ekte domene. Nå nevner ingen fil i koden en ekte menighet eller et kirkesamfunn, heller ikke demodataene |
| **Uten årstid** | Samlinger, oppgaver, meldinger og nyheter nevner ingen årstid, høytid, måned eller dato. Gudstjenesten som sto på julaften kl. 14:30, er en høytidsgudstjeneste en søndag kl. 11:00 |
| **Datoene regnes fra i dag** | Alle datoer flyttes hele uker når innholdet legges i en database, med klokka som i Norge. Innholdet er skrevet for uka fra mandag 31. august 2026: det som er gjort, er datert før den. Fire oppmøtetall som gjaldt samlinger fram i tid, er tatt ut |
| **Tatt ut** | Lenken til en YouTube-video i en gruppemelding og i en tale. Den førte til en musikkvideo ingen har valgt. Produkteier velger en video som skal vises |
| **Nullstillingen** | `npm run reset-demo` fyller demoens database og fjerner alt annet i den, og leser den til slutt på nytt for å se at den er som den skal. GitHub starter den hver natt kl. 01:30 UTC |
| **Sperrer** | Nullstillingen nekter uten demo-innstillingen, uten navnet på databasen, når navnet ikke stemmer med innstillingene, og når databasen står i produksjon |
| **Prøvd** | Reglene, datoene og hele nullstillingen mot en etterligning av databasen: 58 nye sjekker. Skriptets avslag er prøvd på maskinen |
| **Ikke levert her** | Nullstillingen er ikke kjørt mot demoens database, og demoen på demo.menighetsplan.no er ikke byttet over til den (resten av 3e). Nivåskillet i resten av appen (3c) |

---


## 13. Kjente mangler

Sortert etter hvor mye de betyr for en menighet som skal ta løsningen i bruk.

| # | Mangel | Løses i |
|:---:|:---|:---|
| 1 | Databasereglene er åpne. Innloggingen sperrer skjermene, men den som kjenner databasen, kan fortsatt lese og skrive utenom | Trinn 4 |
| 2 | Personregisteret og kladder leveres til alle nettlesere | Fase 1 |
| 3 | To personer som deler e-postadresse, kan ikke logge inn før adressen står på bare én av dem. Første administrator må legges inn med et skript | Trinn 7 for skriptet |
| 4 | Forsidens tekster og menighetens navn står delvis i koden | Fase 2 |
| 5 | Bilder lagres inne i sidedokumentene, og kan da ikke brukes som delebilde | Fase 2 |
| 6 | To kilder for stab og lederskap, den ene uten samtykke | Fase 2 |
| 7 | Programmet i kjøreplanen kan ikke redigeres | Fase 3 |
| 8 | Ingen varsling: forespørsler og forfall når ingen uten at de åpner appen | Fase 3 |
| 9 | Modulvalg lagres bare i én nettleser | Fase 3 |
| 10 | En besøkende kan ikke melde interesse for en gruppe i løsningen | Fase 3 |
| 11 | Et nytt gruppemedlem ser hele meldingshistorikken | Fase 3 |
| 12 | Medlemmet kan ikke oppgi grunn for et forfall, og lederen ser den ikke | Fase 3 |
| 13 | Firebase-klienten lastes på første nettsidebesøk (~1,3 MB JavaScript utover CSS). Admin og Min side er skilt ut, men Firestore er felles datakilde for alle flater | Fase 4 |
| 14 | Reglene i databasen i drift er eldre enn `firestore.rules`, og avviser nye samlinger (prøvd 5. oktober: `volunteer_roles` og `gatheringHeadcounts`). Tjenesteroller og oppmøtetall lagres derfor i `cms_settings`, merket med `recordType` | Fase 1 |
| 15 | Besøkstallene kan endres og slettes av hvem som helst så lenge databasereglene er åpne, og de ligger i `cms_settings` til reglene er publisert. Med innlogging trenger de en egen samling der en besøkende bare kan legge til i dagens summer | Fase 1 |
| 16 | Moduler kan slås av og på av hvem som helst med adgang til admin, og det finnes ikke noe skille mellom hva en menighet har fått tilgang til og hva den har slått på. Kalender og Meldinger husker valget bare i nettleseren | Fase 1 |
| 17 | Noen faste tekster passer ikke alle menigheter: standardtekstene i innholdsmodulene (søndagsskole, kirkekaffe, husfellesskap annenhver uke), de tre infoboksene på forsiden, og setningen om skattefradrag i bunnen av nettsiden. Demodataene (eksempelmenigheten) kan fortsatt legges inn fra Database i enhver installasjon | Fase 2, og trinn 2 for demodataene |
| 18 | På Menighetsplattform er bare menyen og fanene i admin tilpasset. Min side, arrangementssiden, oversikten og gruppene på nettsiden viser fortsatt alt | Trinn 3c |
| 19 | Hos en menighet kan nivået ikke settes: alle har Menighetsplan | Trinn 4 |
| 20 | Demoens nattlige nullstilling startes av GitHub, som slår av tidsplanen når repoet har stått urørt i 60 dager. Demoens database er på Firebase sin gratisplan, som har et tak på lesinger per døgn. Blir demoen mye besøkt, svarer den ikke før neste døgn | Trinn 8 |

---

## 14. Veien videre

### Klar for flere menigheter *(avtalt 7. oktober 2026, rekkefølgen endret 8. oktober, pågår)*

Menighetsplan skal selges til 10–20 menigheter. Hver menighet får sin egen installasjon av denne appen: sin egen database og sin egen adresse. Salgssiden menighetsplan.no, med presentasjon, priser, påmelding og senere kundeportal, bygges for seg og hører ikke hjemme i dette repoet. Det gjør heller ikke betaling.

Avtalen mellom salgssiden og appen:

* **Tilgang.** Nivå og moduler står i dokumentet `/system/entitlements` i menighetens database. Bare leverandøren kan skrive det. Appen leser det.
* **Innstillinger.** Appen finner databasen sin fra `VITE_FIREBASE_*` og `VITE_TENANT_ID`.
* **Eierskap.** Databasereglene, oppsettet av en ny menighet og utrullingen av regler eies av appen, fordi det er appen som kjenner dataene.

Trinnene tas i rekkefølge. Et trinn er ferdig når det er prøvd, testene er grønne og det er sendt inn.

**Demoen først (bestemt 8. oktober 2026).** Den første planen hadde lukkede databaseregler som trinn 3 og demoen som trinn 7. Rekkefølgen er snudd. Demoen er det en menighet ser før den bestiller, og salgssiden skal sende «Se demo» til den ekte appen i stedet for å vise en etterligning av den. Demoen har bare eksempeldata, så den kan stå med åpne regler. Ingen menighet legger inn ekte personer før trinn 4 er levert.

| Trinn | Hva | Status |
|:---|:---|:---|
| 1 | **Nøytral og flyttbar app.** Databasen leses fra installasjonens innstillinger. Ingenting om én menighet står i koden | **Levert 7. oktober** (kapittel 12) |
| 2 | **Innlogging og roller:** administrator, gruppeleder og medlem. Testbryteren fjernes, og admin legges bak innlogging | **Levert 7. oktober** (kapittel 10.1 og 12) |
| 3 | **Demoen** på demo.menighetsplan.no, i delene under | Pågår |
| 4 | **Lukkede databaseregler og tilgang per menighet.** Regler for appens egne data. Nettsiden slutter å laste personregisteret. Appen leser `/system/entitlements`, siden Moduler viser «ikke inkludert», «av» og «på», og reglene sperrer det menigheten ikke har | |
| 5 | **Første ekte menighet**, satt opp for hånd | |
| 6 | **Prøveperiode** for en menighet som vil prøve før den bestiller | |
| 7 | **Oppsett av ny menighet:** skript og sjekkliste for database, regler, tilgang, første administrator, startinnhold og adresse. Bygges bare hvis oppsett for hånd blir for tungt med 10–20 menigheter | |
| 8 | **Drift:** utrulling av regler til alle, sikkerhetskopi, eksport og sletting ved opphør | |

**Trinn 3, demoen, del for del.** Hver del prøves og sendes inn for seg.

| Del | Hva | Status |
|:---|:---|:---|
| 3a | **Demo-installasjonen og nivåvelgeren.** En installasjon kan settes opp som demo. Da står en stripe øverst med velgeren mellom Menighetsplattform og Menighetsplan, og menyen i admin følger valget | **Levert 8. oktober** (kapittel 1.3, 1.4 og 12) |
| 3b | **Vei inn uten innlogging** i demoen, som administrator, gruppeleder og frivillig. Det som tømmer databasen, er ikke med i demoen | **Levert 9. oktober** (kapittel 1.4 og 12) |
| 3c | **Nivåskillet i resten av appen:** Min side, arrangementssiden, oversikten og gruppene på nettsiden | Neste |
| 3d | **Demodata som lever:** datoene regnes fra i dag, og demomenigheten får navn og innhold | **Levert 9. oktober** (kapittel 1.4 og 12) |
| 3e | **Demoen legges ut** med egen database, og nullstilles hver natt. Krever et eget Firebase-prosjekt, som produkteier oppretter | **Delvis 9. oktober:** lagt ut på demo.menighetsplan.no, databasen er opprettet og nullstillingen bygget. Gjenstår: første nullstilling av demoens database, og å bytte innstillingene i Vercel så demoen leser den (kapittel 1.4) |

**Slik er demoen bestemt**

* **To nivåer, ikke tre valg.** Menighetsplan inneholder alt i Menighetsplattform. Tilleggsmodulene er ikke med i demoen.
* **Velgeren finnes bare i demoen**, og valget ligger i nettleseren til den som ser på. Hos en menighet bestemmer leverandøren nivået (trinn 4), og ingen velger det i nettleseren.
* **Én felles demodatabase**, i sitt eget Firebase-prosjekt. Et nei til en oppgave på telefonen synes da på lederens skjerm med en gang. Databasen nullstilles hver natt, og det som tømmer den, er stengt.
* **Åpne regler i demoen, lukkede hos menighetene.** De to blandes aldri: demoen har sin egen database.
* **Stripen øverst** har velgeren, en linje som sier at dette er en demo, lenke til påmelding og lenke tilbake til salgssiden.
* **Demomenigheten heter Fjordvik menighet** og er oppdiktet (bestemt 9. oktober 2026). En demo som alle kan endre, skal ikke bære navnet til en ekte menighet. Navn og innhold bestemmes i appen, og salgssiden følger.
* **Enkel Min side** på Menighetsplattform er det salgssiden beskriver: neste i menigheten, kommende samlinger og lenker.
* **Menighetsplattform tilbys etter invitasjon.** Det er gratis for menigheten, men oppsett og drift koster leverandøren per menighet.

Trinn 2 og 4 er det samme som fase 1 under. Fase 2–4 fortsetter som før når trinnene er på plass.

### Fase 1 – Trygg i drift *(trinn 2 og 4 over)*
1. Innlogging med Google-konto. Første administrator er produkteierens konto.
2. Roller: administrator, gruppeleder (avledet av gruppene) og medlem.
3. Databaseregler etter rolle: besøkende leser bare offentlige data, og kladder leveres ikke ut.
4. Testbryteren, testverktøyet på husfellesskapssiden og demodata-knappene fjernes eller legges bak administrator.
5. Personregisteret lastes ikke på nettsiden.

### Fase 2 – CMS-et styrer hele nettsiden
1. ~~**Temaet virker:** farger, skrift, bakgrunn og avrunding fra design-fanen gjelder hele nettsiden.~~ **Levert 3. oktober.**
2. **Forsiden kan redigeres:** forsidebilde, infoboksene, fellesskaps- og gaveseksjonen. *Delvis levert 3. oktober:* menighetens navn hentes nå fra innstillingene.
3. **Bilder i egen lagring**, med bilder også i nyheter, stab og innholdsblokker.
4. ~~**Delingskort fra serveren:** tittel, beskrivelse og bilde ligger i siden slik den sendes ut.~~ **Levert 3. oktober.**
5. **Én kilde for stab og lederskap:** personregisteret med samtykke. CMS-fanen bestemmer rekkefølge, bilde og omtale.
6. **Nyheter:** arkivside, utløpsdato og kobling til samling. **Taler:** kobling til person og samling.
7. **Menighetens egen profil:** logo og egen skrift.
8. Senere: visuell redigering av blokker, og historikk med angre.

### Fase 3 – Webappen ferdig
1. **Kjøreplan-editor:** program med klokkeslett, koblet til oppgaver.
2. **Varsling** ved forespørsel, påminnelse og akutt forfall. Kanal må velges (se under).
3. Modulvalg lagres for hele menigheten.
4. «Bli med»: en besøkende melder interesse for en gruppe, og lederen ser henvendelsen.
5. Et nytt medlem ser meldinger fra innmeldingsdatoen.
6. Forfall med grunn: medlemmet kan skrive den, og lederen ser den.
7. Kalender- og meldingsmodul med innhold. *Min kalender* på Min side er en mulig funksjon med avtalt innhold (kapittel 3), men er ikke prioritert.
8. Omsorgsvarsel når samme person settes opp ofte, og varsel før en politiattest går ut.

### Fase 4 – Ytelse og drift
1. ~~**Adminpanelet og CMS-et lastes først når de åpnes.**~~ **Levert 5. oktober.** Offentlige sider laster ikke admin, Min side eller CMS-panel. Faner i admin hentes ved behov, med forhåndshent ved hover. Ved utdatert chunk etter deploy lastes siden én gang på nytt (ruter) eller vises en «Last på nytt»-knapp (admin-faner).
2. Mindre førstebesøk på nettsiden: vurdere offentlig lesing via API, eller lazy-innlasting av deler av Firebase (Auth, Storage).
3. Avgrenset mellomlagring i den installerte appen.
4. Én felles dialogkomponent med tastaturstøtte, i stedet for at hver dialog er laget for hånd.
5. Sikkerhetskopi av databasen, feillogg, og Firebase-prosjektet eid av menighetens egen konto.

### Løpende – kodekvalitet
Hver endring typesjekkes, testes og bygges før den regnes som ferdig. Regler flyttes til rene funksjoner med tester. Dokumentene oppdateres i samme endring.

### Åpne produktvalg
| Valg | Alternativer | Anbefaling |
|:---|:---|:---|
| Varslingskanal | Bare pushvarsler i appen, eller push pluss SMS ved akutt forfall og påminnelse dagen før | Push pluss SMS. De som trenger varselet mest, har ofte ikke appen åpen |
| Innloggingsmåter | Bare Google, eller Google pluss andre måter | Avgjort 7. oktober 2026: Google-konto og lenke på e-post, uten passord (kapittel 10.1). Vipps kan legges til når en menighet ber om det |
| Bildelagring | Firebase Storage, eller en ekstern bildetjeneste | Firebase Storage. Samme prosjekt, samme regler |
| Hvem teller oppmøtet | Administrator i etterkant, eller en egen rolle «Teller» på gudstjenesten som registrerer fra Min side | Start med administrator. Legg til rollen når tellingen skal gjøres samme dag av den som står i døra |
| Hvem er «barn» i tellingen | Under konfirmasjonsalder, under 18, eller egen telling for barnekirken | Under konfirmasjonsalder (det står i registreringsvinduet). Bestemmes før tallene brukes i årsmeldingen |
| Nye og faste besøkende, kilde og utstyr | Måles ikke, eller spør hver besøkende om samtykke til å huske nettleseren | Måles ikke. Besøk telles anonymt (avgjort 7. oktober 2026, kapittel 2.5). En samtykkeboks på en menighets nettside koster mer tillit enn tallene er verdt |
| Nivåer og tilleggsmoduler | To nivåer (Menighetsplattform, gratis, og Menighetsplan, betalt) og sju tilleggsmoduler som hver slås på for seg | Foreslått av produkteier 7. oktober 2026. Styringen av moduler er bygget (kapittel 2.6). De to nivåene ble bestemt 8. oktober 2026 og bygges som del av demoen (trinn 3) |

---

## 15. Skjermkrav og akseptansekriterier

### 15.1 Skjermkrav for adminpanelet

| Fane | Hver rad viser minst | Handlinger |
|:---|:---|:---|
| **Sider & innhold** | Tittel, adresse, status (kladd, publisert, planlagt med tidspunkt), plass i menyen, sist endret | Rediger, forhåndsvis, flytt, slett med bekreftelse |
| **Arrangementer** | Tittel, tidspunkt, sted, synlighet, bemanningsstatus med ikon og tekst | Rediger, avlys, opprett oppgaver, åpne kjøreplan, «Lag neste arrangement» |
| **Trenger oppfølging** | Oppgave, samling og dato, plasser (`1/2`), status (`Mangler 1`, `Akutt forfall`) | Tildel, forespør, åpne purretekst |
| **Taler** | Tittel, dato, taler, serie, om det er lyd eller video | Rediger, legg til opptak |
| **Personer & roller** | Navn, kontaktinfo, grupper og roller, politiattest, offentlig profil med samtykkestatus | Rediger, registrer samtykke, slett |
| **Analysebord** | Hvert tall med periode, endring fra perioden før, og hva det bygger på. Et tall uten grunnlag vises som strek | Bytt periode, registrer og rett oppmøtetall, vis som tabell, last ned CSV |

### 15.2 Testscenarioer
Scenarioene under er dekket av automatiske tester.

* **A. Tildeling.** En oppgave «Lydtekniker» trenger én. Administrator tildeler Kari. Tildelingen er bekreftet, og oppgaven viser `Dekket (1/1)` med en gang.
* **B. Forespørsel og avslag.** En oppgave «Kirkekaffe» trenger to. Administrator forespør person A. Oppgaven viser `Venter på svar`, og én plass er fortsatt ledig. Svarer A nei mindre enn 48 timer før samlingen, merkes oppgaven som akutt.
* **C. Samtykke.** Administrator krysser av «Vis offentlig» for en medarbeider. Tidspunktet og hvem som registrerte samtykket lagres. Uten samtykke vises personen ikke.
* **D. Medlemmet tar en oppgave.** En plass er ledig i en av medlemmets grupper. Medlemmet trykker «Ta oppgaven». Tildelingen er bekreftet, og oppgaven står under «Mine oppgaver».
* **E. Forfall.** Et bekreftet medlem melder forfall. Plassen blir ledig, tidspunktet lagres, og oppgaven forsvinner fra medlemmets liste. Er det mindre enn 48 timer til samlingen, merkes oppgaven som akutt til noen tar den.
* **F. Skjult gruppe.** Administrator fjerner krysset «Vis gruppen på nettsiden». Gruppen og møtetiden forsvinner fra «Fellesskap» og fra API-et.
* **G. Fremhevet samling.** Administrator fremhever en samling. Den står øverst på forsiden til den er passert eller avlyst. Da står neste gudstjeneste der.
* **H. Planlagt publisering.** En side settes til publisering i morgen kl. 08:00. Den står ikke i menyen i dag, og er der i morgen etter kl. 08:00.
* **I. Lagring som feiler.** Databasen avviser en endring. Brukeren får beskjed, og skjermen viser det som faktisk er lagret.
* **J. Oppmøtetall.** Administrator registrerer 72 voksne og 15 barn på en gudstjeneste som mangler tall. Søylen viser 87, samlingen forsvinner fra «Mangler oppmøtetall», og snittet regnes på nytt. En telling uten noen til stede avvises. En ny telling erstatter den gamle.
* **K. Ingen oppdiktede tall.** En tom database gir streker, ikke nuller, og datagrunnlaget sier at ingen gudstjenester er holdt.

---

## 16. Slik jobber vi

* **Produkteier** prioriterer og godkjenner. Kapittel 14 er arbeidslisten.
* **Google AI Studio** brukes til å bygge nye skjermbilder og kjøre løsningen. AI Studio henter fra og leverer til grenen `main` på GitHub.
* **Claude** har ansvar for arkitektur, kvalitet og dokumentasjon, og leverer hver verifiserte endring rett til `main`.
* En endring er **ferdig** når typesjekken, testene og bygget er grønne, endringen er sett i nettleseren, og dokumentene er oppdatert.
* Nye regler for kodeendringer skrives inn i `CLAUDE.md`, slik at de gjelder uansett hvem eller hva som skriver koden.
