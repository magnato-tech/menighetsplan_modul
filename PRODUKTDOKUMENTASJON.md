# Produktdokumentasjon: Menighetsplan

> **Dokumentversjon:** 4.33 · **Sist oppdatert:** 2026-10-13
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
| Frivillig | Webappen, Min side | Ser egne oppgaver, tar ledige oppgaver, svarer på forespørsler, melder forfall, skriver i gruppene sine, svarer på innkalling til husfellesskap |
| Gruppeleder | Webappen, Gruppeleder | Bemanner oppgavene i sine grupper, holder listen over deltakere og møteplanen, sender beskjed til gruppen |
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

  Den besøkende går inn som en person fra demoens register som har rollen, og siden sier hvem. Valget bestemmer hvor man kommer, også for den som trykket «Min Side» først. Den som kom fra en lenke til en fane i admin og går inn som administrator, kommer til den fanen.
* **CMS-et står under «Administrator»**, og er nevnt først i teksten på valget: «Redigerer nettsiden (CMS), planlegger arrangementer og holder personregisteret». Det hadde sin egen vei inn 9. oktober, og den ble tatt ut samme dag: den førte til samme administrator i samme admin, bare med en annen startside.
* **Bytte rolle.** Den som er inne, har «Bytt rolle» i stripen, som fører til de samme valgene. «Logg ut» gjør det samme.
* **Hvem man går inn som**, følger av registeret: av dem som har rollen, den som er med i flest grupper. Innholdet i demoen kan dermed byttes uten at noe annet må endres.
* **Det demoen er uten** *(levert 9. oktober)*. «Database og Testdata» og «Moduler» står ikke i menyen, og tilleggsmodulene vises ikke, heller ikke om en skulle være slått på i databasen. Skrives adressen til en slik fane inn, sier siden at den ikke er med i demoen. Alt som tømmer databasen, nekter i demoen, uansett hvor det kalles fra.
* **Nivåvelgeren** *(levert 8. oktober)* har to valg. Valget gjelder med en gang på alle skjermer, og huskes i nettleseren til den som ser på. Én besøkendes valg endrer ikke hva en annen ser. Før noe er valgt, vises Menighetsplan.
* **Bare i demoen.** En menighets installasjon tegner aldri stripen, og spør aldri nettleseren om nivået.
* **Forhåndsvisningen i admin** viser nettsiden uten stripe.
* **Eksempelmenigheten** *(levert 9. oktober)*. Demoen viser Fjordvik menighet. Den er oppdiktet: navnet, adressen, personene og innholdet. E-postadressene ender på `.example`, som ingen kan eie. Innholdet nevner ingen årstid, høytid eller måned, for det vises hele året.
* **Datoene regnes fra i dag** *(levert 9. oktober)*. Innholdet er skrevet for én uke, og flyttes hele uker fram når det legges i databasen. En gudstjeneste søndag kl. 11:00 står da alltid på en søndag kl. 11:00, også over skiftet mellom sommertid og vintertid. Det er alltid en gudstjeneste innen en uke, og det som er gjort (meldinger, svar, taler, nyheter og oppmøtetall), ligger alltid bak. Uka skifter natt til mandag. Det samme gjelder når demodataene legges inn fra Database hos en menighet.
* **Velg menighet** *(levert 9. oktober)*. I stripen står en liste, «Se din menighet», der den besøkende kan velge å se løsningen med nettsiden til en ekte menighet i stedet for eksempelmenigheten. Det er laget sett av fire menigheter (`public/demosett/`): Flekkerøy misjonskirke, Kristiansand Misjonskirke Salem, Lillesand Misjonskirke og Søgne Misjonskirke. I lista står de eieren av demoen har slått på. Fra 12. oktober står alle fire i lista fra starten.
  * **Valget er den besøkendes eget.** Det ligger i nettleseren, som nivået. Én besøkendes valg endrer ikke hva en annen ser. «Velg menighet» under Database hos en menighet bytter derimot nettsiden i selve databasen, og brukes ikke i demoen.
  * **Hver menighet har sin egen kopi** i demoens database: menighetens nettside (sider, nyheter, taler, stab, innstillinger og kalenderen åpen for alle) og eksempelmenighetens planlegger (personer, grupper og tjenesteroller). Det en besøkende endrer, ser de andre som ser på samme menighet, til neste nullstilling.
  * **En lenke kan føre rett til en menighet:** `demo.menighetsplan.no/?menighet=sogne`. Navnet er settets (`floy`, `lmk`, `salem`, `sogne`), og `eksempel` gir eksempelmenigheten. Salgssiden kan bruke det i «se hvordan det ser ut for din menighet».
  * **Eieren bestemmer hvem som står i lista** *(bygget 9. oktober)*. En menighet slås på når den har sagt ja til å vises. En menighet som er av, står ikke i lista, men kan åpnes med lenken sin. Slik viser eieren en menighet dens egen versjon uten at alle andre tilbys den.
  * **Bare det som ligger klart, tilbys.** En menighet kan vises når nullstillingen har lagt den i databasen. Den som har valgt en menighet demoen ikke har, tas til eksempelmenigheten.
  * **Stripen sier hvor nettsiden er hentet fra** når en ekte menighet vises. Datoene i settet flyttes hele uker fra uka det ble hentet, så kalenderen ikke blir liggende i fortiden.
  * **Uten bilder av de ansatte** *(bestemt 9. oktober, produkteier)*. Demoen presenterer produktet for andre, og et bilde av en person brukes ikke til det uten at personen har sagt ja. Ingen i stab-registeret har bilde, portrettene på menighetens egen side om de ansatte er tatt ut, og et bilde som står ved siden av navnet til en ansatt, er tatt ut. Navn og tittel står, som på menighetens egen nettside. Andre bilder på nettsiden vises.
  * **En menighet som har sagt ja, vises slik nettsiden dens er** *(12. oktober, produkteier)*. Lillesand Misjonskirke er produkteiers egen menighet, og vises i demoen som på lillesandmisjonskirke.no: med bildene av de ansatte og lederskapet, telefonnumre og e-postadresser, alle talebildene og toppbildet på hver side. Settet er merket for det (`asPublished`), og da tas ingenting ut. De tre andre menighetene vises som før, uten bilder av de ansatte og uten kontaktopplysninger.
  * **Talebildene er med når det er bestemt for settet** *(12. oktober, produkteier)*. Noen talebilder viser den som talte, og ingenting i et sett sier hvilke. Et sett til demoen har derfor talebilder bare når det er bestemt, og så mange som er bestemt. Lillesand Misjonskirke har alle talebildene sine. Søgne Misjonskirke har bildet til de ti nyeste talene. Der er talebildene portretter av den som talte. Flekkerøy og Salem har ingen talebilder på nettsidene sine.
  * **Begrensning:** bemanningen i eksempelet hører til eksempelmenighetens gudstjenester, og er derfor ikke med hos en ekte menighet. Der viser planleggeren personene, gruppene og rollene, men nesten ingen oppgaver.
* **Demo-oppsett** *(bygget 9. oktober)* er en fane i admin som bare eieren av demoen kommer inn i: `/admin?tab=demo-oppsett`. Der står hver menighet med en bryter («i lista for alle»), lenken rett til den, og en knapp som viser den.
  * **Eierkoden.** Ingen logger inn i demoen, så eieren kjennes på en kode, som skrives én gang og huskes i nettleseren. Demoens innstillinger har et fingeravtrykk av koden (`VITE_DEMO_OWNER_CODE_HASH`), aldri koden selv. Før den er satt opp, lager fanen linja som skal inn i innstillingene. Uten koden vises ingen menigheter og ingen brytere, og fanen står ikke i menyen. Eieren kan bytte kode fra fanen («Bytt eierkode»): den lager den nye linja, og den gamle koden slutter å virke når linja er byttet i innstillingene og demoen er bygget på nytt.
  * **Valgene overlever nullstillingen.** De ligger i demoens database, som det eneste der som verken er innhold eller en besøkendes.
  * **Begrensning:** koden holder skjermen unna besøkende, men beskytter ikke databasen. Demoens database har åpne regler, så den som kan nok, kan endre valgene utenom skjermen.
* **Nullstilling hver natt** *(levert 9. oktober; første kjøring av seg selv er natt til 10. oktober)*. Hver natt, rundt kl. 03, fylles demoens database med eksempelmenigheten og med hver av de andre menighetene på nytt, og alt en besøkende har endret eller lagt inn, fjernes. Innholdet skrives først og det overflødige fjernes etterpå, så demoen er aldri tom. Nullstillingen gjelder bare demoen: den nekter uten demo-innstillingen, uten at navnet på databasen er skrevet, og når databasen står i produksjon. Den kan også startes for hånd: `npm run reset-demo -- <navnet på prosjektet>`.
* **Hvor den ligger** *(levert 9. oktober)*. Demoen er lagt ut på demo.menighetsplan.no, som salgssidens «Se demo» fører til. Den bygges på nytt av seg selv hver gang noe sendes inn til `main`. Demoen har sin egen database, i Firebase-prosjektet `menighetsplan-demo`, med åpne regler (`firestore.demo.rules`). Databasen ble fylt første gang 9. oktober, og den publiserte demoen leser den fra samme dag: innstillingene i Vercel peker på demoens eget prosjekt, uten navn på databasen.
* *Planlagt (trinn 3c):* nivåskillet i resten av appen.

---

## 2. Adminpanelet (Admin Studio)

Adminpanelet ligger på `/admin` og har én meny med to deler. Hver fane har sin egen adresse (`/admin?tab=…`), og et påbegynt utkast overlever et fanebytte. Deler av panelet som ikke alle menigheter skal ha, er **moduler**: de slås på under **Moduler** og står først da i menyen (kapittel 2.6).

### 2.1 Planlegging – admin for webappen

| Fane | Hva administratoren gjør | Status |
|---|---|---|
| **Oversikt** | Ser nøkkeltall og hva som haster | Levert |
| **Arrangementer** | Oppretter, endrer og avlyser samlinger. Det raske skjemaet tar tittel, dato, klokkeslett, tema og sted, og gjør ingen gruppe ansvarlig: arrangementet legges i kalenderen. «Flere valg» åpner det store skjemaet, som også brukes ved redigering: slutt (også en annen dag), sted, bibeltekst, ansvarlig gruppe (kalenderen til en annen velges), gudstjeneste og synlighet. «Lag neste arrangement» kopierer oppgavene til en ny dato | Levert. Mal og serie i det store skjemaet er prøveutgaver (kapittel 14) |
| **Maler** | Holder malene for arrangementer som gjentas: tid, sted, bilde og tekst, program med roller, og oppgavene som skal bemannes. Legger inn standardmalen for gudstjeneste, og planlegger en serie fra en mal | Levert 12. oktober |
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
| **Aktuelt & nyheter** | Skriver og publiserer artikler. En artikkel kan høre til et arrangement eller ha en siste dag, og går da ut av forsiden av seg selv (kapittel 5.8) | Levert |
| **Taler & prekener** | Legger inn taler med lyd, Spotify, video og et bilde til talen | Levert |
| **Lederskap & stab** | Holder listen over stab som vises på «Om oss» | Delvis: en egen liste ved siden av personregisteret, uten samtykke (kapittel 13) |
| **Tema & designsystem** | Velger ferdig tema eller egne farger, bakgrunn, skrift og avrunding. Forhåndsvisningen er tegnet med de samme fargene nettsiden får | Levert |
| **Nettside-innstillinger** | Menighetens navn, slagord, velkomsttekst, kontaktinfo, Vipps, konto og sosiale medier | Levert |
| **Arrangementer på nettsiden** | Ser hvert arrangement med bildet sitt og hva det mangler på nettsiden. Åpner arrangementets skjema for å legge inn bilde, ingress, tekst og lenke. Fremhever en samling på forsiden eller skjuler den fra kalenderen | Levert. Het «Forside-overstyring» til 12. oktober |

