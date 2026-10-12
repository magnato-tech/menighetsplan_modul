# Brukerveiledning – kildedokument

Dette dokumentet er kilden til en senere brukerveiledning i fanen **Hjelp**. Det er ikke teksten som skal vises rått i fanen.

Teksten under forutsetter at du allerede er inne i Admin Studio med den rollen arbeidsflyten krever. Stegene beskriver bare funksjoner som finnes i koden. Det som ikke er bekreftet, er merket `[USIKKER]`.

Ankrene etter hver overskrift, for eksempel `#sider-publisering`, er adressene i Hjelp-fanen: `/admin?tab=cms-hjelp#sider-publisering`.

---

## Avvik mot tilgangsstyringen

Inndelingen **For nettsideredaktører** og **For planleggere og administratorer** er en redaksjonell inndeling. Den stemmer ikke med rollene i koden.

Koden har bare to roller på en person: `globalRole` er enten `member` eller `admin`. Det finnes ingen egen redaktørrolle. Kilder: `src/types.ts`, `src/hooks/adminHooks.ts`.

| Arbeidsflyt | Forventet i denne inndelingen | Det koden faktisk sjekker | Avvik |
|---|---|---|---|
| 1–6, fanene under Nettside & CMS | Nett­sideredaktør | Ingen sjekk i `AdminStudio.tsx`. Alle som åpner `/admin` kommer inn i fanene. | Ja. Fanene skiller ikke redaktør fra administrator eller frivillig. |
| 7, fanen Arrangementer | Planlegger / administrator | Ingen sjekk på fanen. | Ja. |
| 7, kjøreplan `/admin/samling/:id` | Administrator | `hasAccess` er sann for administrator, gruppeleder eller nestleder i en involvert gruppe. Andre ser «Arrangementet krever leder- eller admin-tilgang». | Delvis. Ikke bare administrator. |
| 8, fanen Trenger oppfølging | Administrator | Ingen sjekk på fanen. | Ja. |
| 8, oppgavekort `/admin/oppgave/:id` | Administrator | `AdminAccessRequired` hvis `globalRole` ikke er `admin`. Tekst: «oppgavekortet i admin-flaten». | Stemmer med administrator. |
| 9, fanen Grupper & Husfellesskap | Administrator | Ingen sjekk på fanen. | Ja. |
| 9, gruppekort `/admin/gruppe/:id` | Administrator | `AdminAccessRequired` hvis ikke administrator. Tekst: «denne admin-siden». | Stemmer med administrator. |
| 10, fanen Personer | Administrator | Ingen sjekk på fanen. | Ja. |
| 10, personkort `/admin/person/:id` | Administrator | `AdminAccessRequired` hvis ikke administrator. Tekst: «personkort i admin-flaten». | Stemmer med administrator. |
| 11, fanen Analysebord | Administrator | Ingen sjekk på fanen. | Ja. Fanen viser navn på frivillige og personer uten gruppe, og bør ligge bak administrator når innlogging kommer. |
| Inngang til hele studioet | Administrator | Lenken i toppfeltet vises bare når `globalRole === "admin"` (`src/components/Header.tsx`). Selve adressen `/admin` har ingen tilsvarende sperre. | Ja. Menyen skjuler inngangen, ruten gjør det ikke. |

---

## For nettsideredaktører

### 1. Sider & Innhold

Menypunktet heter **Sider & Innhold**. Overskriften på siden er **Sider & Innhold på nettsiden**.

#### 1.1 Sidetre (`#sider-sidetre`)

- **Formål:** Bygge menyen på nettsiden med hovedfaner og underfaner, og styre om en side er publisert.
- **Hvor:** Sidemeny, Nettside & CMS, **Sider & Innhold**.
- **Steg for steg:**
  1. Velg **Ny hovedfane** eller **Legg til fane**.
  2. På en eksisterende hovedfane: opprett underfane, velg **Rediger**, eller slett.
  3. Dra faner for å endre rekkefølge.
  4. Bruk statusknappene i treet for å publisere eller sette en side til kladd.
