export type HelpArticleImageLayout = "wide" | "tall";

export interface HelpArticle {
  id: string;
  title: string;
  /** wide: full column under intro. tall: right column beside intro and steps. */
  layout: HelpArticleImageLayout;
  formal: string;
  hvor: string;
  steg: string[];
  knapper: string;
  etterLagring: string;
}

export interface HelpSection {
  title: string;
  items: HelpNavItem[];
}

export type HelpNavItem =
  | { kind: "article"; article: HelpArticle }
  | { kind: "menu"; title: string; articles: HelpArticle[] };

const siderSidetre: HelpArticle = {
  id: "sider-sidetre",
  title: "Sidetre",
  layout: "wide",
  formal: "Bygge menyen på nettsiden med hovedfaner og underfaner, og styre om en side er publisert.",
  hvor: "Velg Nettside øverst i menyen, så Sider & Innhold. Overskriften på siden er «Sider & Innhold på nettsiden».",
  steg: [
    "Trykk på den runde + øverst til høyre for en ny hovedfane.",
    "På en eksisterende hovedfane: opprett underfane, velg Rediger, eller slett.",
    "Dra faner for å endre rekkefølge.",
    "På PC står menyen på nettsiden øverst i listen. Trykk på en fane, eller hold musen over den og velg en underside, så ruller listen dit.",
    "Bruk statusknappene i treet for å publisere eller sette en side til kladd.",
  ],
  knapper:
    "+ øverst til høyre (Ny hovedfane), Rediger. Slett har tittelen Slett fane eller Slett underside. Underfane: «Opprett ny underfane som legger seg under denne fanen».",
  etterLagring:
    "«Siden ble lagret og menystrukturen ble oppdatert!» Siden blir stående åpen, så du kan fortsette; lukk den for å komme tilbake til listen. Har du endret noe uten å lagre, spør admin før siden lukkes eller du går til en annen side: «Lagre», «Forkast endringene» eller «Bli her». På PC står nettsidens meny over redigeringen, og en side i menyen åpnes der. Ved flytting: «Menyrekkefølgen ble oppdatert!» Ved publisering: «[tittel] er nå publisert på nettsiden!» Ved kladd: «[tittel] er satt til kladd (upublisert).» Ved sletting: «Siden ble slettet». Uten tittel: «Siden må ha en tittel».",
};

const siderInnstillinger: HelpArticle = {
  id: "sider-innstillinger",
  title: "Sideinnstillinger",
  layout: "wide",
  formal: "Gi siden navn, adresse og plass i menyen.",
  hvor: "Samme fane, i vinduet som åpnes ved + (Ny hovedfane), ved + på en fane (ny underfane) eller ved Rediger.",
  steg: [
    "Fyll inn Sidetittel (Vises i meny og header).",
    "La Adresse (f.eks. om-oss) stå tom for å la den lages fra tittelen, eller skriv den selv.",
    "Velg Hovedfane / Forelder hvis siden skal ligge under en annen fane.",
    "Sett Rekkefølge i meny.",
  ],
  knapper:
    "Plassholder for tittel: «f.eks. Om oss, Barn & Unge, Kontakt». Plassholder for adresse: «om-oss (eller genereres automatisk fra tittel)». Vindustittel: Opprett ny underfane, Opprett ny hovedfane, eller «Rediger side: [tittel]».",
  etterLagring:
    "Samme melding som når du trykker Lagre side: «Siden ble lagret og menystrukturen ble oppdatert!» Tittel er påkrevd. Tom adresse blir laget fra tittelen.",
};