### 2.3 Felles for hele panelet

* Panelet er responsivt: fast meny på PC, uttrekksmeny på mobil.
* En handling bekreftes med en melding som forsvinner av seg selv. En lagring som feiler, vises i et rødt banner og blir ikke stående som om den var lagret.
* **Moduler** (under System & Database) viser hvilke moduler produktet har, og slår delene av dem av og på for hele menigheten (kapittel 2.6).
* **Innlogging.** `/admin` er bare for administratorer. Den som ikke er logget inn, sendes til innloggingssiden, og en frivillig får beskjed om at det kreves administrator (kapittel 10.1). Nederst i menyen står hvem som er logget inn, og «Logg ut».

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
| Frivillighet og bemanning | Forfall (akutte under 48 timer), avslag, svartid (median), de neste fire ukene, hvor ofte hver har stått på, roller som er vanskeligst å bemanne, «Kan trenge avlastning», «Ikke brukt i perioden» | Avlastning: har stått på minst like mange samlinger som halvparten av ukene i perioden, og minst tre. Ikke brukt: deltaker i en tjenestegruppe uten oppgave i perioden |
| Grupper og fellesskap | Antall grupper per kategori, nye deltakere, meldinger, samlinger og svar per gruppe, sist aktiv, personer uten gruppe | Stille gruppe: verken samling eller melding de siste 30 dagene |
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
| **Oppgave** | `/oppgave/:id` | Tid, sted, instruks og hvem andre som står på. Ta oppgaven, svar på forespørsel, meld forfall | Levert. En grunn for forfallet lagres ikke: den kan være privat, og tas muntlig |
| **Gruppeleder** | `/leder` | Gruppene jeg leder, med bemanningsstatus | Levert |
| **Gruppe** | `/gruppe/:id` | Deltakere, møteplan, aktiviteter og beskjeder til gruppen, med bilde | Levert |
| **Samling** | `/samling/:id` | Kjøreplan: programmet og oppgavene på én tidslinje, med hvem som står på hva | Delvis: programmet kan ikke redigeres i løsningen ennå |
| **Husfellesskap** | `/husfellesskap` | Neste møte med vert, tema og bibeltekst. «Kommer» / «Kommer ikke». Deltakerliste | Levert |
| Meldinger | `/meldinger` | Valgfri modul for meldinger på tvers av grupper | Planlagt: i dag en plassholderside |
| Kalender | – | Valgfri modul med felles kalender | Planlagt: modulen kan slås på, men har ingen side |
| **Min kalender** | – | Personlig oversikt på Min side | Mulig funksjon, ikke prioritert. Se under |

Min side ligger bak innlogging (kapittel 10.1). Øverst står hvem som er logget inn, rollen og «Logg ut». En frivillig ser bare det som gjelder egne grupper. Løsningen kan installeres på mobilen som app (PWA).

### Mulig funksjon: Min kalender

Ikke bygget. Avtalt innhold, hvis den tas inn senere:

* Kildebasert, ikke bare det den frivillige har bekreftet. Den viser offentlige arrangementer i menigheten, pluss kommende samlinger i gruppene den frivillige er med i.
* Hver kilde (menigheten og hver gruppe) kan slås av og på med et øyeikon. Standard er at alle kilder er på.
* «Kommer ikke» skjuler den ene samlingen. En bekreftet oppgave legges på samlingen den hører til, og lager ikke en egen hendelse.
* Husfellesskap vises bare når innkalling er sendt, eller den frivillige allerede har svart. Andre grupper viser alle kommende gruppesamlinger så lenge kilden er på.
* Den erstatter «Neste for deg» og «Neste i menigheten» på Min side. «Trenger svar», gruppene og oppgavene blir stående.
* Personlig kalenderabonnement (iCal) tilbys ikke: tjenesten som lager filen, kjører ikke der løsningen er satt i drift (se kapittel 13). Abonnement på menighetens offentlige kalender står på nettsiden.

---

## 4. Nettsiden

| Side | Adresse | Innholdet kommer fra | Status |
|---|---|---|---|
| **Forside** | `/` | Velkomsttekst fra innstillingene. Fremhevet samling eller neste gudstjeneste, og de fire neste samlingene, fra planleggeren. Tre siste nyheter og siste tale fra CMS-et | Delvis: tre infobokser, fellesskapsteksten og gaveteksten står fast i koden |
| **Arrangement** | `/arrangement/<id>` | Arrangementets egen side: bilde, tid, sted, tema, ingress, tekst, knapp og «Legg i kalenderen min». Sier fra når arrangementet er avlyst eller holdt. Bare arrangementer åpne for alle har en side | Levert 12. oktober |
| **Hva skjer** | `/hva-skjer` | Kommende offentlige samlinger fra planleggeren | Levert |
| **Taler** | `/taler` | Talearkivet fra CMS-et, med avspilling og bildet til hver tale | Levert |
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
| `imageUrl`, `imageAlt` | `string` | Nei | Bilde på nettsiden: en adresse eller et bilde fra mediebiblioteket, og bildeteksten for den som ikke ser bildet |
| `summary` | `string` | Nei | Ingress: en setning eller to, vist på kortet på forsiden. Uten ingress vises temaet |
| `content` | `string` | Nei | Lengre tekst om arrangementet, skrevet som teksten på en side. Vises på arrangementets egen side |
| `linkUrl`, `linkLabel` | `string` | Nei | Lenke, for eksempel til påmelding, og teksten på knappen («Les mer» når ingen er skrevet). Vises på arrangementets egen side, i ny fane når den går ut av nettsiden |
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

### 5.4 Person (`Person`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id` | `string` | Ja | Unik identifikator. *Planlagt:* lik brukerens ID ved innlogging |
| `name` | `string` | Ja | Fullt navn |
| `email`, `phone` | `string` | Nei | Privat kontaktinfo. Vises aldri på nettsiden |
| `globalRole` | `"member" \| "admin"` | Ja | Frivillig eller administrator |
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
| `memberIds`, `leaderIds`, `deputyLeaderIds` | `string[]` | Ja, Ja, Nei | Deltakere, ledere og nestledere |
| `meetingSchedule` | `{ weekday, time, frequency }` | Nei | Fast møtetid: hver uke, annenhver uke eller hver måned |
| `memberJoinedAt` | `{ personId: dato }` | Nei | Når hver deltaker ble med |
| `notificationPreferences` | `{ personId: boolean }` | Nei | Om deltakeren vil ha varsler fra gruppen |

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
| `expiresAt` | `YYYY-MM-DD` | Nei | «Vises til og med»: siste dag artikkelen står i listene på nettsiden |
| `gatheringRefId` | `string` | Nei | Arrangementet artikkelen hører til. Uten dato vises artikkelen til og med dagen arrangementet holdes |

**Hvor lenge en nyhet vises** *(levert 12. oktober 2026)*. En artikkel står til den tas ut, med to unntak:

* **Den hører til et arrangement.** Da vises den til og med dagen arrangementet holdes, og går ut av forsiden dagen etter. Flyttes arrangementet, følger artikkelen med. Varer arrangementet over flere dager, gjelder siste dag. Er arrangementet slettet, står artikkelen.
* **Den har en dato i «Vises til og med».** Datoen går foran arrangementet, begge veier.

Dagen er den norske, og skiftet skjer ved midnatt norsk tid. En artikkel som er utløpt, er ute av forsiden og nyhetslistene. Den kan fortsatt leses av den som har adressen, så en lenke som er delt, ikke blir død. I admin står den i listen, merket «Utløpt» med ikon og tekst, og kan gis en ny dato. Løsningen setter aldri en dato av seg selv.

### 5.9 Tale (`CmsSermon`)

| Felt | Type | Påkrevd | Beskrivelse |
|:---|:---|:---:|:---|
| `id`, `title` | `string` | Ja | Talen og tittelen |
| `speaker` | `string` | Ja | Taler, som fritekst |
| `date` | dato | Ja | Når talen ble holdt. Nyeste vises først |
| `bibleText`, `series`, `summary` | `string` | Nei | Bibeltekst, serie og sammendrag |
| `audioUrl`, `spotifyUrl` | `string` | Nei | Lydfil og Spotify-lenke |
| `videoUrl` | `string` | Nei | Video. YouTube-lenker gjøres om til `youtube-nocookie.com` |
| `imageUrl` | `string` | Nei | Bildet til talen: en adresse, eller et bilde fra mediebiblioteket. Vises ved talen i talearkivet, og på forsiden når talen er den nyeste. En tale uten bilde vises uten |
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
| **Forespør** | Leder eller administrator | Venter på svar til deltakeren svarer ja eller nei på Min side eller oppgavesiden |
| **Ta oppgaven** | Den frivillige selv, når en plass er ledig i en av den frivilliges grupper | Bekreftet med en gang |

### 6.2 Forfall

* En bekreftet frivillig som melder forfall, lagres som **forfall**. Et nei på en forespørsel lagres som **avslått**.
* En grunn for forfallet lagres ikke. Det er et valg, ikke en mangel: opplysningen kan være privat, og tas muntlig.
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

* **`intern`** – bare for deltakere, ledere og stab. Skjult i kalenderen og i API-et.
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

**Der løsningen er satt i drift (Vercel), kjører ikke denne serveren.** Der svarer bare kalenderabonnementet, `GET /api/offentlig/kalender.ics`, som er en egen liten funksjon (se «Kalenderabonnementet der løsningen er i drift» i kapittel 12). Andre adresser under `/api` svarer «finnes ikke». JSON-endepunktene over finnes bare der `server.ts` kjøres.

Kontrakten står i `INTEGRASJON-MENIGHETSPLAN.md`. Det eksterne CMS-et (`menighetsplan_ClaudeCMS`) er en egen løsning som leser dette API-et. Koden for det hører ikke hjemme i dette repoet.

---

## 10. Sikkerhet og tilgang