- **Tekst i grensesnittet:** **Ny hovedfane**, **Legg til fane**, **Rediger**, **Design**, **Åpne nettside**, **Hovedmeny (Offentlig nettsted)**. Tellere: «hovedfaner», «underfaner», «publisert», «planlagt», «kladd» / «kladder». Hjelpetekst på underfane: «Opprett ny underfane som legger seg under denne fanen». Slett har tittel **Slett fane** eller **Slett underside**.
- **Etter lagring:** Ved ny eller endret side: «Siden ble lagret og menystrukturen ble oppdatert!» Ved flytting: «Menyrekkefølgen ble oppdatert!» Ved publisering: ««[tittel]» er nå publisert på nettsiden!» Ved kladd: ««[tittel]» er satt til kladd (upublisert).» Ved sletting: «Siden ble slettet».
- **Påkrevd og feil:** Tittel kreves før lagring: «Siden må ha en tittel». Rekkefølge som feiler: «Kunne ikke oppdatere menyrekkefølgen». Publisering som feiler: «Kunne ikke oppdatere publiseringsstatus». Sletting spør om bekreftelse i `PageDeleteDialog`. [USIKKER] nøyaktig bekreftelsestekst i dialogen er ikke gjengitt her.
- **Rettigheter:** Ingen rollesjekk på fanen. Se avvikstabellen.
- **Kilde:** `src/components/admin/AdminCmsPanel.tsx`, `src/pages/admin/tabs/pages/PageTreeList.tsx`, `src/pages/admin/tabs/pages/PageDeleteDialog.tsx`

#### 1.2 Sideinnstillinger (`#sider-innstillinger`)

- **Formål:** Gi siden navn, adresse og plass i menyen.
- **Hvor:** Samme fane, i vinduet som åpnes ved **Ny hovedfane**, **Legg til fane** eller **Rediger**.
- **Steg for steg:**
  1. Fyll inn **Sidetittel (Vises i meny og header)**.
  2. La **Adresse (f.eks. om-oss)** stå tom for å la den lages fra tittelen, eller skriv den selv.
  3. Velg **Hovedfane / Forelder** hvis siden skal ligge under en annen fane.
  4. Sett **Rekkefølge i meny**.
- **Tekst i grensesnittet:** Plassholder for tittel: «f.eks. Om oss, Barn & Unge, Kontakt». Plassholder for adresse: «om-oss (eller genereres automatisk fra tittel)». Vindustittel: **Opprett ny underfane**, **Opprett ny hovedfane**, eller «Rediger side: [tittel]» / «Rediger side: Uten tittel».
- **Etter lagring:** Samme melding som i 1.1 når du trykker **Lagre side**.
- **Påkrevd og feil:** Tittel er påkrevd. Tom adresse blir laget fra tittelen (små bokstaver, mellomrom blir bindestrek).
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/pages/PageEditModal.tsx`, `src/components/admin/AdminCmsPanel.tsx`

#### 1.3 Hero og knapper (`#sider-hero`)

- **Formål:** Sette toppbanner, overskrift og inntil to knapper øverst på siden.
- **Hvor:** Samme redigeringsvindu, seksjonen **Hero / Toppbanner**.
- **Steg for steg:**
  1. Skriv **Tittel i Hero**.
  2. Velg bilde med bildevelgeren (se arbeidsflyt 5).
  3. Skriv knappetekst for **Primærknapp** og **Sekundærknapp**, og huk av **Vis på siden** for dem som skal vises.
- **Tekst i grensesnittet:** **Hero / Toppbanner**, **Tittel i Hero**, **Primærknapp**, **Sekundærknapp**, **Vis på siden**. Plassholder for knappetekst: «Knappetekst». På forsiden brukes «Se hva som skjer» og «Bli kjent med oss» som plassholdere.
- **Etter lagring:** Banner og knapper vises på den offentlige siden etter **Lagre side**, når siden er publisert.
- **Påkrevd og feil:** Ingen egne påkrevde felt utover sidetittelen. Bilde kan stå tomt.
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/pages/PageEditModal.tsx`

#### 1.4 Innhold og blokker (`#sider-innhold`)

- **Formål:** Sette sammen sidens innhold av blokker, blant annet tekst, bilder og moduler som henter arrangementer.
- **Hvor:** Samme redigeringsvindu, innholdsdelen under hero.
- **Steg for steg:**
  1. Velg **Rediger**, **Splitt** eller **Forhåndsvis**.
  2. Legg inn en blokk fra blokkvelgeren, eller velg **Rediger innhold** på en eksisterende blokk.
  3. Dra blokker for å endre rekkefølge.
  4. Forhåndsvis med **Desktop**, **Nettbrett** eller **Mobil**, eller **Forhåndsvis i ny fane**.
