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
  hvor: "Sidemeny, Nettside & CMS, Sider & Innhold. Overskriften på siden er «Sider & Innhold på nettsiden».",
  steg: [
    "Velg Ny hovedfane eller Legg til fane.",
    "På en eksisterende hovedfane: opprett underfane, velg Rediger, eller slett.",
    "Dra faner for å endre rekkefølge.",
    "Bruk statusknappene i treet for å publisere eller sette en side til kladd.",
  ],
  knapper:
    "Ny hovedfane, Legg til fane, Rediger, Design, Åpne nettside, Hovedmeny (Offentlig nettsted). Slett har tittelen Slett fane eller Slett underside. Underfane: «Opprett ny underfane som legger seg under denne fanen».",
  etterLagring:
    "«Siden ble lagret og menystrukturen ble oppdatert!» Ved flytting: «Menyrekkefølgen ble oppdatert!» Ved publisering: «[tittel] er nå publisert på nettsiden!» Ved kladd: «[tittel] er satt til kladd (upublisert).» Ved sletting: «Siden ble slettet». Uten tittel: «Siden må ha en tittel».",
};

const siderInnstillinger: HelpArticle = {
  id: "sider-innstillinger",
  title: "Sideinnstillinger",
  layout: "wide",
  formal: "Gi siden navn, adresse og plass i menyen.",
  hvor: "Samme fane, i vinduet som åpnes ved Ny hovedfane, Legg til fane eller Rediger.",
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
  ],
  knapper:
    "Hero / Toppbanner, Tittel i Hero, Primærknapp, Sekundærknapp, Vis på siden. Plassholder for knappetekst: «Knappetekst». På forsiden brukes «Se hva som skjer» og «Bli kjent med oss» som plassholdere.",
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
    "Trykk Lagre side. Avbryt lukker uten å lagre.",
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
  hvor: "Sidemeny Aktuelt & Nyheter. Overskrift på siden: Aktuelt & Nyhetsartikler.",
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
  hvor: "Sidemeny Taler & Prekener. Overskrift: Taler & Prekenarkiv.",
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
  hvor: "Sidemeny Lederskap & Stab. Overskriften er den samme.",
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
  hvor: "Sidemeny Mediebibliotek. Samme bibliotek åpnes fra bildevelgeren mens du redigerer en side.",
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
  hvor: "Sidemeny Arrangementer på nettsiden, under Nettside & CMS. Hvert arrangement viser om det mangler bilde eller tekst. Bilde og tekst åpner arrangementets skjema, på delen På nettsiden.",
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
  title: "Arrangementer",
  layout: "wide",
  formal: "Legge inn en samling og åpne kjøreplanen for oppgaver den dagen.",
  hvor: "Sidemeny, Arrangementer & Bemanning, Arrangementer. Overskrift: Gudstjenester & Møter. Kjøreplan merkes Kjøreplan. Tilbake-lenke: Tilbake til arrangementer.",
  steg: [
    "Under Opprett ny samling: skriv tittel, dato og klokkeslett. Tema er valgfritt.",
    "Velg Ansvarlig gruppe.",
    "Huk av Dette er en gudstjeneste hvis det gjelder.",
    "Trykk Legg til i planleggeren.",
    "Trenger arrangementet mer enn dette, trykk Flere valg. Da åpnes hele skjemaet, med det du har skrevet: sluttid, slutt en annen dag, sted, bibeltekst og hvem som ser arrangementet.",
    "Start fra en mal i det store skjemaet fyller ut skjemaet, og arrangementet får malens program og oppgaver. På et arrangement som allerede finnes bruker du Hent fra mal i kjøreplanen. Rediger malen (penn på malen, eller Rediger malen før du oppretter) åpner malen før arrangementet lages. Malene lages under Maler i menyen, eller med Lag mal på et arrangement som alt er satt opp.",
    "Gjenta som serie: velg hvor ofte og siste dato. Dagene vises med hake, og en dag kan tas ut før serien opprettes. Slett resten av serien står på hvert arrangement i en serie.",
    "For å gjenta et arrangement: åpne neste arrangement, sett ny dato, og bekreft. Oppgavene kopieres uten personer.",
    "På kjøreplanen: Rediger åpner det samme store skjemaet, der arrangementet også kan avlyses. Med hele programmet i visning kan admin dra i håndtaket på en programpost for å flytte den. Ny oppgave, Skriv ut. Overskrift: Kjøreplan & «Hvem gjør hva».",
  ],
  knapper:
    "Plassholder tittel: «Tittel, f.eks. Søndagsgudstjeneste & dåp». Plassholder tema: «Valgfritt tema...». Tom gruppe: «Ingen grupper finnes ennå». Knapp: Legg til i planleggeren.",
  etterLagring:
    "«Ny samling opprettet og synkronisert til kalenderen!» Ved kopi: «Nytt arrangement opprettet for [dato] med [antall] oppgaver klonet!» «Tittel og dato må fylles ut». «Opprett en gruppe først. En samling må ha en ansvarlig gruppe.»",
};