| Område | Mål | I dag |
|:---|:---|:---|
| Innlogging | Frivillige logger inn med Google-konto eller en lenke på e-post. Rollen styrer hva man ser og kan gjøre | **Levert 7. oktober** for skjermene: Min side krever at man står i personregisteret, og admin krever administrator (kapittel 10.1) |
| Regler i databasen | Besøkende leser bare offentlige data. En frivillig endrer bare sitt eget. Bare administrator endrer offentlige profilfelt og samtykke | **Skrevet og prøvd lokalt 12. oktober** (kapittel 12, «Lukket database»). Ikke publisert i noen database ennå. Demoen har sine egne, åpne regler |
| Sporbarhet | `updatedBy` er alltid den innloggede brukeren | **Delvis.** Regelen finnes, men gjelder først når noen er logget inn |
| Personregisteret | Lastes bare for innloggede | **Levert 12. oktober** for en menighets egen installasjon: en besøkende får bare de offentlige kopiene av personer med samtykke. Demoen og utviklermaskinen laster fortsatt hele registeret, for der går hvem som helst inn som en person |
| Samtykke | Ingen person vises uten registrert samtykke | **Levert** |
| API | Ingen persondata ut | **Levert** |

**Databasen inneholder bare demodata.** Ekte persondata skal ikke legges inn før reglene i `firestore.rules` er prøvd og publisert i menighetens egen database. Reglene i `firestore.demo.rules` er åpne, og skal aldri publiseres i en database med ekte personer.

### 10.1 Innlogging og roller

**To veier inn, ingen passord.** På `/logg-inn` velger man «Fortsett med Google» eller skriver e-postadressen sin og får en lenke som logger inn. Lenken virker én gang. Åpnes den på en annen enhet enn den ble bestilt fra, må adressen skrives inn på nytt, så en lenke på avveie ikke er nok.

**Kontoen er ikke personen.** En konto er det man logger inn med. En person er en rad i menighetens personregister. De kobles med e-postadressen: kontoens bekreftede adresse må stå på nøyaktig én person i registeret. Store og små bokstaver spiller ingen rolle.

| Den som logger inn | Får |
|:---|:---|
| Står i registeret med adressen | Min side, som den personen |
| Står der som administrator | Min side og admin |
| Står ikke i registeret | Beskjed om å kontakte menigheten, og «Logg ut og prøv en annen konto». Ingenting annet |
| Har en adresse flere personer deler | Beskjed om at adressen ikke sier hvem man er, og at menigheten må rette det |

**Tre roller, og de følger av personen.** *Administrator* står på personen i registeret. *Gruppeleder* er den som leder minst én gruppe, som leder eller stedfortreder. *Frivillig* er alle andre i registeret. Rollen lagres ikke på kontoen, så den endres i det personen endres i registeret.

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
| **Bemanning** | Oppgavens status regnes ut av tildelingene. En frivillig kan ta en ledig oppgave og svare på en forespørsel. Forfall med 48-timersregel og tidsstempler |
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
| **Roller** | Administrator står på personen. Gruppeleder følger av gruppene. Frivillig er alle andre i registeret |
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
| **Ikke levert her** | Da dette ble sendt inn, var nullstillingen ikke kjørt mot demoens database. Det ble gjort senere samme dag (se «Velg menighet i demoen» under). Demoen på demo.menighetsplan.no er ikke byttet over til den (resten av 3e). Nivåskillet i resten av appen (3c) |

### Velg menighet i demoen (9. oktober 2026)

Bestilt av produkteier samme dag: besøkende skal kunne se løsningen med nettsiden til en ekte menighet, og valget skal stå synlig øverst.

| Område | Levert |
|:---|:---|
| **Lista i stripen** | «Se din menighet»: eksempelmenigheten og menighetene som ligger klare i demoens database. Finnes ingen, vises ikke lista |
| **Den besøkendes eget valg** | Valget ligger i nettleseren. Hver menighet har sine egne samlinger i demoens database, og appen leser samlingene til den som er valgt. Ingen besøkende endrer hva en annen ser |
| **Lenke rett til en menighet** | `…/?menighet=sogne` åpner demoen med den menigheten, og valget huskes |
| **Nullstillingen** | Fyller eksempelmenigheten og én kopi per sett: settets nettside og eksempelmenighetens planlegger. I alt 1181 dokumenter med de fire settene som følger med |
| **Sikring** | En menighet som ikke ligger i databasen, tilbys ikke. Et valg som ikke finnes, fører til eksempelmenigheten. Sperren mot tømming i demoen står som før: byttet sletter ingenting |
| **Prøvd** | 45 nye sjekker, blant dem alle de fire settene gjennom hele nullstillingen mot en etterligning av databasen. Appen er åpnet lokalt mot en database uten menighetene: lista vises ikke, og en lenke til en menighet som mangler, fører til eksempelmenigheten |
| **Uten bilder av de ansatte** | Lagt til samme dag, etter at produkteier pekte på at bilder av personer ikke kan brukes i markedsføring uten samtykke. Gjelder demoen, ikke «Velg menighet» under Database. 16 sjekker, blant dem at ingen av de fire settene viser et bilde fra stab-registeret eller et bilde ved siden av navnet til en ansatt |
| **Bryter per menighet** | Lagt til samme dag: eieren av demoen bestemmer i «Demo-oppsett» hvilke menigheter som står i lista for alle. Fanen åpnes med en eierkode. Fra starten står bare Lillesand Misjonskirke i lista. 50 sjekker. Prøvd lokalt med en prøvekode: feil kode åpner ikke, riktig kode viser de fire menighetene med brytere og lenker, og fanen kommer i menyen. Ingen bryter er trykket på lokalt, for den lokale appen bruker databasen i drift |
| **Prøvd mot demoens database** | Produkteier kjørte nullstillingen 9. oktober: 1181 dokumenter skrevet og kontrollert, fordelt på eksempelmenigheten og de fire menighetene. Appen er så åpnet lokalt mot databasen: eksempelmenigheten vises med lista i stripen (Lillesand), Søgne åpnes med lenken sin og står da i lista for den besøkende, stripen sier hvor nettsiden er hentet fra, og Søgnes side «Ansatte» viser tolv navn uten bilder. På mobilbredde får lista og nivåvelgeren plass på samme linje |
| **Byttet over** | Produkteier byttet innstillingene i Vercel 9. oktober, og demoen ble bygget på nytt. demo.menighetsplan.no viser nå eksempelmenigheten fra sin egen database, med gudstjenesten førstkommende søndag, lista i stripen med Lillesand, og Lillesand fra lenken sin |
| **Eierkoden** | Produkteier valgte en eierkode og la fingeravtrykket inn i Vercel 9. oktober. Den publiserte demoen ber nå om koden i «Demo-oppsett». Kopieringsknappene der prøver en eldre måte når nettleseren sperrer utklippstavlen, og ett klikk merker hele teksten |
| **Ikke levert her** | Nullstillingen har ikke gått av seg selv ennå (første gang natt til 10. oktober). Bemanning på en ekte menighets gudstjenester |

### Bilde til talene (12. oktober 2026)

Bestilt av produkteier samme dag: talene på lillesandmisjonskirke.no har et bilde hver, og de var ikke med i demoen.

| Område | Levert |
|:---|:---|
| **Feltet** | En tale kan ha et bilde (kapittel 5.9). Det velges i admin under «Taler & prekener», fra mediebiblioteket, bildene som følger med, eller en adresse |
| **Nettsiden** | Bildet vises ved talen i talearkivet, og ved den nyeste talen på forsiden. En tale uten bilde vises som før |
| **Mediebiblioteket** | Et bilde som er i bruk på en tale, regnes som i bruk og kan ikke slettes derfra |
| **Lillesand i demoen** | Alle talene i settet har bildet sitt. Nettsiden ble hentet på nytt 12. oktober, så talen fra 11. oktober er med: 118 taler. Bildene lenkes fra menighetens egen nettside, som de andre bildene i settet |
| **Søgne i demoen** | De ti nyeste talene har bildet sitt, bestemt av produkteier 12. oktober. Bildene er portretter av den som talte |
| **Lillesand slik nettsiden er** | Bestemt av produkteier 12. oktober, for egen menighet: bildene av de seks i stab og lederskap, telefonnumre og e-postadresser, og toppbildet på 18 av sidene er med. Alle bildene på lillesandmisjonskirke.no er sammenlignet med settet. Det som ikke er med, har ingen plass i appen ennå: logoen, bildestripen nederst på sidene og de tre bildeknappene på forsiden (Misjonskirken Norge, Facebook og gave) |
| **Alle fire i lista** | Bestemt av produkteier 12. oktober: Flekkerøy, Lillesand, Salem og Søgne står i «Se din menighet» for alle fra starten. Eieren kan fortsatt slå en menighet av i «Demo-oppsett», og det valget går foran |
| **Bilder av personer** | Åtte av bildene viser den som talte. Produkteier, som er pastor i menigheten, bestemte at alle skal med. Et sett har ellers ingen talebilder før det er bestemt for settet. Et talebilde som er et bilde fra stab-registeret, tas ut i demoen som andre bilder derfra |
| **Prøvd** | 8 nye sjekker: bildet på talesiden og på forsiden, en tale uten bilde, et bilde fra biblioteket, et bilde som er slettet, og bildet til en tale i mediebiblioteket og i demoen |

### Nyheter som går ut av seg selv (12. oktober 2026)

Bestilt av produkteier samme dag: en nyhet om noe som er over, skal ikke bli stående på forsiden til noen husker å ta den ut. Modulene som heter dynamiske, skal følge aktivitetsplanen.

| Område | Levert |
|:---|:---|
| **Hører til arrangement** | En nyhet kan knyttes til et arrangement i admin. Den vises til og med dagen arrangementet holdes, og følger med når arrangementet flyttes |
| **Vises til og med** | En nyhet kan ha en siste dag, som går foran arrangementet |
| **Nettsiden** | Forsiden og nyhetslistene viser ikke en utløpt nyhet, og den tar ikke en av de tre plassene. Adressen til nyheten virker fortsatt |
| **Admin** | Skjemaet sier i klartekst hvor lenge nyheten vises. Listen merker en utløpt nyhet med ikon og tekst, og den kan forlenges eller slettes |
| **Eksempelmenigheten** | Nyheten om ungdomsmiljøet hører til ungdomsmøtet uka etter, så koblingen kan vises fram i demoen |
| **Prøvd** | 25 nye sjekker: midnatt norsk tid sommer og vinter, arrangement som flyttes, slettes og varer flere dager, forsiden før arrangementene har kommet, skjemaet og listen i admin, og at en dato som tømmes, også tas bort i databasen |
| **Ikke levert her** | En nyhet hentet fra et gammelt nettsted har ingen dato, og står til den gis en. Arkivside for gamle nyheter |

**De dynamiske modulene og aktivitetsplanen**, slik de er etter dette:

| Modul | Følger aktivitetsplanen |
|:---|:---|
| Neste gudstjeneste | Ja. Henter neste gudstjeneste fra arrangementene, og bytter av seg selv når den er holdt |
| Hva skjer, og Kalender | Ja. Viser kommende arrangementer åpne for alle |
| Nyheter og artikler | Ja, fra 12. oktober, for nyheter som er knyttet til et arrangement eller har en dato |
| Siste tale fra søndagen | Nei. Viser den nyeste talen i talearkivet. En tale er ikke knyttet til gudstjenesten den ble holdt i *(planlagt, fase 2)* |
| Husfellesskap & grupper | Nei. Er et banner med fast tekst og lenke til gruppesiden, og leser ikke gruppene |
| Givertjeneste & Vipps | Nei, og skal ikke. Viser Vipps-nummer og konto fra innstillingene |

### Ett skjema for arrangementer (12. oktober 2026)

Del A1 av «Arrangement, maler og serier» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Det raske skjemaet** | Står som før, med knappen «Flere valg». «Legg til i planleggeren» lagrer med en gang |
| **Det store skjemaet** | Åpnes over hele skjermen med det som er skrevet i det raske. Tittel, dato, start, slutt (også en annen dag), sted, tema, bibeltekst, ansvarlig gruppe, gudstjeneste og synlighet i tre trinn |
| **Redigering** | «Rediger» på arrangementet åpner det samme skjemaet, der arrangementet også kan avlyses. Den lille dialogen er tatt ut. Tema og bibeltekst kan nå endres etterpå, og sted og slutt settes når arrangementet opprettes |
| **Feil som er rettet** | Avkrysningen het «Er gudstjeneste (isGudstjeneste)». En slutt før starten ble lagret uten spørsmål |
| **Menighetsplattform** | Ingen av skjemaene spør etter ansvarlig gruppe. Arrangementet går til gruppen som holder kalenderen |
| **Prøveutgaver** | «Start fra en mal» og «Gjenta som serie», merket som det (kapittel 14) |
| **Prøvd** | 37 nye sjekker: dagene i en serie over sommertid, nyttår og måneder uten femte ukedag, hva skjemaet lagrer og tar bort, og skjemaet selv fra «Flere valg» til lagret arrangement |

### Bilde og tekst på arrangementer (12. oktober 2026)

Del A2 av «Arrangement, maler og serier» (kapittel 14), og første del av A3.

| Område | Levert |
|:---|:---|
| **Feltene** | Et arrangement kan ha bilde med bildetekst, ingress, lengre tekst og lenke med knappetekst (kapittel 5.1). Alt er valgfritt |
| **I skjemaet** | Delen «På nettsiden» i arrangementets skjema. Den står sammenfoldet når den er tom, og hentes først når den åpnes |
| **I CMS-et** | «Arrangementer på nettsiden» viser bildet til hvert arrangement, og sier med ikon og ord om det mangler bilde, tekst eller begge. «Bilde og tekst» åpner skjemaet på riktig del. Et internt arrangement blir ikke spurt om noe |
| **På forsiden** | Kortene i «Hva skjer» viser bildet øverst, i formatet plakater lages i (16:9), og ingressen under tittelen. «Neste gudstjeneste» viser bildet og ingressen. Et arrangement uten bilde vises som før |
| **Eksempelmenigheten** | Gudstjenesten og ungdomsmøtet har bilde og ingress, så det kan ses i demoen |
| **Demoen** | Et arrangement hos en ekte menighet som har et bilde fra stab-registeret, vises uten bildet, som nyheter og taler |
| **Lagres, men vises ikke ennå** | Den lengre teksten og lenken. De får plass på arrangementets egen side, som er neste del, og skjemaet sier det |
| **Prøvd** | 22 nye sjekker: hva som lagres og tas bort, lenken, hva et arrangement mangler, skjemaet fra CMS-et til lagret arrangement, og kortene på forsiden |

### Egen side for arrangementet (12. oktober 2026)

Resten av del A3 i «Arrangement, maler og serier» (kapittel 14).

| Område | Levert |
|:---|:---|
| **Siden** | `/arrangement/<id>`: bilde, tittel, dato, tid (med slutt, også over flere dager), sted, tema og bibeltekst, ingress, den lengre teksten, knapp med lenken, og nyhetene som hører til arrangementet |
| **Avlyst og holdt** | Et avlyst arrangement sier det øverst, med ikon og ord. Et arrangement som er holdt, beholder siden sin, så en delt lenke virker, og sier at det er holdt |
| **Bare åpne arrangementer** | Et internt arrangement og et møte i en gruppe har ingen side, heller ikke for den som har adressen |
| **Veiene dit** | Kortene i «Hva skjer», lenken i «Neste gudstjeneste», radene i kalenderlisten og arrangementene i månedsvisningen åpner siden. Kalenderlisten viser også bildet og ingressen |
| **Legg i kalenderen min** | En kalenderfil med det ene arrangementet, med adressen til siden i |
| **Nyheter** | En nyhet som hører til et arrangement, har en faktaboks med tid og sted, og lenke til arrangementets side |
| **Deling og søk** | Tittel, ingress og bilde følger adressen, i nettleseren og fra serveren. Besøk på siden telles som besøk på en side |
| **Kalenderabonnementet** | Ingressen står i beskrivelsen, og hvert arrangement har adressen til siden sin |
| **Det offentlige API-et** | `beskrivelse` har ingressen. Ingen andre nye felt er gitt ut |
| **Min side** | «Neste i menigheten» lenker til arrangementets side |
| **Rettet** | Et arrangement uten program sa «Ingen programpunkter matcher filteret». Nå sier det at arrangementet ikke har noe program ennå |
| **Prøvd** | 23 nye sjekker for siden, veiene dit, kalenderfilen, delingskortet, tellingen av besøk og API-et |
| **Ikke levert her** | Merking av tid og sted for søkemotorer utover tittel og beskrivelse |

### Maler og serier (12. oktober 2026)

Del B og C av «Arrangement, maler og serier» (kapittel 14). Bestilt av produkteier: standard program på en gudstjeneste skal kunne fylles inn enkelt, og gjentakende arrangementer legges ut året og fram til sommeren.

| Område | Levert |
|:---|:---|
| **Siden «Maler»** | Ny side i admin, på begge nivå. Hver mal står med tid, antall programpunkter og oppgavene den gir. «Ny mal», «Rediger», «Slett» og «Planlegg serie» |
| **Standardmalen for gudstjeneste** | Legges inn med ett trykk: 18 programpunkter fra velkomsten ved inngangen kl. 10:45 til kirkekaffen, med rollene møtevert, lovsang, møteleder, barnekirke, taler og forbønn. Hvert punkt knyttes til rollen med samme navn i menighetens egne roller. Malen kan endres fritt etterpå |
| **Skjemaet for en mal** | Navn, tittel, klokkeslett og varighet, sted, gruppe, synlighet, bilde og tekst. Programmet redigeres punkt for punkt: klokkeslett, minutter, tittel og rolle, med flytt opp og ned. Oppgavene følger rollene i programmet, og ekstra vakter legges til med antall |
| **Lag mal av et arrangement** | «Lag mal» på et arrangement som alt er satt opp, gir en mal med programmet, oppgavene, bildet og teksten |
| **Arrangement fra mal** | «Start fra en mal» i det store skjemaet fyller ut skjemaet. Arrangementet får malens program, på klokkeslettene som følger av dets egen starttid, og én oppgave per rolle |
| **Serie** | «Gjenta som serie»: hver uke, hver 2., 3. eller 4. uke, eller én gang i måneden. Siste dato er foreslått til 30. juni. Dagene vises med hake, og en dag kan tas ut. En dag der det alt ligger et arrangement, er merket |
| **Etter at serien er laget** | Hvert arrangement er merket «Del av serie» i listen. Resten av en serie kan flyttes (se «Flytt resten av en serie»). Den kan ikke slettes i ett trykk: «Slett resten av serien» ble tatt ut 13. oktober 2026, og arrangementer slettes ett om gangen (se «Slett ett arrangement, også når det står folk på det») |
| **Menighetsplattform** | Maler og serier virker også uten planleggeren. Arrangementene får da ikke program og oppgaver |
| **Demoen** | Standardmalen ligger klar hos eksempelmenigheten og hos hver av menighetene, og legges inn på nytt ved nullstillingen |
| **Lagring** | Malene ligger sammen med innstillingene, merket som maler, slik tjenesterollene gjør. Det krever ingen endring i databasens regler |
| **Prøvd** | 66 nye sjekker: klokka i et program, standardmalen, oppgavene en mal gir, arrangement og serie fra mal, mal av et arrangement, skjemaene og siden «Maler» |
| **Ikke levert her** | Fast person i en mal. Dra og slipp i programmet, og redigering av programmet på et arrangement som alt er opprettet (fase 3). En endring i en mal oppdaterer ikke arrangementer som alt er laget |

### Lukket database (12. oktober 2026)

Første del av trinn 4 (kapittel 14). Bestilt av produkteier for at planene fram til sommeren kan legges inn hos første menighet, og frivillige kan melde seg på oppgaver: da står ekte personer i databasen.

| Område | Levert |
|:---|:---|
| **Tre slags besøkende** | Hvem som helst leser nettsiden slik den er publisert. Den som står i personregisteret og har logget inn, leser planleggingen og registeret, og svarer for seg selv. Administrator endrer alt |
| **Innlogginger** | Databasen kan ikke lete i registeret etter en e-postadresse. For hver adresse som står på nøyaktig én person, ligger det derfor et eget dokument som sier hvem personen er, og om personen er administrator. Det er dette reglene slår opp i |
| **Offentlige kopier** | For hver person som har samtykket til offentlig profil, ligger det en kopi med bare de offentlige feltene: navn, tittel, offentlig telefon og e-post, bilde og stabsopplysninger. Nettsiden leser kopiene. Privat telefon og e-post er ikke med |
| **Følger registeret av seg selv** | Innloggingene og kopiene skrives fra registeret, i nettleseren til en administrator som har appen åpen. Den som legger inn en frivillig med e-postadresse, gir dermed personen adgang i samme øyeblikk. En administrator kan ikke miste sin egen innlogging på denne måten |
| **Nettsiden** | En besøkende får bare gruppene og arrangementene som er merket offentlige, og ingenting av oppgaver, tildelinger, meldinger og oppmøte |
| **Gruppeledere** | En leder eller nestleder endrer sin egen gruppe, arrangementene til gruppen og oppgavene på dem |
| **Frivillige** | Svarer på forespørsler, melder seg på og av oppgaver, svarer på om de kommer, skriver meldinger i eget navn, og slår egne varsler av og på |
| **Besøkstall** | En besøkende kan legge til i dagens summer, og ikke noe annet |
| **Bilder og filer** | Alle kan se dem. Bare administrator kan laste opp og slette |
| **Første administrator** | Legges inn utenfra før reglene publiseres (`npm run first-admin`), og får da også sin innlogging |
| **Demoen** | Uendret. Den har sin egen database og sine egne, åpne regler, og ingen logger inn der |
| **Prøvd** | 34 nye sjekker: innloggingene et register gir, delte adresser, de offentlige kopiene, hvem en konto er, hva en besøkende og en innlogget får fra databasen, og at skrivingen fra registeret stopper når den blir avvist |
| **Reglene er kjørt** | Mot Firebase sin lokale prøvedatabase, med 27 sjekker (`npm run test:rules`): hva en besøkende, en innlogget utenfor registeret, en frivillig, en gruppeleder og en administrator får lese og skrive, spurt slik appen spør. Også 400 dokumenter i én sending, og opplasting til bildelageret. Sjekkene slår ut når en regel bevisst ødelegges |
| **Ikke prøvd** | Reglene er ikke publisert i en ekte database, og innloggingen mot Google og e-post er ikke prøvd i drift |
| **Ikke levert her** | Tilgang per menighet (nivå og moduler). En advarsel i admin når to personer deler e-postadresse: ingen av dem kan logge inn. Finere regler for hvem som kan endre tildelinger |