- **Tekst i grensesnittet:** **Rediger**, **Splitt**, **Forhåndsvis**, **Rediger innhold**, **Desktop**, **Nettbrett**, **Mobil**, **Forhåndsvis i ny fane**, **Ny fane**. Blokkategorier i velgeren: Dynamisk, Struktur, Media & Tekst, Typografi, Varsler, Interaksjon, Personer & Roller. Eksempler på blokker: **Neste gudstjeneste**, **Hva skjer**, **Kalender**.
- **Etter lagring:** Blokkene vises på siden etter **Lagre side**. Dynamiske blokker viser arrangementer som allerede er satt til offentlig eller fremhevet.
- **Påkrevd og feil:** [USIKKER] om en side kan lagres helt uten blokker. Tittel er det eneste feltet koden avviser eksplisitt.
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/pages/PageEditModal.tsx`, `src/pages/admin/tabs/pages/VisualBlockManager.tsx`, `src/pages/admin/tabs/pages/ContentBlockPickerModal.tsx`

#### 1.5 Publisering (`#sider-publisering`)

- **Formål:** Bestemme om siden er synlig for publikum, om den ligger i menyen, og om den skal vente til et tidspunkt.
- **Hvor:** Samme redigeringsvindu, seksjonen **Publisering & Synlighet**.
- **Steg for steg:**
  1. Huk av **Aktiver publisering** hvis siden skal vises.
  2. Huk av **Vis i offentlig meny** hvis den skal ligge i toppmenyen.
  3. Valgfritt: sett **Publiseringsdato & tidspunkt (Planlegging)**, eller bruk **I morgen 09:00**.
  4. Trykk **Lagre side**. **Avbryt** lukker uten å lagre.
- **Tekst i grensesnittet:** **Aktiver publisering** — «Når aktivert, vil siden være synlig for publikum (eller automatisk fra planlagt dato).» **Vis i offentlig meny** — «Vises i toppmenyen eller nedtrekksmenyen. Slått av er siden bare tilgjengelig via direkte lenke.» **Nullstill dato (publiser umiddelbart)**. **Lagre side**.
- **Etter lagring:** «Siden ble lagret og menystrukturen ble oppdatert!» En planlagt side telles som «planlagt» i sidetreet til tidspunktet er passert.
- **Påkrevd og feil:** Publisering er på som standard for en ny side (`isPublished` og `inNavMenu` starter som sant). Dato er valgfri.
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/pages/PageEditModal.tsx`, `src/components/admin/AdminCmsPanel.tsx`

#### 1.6 Søkemotorer og deling (`#sider-sok`)

- **Formål:** Styre hvordan siden vises i søk og når noen deler lenken.
- **Hvor:** Samme redigeringsvindu, seksjonen for søk og deling.
- **Steg for steg:**
  1. Skriv en kort beskrivelse, eller bruk **Bruk som SEO-beskrivelse** fra ingressen.
  2. Velg delebilde, eller la feltet stå tomt.
  3. Se **Forhåndsvisning av delebilde på sosiale medier**.
  4. Trykk **Lagre side**.
- **Tekst i grensesnittet:** «Tilpass hvordan siden vises på Google, Facebook og andre sosiale medier.» Plassholder: «Kort beskrivelse (ca. 150-160 tegn) som Google viser under sidetittelen...» Hjelp ved bilde: «La stå tom for å bruke hovedbildet automatisk når det har en delbar adresse.» Tom forhåndsvisning: «Intet bilde valgt (standard logo/toppbanner benyttes)». **Bruk som SEO-beskrivelse**.
- **Etter lagring:** Tittel, beskrivelse og bilde brukes på den offentlige siden og i delingskortet etter **Lagre side**.
- **Påkrevd og feil:** Beskrivelse og delebilde er valgfrie. Et bilde som bare ligger som tekst i sidedokumentet kan ikke brukes som delebilde. [USIKKER] om brukeren får en egen feilmelding om det, eller om feltet bare faller tilbake til standard.
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/pages/PageEditModal.tsx`

### 2. Aktuelt & Nyheter (`#nyheter`)

- **Formål:** Publisere en nyhet som vises på nettsiden.
- **Hvor:** Sidemeny **Aktuelt & Nyheter**. Overskrift på siden: **Aktuelt & Nyhetsartikler**.
- **Steg for steg:**
  1. Trykk **Ny artikkel**.
  2. Fyll inn **Tittel**, velg **Kategori**, og kontroller **Forfatter**.
  3. Skriv **Ingress / Sammendrag** og **Artikkeltekst**.
  4. La **Publiser artikkelen direkte på nettsiden** stå på, eller slå den av.
  5. Trykk **Lagre artikkel**. **Avbryt** lukker skjemaet.
  6. Senere: **Rediger**, eller slett etter bekreftelse «Vil du slette artikkelen "[tittel]"?»