const siderHero: HelpArticle = {
  id: "sider-hero",
  title: "Hero og knapper",
  layout: "tall",
  formal: "Sette toppbanner, overskrift og inntil to knapper øverst på siden.",
  hvor: "Samme redigeringsvindu, seksjonen Hero / Toppbanner.",
  steg: [
    "Skriv Tittel i Hero.",
    "Velg bilde med bildevelgeren. Se Mediebibliotek.",
    "Skriv knappetekst for Primærknapp og Sekundærknapp, og huk av Vis på siden for dem som skal vises.",
    "På forsiden: velg Høyde på toppbildet (Lav, Middels eller Hele skjermen) og om Tittelen på bildet skal være Kraftig eller Rolig. Tekststørrelse og Skrift på tittelen står rett under Tittel i Hero. Toppbilde 2 og 3 kan få hver sin tittel når bildet er valgt; tomt felt gir hovedtittelen. Med flere bilder står prikker under bildet, og piler på sidene kan slås på. Undertittelen kan slås av med Vis på siden ved Ingress / Undertittel.",
    "På forsiden: velg hvordan Menyen øverst ligger (over bildet uten bakgrunn, med svak skygge, eller som hvit linje) og hvor mørkt Slør over bildet skal være. En lys logo til bruk over bildet, og menyord med store bokstaver, velges i Nettside-innstillinger.",
  ],
  knapper:
    "Hero / Toppbanner, Tittel i Hero, Toppbildet: størrelse, tittel og flere bilder, Høyde på toppbildet, Tittelen på bildet, Primærknapp, Sekundærknapp, Vis på siden. Plassholder for knappetekst: «Knappetekst». På forsiden brukes «Se hva som skjer» og «Bli kjent med oss» som plassholdere.",
  etterLagring:
    "Banner og knapper vises på den offentlige siden etter Lagre side, når siden er publisert. Bilde kan stå tomt.",
};

const siderInnhold: HelpArticle = {
  id: "sider-innhold",
  title: "Innhold og blokker",
  layout: "tall",
  formal: "Sette sammen sidens innhold av blokker, blant annet tekst, bilder og moduler som henter arrangementer.",
  hvor: "Samme redigeringsvindu, innholdsdelen under hero.",
  steg: [
    "Velg Rediger, Splitt eller Forhåndsvis.",
    "Legg inn en blokk fra blokkvelgeren, eller velg Rediger innhold på en eksisterende blokk.",
    "Dra blokker for å endre rekkefølge.",
    "Forhåndsvis med Desktop, Nettbrett eller Mobil, eller Forhåndsvis i ny fane.",
  ],
  knapper:
    "Rediger, Splitt, Forhåndsvis, Rediger innhold, Desktop, Nettbrett, Mobil, Forhåndsvis i ny fane, Ny fane. Blokkategorier: Dynamisk, Struktur, Media & Tekst, Typografi, Varsler, Interaksjon, Personer & Roller. Eksempler: Neste gudstjeneste, Hva skjer, Kalender.",
  etterLagring:
    "Blokkene vises på siden etter Lagre side. Dynamiske blokker viser arrangementer som allerede er satt til offentlig eller fremhevet. Tittel er det eneste feltet som avvises hvis det mangler.",
};

const siderPublisering: HelpArticle = {
  id: "sider-publisering",
  title: "Publisering",
  layout: "wide",
  formal: "Bestemme om siden er synlig for publikum, om den ligger i menyen, og om den skal vente til et tidspunkt.",
  hvor: "Samme redigeringsvindu, seksjonen Publisering & Synlighet.",
  steg: [
    "Huk av Aktiver publisering hvis siden skal vises.",
    "Huk av Vis i offentlig meny hvis den skal ligge i toppmenyen.",
    "Valgfritt: sett Publiseringsdato & tidspunkt (Planlegging), eller bruk I morgen 09:00.",
    "Trykk Lagre øverst, som alltid står synlig, eller Lagre side nederst. Avbryt lukker uten å lagre.",
  ],
  knapper:
    "Aktiver publisering — «Når aktivert, vil siden være synlig for publikum (eller automatisk fra planlagt dato).» Vis i offentlig meny — «Vises i toppmenyen eller nedtrekksmenyen. Slått av er siden bare tilgjengelig via direkte lenke.» Nullstill dato (publiser umiddelbart). Lagre side.",
  etterLagring:
    "«Siden ble lagret og menystrukturen ble oppdatert!» En planlagt side telles som «planlagt» i sidetreet til tidspunktet er passert. Publisering og meny er på som standard for en ny side. Dato er valgfri.",
};