const oppgaver: HelpArticle = {
  id: "oppgaver",
  title: "Trenger oppfølging",
  layout: "wide",
  formal: "Se hvilke oppgaver som mangler folk, tildele en person, eller lage en påminnelsestekst.",
  hvor: "Sidemeny Trenger oppfølging. Overskrift: Oppgaver & Frivilligoversikt. Detalj merkes Oppgavekort. Tilbake: Tilbake til oppgaver.",
  steg: [
    "Filtrer med Alle oppgaver, Trenger oppfølging / Vikar eller Venter på svar / Ubesatt. De to siste viser bare samlinger som ikke er over. Alle oppgaver viser også dem som er holdt.",
    "Trykk Tildel eller Forespør på en oppgave.",
    "Velg person. Tildel direkte setter personen som bekreftet. Forespør setter status til venter på svar.",
    "Bekreft med Tildel oppgave (Bekreftet) eller Forespør frivillig (Venter på svar).",
    "Purr åpner Purr / Send påminnelse. Trykk Kopier tekst.",
  ],
  knapper:
    "Tildel, Forespør, Tildel direkte, Purr. Hjelp: «Setter status umiddelbart til Bekreftet. Brukes når du allerede har avtalt vakten muntlig med personen.» Purr: «Purr / generer SMS- og Messenger-tekst».",
  etterLagring:
    "«Personen ble tildelt og bekreftet!» eller «Forespørsel ble sendt (status: venter på svar)!» «Purretekst kopiert til utklippstavlen!» Uten person: «Vennligst velg en person». Påminnelsen kopieres. Den sendes ikke som melding herfra.",
};

const grupper: HelpArticle = {
  id: "grupper",
  title: "Grupper & Husfellesskap",
  layout: "wide",
  formal: "Opprette en gruppe og sette leder, nestleder og medlemmer.",
  hvor: "Sidemeny Grupper & Husfellesskap. Overskrift: Grupper & Fellesskap. Detalj: Administrer gruppe, merket Gruppeadministrasjon. Tilbake: Tilbake til grupper.",
  steg: [
    "Trykk Opprett ny gruppe.",
    "Skriv navn, velg type, leder og eventuell beskrivelse.",
    "Trykk Opprett gruppe.",
    "Filtrer med Alle, Ledergrupper, Strategigrupper, Tjenestegrupper, Husgrupper eller Interessegrupper.",
    "Åpne gruppen. Sett Leder og Nestleder, legg til medlemmer med Legg til, eller Fjern.",
    "Trykk Lagre endringer for gruppen.",
  ],
  knapper:
    "Ledergruppe, Strategigruppe, Tjenestegruppe, Husgruppe, Interessegruppe. Plassholder: «f.eks. Turgruppe & Friluft eller Vekstgruppe Bønn». Felt: Leder. På kortet: «Leder: [navn]» eller «Ikke satt». I detalj: Medlemmer i gruppen, merker Leder, Nestleder, Medlem.",
  etterLagring:
    "«Gruppen [navn] ble opprettet!» Kortet viser medlemstall og leder. «Gruppen må ha et navn».",
};

const personer: HelpArticle = {
  id: "personer",
  title: "Personer",
  layout: "wide",
  formal: "Holde kontaktinfo, tilgang, fravær og offentlig profil oppdatert for én person.",
  hvor: "Sidemeny Personer. Overskrift: Personregister. Åpne med Åpne i tabellen eller Rediger person & fravær i kortvisning. Merket Personkort. Tilbake: Tilbake til personregister.",
  steg: [
    "Søk, eller bytt mellom Kort og Tabell.",
    "Åpne personen.",
    "Oppdater navn, telefon, e-post, tilgang, Politiattest (gyldig til dato) og fravær.",
    "Under Offentlig profil på nettsiden bestemmer du hva som kan vises utad.",
    "Trykk Lagre alle personopplysninger & tilganger.",
  ],
  knapper:
    "Søk: «Søk etter navn, gruppe, tilgang eller kontaktinfo...» Kolonner: Navn, Tilgang, Grupper, E-post, Telefon, Handling. Tilgangsmerker: GRUPPELEDER, NESTLEDER, MEDLEM, ADMINISTRATOR.",
  etterLagring:
    "Fravær som legges til, bekreftes med «Fraværsperiode lagt til!» Offentlig visning krever at offentlig profil er slått på.",
};

const analysebord: HelpArticle = {
  id: "analysebord",
  title: "Analysebord",
  layout: "wide",
  formal:
    "Se menighetens liv i tall over en periode: oppmøte på gudstjenestene, frivillighet og bemanning, grupper og fellesskap, personregisteret og nettsiden. Hvert tall sammenlignes med perioden før.",
  hvor: "Sidemeny Innsikt, Analysebord. Overskrift: Analysebord.",
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

export function helpArticles(): HelpArticle[] {
  return helpSections.flatMap((section) =>
    section.items.flatMap((item) => (item.kind === "article" ? [item.article] : item.articles))
  );
}

export function findHelpArticle(id: string): HelpArticle {
  return helpArticles().find((article) => article.id === id) ?? siderSidetre;
}