- **Tekst i grensesnittet:** **Skriv ny artikkel** eller «Rediger artikkel: [tittel]». Kategorier: **Aktuelt**, **Gudstjeneste**, **Ungdom**, **Misjon**, **Familie**. Plassholder tittel: «f.eks. Flott oppstart for høstens søndagsskole». Plassholder ingress: «En kort innledning som fanger oppmerksomheten...» Lenke ut har tittel **Les artikkel**.
- **Etter lagring:** «Nyhetsartikkelen ble lagret og publisert!» Skjemaet lukkes, og artikkelen ligger i listen med kategori, forfatter og dato. Ved sletting: «Artikkelen ble slettet».
- **Påkrevd og feil:** **Tittel** er påkrevd. Uten tittel: «Artikkelen må ha en tittel». Forfatter fylles med ditt navn. Kategori starter som **Aktuelt**. Publisering er på som standard. Meldingen sier «publisert» også når avkrysningen er slått av. [USIKKER] om en upublisert artikkel da likevel er skjult på nettsiden.
- **Rettigheter:** Ingen rollesjekk på fanen.
- **Kilde:** `src/pages/admin/tabs/NewsTab.tsx`

### 3. Taler & Prekener (`#taler`)

- **Formål:** Legge en tale inn i prekenarkivet, med taler, bibeltekst og lenke til opptak.
- **Hvor:** Sidemeny **Taler & Prekener**. Overskrift: **Taler & Prekenarkiv**.
- **Steg for steg:**
  1. Trykk **Legg til tale**.
  2. Fyll inn tittel, taler, dato, bibeltekst, serie og lenker til lyd eller video.
  3. Trykk **Lagre tale**.
  4. Senere: **Rediger**, eller slett (knappens tittel er **Slett tale**).
- **Tekst i grensesnittet:** **Legg til ny tale** eller «Rediger tale: [tittel]». Plassholdere: «f.eks. Guds rike er kommet nær», «f.eks. Pastor Kari Nordmann», «f.eks. Markus 1,14–15», «f.eks. Vandring gjennom Markus», «https://open.spotify.com/episode/...», «https://.../tale.mp3», «https://youtube.com/watch?v=...».
- **Etter lagring:** «Talen ble lagret og publisert til prekenarkivet!» Ved sletting: «Talen ble slettet».
- **Påkrevd og feil:** Tittel er påkrevd i koden: «Talen må ha en tittel». Taler-feltet er også merket påkrevd i skjemaet. YouTube-adresse skrives om til en avspiller-vennlig adresse før lagring. Lyd og video er valgfrie.
- **Rettigheter:** Ingen rollesjekk på fanen.
- **Kilde:** `src/pages/admin/tabs/SermonsTab.tsx`

### 4. Lederskap & Stab (`#lederskap`)

- **Formål:** Vise ansatte og menighetsråd på nettsiden, hentet fra personregisteret og ledergruppen.
- **Hvor:** Sidemeny **Lederskap & Stab**. Overskriften er den samme.
- **Steg for steg:**
  1. Trykk **Legg til person i staben**.
  2. Velg en person som ikke allerede står i staben, og bekreft.
  3. Personen får rollen «Medarbeider» og vises offentlig.
  4. For å endre navn, bilde eller biografi: **Rediger personkort** eller **Rediger profil**, som åpner personkortet.
  5. Menighetsrådet hentes fra gruppen som heter noe med «lederskap», eller den første ledergruppen. Endring av hvem som sitter der gjøres under **Grupper & Husfellesskap**.
- **Tekst i grensesnittet:** **Legg til person i staben**, **Rediger personkort**, **Rediger profil**. Forklaring på siden: «Her administreres menighetens ansatte (stab) og valgte lederskap (menighetsråd).»
- **Etter lagring:** «Personen er nå registrert som ansatt i staben!» Personen vises i stablisen. Feil: «Kunne ikke legge til som ansatt.»
- **Påkrevd og feil:** Du må velge en person. Knappen **Populer testdata (32 personer)** og **Fyll inn testdata nå** fyller registeret med eksempelpersoner. Det er ikke en del av vanlig redaksjon.
- **Rettigheter:** Fanen har ingen rollesjekk. Personkortet som åpnes fra **Rediger personkort** krever administrator.
- **Kilde:** `src/pages/admin/tabs/StaffTab.tsx`, `src/pages/AdminPersonDetailPage.tsx`

### 5. Mediebibliotek (`#mediebibliotek`)