const siderSok: HelpArticle = {
  id: "sider-sok",
  title: "Søkemotorer og deling",
  layout: "tall",
  formal: "Styre hvordan siden vises i søk og når noen deler lenken.",
  hvor: "Samme redigeringsvindu, seksjonen for søk og deling.",
  steg: [
    "Skriv en kort beskrivelse, eller bruk Bruk som SEO-beskrivelse fra ingressen.",
    "Velg delebilde, eller la feltet stå tomt.",
    "Se Forhåndsvisning av delebilde på sosiale medier.",
    "Trykk Lagre side.",
  ],
  knapper:
    "«Tilpass hvordan siden vises på Google, Facebook og andre sosiale medier.» Plassholder: «Kort beskrivelse (ca. 150-160 tegn) som Google viser under sidetittelen...» «La stå tom for å bruke hovedbildet automatisk når det har en delbar adresse.» Tom forhåndsvisning: «Intet bilde valgt (standard logo/toppbanner benyttes)». Bruk som SEO-beskrivelse.",
  etterLagring:
    "Tittel, beskrivelse og bilde brukes på den offentlige siden og i delingskortet etter Lagre side. Beskrivelse og delebilde er valgfrie.",
};

const nyheter: HelpArticle = {
  id: "nyheter",
  title: "Aktuelt & Nyheter",
  layout: "wide",
  formal: "Publisere en nyhet som vises på nettsiden.",
  hvor: "Nettside, Aktuelt & Nyheter. Overskrift på siden: Aktuelt & Nyhetsartikler.",
  steg: [
    "Trykk Ny artikkel.",
    "Fyll inn Tittel, velg Kategori, og kontroller Forfatter.",
    "Skriv Ingress / Sammendrag og Artikkeltekst.",
    "Handler artikkelen om et arrangement, velg det under Hører til arrangement. Da går artikkelen ut av forsiden av seg selv dagen etter arrangementet.",
    "Skal artikkelen stå til en bestemt dag, sett datoen i Vises til og med. Uten arrangement og uten dato står den til du tar den ut.",
    "La Publiser artikkelen direkte på nettsiden stå på, eller slå den av.",
    "Trykk Lagre artikkel. Avbryt lukker skjemaet.",
    "Senere: Rediger, eller slett etter bekreftelse «Vil du slette artikkelen [tittel]?»",
  ],
  knapper:
    "Skriv ny artikkel eller «Rediger artikkel: [tittel]». Kategorier: Aktuelt, Gudstjeneste, Ungdom, Misjon, Familie. Plassholder tittel: «f.eks. Flott oppstart for høstens søndagsskole». Plassholder ingress: «En kort innledning som fanger oppmerksomheten...» Lenke ut har tittel Les artikkel.",
  etterLagring:
    "«Nyhetsartikkelen ble lagret og publisert!» Skjemaet lukkes, og artikkelen ligger i listen med kategori, forfatter og dato, og med hvor lenge den vises. En artikkel som er utløpt, står i listen merket Utløpt, og kan gis en ny dato. Ved sletting: «Artikkelen ble slettet». Uten tittel: «Artikkelen må ha en tittel».",
};