### Menighetens logo (12. oktober 2026)

Bestilt av produkteier under oppsettet av første menighet.

| Område | Levert |
|:---|:---|
| **Innstillingene** | Under «Menighet & Merkevare» velges en logo fra fil: PNG, SVG, JPG eller WebP, opptil 200 kB. Den vises før den lagres, og kan byttes og fjernes |
| **Nettsiden** | Logoen står øverst i stedet for symbolet, navnet og slagordet, og fører til forsiden. Over et bilde står den på en lys plate, så den kan leses |
| **Innloggingssiden** | Logoen står over «Logg inn», i stedet for navnet |
| **Lagring** | Logoen ligger som tekst i innstillingene, så den følger med i et datasett og trenger ikke bildelageret |
| **Prøvd** | 9 sjekker: hva som kan være logo, visningen med og uten logo, og valg, feil fil og fjerning i innstillingene |
| **Ikke levert her** | En egen hvit utgave for mørk bakgrunn, og logo i bunnen av nettsiden og i admin |

### Fødselsdato i personregisteret (12. oktober 2026)

Bestilt av produkteier under oppsettet av første menighet.

| Område | Levert |
|:---|:---|
| **Personsiden i admin** | Feltet «Fødselsdato» under e-postadressen. Det er valgfritt, og viser datoen skrevet ut og alderen når den er fylt inn |
| **Kontroll** | En dato som ikke finnes, en dato fram i tid og et årstall før 1900 avvises med en forklaring |
| **Nettsiden** | Fødselsdatoen er aldri med i det nettsiden viser av en person |
| **Prøvd** | 6 sjekker av dato, alder og tekst, og én av at den offentlige kopien av en person ikke har fødselsdatoen |
| **Ikke levert her** | Fødselsdato i skjemaet for ny person og i personlisten. Fødselsdagsliste og aldersgrupper |

**Hvem som kan lese den.** Bare en administrator ser og endrer feltet. I koden leser en frivillig bare sitt eget personkort (kapittel 14). Det gjelder i databasen først når `firestore.rules` er publisert på nytt hos menigheten.

### Leder og nestleder regnes som deltakere (12. oktober 2026)

Funnet av produkteier hos første menighet: Min side viste to i en husgruppe, mens admin viste «0 medlemmer» (nå «0 deltakere») og «Ingen medlemmer i gruppen» (nå «Ingen deltakere i gruppen») i feltet for leder.

| Område | Rettet |
|:---|:---|
| **Årsaken** | Gruppene var hentet inn fra et datasett der lederen og nestlederen sto som leder og nestleder, men ikke i listen over deltakere. Min side regnet alle tre rollene som deltakere, admin bare den listen |
| **Admin** | Gruppesiden, gruppekortene og personsiden regner nå leder og nestleder som deltakere. Feltene «Leder» og «Nestleder» viser den som har rollen, også når personen ikke står i listen over deltakere |
| **Gruppelederens side** | Samme regel: listen over deltakere har med leder og nestleder, og bare de som ikke er i gruppen i det hele tatt, kan legges til |
| **Min side** | Antallet deltakere på gruppekortet teller hver person én gang, uansett rolle |
| **Når en gruppe lagres i admin** | Den som er valgt som leder eller nestleder, skrives inn i listen over deltakere. En gruppe som mangler lederen der, rettes dermed første gang den lagres |
| **Databasen rettes av seg selv** | Når en administrator har appen åpen i en menighets egen installasjon, skrives ledere og nestledere som mangler i listen over deltakere til gruppen sin, inn i den. Ingenting annet i gruppen røres |
| **Ubesatte oppgaver** | En oppgave som er satt til «trengs ikke» på et arrangement, telles ikke lenger som ubesatt i admin |
| **Prøvd** | 9 sjekker, med en gruppe slik datasettet hadde den |

### Gruppelederen planlegger semesteret (13. oktober 2026)

Bestilt av produkteier: en husgruppe møtes gjerne i fast rytme, og det skal være like enkelt å sette opp her som i en kalender.

| Område | Levert |
|:---|:---|
| **Skjemaet «Planlegg samling»** | Det samme skjemaet som før, med valget «Gjenta»: bare denne gangen, hver uke, annenhver uke eller én gang i måneden |
| **Forslag fra gruppen** | Har gruppen fast møtetid, er ukedag, klokkeslett og hyppighet fylt ut. Første dato er neste gang ukedagen kommer |
| **Til og med** | Foreslås til slutten av semesteret: 30. juni om våren, 20. desember om høsten. Kan flyttes |
| **Dagene vises først** | Listen over dagene står i skjemaet før noe opprettes. En dag som ikke passer, tas ut med haken. En dag der gruppen alt har en samling, er merket og opprettes ikke en gang til |
| **Vert** | Kan stå åpen («Avtales senere»), som er utgangspunktet i en plan. Én vert kan settes for alle, en annen på enkeltdager, og «Bytt på» lar deltakerne ha hver sin gang |
| **Sted, tema og bibeltekst** | Uten adresse er samlingen hos verten. Tema og bibeltekst gjelder den første samlingen. Resten legges inn på hver samling når det nærmer seg |
| **Innkalling** | Deltakerne spørres bare om de kommer til gruppens neste samling. De senere står i kalenderen til det er deres tur. En samling planlagt for seg selv spør med en gang, som før |
| **Etterpå** | Hver samling er en vanlig samling, og kan flyttes, endres og slettes for seg. «Slett denne og alle senere» fjerner resten av planen. Samlinger noen har svart på, blir stående |
| **Regler** | Uendret. En leder oppretter samlinger i sin egen gruppe, som før |
| **Prøvd** | 28 sjekker av dagene, verter på omgang, hvem som spørres, og skjemaet. Prøvd i demoen: to samlinger opprettet og slettet igjen |
| **Ikke levert her** | En egen semesterliste på gruppesiden. At en endring kan gjelde «denne og alle senere». Varsel før en samling. At samlingene kommer i hver deltakers egen kalender hos en menighet (det personlige abonnementet trenger en tjener som ikke kjører der) |

### Flytt resten av en serie (13. oktober 2026)

Bestilt av produkteier hos første menighet: gudstjenestene etter jul var lagt på feil uker, og skulle flyttes én uke.

| Område | Levert |
|:---|:---|
| **«Flytt resten av serien»** | Knapp på hvert arrangement som er del av en serie |
| **Slik brukes den** | Administrator gir arrangementet en ny dato. Det og de som kommer etter i serien, flyttes like mange dager, fram eller tilbake |
| **Det som følger med** | Klokkeslett, sluttid, program, oppgaver og de som står på dem. Arrangementene før, andre serier og enkeltarrangementer røres ikke |
| **Vises før noe flyttes** | De nye datoene står i skjemaet, og det sies fra når noen er spurt eller står på en oppgave: de blir stående, på den nye datoen |
| **Regler** | Uendret |
| **Prøvd** | 11 sjekker, også over skiftet til sommertid |

### Arrangementene som tabell (13. oktober 2026)

Bestilt av produkteier: arrangementene i admin sto i tilfeldig rekkefølge, og det var tungt å finne fram blant dem.

| Område | Levert |
|:---|:---|
| **Sortert på dato** | Arrangementene står etter dato, det første først, både som kort og som tabell. Før sto de i den rekkefølgen databasen ga dem |
| **«Kort» og «Tabell»** | En bryter over listen, slik Personer har. Siden åpner som tabell |
| **Tabellen** | Én linje per arrangement: dato, tittel med tema og merke for gudstjeneste og serie, sted og bemanning. Et trykk på overskriften sorterer på den kolonnen, og et trykk til snur rekkefølgen |
| **Handlinger på linjen** | Kjøreplan, lag neste arrangement, slett, og for et arrangement i en serie «Flytt resten av serien» |
| **Ikke i tabellen** | Ingen knapp som sletter mange arrangementer på en gang (se neste avsnitt) |
| **Prøvd** | 11 sjekker av rekkefølgen og tabellen. Sett i nettleseren: 16 arrangementer etter dato, sortering på bemanning, og bytte til kort |

### Slett ett arrangement, også når det står folk på det (13. oktober 2026)

Bestilt av produkteier: «Slett resten av serien» var for farlig, fordi et helt semesterprogram kunne gå tapt i ett trykk. Samtidig tok det lang tid å slette ett arrangement som var bemannet, fordi hver person først måtte tas av hver oppgave i kjøreplanen.

| Område | Levert |
|:---|:---|
| **«Slett resten av serien» er tatt ut** | Knappen er borte fra arrangementene i admin, både på kortene og i tabellen. Arrangementer slettes ett om gangen |
| **Uten folk på oppgavene** | «Slett» spør én gang, som før, og sletter arrangementet med program og oppgaver |
| **Med folk på oppgavene** | «Slett» åpner en advarsel i stedet for å nekte. Den sier hvor mange det gjelder, og viser oppgave for oppgave hvem som står der, og hvem som bare er spurt |
| **Ett trykk** | «Fjern alle og slett arrangementet» tar alle av oppgavene og sletter arrangementet. «Avbryt» lar alt stå |
| **Én sending** | De som står på oppgavene, oppgavene og arrangementet slettes i samme sending til databasen: enten er alt borte, eller så står alt. Det gjelder også et arrangement uten folk, og gamle svar (nei og forfall) følger med ut |
| **Ikke levert her** | Løsningen sier ikke fra til dem som tas av. Advarselen sier det, og administrator gir beskjed selv |
| **Står som før** | Gruppelederens «Slett denne og alle senere» for samlingene i en plan (se «Gruppelederen planlegger semesteret»). Produkteier har sagt at den kan stå inntil videre |
| **Regler** | Uendret. En ny regelsjekk viser at administrator kan gjøre sendingen, og at en frivillig ikke kan |
| **Prøvd** | 8 sjekker av slettingen i admin, én av sendingen i dataleverandøren og én regelsjekk i emulatoren. Sett i nettleseren mot demoens data med nettet slått av i fanen: advarselen viste oppgaven og navnet, «Avbryt» lot alt stå, og etter «Fjern alle og slett arrangementet» var arrangementet, oppgaven og tildelingen borte og resten urørt. Etter ny lasting sto alt som før i databasen |