- **Formål:** Laste opp bilder og bruke dem på sider og i moduler, uten å forlate redigeringen.
- **Hvor:** Sidemeny **Mediebibliotek**. Samme bibliotek åpnes også fra bildevelgeren mens du redigerer en side: knappene **Bibliotek**, **URL** og **Kirkebilder**.
- **Steg for steg:**
  1. Skriv **Tittel i biblioteket**, **Standardtekst for skjermleser (påkrevd)** og eventuelt emneord.
  2. Trykk **Velg fil og last opp**.
  3. I en side: trykk **Bibliotek**, velg bildet, og **Bruk dette bildet**. Eller lim inn en adresse med **URL** og **Bruk**, eller velg et ferdig kirkebilde.
  4. **Bytt bilde** og **Fjern bilde** endrer valget på siden. **Arkiver** og **Slett permanent** ligger i biblioteket.
- **Tekst i grensesnittet:** **Mediebibliotek**, **Last opp nytt bilde**, «Filen lagres med en offentlig adresse som alle med lenken kan hente.» **Vis arkiverte**, **Bruk dette bildet**, **Arkiver**, **Gjenopprett**, **Slett permanent**, **Bibliotek**, **URL**, **Kirkebilder**, **Bytt bilde**, **Fjern bilde**.
- **Etter lagring:** Bildet ligger i rutenettet og kan velges på sider. Et bilde som er i bruk, kan ikke slettes: «Bildet kan ikke slettes fordi det brukes i innhold.» Mislykket opplasting: «Opplastingen feilet. Prøv igjen.»
- **Påkrevd og feil:** «Standardtekst for skjermleser er påkrevd ved opplasting.» Adresse må starte med https://, media: eller data:. Feil: «Adressen må starte med https://, media: eller data:». Det finnes ikke dra-og-slipp inn i en modul. Opplasting går via filvelger.
- **Rettigheter:** Ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/MediaTab.tsx`, `src/components/admin/MediaLibraryPanel.tsx`, `src/components/admin/CmsMediaPicker.tsx`

### 6. Forside-overstyring (`#forside`)

- **Formål:** Bestemme hvilke arrangementer som løftes på forsiden, vises i den offentlige kalenderen, eller holdes interne.
- **Hvor:** Sidemeny **Forside-overstyring**. Overskrift: **Forside-overstyring for arrangementer**.
- **Steg for steg:**
  1. Finn arrangementet i listen.
  2. Trykk **Fremhev**, **Offentlig** eller **Kun intern**.
- **Tekst i grensesnittet:** Knapper: **Fremhev** («Lås til toppen av forsiden»), **Offentlig** («Vises i offentlig kalender»), **Kun intern** («Skjul fra offentlig visning (kun intern planlegger)»). Merker på kortet: **Fremhevet på forsiden**, **Offentlig i kalender**, **Kun intern (skjult på nett)**.
- **Etter lagring:** «Synlighet oppdatert til: Fremhevet på forsiden», «Synlighet oppdatert til: Offentlig kalender» eller «Synlighet oppdatert til: Kun intern». Merket på kortet byttes med en gang.
- **Påkrevd og feil:** Ingen skjema. Arrangementet må allerede finnes under **Arrangementer**.
- **Rettigheter:** Ingen rollesjekk på fanen.
- **Kilde:** `src/pages/admin/tabs/VisibilityTab.tsx`

---

## For planleggere og administratorer

### 7. Arrangementer (`#arrangementer`)

- **Formål:** Legge inn en samling og åpne kjøreplanen for oppgaver den dagen.
- **Hvor:** Sidemeny, Arrangementer & Bemanning, **Arrangementer**. Overskrift på siden: **Gudstjenester & Møter**. Kjøreplan: **Åpne** på et arrangement, merket **Kjøreplan**. Tilbake-lenke: **Tilbake til arrangementer**.
- **Steg for steg:**
  1. Under **Opprett ny samling**: skriv tittel, dato og klokkeslett. Tema er valgfritt.
  2. Velg **Ansvarlig gruppe**.
  3. Huk av **Dette er en gudstjeneste** hvis det gjelder.
  4. Trykk **Legg til i planleggeren**.
  5. For å gjenta et arrangement: åpne «lag neste», sett ny dato, og bekreft. Oppgavene kopieres uten personer.
  6. På kjøreplanen: **Rediger**, **Ny oppgave**, **Skriv ut**. Overskrift: **Kjøreplan & «Hvem gjør hva»**.