const taler: HelpArticle = {
  id: "taler",
  title: "Taler & Prekener",
  layout: "wide",
  formal: "Legge en tale inn i prekenarkivet, med taler, bibeltekst og lenke til opptak.",
  hvor: "Nettside, Taler & Prekener. Overskrift: Taler & Prekenarkiv.",
  steg: [
    "Trykk Legg til tale.",
    "Fyll inn tittel, taler, dato, bibeltekst, serie og lenker til lyd eller video.",
    "Trykk Lagre tale.",
    "Senere: Rediger, eller slett. Knappens tittel er Slett tale.",
  ],
  knapper:
    "Legg til ny tale eller «Rediger tale: [tittel]». Plassholdere: «f.eks. Guds rike er kommet nær», «f.eks. Pastor Kari Nordmann», «f.eks. Markus 1,14–15», «f.eks. Vandring gjennom Markus».",
  etterLagring:
    "«Talen ble lagret og publisert til prekenarkivet!» Ved sletting: «Talen ble slettet». Uten tittel: «Talen må ha en tittel». Taler-feltet er også påkrevd. Lyd og video er valgfrie.",
};

const lederskap: HelpArticle = {
  id: "lederskap",
  title: "Lederskap & Stab",
  layout: "wide",
  formal: "Vise ansatte og menighetsråd på nettsiden, hentet fra personregisteret og ledergruppen.",
  hvor: "Nettside, Lederskap & Stab. Overskriften er den samme.",
  steg: [
    "Trykk Legg til person i staben.",
    "Velg en person som ikke allerede står i staben, og bekreft.",
    "Personen får rollen Medarbeider og vises offentlig.",
    "For å endre navn, bilde eller biografi: Rediger personkort eller Rediger profil.",
    "Menighetsrådet hentes fra ledergruppen. Hvem som sitter der, endres under Grupper & Husfellesskap.",
  ],
  knapper:
    "Legg til person i staben, Rediger personkort, Rediger profil. Forklaring på siden: «Her administreres menighetens ansatte (stab) og valgte lederskap (menighetsråd).»",
  etterLagring:
    "«Personen er nå registrert som ansatt i staben!» Feil: «Kunne ikke legge til som ansatt.» Du må velge en person.",
};

const mediebibliotek: HelpArticle = {
  id: "mediebibliotek",
  title: "Mediebibliotek",
  layout: "wide",
  formal: "Bruke bildene som følger med, og laste opp egne, på sider og i moduler uten å forlate redigeringen.",
  hvor: "Nettside, Mediebibliotek. Samme bibliotek åpnes fra bildevelgeren mens du redigerer en side.",
  steg: [
    "Øverst ligger Bilder som følger med. Søk etter for eksempel fellesskap, familie eller høst.",
    "For å laste opp et eget bilde: skriv Tittel i biblioteket, Standardtekst for skjermleser (påkrevd) og eventuelt emneord.",
    "Trykk Velg fil og last opp.",
    "I en side: trykk Bibliotek. Trykk på et bilde som følger med, eller velg et opplastet bilde og Bruk dette bildet. Eller lim inn en adresse med URL og Bruk, eller velg et ferdig kirkebilde.",
    "Bytt bilde og Fjern bilde endrer valget på siden. Arkiver og Slett permanent ligger i biblioteket.",
  ],
  knapper:
    "Søk i bildene som følger med, Last opp nytt bilde, Vis arkiverte, Bruk dette bildet, Arkiver, Gjenopprett, Slett permanent, Bibliotek, URL, Kirkebilder, Bytt bilde, Fjern bilde.",
  etterLagring:
    "Bildet ligger i rutenettet og kan velges på sider. «Bildet kan ikke slettes fordi det brukes i innhold.» «Opplastingen feilet. Prøv igjen.» «Standardtekst for skjermleser er påkrevd ved opplasting.» «Adressen må starte med https://, media: eller data:».",
};