### Kalenderabonnementet der løsningen er i drift (13. oktober 2026)

Bestilt av produkteier etter at «Legg til i Google Kalender» ga feil hos første menighet. Knappene pekte på en adresse som bare serveren i `server.ts` svarte på, og den kjører ikke på Vercel. Google fikk nettsiden tilbake i stedet for en kalender. Regelen produkteier ga: en knapp skal virke, eller tas bort.

| Område | Levert |
|:---|:---|
| **Den offentlige kalenderen** | `/api/offentlig/kalender.ics` svarer nå med en kalenderfil der løsningen er i drift. «Legg til i Google Kalender» og «Kopier abonnementslenke» på nettsidens kalender bruker den |
| **Det som er med** | Det en besøkende ser i kalenderen på nettsiden: arrangementene som er merket offentlige, fra 30 dager tilbake til ett år fram, med sted, ingress, tema og adressen til arrangementets side. Gruppenes egne samlinger er ikke med. Kalenderen har menighetens navn |
| **Slik leser den** | Uten innlogging og uten nøkler, med samme spørsmål som nettsiden stiller for en besøkende. Reglene i databasen avgjør hva som kommer tilbake. Reglene er uendret |
| **Demoen** | `?menighet=` velger menighet, som før. Hos en menighet ses det bort fra |
| **Slik er den bygget** | Kilden står i `server/vercel/kalender.ts`, `server/publicCalendarFeed.ts` og `server/firestoreRest.ts`. `npm run build:api` pakker den til `api/kalender.js`, som er filen Vercel leser. En sjekk feiler når den pakkede filen ikke er laget av kilden slik den er |
| **Tatt bort: «Åpent API»** | Lenken nederst på nettsiden pekte på `/api/offentlig/arrangementer`, som ikke svarer der løsningen er i drift |
| **Tatt bort: abonnement i «Min kalender»** | Boksen med «Legg til i Google Kalender» og «Kopier abonnementslenke» på Min side. Den personlige kalenderfilen må lages av en tjeneste som kan lese det bare personen selv får lese, og den finnes ikke i drift. Selve kalenderen i «Min kalender» står som før |
| **Tatt bort: «Test API-endepunkt nå»** | Avsnittet «Offentlig Nettside & CMS-integrasjon» i Database-fanen i admin. Knappen spurte `/api/public/gatherings`, som ikke svarer der løsningen er i drift |
| **Andre adresser under `/api`** | Svarer «finnes ikke» i stedet for å vise nettsiden |
| **Vakt** | En sjekk feiler om en skjerm igjen lenker til en adresse under `/api` |
| **Prøvd** | 14 sjekker. Den pakkede funksjonen er kjørt mot databasen til første menighet og mot demoens, uten innlogging: 30 og 13 arrangementer, med riktig navn på kalenderen |

### Hent inn personer fra Cornerstone (13. oktober 2026)

Bestilt av produkteier. Menigheter som har medlemsregisteret sitt i Cornerstone, skal kunne hente personene inn selv, uten at noen andre enn administrator ser filen. Regelen produkteier ga: bare det løsningen har felt for, hentes.

| Område | Levert |
|:---|:---|
| **«Hent inn fra Cornerstone»** | Knapp under Personer i admin. Administrator velger en CSV-fil eksportert fra Cornerstone |
| **Leses i nettleseren** | Filen leses der administrator sitter, og går ingen andre steder enn til menighetens egen database |
| **Det som hentes** | Navn (fornavn, mellomnavn, etternavn), e-post 1, telefonnummer 1, fødselsdato, og om personen er medlem i menigheten og i kirkesamfunnet (innmeldt dato fylt ut, utmeldt dato tom) |
| **Det som aldri hentes** | Alt annet i filen: adresse, kjønn, sivilstatus, yrke, kommentar, foreldre, grupper, dåp, konfirmasjon, begravelse og Cornerstone-ID. Kolonnene leses ikke |
| **Fødselsnummer** | Lagres aldri og vises aldri. Har en person ingen fødselsdato i filen, tas datoen ut av fødselsnummeret, og nummeret går ikke videre |
| **Vises før noe lagres** | Hvor mange som blir lagt inn, hvor mange som har e-post, fødselsdato og medlemskap, og hvem som hoppes over og hvorfor |
| **Hoppes over** | Den som finnes i registeret fra før (samme navn, eller samme fornavn og e-post, og ikke ulik fødselsdato), den som står to ganger i filen, den som står med dødsdato, og rader uten navn |
| **Barn** | Hentes inn som alle andre |
| **Delt e-post** | En adresse kan bare logge inn én person. Deler flere en adresse, blir den stående på den som har den i registeret fra før, eller på den eldste i filen. De andre legges inn uten e-post, og skjemaet sier hvem |
| **Ikke CSV** | En Excel-fil eller en annen fil gir beskjed om å lagre som CSV i Excel først. Det gjelder også en Excel-fil som bare har fått navnet .csv |
| **Tegnsett og skilletegn** | Æ, ø og å leses riktig både fra Cornerstones egen fil og fra en fil lagret i Excel. Semikolon, komma og tabulator godtas |
| **Demoen** | Knappen vises ikke. Demoens database er åpen for alle, og et ekte register skal aldri dit |
| **Ikke levert her** | Grupper fra filen. Oppdatering av personer som finnes fra før (for eksempel fødselsdato som mangler). Angre: personer som er hentet inn, slettes én og én |
| **Regler** | Uendret. Administrator kunne alt skrive mange personer i én sending |
| **Prøvd** | 20 sjekker med oppdiktede personer. Sett i nettleseren med en oppdiktet fil og nettet slått av: Excel-fil ble avvist, forhåndsvisningen stemte, to personer ble lagt inn uten fødselsnummer eller adresse, og demodatabasen var urørt etterpå. Ikke prøvd med en ekte fil fra Cornerstone: det gjør administrator selv |

### Arrangement uten oppgaver (13. oktober 2026)

Bestilt av produkteier: et menighetsmøte uten oppgaver sto med gul boks og «Mangler bemanning på noen oppgaver», 0/0. Et arrangement uten oppgaver mangler ingen; det ordnes på andre måter, for eksempel av vertskapet.

| Område | Levert |
|:---|:---|
| **Kjøreplanen** | Boksen om bemanning vises ikke når arrangementet ikke har noen oppgaver |
| **Listen over arrangementer** | Slike arrangementer står med «Ingen oppgaver», både på kortene og i tabellen. Før sto de som «Dekket (0/0)» i grønt |
| **Arrangementer med oppgaver** | Som før |
| **Prøvd** | Én sjekk av tabellen. Sett i nettleseren mot demoens data: tre arrangementer uten oppgaver sto med «Ingen oppgaver» i begge visninger, kjøreplanen til ett av dem hadde ingen boks, og et arrangement med oppgaver hadde boksen som før |

### Standardinstrukser på roller som mangler dem (13. oktober 2026)

Bestilt av produkteier: rollene hos første menighet var lagt inn uten instruks.

| Område | Levert |
|:---|:---|
| **«Legg inn standardinstrukser»** | Under Roller i admin, når minst én rolle står uten instruks og standardsettet har en instruks for en rolle med det navnet |
| **Hva som skjer** | Rollene som mangler instruks, får standardinstruksen. Skjermen sier hvilke roller det gjelder før noe gjøres |
| **Røres ikke** | Roller som alt har en instruks, og roller standardsettet ikke kjenner. Teksten kan endres etterpå, rolle for rolle |
| **Prøvd** | 2 sjekker |

### Sted i det raske skjemaet, og ingen ansvarlig gruppe som forslag (13. oktober 2026)

Bestilt av produkteier: det er ikke alltid en gruppe som har ansvaret for et helt arrangement, og bemanningen løses oppgave for oppgave i kjøreplanen. Det raske skjemaet foreslo likevel første gruppe i listen som ansvarlig.

| Område | Levert |
|:---|:---|
| **Det raske skjemaet** | «Sted» står der «Ansvarlig gruppe» sto. Står feltet tomt, brukes menighetens faste sted |
| **Ingen gruppe gjøres ansvarlig** | Et nytt arrangement legges i gruppen som bare holder kalenderen, også på Menighetsplan. Før gikk det til første gruppe i listen |
| **Det store skjemaet** | «Ansvarlig gruppe» står der fortsatt, og viser kalenderen til en annen gruppe velges. Det samme gjelder et arrangement som planlegges fra en mal |
| **Hvilken gruppe som holder kalenderen** | Den uten deltakere, leder og nestleder. Er det flere slike (en tjenestegruppe ingen er lagt i ennå), tas den med flest arrangementer. Finnes ingen, går arrangementet til første gruppe, som før |
| **Følge** | Et arrangement i kalenderen kan bare administrator endre. Gruppeledere bemanner egne oppgaver som før |
| **Ikke levert her** | At en enkeltperson kan stå som ansvarlig for et arrangement. Løsningen har ikke felt for det |
| **Prøvd** | 4 sjekker |

### «Frivillig» betyr at personen er med i en tjenestegruppe (13. oktober 2026)

Bestilt av produkteier: alle i registeret sto som «Frivillig», også de som ikke er med på noe. Da sa merkelappen ingenting, og det var ikke mulig å se hvem man kan utfordre.

| Område | Levert |
|:---|:---|
| **Merkelappen** | «Frivillig» står bare på den som er med i minst én tjenestegruppe, som deltaker, leder eller nestleder. Den som ikke er det, har ingen merkelapp. Administrator, gruppeleder og nestleder vises som før |
| **Husgrupper** | Teller ikke. De er fellesskap, ikke tjeneste. En gruppe lagret før gruppene fikk kategori, regnes som tjenestegruppe |
| **Filter** | «Ikke i noen tjenestegruppe» over listen viser dem som kan spørres |
| **Hvor** | Tabellen og kortene under Personer, og merket øverst på personkortet |
| **Tilgangen er uendret** | Alle i registeret med e-post kan logge inn som før. På personkortet heter valget nå «Vanlig tilgang (standard)», ikke «Frivillig» |
| **Ikke levert her** | Den som bare står på en enkeltoppgave uten å være i en tjenestegruppe, regnes ikke som frivillig. Listen som lastes ned, har ikke kolonne for dette |
| **Prøvd** | 6 sjekker, med oppdiktede personer |

---


## 13. Kjente mangler

Sortert etter hvor mye de betyr for en menighet som skal ta løsningen i bruk.