- **Tekst i grensesnittet:** Plassholder tittel: «Tittel, f.eks. Søndagsgudstjeneste & dåp». Plassholder tema: «Valgfritt tema...». Tom gruppe: «Ingen grupper finnes ennå». Knapp: **Legg til i planleggeren**.
- **Etter lagring:** «Ny samling opprettet og synkronisert til kalenderen!» Ved kopi: «Nytt arrangement opprettet for [dato] med [antall] oppgaver klonet!»
- **Påkrevd og feil:** «Tittel og dato må fylles ut». «Opprett en gruppe først. En samling må ha en ansvarlig gruppe.» «Kunne ikke opprette arrangementet». «Vennligst oppgi dato for det nye arrangementet». Klokkeslett starter som 11:00. Sted kan stå tomt; tomt felt bruker standardstedet.
- **Rettigheter:** Fanen har ingen rollesjekk. Kjøreplanen krever administrator, gruppeleder eller nestleder. Andre ser «Arrangementet krever leder- eller admin-tilgang».
- **Kilde:** `src/pages/admin/tabs/GatheringsTab.tsx`, `src/pages/AdminGatheringDetailPage.tsx`, `src/components/GatheringDetailView.tsx`, `src/hooks/leaderHooks.ts`

### 8. Trenger oppfølging (`#oppgaver`)

- **Formål:** Se hvilke oppgaver som mangler folk, tildele en person, eller lage en påminnelsestekst.
- **Hvor:** Sidemeny **Trenger oppfølging**. Overskrift: **Oppgaver & Frivilligoversikt**. Detalj: **Rediger**, merket **Oppgavekort**. Tilbake: **Tilbake til oppgaver**.
- **Steg for steg:**
  1. Filtrer med **Alle oppgaver**, **Trenger oppfølging / Vikar** eller **Venter på svar / Ubesatt**. De to siste viser bare samlinger som ikke er over (eller startet for under fire timer siden). **Alle oppgaver** viser også dem som er holdt.
  2. Trykk **Tildel** eller **Forespør** på en oppgave.
  3. Velg person. **Tildel direkte** setter personen som bekreftet. **Forespør** setter status til venter på svar.
  4. Bekreft med **Tildel oppgave (Bekreftet)** eller **Forespør frivillig (Venter på svar)**.
  5. **Purr** åpner **Purr / Send påminnelse**. Trykk **Kopier tekst**.
- **Tekst i grensesnittet:** Hjelp ved tildeling: «Setter status umiddelbart til Bekreftet. Brukes når du allerede har avtalt vakten muntlig med personen.» Knappetittel på **Purr**: «Purr / generer SMS- og Messenger-tekst».
- **Etter lagring:** «Personen ble tildelt og bekreftet!» eller «Forespørsel ble sendt (status: venter på svar)!» Ved purr: «Purretekst kopiert til utklippstavlen!» Knappen viser **Kopiert til utklippstavle!**
- **Påkrevd og feil:** «Vennligst velg en person». «Kunne ikke fullføre handlingen» hvis tildelingen feiler. Påminnelsen kopieres. Den sendes ikke som melding fra systemet.
- **Rettigheter:** Fanen har ingen rollesjekk. Oppgavekortet krever administrator.
- **Kilde:** `src/pages/admin/tabs/TasksTab.tsx`, `src/pages/AdminTaskDetailPage.tsx`

### 9. Grupper & Husfellesskap (`#grupper`)

- **Formål:** Opprette en gruppe og sette leder, nestleder og deltakere.
- **Hvor:** Sidemeny **Grupper & Husfellesskap**. Overskrift: **Grupper & Fellesskap**. Detalj: **Administrer gruppe →**, merket **Gruppeadministrasjon**. Tilbake: **Tilbake til grupper**.
- **Steg for steg:**
  1. Trykk **Opprett ny gruppe**.
  2. Skriv navn, velg type, leder og eventuell beskrivelse.
  3. Trykk **Opprett gruppe**.
  4. Filtrer med **Alle**, **Ledergrupper**, **Strategigrupper**, **Tjenestegrupper**, **Husgrupper** eller **Interessegrupper**.
  5. Åpne gruppen. Sett **Leder** og **Nestleder**, legg til deltakere med **Legg til deltaker**, eller **Fjern**.
  6. Trykk **Lagre endringer for gruppen**.