const forside: HelpArticle = {
  id: "forside",
  title: "Arrangementer på nettsiden",
  layout: "wide",
  formal: "Bestemme hvilke arrangementer som løftes på forsiden, vises i den offentlige kalenderen, eller holdes interne.",
  hvor: "Nettside, Arrangementer på nettsiden. Hvert arrangement viser om det mangler bilde eller tekst. Bilde og tekst åpner arrangementets skjema, på delen På nettsiden.",
  steg: [
    "Finn arrangementet i listen.",
    "Trykk Fremhev, Offentlig eller Kun intern.",
  ],
  knapper:
    "Fremhev («Lås til toppen av forsiden»), Offentlig («Vises i offentlig kalender»), Kun intern («Skjul fra offentlig visning (kun intern planlegger)»). Merker: Fremhevet på forsiden, Offentlig i kalender, Kun intern (skjult på nett).",
  etterLagring:
    "«Synlighet oppdatert til: Fremhevet på forsiden», «Synlighet oppdatert til: Offentlig kalender» eller «Synlighet oppdatert til: Kun intern». Merket på kortet byttes med en gang. Arrangementet må allerede finnes under Arrangementer.",
};

const arrangementer: HelpArticle = {
  id: "arrangementer",
  title: "Kalender og arrangementer",
  layout: "wide",
  formal: "Se arrangementene som måned, uke, kort eller tabell, legge inn en samling og åpne kjøreplanen for oppgaver den dagen.",
  hvor: "Velg Planlegging øverst i menyen, så Kalender. Overskrift: Kalender. Kort og Tabell viser Kommende først; Tidligere viser dem som er holdt. Trykk på et arrangement for å åpne det. Tilbake-lenke: Kalender.",
  steg: [
    "Velg visning øverst: Måned, Uke, Kort eller Tabell. På mobil står Uke og Kort. I Måned og Uke blar du med pilene, og I dag går tilbake til i dag. Et trykk på en ledig plass på en dag åpner skjemaet for et nytt arrangement den dagen. Arrangementer flyttes ikke i kalenderen: de åpnes.",
    "Knappene Alle, Gudstjenester, Husgrupper, Tjenestegrupper og Andre velger hva som vises, i alle visningene. Flere kan være på samtidig. Tjenestegrupper er teamenes egne samlinger; bønnemøter, ungdomsmøter og andre åpne arrangementer står under Andre. Visningen og knappene huskes i nettleseren.",
    "Trykk + øverst til høyre. Skjemaet for et nytt arrangement åpnes: tittel, dato og klokkeslett, og om du vil sluttid, sted, tema, bibeltekst, ansvarlig gruppe og hvem som ser arrangementet. Står stedet tomt, brukes menighetens faste sted. Et arrangement ligger i kalenderen uten ansvarlig gruppe til du velger en.",
    "Trykk Opprett arrangement.",
    "Trykk på et arrangement for å åpne Bemanning. Kjøreplan åpner Program.",
    "Start fra en mal i det store skjemaet fyller ut skjemaet, og arrangementet får malens program og oppgaver. På et arrangement som allerede finnes bruker du Hent fra mal i kjøreplanen. Rediger malen (penn på malen, eller Rediger malen før du oppretter) åpner malen før arrangementet lages. Malene lages under Maler i menyen, eller med Lag mal på et arrangement som alt er satt opp.",
    "Gjenta som serie: velg hvor ofte og siste dato. Dagene vises med hake, og en dag kan tas ut før serien opprettes. Flytt resten av serien står på hvert arrangement i en serie. Arrangementer slettes ett om gangen: står det folk på oppgavene, kommer en advarsel som sier hvem, og ett trykk tar alle av og sletter arrangementet.",
    "For å gjenta et arrangement: åpne neste arrangement, sett ny dato, og bekreft. Oppgavene kopieres uten personer.",
    "I arrangementet: Rediger åpner det samme store skjemaet, der arrangementet også kan avlyses. Under Program kan admin dra i håndtaket på en programpost for å flytte den. Bemanningen gjøres under Bemanning (se den artikkelen). På mobil står Rediger, Ny oppgave, Hent fra mal, Lag mal og Skriv ut bak «…».",
  ],
  knapper:
    "+ (Nytt arrangement), Alle, Gudstjenester, Husgrupper, Tjenestegrupper, Andre, Måned, Uke, Kort, Tabell, I dag, Kommende, Tidligere, Kjøreplan, Opprett arrangement.",
  etterLagring:
    "«Nytt arrangement opprettet og lagt i kalenderen!» Ved kopi: «Nytt arrangement opprettet for [dato] med [antall] oppgaver klonet!» «Tittel og dato må fylles ut». «Opprett en gruppe først. Arrangementene må ha en gruppe å ligge i.»",
};