| # | Mangel | Løses i |
|:---:|:---|:---|
| 1 | Koden gir ikke lenger hele personregisteret til en frivillig. Reglene som er publisert hos første menighet, gjør det fortsatt, til `firestore.rules` limes inn og publiseres på nytt. Frivillige skal ikke inviteres før det, og før en administrator har åpnet appen én gang så katalog og navn på tildelingene er skrevet. Svar på en tildeling kan i koden bare endres av den det gjelder, av ansvarlig leder og av administrator. Det gjelder først når reglene publiseres. En besøkende kan legge til i besøkstallene med hvilke tall som helst | Kapittel 14 |
| 2 | Kladder til nyheter, taler og stab leveres til alle nettlesere. Kladder til sider leveres bare til dem som står i registeret. I demoen leveres hele registeret til alle, som før | Fase 1 |
| 3 | To personer som deler e-postadresse, kan ikke logge inn før adressen står på bare én av dem. Første administrator må legges inn med et skript | Trinn 7 for skriptet |
| 4 | Forsidens tekster og menighetens navn står delvis i koden | Fase 2 |
| 5 | Bilder lagres inne i sidedokumentene, og kan da ikke brukes som delebilde | Fase 2 |
| 6 | To kilder for stab og lederskap, den ene uten samtykke | Fase 2 |
| 7 | Programmet i kjøreplanen kan ikke redigeres | Fase 3 |
| 8 | Ingen varsling: forespørsler og forfall når ingen uten at de åpner appen | Fase 3 |
| 9 | Modulvalg lagres bare i én nettleser | Fase 3 |
| 10 | En besøkende kan ikke melde interesse for en gruppe i løsningen | Fase 3 |
| 11 | En ny deltaker ser hele meldingshistorikken | Fase 3 |
| 12 | Valg, ikke en mangel: forfallsgrunn lagres ikke. Opplysningen kan være privat, og tas muntlig | — |
| 13 | Firebase-klienten lastes på første nettsidebesøk (~1,3 MB JavaScript utover CSS). Admin og Min side er skilt ut, men Firestore er felles datakilde for alle flater | Fase 4 |
| 14 | Tjenesteroller, oppmøtetall, maler og besøkstall ligger fortsatt i `cms_settings`, merket med `recordType`, slik de ble lagt da reglene i drift avviste nye samlinger. De lukkede reglene kjenner merkene | Fase 1 |
| 15 | Med de lukkede reglene kan en besøkende bare legge til i dagens besøkstall, ikke slette. Reglene kan ikke se om det som legges til, er ett besøk eller tusen | Fase 1 |
| 16 | Moduler kan slås av og på av hvem som helst med adgang til admin, og det finnes ikke noe skille mellom hva en menighet har fått tilgang til og hva den har slått på. Kalender og Meldinger husker valget bare i nettleseren | Fase 1 |
| 17 | Noen faste tekster passer ikke alle menigheter: standardtekstene i innholdsmodulene (søndagsskole, kirkekaffe, husfellesskap annenhver uke), de tre infoboksene på forsiden, og setningen om skattefradrag i bunnen av nettsiden. Demodataene (eksempelmenigheten) kan fortsatt legges inn fra Database i enhver installasjon | Fase 2, og trinn 2 for demodataene |
| 18 | På Menighetsplattform er bare menyen og fanene i admin tilpasset. Min side, arrangementssiden, oversikten og gruppene på nettsiden viser fortsatt alt | Trinn 3c |
| 19 | Hos en menighet kan nivået ikke settes: alle har Menighetsplan | Trinn 4 |
| 20 | Demoens nattlige nullstilling startes av GitHub, som slår av tidsplanen når repoet har stått urørt i 60 dager. Demoens database er på Firebase sin gratisplan, som har et tak på lesinger per døgn. Blir demoen mye besøkt, svarer den ikke før neste døgn | Trinn 8 |
| 21 | Hos en ekte menighet i demoen har planleggeren nesten ingen oppgaver: bemanningen i eksempelet hører til eksempelmenighetens gudstjenester | Ikke planlagt |
| 22 | Settene i demoen er laget av menighetenes åpne nettsider, og vises i en demo alle kan endre. Bildene av de ansatte er tatt ut, men navnene deres står, og andre bilder på nettsidene kan vise personer. Eieren slår en menighet på i lista når den har sagt ja. En menighet som er av, kan fortsatt åpnes av den som har lenken | Produkteier |
| 23 | Eierkoden til demoen beskytter skjermen, ikke databasen. Demoens database har åpne regler | Ikke planlagt |
| 24 | Der løsningen er i drift, finnes ikke det personlige kalenderabonnementet og ikke JSON-API-et i kapittel 9. Knappene og lenkene som pekte dit, er tatt bort. Det personlige abonnementet trenger en tjeneste med egen nøkkel til databasen | Ikke planlagt |

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
| 2 | **Innlogging og roller:** administrator, gruppeleder og frivillig. Testbryteren fjernes, og admin legges bak innlogging | **Levert 7. oktober** (kapittel 10.1 og 12) |
| 3 | **Demoen** på demo.menighetsplan.no, i delene under | Pågår |
| 4 | **Lukkede databaseregler og tilgang per menighet.** Regler for appens egne data. Nettsiden slutter å laste personregisteret. Appen leser `/system/entitlements`, siden Moduler viser «ikke inkludert», «av» og «på», og reglene sperrer det menigheten ikke har | **Reglene og appens del er skrevet og prøvd lokalt 12. oktober** (kapittel 12). Ikke publisert. Tilgang per menighet er ikke bygget |
| 5 | **Første ekte menighet**, satt opp for hånd | |
| 6 | **Prøveperiode** for en menighet som vil prøve før den bestiller | |
| 7 | **Oppsett av ny menighet:** skript og sjekkliste for database, regler, tilgang, første administrator, startinnhold og adresse. Bygges bare hvis oppsett for hånd blir for tungt med 10–20 menigheter | |
| 8 | **Drift:** utrulling av regler til alle, sikkerhetskopi, eksport og sletting ved opphør | |

**Trinn 3, demoen, del for del.** Hver del prøves og sendes inn for seg.

| Del | Hva | Status |
|:---|:---|:---|
| 3a | **Demo-installasjonen og nivåvelgeren.** En installasjon kan settes opp som demo. Da står en stripe øverst med velgeren mellom Menighetsplattform og Menighetsplan, og menyen i admin følger valget | **Levert 8. oktober** (kapittel 1.3, 1.4 og 12) |
| 3b | **Vei inn uten innlogging** i demoen, som administrator, gruppeleder og frivillig. Det som tømmer databasen, er ikke med i demoen | **Levert 9. oktober** (kapittel 1.4 og 12) |
| 3c | **Nivåskillet i resten av appen:** Min side, arrangementssiden, oversikten og gruppene på nettsiden | Neste, og det siste som gjenstår av trinn 3 |
| 3d | **Demodata som lever:** datoene regnes fra i dag, og demomenigheten får navn og innhold | **Levert 9. oktober** (kapittel 1.4 og 12) |
| 3e | **Demoen legges ut** med egen database, og nullstilles hver natt. Krever et eget Firebase-prosjekt, som produkteier oppretter | **Levert 9. oktober:** lagt ut på demo.menighetsplan.no med egen database, som er fylt, og med «Velg menighet». Eierkoden til «Demo-oppsett» er lagt inn. Gjenstår å se: den første nullstillingen som går av seg selv, natt til 10. oktober (kapittel 1.4) |

**Slik er demoen bestemt**

* **To nivåer, ikke tre valg.** Menighetsplan inneholder alt i Menighetsplattform. Tilleggsmodulene er ikke med i demoen.
* **Velgeren finnes bare i demoen**, og valget ligger i nettleseren til den som ser på. Hos en menighet bestemmer leverandøren nivået (trinn 4), og ingen velger det i nettleseren.
* **Én felles demodatabase**, i sitt eget Firebase-prosjekt. Et nei til en oppgave på telefonen synes da på lederens skjerm med en gang. Databasen nullstilles hver natt, og det som tømmer den, er stengt.
* **Den besøkende kan se en ekte menighets nettside** (bestemt 9. oktober 2026). Demoen har eksempelmenigheten og én kopi for hver menighet det er laget sett av. Valget er den besøkendes eget, og står øverst i stripen. Alle kopiene ligger i den ene demodatabasen, under hver sine samlinger. Eieren av demoen bestemmer hvilke menigheter som står i lista, og slår en menighet på når den har sagt ja. Bilder av de ansatte vises ikke.
* **Åpne regler i demoen, lukkede hos menighetene.** De to blandes aldri: demoen har sin egen database.
* **Stripen øverst** har velgeren, en linje som sier at dette er en demo, lenke til påmelding og lenke tilbake til salgssiden.
* **Demomenigheten heter Fjordvik menighet** og er oppdiktet (bestemt 9. oktober 2026). En demo som alle kan endre, skal ikke bære navnet til en ekte menighet. Navn og innhold bestemmes i appen, og salgssiden følger.
* **Enkel Min side** på Menighetsplattform er det salgssiden beskriver: neste i menigheten, kommende samlinger og lenker.
* **Menighetsplattform tilbys etter invitasjon.** Det er gratis for menigheten, men oppsett og drift koster leverandøren per menighet.

Trinn 2 og 4 er det samme som fase 1 under. Fase 2–4 fortsetter som før når trinnene er på plass.

### Arrangement, maler og serier *(avtalt 12. oktober 2026, pågår)*

Bestilt av produkteier etter en gjennomgang av skjemaet for arrangementer i eRedaktør og av malene og seriene i en tidligere egen løsning. Et arrangement finnes ett sted. Planleggeren eier fakta (tittel, tid, sted, avlyst), og CMS-et eier presentasjonen (bilde, ingress, tekst). Hver del prøves og sendes inn for seg.

| Del | Hva | Status |
|:---|:---|:---|
| A1 | **Ett skjema i planleggeren.** Det raske skjemaet står, og «Flere valg» åpner det store, på en stor flate. Det samme skjemaet brukes ved redigering | **Levert 12. oktober** (kapittel 12) |
| A2 | **Bilde og tekst på arrangementet.** Feltene ligger i arrangementets eget skjema, i delen «På nettsiden»: bilde med bildetekst, ingress, lang tekst og lenke med knappetekst. «Forside-overstyring» i CMS-et er blitt «Arrangementer på nettsiden»: en oversikt som viser hva hvert arrangement mangler, og som åpner det samme skjemaet på delen om nettsiden | **Levert 12. oktober** (kapittel 12) |
| A3 | **Nettsiden.** Bilde og ingress på kortene i «Neste gudstjeneste», «Hva skjer» og kalenderlisten. Egen side for hvert arrangement, som alle kort og kalenderen åpner. Bildet og ingressen følger med ved deling og i kalenderabonnementet. En nyhet som hører til et arrangement, har en faktaboks med tid og sted | **Levert 12. oktober** (kapittel 12) |
| A4 | **«Lag neste arrangement»** kopierer også bilde, tekst og kjøreplan. I dag kopieres oppgavene, men ikke kjøreplanen | |
| B | **Maler.** En mal har fakta, bilde og tekst, program med rolle på hvert punkt, og oppgavene som skal bemannes. Programmet står som minutter fra start, så det følger arrangementets egen starttid. «Lag mal» på et arrangement, «Start fra en mal» i skjemaet, og siden «Maler» med standardmalen for gudstjeneste | **Levert 12. oktober** (kapittel 12) |
| C | **Serier.** Fra skjemaet eller fra en mal: frekvens og siste dato, foreslått fram til sommeren. Dagene vises før noe opprettes, enkeltdager kan tas ut, og det sies fra der det alt ligger et arrangement. Hvert arrangement i serien er et vanlig arrangement, merket som del av serien. Resten av en serie kan slettes fra ett av arrangementene | **Levert 12. oktober** (kapittel 12) |