- **Tekst i grensesnittet:** Typer i listen: «Ledergruppe (Stabsgruppe, lederskapsgruppe, gruppeledere)», «Strategigruppe (Vekstgrupper Bønn, Kommunikasjon, Historie)», «Tjenestegruppe (Lyd, kirkekaffe, søndagsskole)», «Husgruppe (Husfellesskap i hjemmene)», «Interessegruppe (Turgruppe, kor, hobby, senior)». Plassholder navn: «f.eks. Turgruppe & Friluft eller Vekstgruppe Bønn». Felt: **Leder**. På kortet: «Leder: [navn]» eller «Ikke satt». I detalj: **Deltakere i gruppen**, merker **Leder**, **Nestleder**, **Deltaker**.
- **Etter lagring:** «Gruppen "[navn]" ble opprettet!» Kortet viser antall deltakere og leder. Etter lagring på gruppekortet ligger endringen i listen over deltakere.
- **Påkrevd og feil:** «Gruppen må ha et navn». Navnefeltet er påkrevd i skjemaet.
- **Rettigheter:** Fanen har ingen rollesjekk. Gruppekortet krever administrator.
- **Kilde:** `src/pages/admin/tabs/GroupsTab.tsx`, `src/pages/AdminGroupDetailPage.tsx`

### 10. Personer (`#personer`)

- **Formål:** Holde kontaktinfo, tilgang, fravær og offentlig profil oppdatert for én person.
- **Hvor:** Sidemeny **Personer**. Overskrift: **Personregister**. Åpne med **Åpne** i tabellen eller **Rediger person & fravær** i kortvisning. Merket **Personkort**. Tilbake: **Tilbake til personregister**.
- **Steg for steg:**
  1. Søk, eller bytt mellom **Kort** og **Tabell**.
  2. Åpne personen.
  3. Oppdater navn, telefon, e-post, tilgang, **Politiattest (gyldig til dato)** og fravær.
  4. Under **Offentlig profil på nettsiden** bestemmer du hva som kan vises utad.
  5. Trykk **Lagre alle personopplysninger & tilganger**.
- **Tekst i grensesnittet:** Søk: «Søk etter navn, gruppe, tilgang eller kontaktinfo...» Kolonner: **Navn**, **Tilgang**, **Grupper**, **E-post**, **Telefon**, **Handling**. Tilgangsmerker inkluderer **GRUPPELEDER**, **NESTLEDER**, **FRIVILLIG** og **ADMINISTRATOR**.
- **Etter lagring:** Fravær som legges til, bekreftes med «Fraværsperiode lagt til!» Øvrig lagring viser en bekreftelse på personkortet. [USIKKER] den nøyaktige suksessmeldingen etter **Lagre alle personopplysninger & tilganger** er ikke gjengitt her.
- **Påkrevd og feil:** Offentlig visning krever at offentlig profil er slått på. Telefon og e-post fra det interne kortet vises ikke på nettsiden av seg selv. **Populer testdata (32 personer)** er eksempeldata, ikke vanlig registrering.
- **Rettigheter:** Fanen har ingen rollesjekk. Personkortet krever administrator. Uten den vises «Admin-tilgang kreves».
- **Kilde:** `src/pages/admin/tabs/PersonsTab.tsx`, `src/pages/admin/tabs/persons/PersonsTable.tsx`, `src/pages/AdminPersonDetailPage.tsx`

## Innsikt

### 11. Analysebord (`#analysebord`)

- **Formål:** Se menighetens liv i tall over en periode: oppmøte på gudstjenestene, frivillighet og bemanning, grupper og fellesskap, personregisteret og nettsiden. Hvert tall sammenlignes med perioden før.
- **Hvor:** Sidemeny **Innsikt**, **Analysebord** (nederst i menyen). Overskrift: **Analysebord**.
- **Steg for steg:**
  1. Velg periode: **Siste 4 uker**, **Siste 3 måneder** eller **Siste 12 måneder**.
  2. Under **Oppmøte**: trykk på en søyle, eller **Registrer** i listen **Mangler oppmøtetall**.
  3. Fyll inn **Voksne** og **Barn**, og eventuelt **Merknad (valgfritt)**. Trykk **Lagre oppmøtetall**.
  4. Bytt mellom **Gudstjenester** og **Alle arrangementer**, eller trykk **Vis som tabell**.
  5. Trykk **Last ned CSV** for å hente oppmøtetallene til et regneark.
  6. Les **Kan trenge avlastning** og **Ikke brukt i perioden** før neste vaktliste lages. Navnene åpner personkortet.
  7. **Bemanning per arrangement** viser hvor mange samlinger som hadde alle plasser bekreftet, og hvilke som manglet folk.
  8. **Flere oppgaver på samme samling** viser hvem som har hatt to eller flere oppgaver på samme samling, og de vanligste kombinasjonene. **Samme klokkeslett i kjøreplanen** vises der kjøreplanen har klokkeslett for begge oppgavene.
  9. **Oppgaver og aktiviteter per måned** viser hvor stor del av menigheten som har 0, 1, 2 … **8 eller flere** i en vanlig måned. Bytt med **Oppgaver** og **Aktiviteter**.
  10. **Hver enkelt** er en tabell per person. Bruk **Sorter etter** og **Bare de som har vært med**, og **Vis alle** for hele listen.
  11. Trykk **Tilpass bordet** for å velge moduler, eller øyet på en modul for å skjule den. **Vis alle** tar alt tilbake.
  12. **Datagrunnlag** nederst sier hva tallene bygger på, og hva som ikke måles.