const bemanning: HelpArticle = {
  id: "bemanning",
  title: "Bemanning",
  layout: "wide",
  formal: "Fikse forfall og fylle ledige roller på et arrangement, også fra mobilen.",
  hvor: "Oversikt i Planlegging viser de neste arrangementene. Trykk på ett, så åpnes Bemanning. Arrangementet har to visninger: Program og Bemanning.",
  steg: [
    "Program viser programpostene med rolle, team, tema og hvem som er satt opp. Her endres ikke bemanningen.",
    "Bemanning viser hver rolle én gang, også når den brukes i flere programposter. Øverst står Må ordnes: forfall og ubesatte roller. Resten står per team.",
    "Trykk på en person for å endre: Bekreftet, Forespurt, Forfall eller Slett. Har personen telefonnummer, ringer du ved å trykke på navnet øverst.",
    "Har en rolle en ledig plass, står Tildel og Forespør under den. Tildel setter personen på som bekreftet (avtalt allerede). Forespør sender en forespørsel til Min side.",
    "Et bytte: trykk på den som ikke kan og velg Forfall. Trykk så Tildel på samme rolle og velg den nye.",
    "Trykk på rollenavnet for å se instruksen.",
    "En gruppeleder ser hele programmet, og bemanningen til sine egne grupper.",
  ],
  knapper:
    "Program, Bemanning, Tildel, Forespør, Bekreftet, Forespurt, Forfall, Slett. Merker: Forfall, Ubesatt, Venter på svar, Dekket.",
  etterLagring:
    "«[Navn]: Forfall», «[Navn] er tildelt [rolle].», «[Navn] er forespurt som [rolle].», «[Navn] er slettet fra oppgaven.» En rolle du nettopp har endret, blir stående der den er til du åpner arrangementet igjen.",
};

const oppgaver: HelpArticle = {
  id: "oppgaver",
  title: "Trenger oppfølging",
  layout: "wide",
  formal: "Se forfall og ubesatte roller på arrangementene som kommer, og tildele en person.",
  hvor: "Planlegging, Trenger oppfølging. Overskrift: Trenger oppfølging. Tallet i menyen er det som må ordnes de nærmeste fire ukene.",
  steg: [
    "Oppgavene står per arrangement, det nærmeste først. Trykk på arrangementet for å åpne Bemanning.",
    "Velg Må ordnes, Venter på svar eller Alle, og 4 uker eller Alt som kommer.",
    "Trykk Tildel eller Forespør på en oppgave, velg person og bekreft.",
  ],
  knapper:
    "Må ordnes, Venter på svar, Alle, 4 uker, Alt som kommer, Bemanning, Tildel, Forespør, Rediger. Merket Under 48 t står på forfall og ubesatte roller når arrangementet er under to døgn unna.",
  etterLagring:
    "«Personen er tildelt.» eller «Forespørselen er sendt.» Uten person: «Velg en person».",
};