**Slik er det bestemt**

* **Prøveutgavene er byttet ut** (12. oktober). «Start fra en mal» og «Gjenta som serie» sto først i skjemaet som prøveutgaver, etter ønske fra produkteier. De er nå ekte: malene er menighetens egne, og en serie oppretter alle arrangementene.
* **Et arrangement fra en mal er et vanlig arrangement.** En endring i malen gjelder arrangementene som lages etterpå, og ingenting som alt står i kalenderen.
* **Én oppgave per rolle.** En rolle som har flere punkter i programmet, er én oppgave på arrangementet. En vakt som ikke står i programmet, eller en rolle som trenger flere enn én, legges til i malen.
* **Siste dato foreslås fram til sommeren:** 30. juni som kommer. En serie har høyst 60 arrangementer.
* **Resten av en serie kan slettes**, fra og med ett av arrangementene. Et arrangement noen er spurt om eller har svart på, blir stående.
* **Ett skjema, to innganger** (produkteier, 12. oktober). Bilde og tekst fylles ut i arrangementets skjema, ikke i et eget skjema i CMS-et. Planleggeren og CMS-et åpner det samme skjemaet. Da er feltene like på begge nivå, og en mal kan senere bære dem.
* **Fast person i en mal er ikke bygget.** Malen sier hvilke roller som trengs. Hvem som har dem, settes på hvert arrangement, og går da gjennom forespørsel og svar som ellers. *Planlagt:* en fast person i malen, som blir forespurt på hvert arrangement.
* **Ingenting er påkrevd.** Malens bilde er standardbildet, og et arrangement uten mal og uten bilde vises uten.
* **«Én gang i måneden»** er samme ukedag i samme uke i måneden. En måned uten en slik dag står over.
* **Nivåene.** Skjema, bilde, tekst, maler og serier gjelder begge nivå. Bemanning og kjøreplan i en mal hører til Menighetsplan. På Menighetsplattform velges ingen ansvarlig gruppe: arrangementet går til gruppen som holder kalenderen.
* **Ikke med her:** redigering av kjøreplanen med varighet og dra og slipp (fase 3).

### Første menighet i drift, og slipp av versjoner *(12. oktober 2026)*

**Lillesand Misjonskirke** er satt opp som første menighet, på lillesandmisjonskirke.menighetsplan.no: eget Firebase-prosjekt (`menighetsplan-lillesand`), eget Vercel-prosjekt, lukkede regler publisert, innlogging med Google og e-postlenke, og driftsmodus «Produksjon». Innholdet er nettsiden fra lillesandmisjonskirke.no, personregisteret, tjenestegruppene, husgruppene, malen for gudstjeneste og gudstjenestene fram til sommeren 2027 med oppgaver, og bemanningen fram til jul fra menighetens eget ark.

**En menighet får bare stabile versjoner.** Demoen følger grenen `main` og bygges ved hver innsending. En menighets installasjon følger grenen `stabil` (Vercel: Settings → Environments → Production → Branch Tracking). En slipp er å flytte `stabil` fram til `main`, og det er produkteier som gjør det:

```
git fetch origin
git push origin origin/main:stabil
```

* Ingenting utvikles på `stabil`. Retningen er alltid fra `main` til `stabil`.
* Før en slipp prøves det nye i demoen, og det sies fra om databasereglene er endret. Reglene følger ikke med koden: `firestore.rules` må limes inn i hver menighets Firebase-prosjekt (Firestore → Rules → Publish).
* Reglene som er publisert hos Lillesand, er fra 12. oktober kl. 19 og mangler tillegget som lar en frivillig lagre `calendarFeedToken` på seg selv. De må publiseres på nytt før det personlige kalenderabonnementet virker der.
* Filer med personopplysninger (registeret, bemanningen) ligger utenfor repoet og skal aldri inn i det.

### Brukernivåer som holder i databasen *(avtalt 12. oktober 2026; lesetilgangen er i koden, ikke publisert i databasen ennå)*

**Problemet.** Appen har tre roller (administrator, gruppeleder, frivillig). De styrer skjermene. Lesingen av registeret var den samme for alle som var logget inn. Produkteier har bedt om tre sikre nivåer, og frivillige skal ikke inviteres inn før reglene er publisert.

**Avtalt.**

| | Frivillig | Gruppeleder og nestleder | Administrator |
|:---|:---|:---|:---|
| Egne opplysninger | Ser sine egne | Ser sine egne | Ser alt |
| Personer i egne grupper | Navn og telefon | Navn, telefon og e-post | Ser alt |
| Personer utenfor egne grupper | Ingenting | Ingenting | Ser alt |
| Fødselsdato, politiattest, fravær | Bare sin egen | Bare sin egen | Ser alt |
| Hvem som står på oppgavene på et arrangement | Bare navnet | Bare navnet | Ser alt |
| Legge folk i gruppen | Nei | Foreslår navn, administrator godkjenner | Ja |

**Lesetilgangen er skrevet i koden** (`src/utils/groupAccess.ts`, `firestore.rules`, `useRegisterMirror`). En frivillig henter sitt eget personkort, navn og telefon for egen gruppe, og e-post bare når hun leder gruppen. Kjøreplanen bruker navnet på tildelingen. «Legg til person» fra registeret vises bare for administrator. Gruppeleder kan fortsatt fjerne en deltaker, men kan ikke ta inn noen som ikke allerede er i gruppen. Demoen leser hele registeret, fordi ingen logger inn der.

Det holder ikke før reglene er publisert. Reglene som ligger hos Lillesand i dag, avviser skriving til de nye samlingene. Speilet kan derfor ikke kjøre før de nye reglene er publisert. Rekkefølgen er:

1. Koden kommer til `main` etter godkjenning.
2. Endringen prøves i demoen.
3. Utrulling til `stabil` godkjennes.
4. De nye Firestore-reglene publiseres straks etter utrullingen.
5. Administrator åpner appen og lar speilet fullføre.
6. Speilingen kontrolleres før én konto for en frivillig brukes til sluttkontroll. Hele `persons` skal ikke komme ned i nettleseren.

Gruppene kan mangle på nettsiden mellom utrullingen og fullført speiling, fordi nettsiden leser de offentlige gruppekortene, og de skrives først når speilet er ferdig. Vanlige frivillige skal ikke inviteres til å teste før speilingen er kontrollert.

**Gruppeleder foreslår deltakere** er skrevet i koden (`memberProposals`, `MemberProposals.tsx`). Leder og nestleder skriver et navn. Forslaget har bare gruppe, navn, hvem som sendte det, tidspunkt og status. Administrator knytter navnet til en person i registeret eller oppretter personen, og kan fortsatt legge inn deltakere direkte. Ventende forslag vises for seg, med teksten «Venter på godkjenning», og bare for leder, nestleder og administrator. Det gjelder husgrupper og tjenestegrupper. Reglene må publiseres etter utrulling til `stabil`, i samme rekkefølge som lesetilgangen over. Før de er publisert, blir forslaget avvist.

**Svar på tildelinger** er skrevet i reglene. Den som står på tildelingen, svarer for seg selv. Leder, nestleder og administrator kan endre og fjerne bemanningen de har ansvar for. En frivillig kan ikke slette en tildeling, og kan ikke avlyse en oppgave. Oppmøte leses av en selv, av dem som er med i gruppen arrangementet hører til, og av administrator. Forfallsgrunn lagres ikke. Reglene må publiseres etter utrulling til `stabil`, sammen med lesetilgangen og forslagene om deltakere. Inntil speilet har kjørt, kan en gammel grunn fortsatt ligge på tildelingen.

Administrator er det samme som den som skal se registeret. En redaktør som endrer nettsiden uten å se registeret, er ikke bygget.

**Kan ikke vises i demoen**, fordi ingen logger inn der. Reglene prøves lokalt (`npm run test:rules`), og med en konto til hos første menighet før adressen sendes ut.

### Fase 1 – Trygg i drift *(trinn 2 og 4 over)*
1. Innlogging med Google-konto. Første administrator er produkteierens konto.
2. Roller: administrator, gruppeleder (avledet av gruppene) og frivillig.
3. Databaseregler etter rolle: besøkende leser bare offentlige data, og kladder leveres ikke ut.
4. Testbryteren, testverktøyet på husfellesskapssiden og demodata-knappene fjernes eller legges bak administrator.
5. Personregisteret lastes ikke på nettsiden.

### Fase 2 – CMS-et styrer hele nettsiden
1. ~~**Temaet virker:** farger, skrift, bakgrunn og avrunding fra design-fanen gjelder hele nettsiden.~~ **Levert 3. oktober.**
2. **Forsiden kan redigeres:** forsidebilde, infoboksene, fellesskaps- og gaveseksjonen. *Delvis levert 3. oktober:* menighetens navn hentes nå fra innstillingene.
3. **Bilder i egen lagring**, med bilder også i nyheter, stab og innholdsblokker.
4. ~~**Delingskort fra serveren:** tittel, beskrivelse og bilde ligger i siden slik den sendes ut.~~ **Levert 3. oktober.**
5. **Én kilde for stab og lederskap:** personregisteret med samtykke. CMS-fanen bestemmer rekkefølge, bilde og omtale.
6. **Nyheter:** arkivside. ~~Utløpsdato og kobling til samling.~~ **Levert 12. oktober.** **Taler:** kobling til person og samling.
7. **Menighetens egen profil:** logo og egen skrift.
8. Senere: visuell redigering av blokker, og historikk med angre.

### Fase 3 – Webappen ferdig
1. **Kjøreplan-editor:** program med klokkeslett, koblet til oppgaver.
2. **Varsling** ved forespørsel, påminnelse og akutt forfall. Kanal må velges (se under).
3. Modulvalg lagres for hele menigheten.
4. «Bli med»: en besøkende melder interesse for en gruppe, og lederen ser henvendelsen.
5. En ny deltaker ser meldinger fra innmeldingsdatoen.
6. ~~Forfall med grunn.~~ **Valg:** grunnen lagres ikke. Opplysningen kan være privat, og tas muntlig.
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
* **D. Den frivillige tar en oppgave.** En plass er ledig i en av den frivilliges grupper. Den frivillige trykker «Ta oppgaven». Tildelingen er bekreftet, og oppgaven står under «Mine oppgaver».
* **E. Forfall.** En bekreftet frivillig melder forfall. Plassen blir ledig, tidspunktet lagres, og oppgaven forsvinner fra den frivilliges liste. Er det mindre enn 48 timer til samlingen, merkes oppgaven som akutt til noen tar den.
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