- **Tekst i grensesnittet:** Vinduet heter **Registrer oppmøtetall** eller **Endre oppmøtetall**. Hjelpetekst: «Skriv inn hvor mange som var til stede, talt på dagen. Tell barn under konfirmasjonsalder som barn.» En samling uten tall vises i diagrammet som en lav grå strek, merket **Ikke registrert**. Et tall som mangler grunnlag vises som «–».
- **Etter lagring:** «Oppmøtetallet for «[samling]» er lagret.» Ved **Fjern tellingen**: «Oppmøtetallet for «[samling]» er fjernet.» Søylen, snittet og nøkkeltallene oppdateres med en gang. Når en modul skjules: ««[modul]» er skjult. Du får den tilbake under Tilpass bordet.» Nederst står hvor mange moduler som er skjult. Valget lagres på den aktive brukeren; til innlogging er på plass, deler alle som bruker samme bruker, samme valg.
- **Påkrevd og feil:** «Skriv inn hvor mange som var til stede.» når begge feltene er tomme eller null. «Voksne må være et helt tall (0 eller mer).» og tilsvarende for **Barn**. Bare samlinger som er holdt, ikke avlyst og ikke gruppesamlinger, kan telles.
- **Prøve med historikk:** Under **Database og Testdata**, **Simuler menighetsliv**: velg 12, 26 eller 52 uker og trykk **Simuler menighetsliv**. **Fjern simulert historikk** tar bort bare det som ble simulert.
- **Rettigheter:** Fanen har ingen rollesjekk.
- **Kilde:** `src/pages/admin/tabs/AnalyticsTab.tsx`, `src/pages/admin/tabs/analytics/`, `src/utils/churchAnalytics.ts`, `src/components/admin/SimulationPanel.tsx`

---

## Skjermbilder i Hjelp-fanen

Bildene ligger i `public/help/` som `hjelp-<artikkel-id>.png` og vises øverst i hver hjelpeartikkel. Kjør `node scripts/capture-help-screenshots.mjs` (med `npm run dev` aktiv) for å ta dem på nytt etter store UI-endringer.

Listen under beskriver hva hvert bilde skal vise.

| Filnavn | Hva bildet skal vise |
|---|---|
| `hjelp-sider-sidetre.png` | Sidetreet med **Ny hovedfane** og statusmerkene |
| `hjelp-sider-innstillinger.png` | Feltene **Sidetittel** og **Adresse** |
| `hjelp-sider-hero.png` | Seksjonen **Hero / Toppbanner** |
| `hjelp-sider-innhold.png` | Blokklisten med **Rediger innhold** |
| `hjelp-sider-publisering.png` | **Publisering & Synlighet** og **Lagre side** |
| `hjelp-sider-sok.png` | Søkebeskrivelse og delebilde |
| `hjelp-nyheter.png` | Skjemaet **Skriv ny artikkel** |
| `hjelp-taler.png` | Skjemaet **Legg til ny tale** |
| `hjelp-lederskap.png` | **Lederskap & Stab** med **Legg til person i staben** |
| `hjelp-mediebibliotek.png` | Opplasting med påkrevd skjermlesertekst |
| `hjelp-forside.png` | Knappene **Fremhev**, **Offentlig** og **Kun intern** |
| `hjelp-arrangementer.png` | **Opprett ny samling** |
| `hjelp-kjoreplan.png` | **Kjøreplan & «Hvem gjør hva»** |
| `hjelp-oppgaver.png` | **Tildel**, **Forespør** og **Purr** |
| `hjelp-grupper.png` | Gruppekort med ledernavn og **Administrer gruppe** |
| `hjelp-personer.png` | Tabellen i **Personregister** med **Åpne** |
| `hjelp-analysebord.png` | Seksjonen **Oppmøte** med søylene, snittlinjen og **Mangler oppmøtetall** |