const grupper: HelpArticle = {
  id: "grupper",
  title: "Grupper & Husfellesskap",
  layout: "wide",
  formal: "Opprette en gruppe og sette leder, nestleder og deltakere.",
  hvor: "Planlegging, Grupper & Husfellesskap. Overskrift: Grupper & Fellesskap. Detalj: Administrer gruppe, merket Gruppeadministrasjon. Tilbake: Tilbake til grupper.",
  steg: [
    "Trykk Opprett ny gruppe.",
    "Skriv navn, velg type, leder og eventuell beskrivelse.",
    "Trykk Opprett gruppe.",
    "Filtrer med Alle, Ledergrupper, Strategigrupper, Tjenestegrupper, Husgrupper eller Interessegrupper.",
    "Åpne gruppen. Sett Leder og Nestleder, legg til deltakere med Legg til deltaker, eller Fjern.",
    "Trykk Lagre endringer for gruppen.",
  ],
  knapper:
    "Ledergruppe, Strategigruppe, Tjenestegruppe, Husgruppe, Interessegruppe. Plassholder: «f.eks. Turgruppe & Friluft eller Vekstgruppe Bønn». Felt: Leder. På kortet: «Leder: [navn]» eller «Ikke satt». I detalj: Deltakere i gruppen, merker Leder, Nestleder, Deltaker.",
  etterLagring:
    "«Gruppen [navn] ble opprettet!» Kortet viser antall deltakere og leder. «Gruppen må ha et navn».",
};

const personer: HelpArticle = {
  id: "personer",
  title: "Personer",
  layout: "wide",
  formal: "Holde kontaktinfo, tilgang, fravær og offentlig profil oppdatert for én person.",
  hvor: "Planlegging, Personer. Overskrift: Personregister. Åpne med Åpne i tabellen eller Rediger person & fravær i kortvisning. Merket Personkort. Tilbake: Tilbake til personregister.",
  steg: [
    "Søk, eller bytt mellom Kort og Tabell.",
    "Åpne personen.",
    "Oppdater navn, telefon, e-post, tilgang, Politiattest (gyldig til dato) og fravær.",
    "Under Offentlig profil på nettsiden bestemmer du hva som kan vises utad.",
    "Trykk Lagre alle personopplysninger & tilganger.",
    "For å hente inn mange fra Cornerstone: eksporter personene som CSV, trykk Hent inn fra Cornerstone og velg filen. Du ser hvem som blir lagt inn før noe lagres. Bare navn, e-post, telefon, fødselsdato og medlemskap hentes. Er filen en Excel-fil, lagrer du den som CSV i Excel først.",
  ],
  knapper:
    "Søk: «Søk etter navn, gruppe, tilgang eller kontaktinfo...» Kolonner: Navn, Tilgang, Grupper, E-post, Telefon, Handling. Merker: GRUPPELEDER, NESTLEDER, FRIVILLIG, ADMINISTRATOR. FRIVILLIG står bare på den som er med i en tjenestegruppe; den som ikke er det, har en strek. Filteret Ikke i noen tjenestegruppe viser dem du kan spørre.",
  etterLagring:
    "Fravær som legges til, bekreftes med «Fraværsperiode lagt til!» Offentlig visning krever at offentlig profil er slått på.",
};

const analysebord: HelpArticle = {
  id: "analysebord",
  title: "Analysebord",
  layout: "wide",
  formal:
    "Se menighetens liv i tall over en periode: oppmøte på gudstjenestene, frivillighet og bemanning, grupper og fellesskap, personregisteret og nettsiden. Hvert tall sammenlignes med perioden før.",
  hvor: "Planlegging, Analysebord. Overskrift: Analysebord.",
  steg: [
    "Velg periode: Siste 4 uker, Siste 3 måneder eller Siste 12 måneder.",
    "Under Oppmøte: trykk på en søyle, eller Registrer i listen Mangler oppmøtetall, for å skrive inn hvor mange som var til stede.",
    "Fyll inn Voksne og Barn, og eventuelt Merknad (valgfritt). Trykk Lagre oppmøtetall.",
    "Bytt mellom Gudstjenester og Alle arrangementer, eller trykk Vis som tabell for å se tallene i en tabell.",
    "Trykk Last ned CSV for å hente oppmøtetallene til et regneark, f.eks. til årsmeldingen.",
    "Les Kan trenge avlastning og Ikke brukt i perioden før neste vaktliste lages. Navnene åpner personkortet.",
    "Bemanning per arrangement viser hvor mange samlinger som hadde alle plasser bekreftet, og hvilke som manglet folk.",
    "Flere oppgaver på samme samling viser hvem som har hatt to eller flere oppgaver på samme samling, for eksempel bilde og møteleder, og de vanligste kombinasjonene. Der kjøreplanen har klokkeslett for oppgavene, sies det fra om to av dem er samtidig.",
    "Oppgaver og aktiviteter per måned viser hvor stor del av menigheten som har 0, 1, 2 … 8 eller flere i en vanlig måned. Bytt mellom Oppgaver og Aktiviteter.",
    "Hver enkelt er en tabell per person. Velg Sorter etter, eller huk av Bare de som har vært med.",
    "Trykk Tilpass bordet for å velge hvilke moduler du vil se, eller trykk øyet øverst til høyre på en modul for å skjule den. Vis alle tar alt tilbake.",
    "Datagrunnlag nederst sier hva tallene bygger på, og hva som ikke er målt.",
  ],
  knapper:
    "Siste 4 uker, Siste 3 måneder, Siste 12 måneder, Tilpass bordet, Gudstjenester, Alle arrangementer, Vis som tabell, Vis som diagram, Last ned CSV, Registrer, Endre, Oppgaver, Aktiviteter, Sorter etter, Bare de som har vært med, Vis alle. I vinduet for oppmøte: Registrer oppmøtetall eller Endre oppmøtetall, Lagre oppmøtetall, Avbryt, Fjern tellingen. I Tilpass bordet: en avkrysning per modul, Vis alle og Ferdig. En samling uten tall vises som en lav grå strek merket Ikke registrert.",
  etterLagring:
    "«Oppmøtetallet for «[samling]» er lagret.» Søylen og snittet oppdateres med en gang. Ved fjerning: «Oppmøtetallet for «[samling]» er fjernet.» Uten tall: «Skriv inn hvor mange som var til stede.» Når en modul skjules: ««[modul]» er skjult. Du får den tilbake under Tilpass bordet.» Valget lagres på den aktive brukeren. Under Database og Testdata kan du simulere et halvår med menighetsliv for å prøve bordet.",
};

export const helpSections: HelpSection[] = [
  {
    title: "For nettsideredaktører",
    items: [
      {
        kind: "menu",
        title: "Sider & Innhold",
        articles: [siderSidetre, siderInnstillinger, siderHero, siderInnhold, siderPublisering, siderSok],
      },
      { kind: "article", article: nyheter },
      { kind: "article", article: taler },
      { kind: "article", article: lederskap },
      { kind: "article", article: mediebibliotek },
      { kind: "article", article: forside },
    ],
  },
  {
    title: "For planleggere og administratorer",
    items: [
      { kind: "article", article: arrangementer },
      { kind: "article", article: bemanning },
      { kind: "article", article: oppgaver },
      { kind: "article", article: grupper },
      { kind: "article", article: personer },
    ],
  },
  {
    title: "Innsikt",
    items: [{ kind: "article", article: analysebord }],
  },
];

export const defaultHelpArticleId = siderSidetre.id;

/** The article help opens on when nothing is asked for: the first one for the part of the admin that is open. */
export const firstHelpArticleIdFor = (area: "planlegging" | "nettside"): string =>
  area === "planlegging" ? arrangementer.id : defaultHelpArticleId;

export function helpArticles(): HelpArticle[] {
  return helpSections.flatMap((section) =>
    section.items.flatMap((item) => (item.kind === "article" ? [item.article] : item.articles))
  );
}

export function findHelpArticle(id: string): HelpArticle {
  return helpArticles().find((article) => article.id === id) ?? siderSidetre;
}
