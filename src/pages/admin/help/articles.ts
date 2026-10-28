import type { StudioTab } from "../studio";
import type { StudioArea } from "../studioAreas";

// Hjelp in the admin: one article per task, in the order of the admin menu. Each has the way there,
// a picture from the demo, a few short steps, and a line on what is good to know or to watch out for.
// A button or field is written **like this**, as it is named in the app, and shown in bold; a test
// checks that each such name is found in the app, so the help never points to a button that is gone.

export interface HelpArticle {
  id: string;
  title: string;
  /** The way there, as in the menu: «Nettside → Aktuelt & Nyheter». */
  hvor: string;
  /** One sentence: what the task is for. */
  intro: string;
  steg: string[];
  /** The most useful thing to know, in one to three sentences. */
  godt?: string;
  /** Only where something can go wrong. */
  passPa?: string;
  /** Articles that belong together. */
  seOgsa?: string[];
  /** The admin tabs whose help opens on this article. */
  tabs?: StudioTab[];
  /** Shown only while this add-on module is on, as its tab is. */
  addon?: "analysebord" | "nettsidebesok";
  /** Without a picture: the tab is not in the demo, where the pictures are taken. */
  utenBilde?: boolean;
}

export interface HelpSection {
  title: string;
  items: HelpNavItem[];
}

export type HelpNavItem =
  | { kind: "article"; article: HelpArticle }
  | { kind: "menu"; title: string; articles: HelpArticle[] };

// ---------------------------------------------------------------- Kom i gang

const komIGang: HelpArticle = {
  id: "kom-i-gang",
  title: "Slik er admin bygget",
  hvor: "Menyen til venstre",
  intro: "Admin har to deler: Planlegging, der arrangementene og de frivillige ligger, og Nettside, der nettsiden lages.",
  steg: [
    "Velg **Planlegging** eller **Nettside** øverst i menyen. Menyen under viser fanene i den delen.",
    "Under Nettside: **Sider & Innhold** for menyen og sidene, **Aktuelt & Nyheter**, **Taler & Prekener**, **Lederskap & Stab**, **Mediebibliotek**, **Tema & Designsystem** og **Nettside-innstillinger**.",
    "Under Planlegging: **Kalender**, **Trenger oppfølging**, **Grupper & Husfellesskap**, **Personer**, **Maler**, **Årshjul**, **Send e-post** og **Roller**.",
    "**Åpne offentlig nettside** viser nettsiden i en ny fane. **Gå til Min Side** viser din egen side som frivillig.",
  ],
  godt: "Arrangementene legges inn én gang, i kalenderen under Planlegging, og vises på nettsiden av seg selv. Sol eller måne øverst i menyen bytter mellom lyst og mørkt utseende på admin.",
  seOgsa: ["nytt", "tips"],
  tabs: ["dashboard"],
};

const nytt: HelpArticle = {
  id: "nytt",
  title: "Nytt i oktober",
  hvor: "Nettside → Sider & Innhold, Aktuelt & Nyheter og Mediebibliotek",
  intro: "Det som er nytt i nettsidedelen av admin høsten 2026.",
  steg: [
    "**Historikk** i redigeringen av en side eller en nyhet henter fram en tidligere versjon.",
    "Teksten i en blokk skrives med knapper for overskrift, fet, kursiv, lister og lenke, uten tegn.",
    "Har du endret noe uten å lagre, står det **Ikke lagret** ved fanen i menyen, og admin spør før du går.",
    "Trykk på en seksjon i forhåndsvisningen, så åpnes den i redigeringen. Valgene i en modul vises med en gang.",
    "Opplastede bilder lagres i et eget bildelager, ikke inne i sidene.",
    "En nyhet uten siste dag gir et spørsmål om når den skal gå ut.",
  ],
  seOgsa: ["sider-lagre", "sider-innhold", "nyheter", "mediebibliotek"],
  utenBilde: true,
};

const tips: HelpArticle = {
  id: "tips",
  title: "Seks tips for den som redigerer",
  hvor: "Gode vaner",
  intro: "Det som gjør nettsiden god å lese, og arbeidet lett å holde i orden.",
  steg: [
    "Se på mobil: de fleste leser på telefonen. Velg **Mobil** i forhåndsvisningen.",
    "Korte avsnitt: én tanke per avsnitt, og en overskrift der det skifter.",
    "Bilder som passer: liggende bilder, og bare personer som har sagt ja.",
    "Én kilde: arrangementer legges inn i kalenderen, ikke skrives på en side.",
    "Gi nyheter en siste dag, så går de ut av forsiden av seg selv.",
    "Lagre ofte. Lagret noe feil, finner du det igjen under **Historikk**.",
  ],
  godt: "Valget mellom lyst og mørkt gjelder bare admin. Nettsidens farger velges under Tema & Designsystem.",
  seOgsa: ["kom-i-gang"],
  utenBilde: true,
};

// ---------------------------------------------------------------- Nettside: Sider & Innhold

const siderSidetre: HelpArticle = {
  id: "sider-sidetre",
  title: "Menyen og sidene",
  hvor: "Nettside → Sider & Innhold → Sidestruktur",
  intro: "Sider & Innhold har to visninger. I **Rediger** arbeider du med innholdet på én side. I **Sidestruktur** ordner du menyen: hovedfaner med underfaner, i den rekkefølgen de står på nettsiden.",
  steg: [
    "Trykk **Sidestruktur** øverst. Bryteren husker hvilken visning du brukte sist.",
    "Dra en side for å flytte den, eller bruk pilene opp og ned.",
    "Den runde **+** øverst lager en ny hovedfane. **+ Underfane** på en fane lager en side under den. Kopier-knappen lager en kopi som kladd. Den nye siden åpnes i Rediger.",
    "Trykk på statusen for å publisere en side eller sette den til kladd. Før en side tas bort fra nettsiden, blir du spurt.",
    "Trykk **I toppmeny** eller **I meny** for å ta siden ut av menyen, og trykk igjen for å vise den. Siden finnes fortsatt på sin adresse.",
    "**Rediger** på en rad åpner siden i Rediger. Øyet viser siden i ny fane, også en kladd.",
  ],
  godt: "Menylinjen øverst er nettsidens meny: trykk en fane, så ruller listen dit. **Kollaps alle** og **Utvid alle** viser eller skjuler underfanene.",
  seOgsa: ["sider-redigere", "sider-publisering"],
  tabs: ["cms-sider"],
};

const siderRedigere: HelpArticle = {
  id: "sider-redigere",
  title: "Redigere en side",
  hvor: "Nettside → Sider & Innhold → Rediger",
  intro: "Redigeringen viser sidens seksjoner, feltene til den du har valgt, og nettsiden slik den blir.",
  steg: [
    "Sider & Innhold åpner i **Rediger**, med siden du redigerte sist, eller Forsiden. Trykk en fane i menylinjen over redigeringen for å gå til en annen side. På smal skjerm velger du siden i listen **Side**. Adminmenyen til venstre blir smal med bare ikoner, så redigeringen får plass. **››** øverst åpner den igjen.",
    "**⋯** ved Historikk har **Kopier siden** og **Slett siden**. **×** lukker siden og går til Sidestruktur.",
    "Velg **Rediger**, **Splitt** eller **Forhåndsvis**. Splitt viser nettsiden ved siden av feltene. Dra streken mellom feltene og nettsiden for å gjøre feltene bredere, og dobbeltklikk på den for standard. De tre A-ene øverst gjør teksten i feltene større.",
    "Listen **Seksjoner** viser alt på siden: sideinnstillinger, toppbildet, hver blokk, søk og deling, og publisering. Trykk på en seksjon, så vises bare feltene til den, og forhåndsvisningen viser den.",
    "Dra en blokk i listen for å endre rekkefølgen. Øyet ved en blokk skjuler den på nettsiden uten å slette den. **Legg til blokk eller modul** nederst setter inn tekst, bilde eller en ferdig modul.",
    "Trykk på en seksjon i forhåndsvisningen, så åpnes feltene til den.",
  ],
  godt: "Er skjermen smal, står seksjonene under hverandre, og **Gå til seksjon** øverst hopper dit. **‹‹** i listen skjuler den, og **Seksjoner** øverst viser den igjen. Se siden som **Desktop**, **Nettbrett** eller **Mobil**.",
  passPa: "Et nytt bilde vises i forhåndsvisningen først etter lagring. Det står en melding over forhåndsvisningen når det er slik.",
  seOgsa: ["sider-innhold", "sider-lagre"],
};

const siderInnhold: HelpArticle = {
  id: "sider-innhold",
  title: "Tekst og blokker",
  hvor: "Nettside → Sider & Innhold → Rediger → Rediger innhold",
  intro: "En side er bygget av blokker. Teksten i en blokk skrives slik den skal se ut, med knapper over feltet.",
  steg: [
    "Trykk på tittelen eller teksten i en blokk, eller **Rediger innhold**.",
    "Skriv i feltet **Tekst**. Merk ord og trykk **Fet**, **Kursiv** eller **Lenke**.",
    "I en tekstblokk lager **Overskrift** og **Underoverskrift** overskrifter, og **Punktliste** og **Nummerert liste** lister.",
    "**Lenke**: merk ordene, skriv adressen eller velg en side, og trykk **Bruk**.",
    "Forhåndsvisningen viser teksten med en gang. Trykk **Ferdig**, og lagre siden til slutt.",
    "Under feltene står **Utseende** (bakgrunn, hvit tekst og luft) og **Når den vises** (Vis fra og Vis til). Lukket viser de hva som er satt. En blokk med periode får et merke i Seksjoner, og den kommer og går på nettsiden av seg selv.",
  ],
  godt: "Skriv / på en tom linje i en tekstblokk for å gjøre den til overskrift eller liste. I bilde med tekst, infoboks og kort er det bare Fet, Kursiv og Lenke, fordi nettsiden bare viser det der. **Vis som tekst** viser tegnene (## og -) for den som vil skrive dem selv.",
  passPa: "Har teksten tegn feltet ikke har knapper for, for eksempel et sitat, vises den som vanlig tekst med en melding. Ingenting blir borte.",
  seOgsa: ["sider-redigere", "sider-moduler"],
};

const siderLagre: HelpArticle = {
  id: "sider-lagre",
  title: "Lagre, Historikk og advarselen",
  hvor: "Nettside → Sider & Innhold → Rediger",
  intro: "Siden blir stående åpen når du lagrer, og en tidligere versjon kan hentes tilbake.",
  steg: [
    "Trykk **Lagre** øverst, eller **Lagre side** nederst, eller Ctrl+S. Lukk med X eller **Avbryt**.",
    "Har du endret noe, spør admin før siden lukkes: **Lagre**, **Forkast endringene** eller **Bli her**.",
    "Lagret noe feil? **Historikk** øverst viser de 30 siste versjonene. **Gjenopprett** legger en versjon inn i redigeringen.",
    "Trykk **Lagre** for å beholde versjonen du hentet tilbake.",
  ],
  godt: "Går du til en annen fane, blir det du skrev liggende, og menyen viser **Ikke lagret** ved fanen. **Gå til Min Side**, **Logg ut** og nettleseren spør før noe går tapt. Ble nettleseren lukket likevel, tilbys det ulagrede utkastet neste gang siden åpnes: **Hent tilbake utkastet**. Historikk viser hva hver versjon har annerledes enn nå.",
  seOgsa: ["sider-redigere", "nyheter"],
};

const siderHero: HelpArticle = {
  id: "sider-hero",
  title: "Toppbildet på forsiden",
  hvor: "Nettside → Sider & Innhold → Forside → Rediger → Hero / Toppbanner",
  intro: "Toppbildet er det første besøkende ser: bilde, tittel og meny.",
  steg: [
    "**Menyen øverst** står først: over bildet, eller som en hvit linje med bildet under. Den kan velges når forsiden har et bakgrunnsbilde.",
    "Velg bakgrunnsbildet. Under **Endre utsnitt** drar du rammen dit bildet skal vises, og **Zoom** går nærmere. **Tilbakestill** gir hele bildet igjen. **Høyde på toppbildet** og **Slør over bildet** står rett under, og bilde 2 og 3 kan få egen tittel.",
    "Skriv **Tittel i Hero**, og velg **Tekststørrelse på tittelen**, **Skrift på tittelen** og hvordan **Tittelen på bildet** skal stå.",
    "Undertittel og knapper kommer til slutt, i samme rekkefølge som på forsiden.",
  ],
  godt: "Undertittel og knapper er av til du huker av **Vis på siden**. Prikker under bildet kommer av seg selv, piler slår du på.",
  passPa: "Et bilde med tekst på kan kuttes i kantene. Bruk helst bilder uten tekst i toppbildet.",
  seOgsa: ["sider-redigere", "innstillinger"],
};

const siderModuler: HelpArticle = {
  id: "sider-moduler",
  title: "Modulene",
  hvor: "Nettside → Sider & Innhold → Rediger → Legg til blokk eller modul",
  intro: "En modul fyller seg selv fra der innholdet hører hjemme: kalenderen, nyhetene, talene eller gruppene.",
  steg: [
    "Trykk **Legg til blokk eller modul**. Finn for eksempel **Neste gudstjeneste**, **Hva skjer**, **Kalender**, **Kart** eller **Bildegalleri**, og trykk **Sett inn denne blokken**.",
    "Trykk **Rediger innhold** på modulen. Endre tittel, merkelapp, tekst, bakgrunnsbilde eller bakgrunnsfarge.",
    "Forhåndsvisningen viser valgene med en gang. Trykk **Ferdig**, og lagre siden til slutt.",
    "**Kart**: skriv adressen og trykk **Finn på kartet**. **Bildegalleri**: legg til bilder fra biblioteket. **Neste gudstjeneste** kan vise en nedtelling med **Vis nedtelling**.",
  ],
  godt: "Innholdet i en modul endres der det hører hjemme: en tale under Taler & Prekener, en nyhet under Aktuelt & Nyheter, et arrangement i kalenderen.",
  seOgsa: ["sider-hvaskjer", "nyheter", "taler"],
};

const siderHvaSkjer: HelpArticle = {
  id: "sider-hvaskjer",
  title: "Hva skjer",
  hvor: "Nettside → Sider & Innhold → Forside → Rediger → Hva skjer → Rediger innhold",
  intro: "Hva skjer viser de neste arrangementene fra kalenderen som kort.",
  steg: [
    "Velg antall og hvilke arrangementer: alle, gudstjenester, fremhevede eller én gruppe.",
    "Velg oppsett: rutenett, liste, karusell, eller ett stort og resten små.",
    "Kryss av for ingress, klokkeslett og sted. Velg **Bevegelse når kortene kommer til syne** og et **Standardbilde**.",
    "Under **Arrangementene som vises nå**: **Bilde og tekst** der det mangler.",
  ],
  godt: "Trykk på et kort i forhåndsvisningen for å åpne Bilde og tekst for det arrangementet. Standardbildet vises bare på arrangementer uten eget bilde.",
  seOgsa: ["forside", "sider-moduler"],
};

const siderPublisering: HelpArticle = {
  id: "sider-publisering",
  title: "Publisering",
  hvor: "Nettside → Sider & Innhold → Rediger → Publisering & Synlighet",
  intro: "Bestem om siden vises, om den står i menyen, og om den skal vente til et tidspunkt.",
  steg: [
    "**Aktiver publisering** viser siden på nettsiden.",
    "**Vis i offentlig meny** legger den i menyen. Uten den nås siden bare med lenken.",
    "Skal siden komme senere, sett **Publiseringsdato & tidspunkt (Planlegging)**, eller trykk **I morgen 09:00**.",
    "Trykk **Lagre**.",
  ],
  godt: "En kladd vises ikke på nettsiden. En planlagt side kommer av seg selv på tidspunktet.",
  seOgsa: ["sider-sidetre", "sider-sok"],
};

const siderSok: HelpArticle = {
  id: "sider-sok",
  title: "Søk og deling",
  hvor: "Nettside → Sider & Innhold → Rediger → Søkemotoroptimalisering (SEO) & Delingskort",
  intro: "Bestem hva Google viser, og hvordan siden ser ut når noen deler lenken.",
  steg: [
    "Åpne **Søkemotoroptimalisering (SEO) & Delingskort** nederst i redigeringen.",
    "Skriv en kort beskrivelse, eller trykk **Bruk som SEO-beskrivelse** for å bruke ingressen.",
    "Velg et delebilde, eller la det stå tomt, så brukes toppbildet.",
    "Trykk **Lagre**.",
  ],
  godt: "En beskrivelse på 150–160 tegn passer best i Google. Et delebilde som er liggende, vises best på Facebook.",
  seOgsa: ["sider-publisering", "mediebibliotek"],
};

// ---------------------------------------------------------------- Nettside: de andre fanene

const forside: HelpArticle = {
  id: "forside",
  title: "Arrangementer på nettsiden",
  hvor: "Nettside → Arrangementer på nettsiden",
  intro: "Gi arrangementene bilde og tekst, og bestem hvilke som løftes fram, vises eller holdes interne.",
  steg: [
    "Se etter arrangementer merket «Mangler bilde og tekst», «Mangler bilde» eller «Mangler tekst». **Har bilde og tekst** betyr at alt er på plass.",
    "Trykk **Bilde og tekst**. Velg et liggende bilde, og skriv en kort ingress. Trykk **Lagre endringer**.",
    "**Fremhev** løfter arrangementet fram på forsiden. **Offentlig** viser det i kalenderen. **Kun intern** skjuler det fra nettsiden.",
    "Er arrangementet laget fra en mal med bilde: **Bruk malens bilde**, eller **Gi dem bildet fra malen** for alle på en gang.",
  ],
  godt: "Bildet vises på kortet på forsiden og på arrangementets egen side. Hvert arrangement i en serie har sitt eget bilde.",
  seOgsa: ["sider-hvaskjer", "arrangementer", "maler"],
  tabs: ["cms-overstyringer"],
};

const nyheter: HelpArticle = {
  id: "nyheter",
  title: "Aktuelt & Nyheter",
  hvor: "Nettside → Aktuelt & Nyheter",
  intro: "Nyheter vises på forsiden og i nyhetslisten, og kan gå ut av seg selv.",
  steg: [
    "Trykk **Ny artikkel**. Skriv tittel, ingress og tekst, og velg kategori og bilde.",
    "Handler nyheten om et arrangement i kalenderen, velg det under **Hører til arrangement (valgfritt)**. Da går nyheten ut dagen etter.",
    "Ellers: sett siste dag i **Vises til og med (valgfritt)**.",
    "Trykk **Lagre artikkel**. **Historikk** viser tidligere versjoner.",
  ],
  godt: "Lagrer du uten siste dag og uten arrangement, spør admin når nyheten skal gå ut, og foreslår datoen teksten nevner. En nyhet som er gått ut, er merket **Utløpt** i listen, og lenken virker fortsatt.",
  passPa: "En nyhet uten siste dag blir stående på forsiden til noen fjerner den. Velg **Lagre uten siste dag** bare for saker som skal stå.",
  seOgsa: ["sider-lagre", "arrangementer"],
  tabs: ["cms-nyheter"],
};

const taler: HelpArticle = {
  id: "taler",
  title: "Taler & Prekener",
  hvor: "Nettside → Taler & Prekener",
  intro: "Legg en tale inn i talearkivet, med lyd, Spotify eller video.",
  steg: [
    "Trykk **Legg til tale**. Skriv tittel, taler, dato og bibeltekst.",
    "Legg inn lydfil, Spotify-lenke eller video. Én er nok.",
    "Velg gjerne et bilde og en serie, og skriv et kort sammendrag.",
    "Trykk **Lagre tale**.",
  ],
  godt: "Den nyeste talen vises på forsiden. YouTube vises uten sporing. En serie gjør det lett å finne taler som hører sammen.",
  seOgsa: ["sider-moduler"],
  tabs: ["cms-taler"],
};

const lederskap: HelpArticle = {
  id: "lederskap",
  title: "Lederskap & Stab",
  hvor: "Nettside → Lederskap & Stab",
  intro: "Vis stab og menighetsråd på nettsiden, hentet fra personregisteret og ledergruppen.",
  steg: [
    "Trykk **Legg til person i staben**, og velg personen fra registeret.",
    "**Rediger personkort**: rolle, bilde og et par setninger.",
    "Registrer samtykket. Da står det **Synlig på nettsiden** på kortet.",
    "Sett inn staben på en side med en personblokk, for eksempel på «Om oss».",
  ],
  godt: "Menighetsrådet hentes fra ledergruppen. Hvem som sitter der, endres under Grupper & Husfellesskap.",
  passPa: "Står det **Mangler samtykke**, vises ikke personen på nettsiden. Registrer bare at noen har sagt ja når du har spurt dem.",
  seOgsa: ["personer", "grupper"],
  tabs: ["cms-stab"],
};

const mediebibliotek: HelpArticle = {
  id: "mediebibliotek",
  title: "Mediebibliotek",
  hvor: "Nettside → Mediebibliotek, og bildevelgeren i redigeringen",
  intro: "Bildene som kan brukes på nettsiden: de som følger med appen, og menighetens egne.",
  steg: [
    "**Bibliotek**: bilder som følger med appen, med fotograf og kilde. Søk etter for eksempel fellesskap eller høst.",
    "**Last opp nytt bilde**: et bilde fra maskinen. Det gjøres mindre og lagres i bildelageret.",
    "**URL**: lim inn adressen til et bilde på nettet.",
    "Skriv en kort beskrivelse når bildet viser noe viktig. Det leses opp for den som ikke ser.",
  ],
  godt: "Står kortet **Bilder lagret inne i sidene** her, trykk **Flytt til bildelageret**. Sidene ser ut som før, men blir lettere.",
  passPa: "Bruk bare bilder av personer som har sagt ja. Bildelageret kan leses av alle som har lenken.",
  seOgsa: ["sider-sok", "forside"],
  tabs: ["cms-medier"],
};

const tema: HelpArticle = {
  id: "tema",
  title: "Tema & Designsystem",
  hvor: "Nettside → Tema & Designsystem",
  intro: "Farger, skrift og hjørner for hele nettsiden.",
  steg: [
    "Trykk på et av de fem ferdige temaene, eller lag ditt eget.",
    "**Primærfarge (Hovedprofil)** brukes til knapper og meny, **Aksentfarge (Detaljer & Kontraster)** til merker.",
    "Velg bakgrunnstone, skrift og hvor runde hjørnene skal være.",
    "Trykk **Lagre designtema**. Det gjelder hele nettsiden med en gang.",
  ],
  godt: "Teksten blir lesbar uansett farge. **Tilbakestill** tar deg tilbake til slik det var.",
  seOgsa: ["innstillinger"],
  tabs: ["cms-design"],
};

const innstillinger: HelpArticle = {
  id: "innstillinger",
  title: "Nettside-innstillinger",
  hvor: "Nettside → Nettside-innstillinger",
  intro: "Det som gjelder hele nettsiden: navn, logo, kontakt, gaver og sosiale medier.",
  steg: [
    "Navn og velkomst: navn, slagord, overskrift og ingress på forsiden.",
    "Logo: **Velg logo**, og eventuelt **Velg lys logo** for menyen over toppbildet.",
    "Kontakt og gaver: adresse, telefon, e-post, kontortid, Vipps, kontonummer og organisasjonsnummer.",
    "Sosiale medier: lim inn lenkene. Trykk **Lagre alle innstillinger**.",
  ],
  godt: "Et felt som står tomt, vises ikke på nettsiden. Farger og skrift ligger under Tema & Designsystem.",
  seOgsa: ["tema", "sider-hero"],
  tabs: ["cms-innstillinger"],
};

const besok: HelpArticle = {
  id: "besok",
  title: "Besøk på nettsiden",
  hvor: "Analyse → Besøk på nettsiden",
  intro: "Hvordan nettsiden brukes: besøk, mest leste sider og hva som bør ryddes.",
  steg: [
    "Velg periode: 7 dager, 4 uker, 3 måneder eller 12 måneder.",
    "Se besøk, mest leste sider og når besøkene kommer.",
    "«Sider som aldri åpnes» og «Adresser som ikke finnes» viser hva som bør ryddes.",
    "«Fører besøket til noe?» teller trykk på telefon, e-post og avspilte taler.",
  ],
  godt: "Tellingen er anonym, uten informasjonskapsler, så ingen samtykkeboks trengs. Slå på at besøk fra din egen nettleser ikke telles.",
  seOgsa: ["moduler"],
  tabs: ["nettsidebesok"],
  addon: "nettsidebesok",
  utenBilde: true,
};

// ---------------------------------------------------------------- Planlegging

const oversikt: HelpArticle = {
  id: "oversikt",
  title: "Oversikt",
  hvor: "Planlegging → Oversikt",
  intro: "Det som skjer framover, og det som må ordnes, på ett sted.",
  steg: [
    "**Kommende arrangementer** viser de neste arrangementene med forfall, ubesatte oppgaver og dem som venter på svar.",
    "Trykk på et arrangement for å åpne bemanningen.",
    "Tallene viser arrangementer framover og det som må ordnes de neste fire ukene.",
    "Hurtighandlingene lager en ny samling eller åpner det som må følges opp.",
  ],
  godt: "**Åpne offentlig nettside** og **Gå til Min Side** står øverst i menyen, og på PC også øverst på Oversikt, så du raskt ser det menigheten ser.",
  seOgsa: ["bemanning", "oppgaver", "arrangementer"],
};

const arrangementer: HelpArticle = {
  id: "arrangementer",
  title: "Kalender",
  hvor: "Planlegging → Kalender",
  intro: "Kalenderen er der arrangementene lages. Det som legges inn her, viser nettsiden av seg selv.",
  steg: [
    "Velg **Måned**, **Uke**, **Kort** eller **Tabell**. På mobil står Uke og Kort.",
    "Filterknappene **Alle**, **Gudstjenester**, **Husgrupper**, **Tjenestegrupper** og **Andre** velger hva som vises.",
    "Trykk på en ledig plass en dag, eller **+** øverst, for et nytt arrangement. Trykk **Opprett arrangement**.",
    "Trykk på et arrangement for å åpne bemanning og kjøreplan. **Rediger** endrer eller avlyser det.",
  ],
  godt: "Start fra en mal, så får arrangementet malens program og oppgaver. **Gjenta som serie** lager mange på en gang. Rød prikk betyr at frivillige mangler.",
  seOgsa: ["bemanning", "maler", "forside"],
  tabs: ["planlegger-samlinger"],
};

const bemanning: HelpArticle = {
  id: "bemanning",
  title: "Bemanning",
  hvor: "Planlegging → Kalender → et arrangement → Bemanning",
  intro: "Fyll ledige oppgaver og ordne forfall på et arrangement, også fra mobilen.",
  steg: [
    "Hvert team har sitt kort. Tallene i headeren viser bekreftet, venter og ledig. Trykk på teamet for å folde det ut på mobil.",
    "Ved en ledig plass trykker du **Fyll plassen**, og velger **Tildel** (personen er avtalt) eller **Forespør** (den får en forespørsel på Min Side).",
    "Trykk på en person for å sette **Bekreftet**, **Forespurt** eller **Forfall**. Den som sa nei, står bak «sa nei».",
    "Vil du se bare det som må ordnes, trykk **Vis bare det som må ordnes**.",
    "På en stor skjerm står programmet til venstre ved siden av teamene. Trykk på en post for å se rollen den bruker.",
  ],
  godt: "Trykk på rollenavnet for å se instruksen. Bytte: sett **Forfall** på den som ikke kan, og **Fyll plassen** på samme rolle. **Program** viser kjøreplanen; der endres ikke bemanningen. En gruppeleder ser bemanningen til sine egne grupper.",
  seOgsa: ["oppgaver", "roller"],
};

const oppgaver: HelpArticle = {
  id: "oppgaver",
  title: "Trenger oppfølging",
  hvor: "Planlegging → Trenger oppfølging",
  intro: "Alt som må ordnes på arrangementene som kommer: forfall og ubesatte oppgaver.",
  steg: [
    "Oppgavene står per arrangement, det nærmeste først.",
    "Velg **Må ordnes**, **Venter på svar** eller **Alle**, og **4 uker** eller **Alt som kommer**.",
    "Trykk **Tildel** eller **Forespør** på en oppgave, velg person og bekreft.",
  ],
  godt: "Tallet i menyen er det som må ordnes de neste fire ukene. Merket **Under 48 t** står når arrangementet er under to døgn unna.",
  seOgsa: ["bemanning"],
  tabs: ["planlegger-oppgaver"],
};

const grupper: HelpArticle = {
  id: "grupper",
  title: "Grupper & Husfellesskap",
  hvor: "Planlegging → Grupper & Husfellesskap",
  intro: "Tjenestegrupper, husgrupper og ledergrupper, med leder, nestleder og deltakere.",
  steg: [
    "Trykk **Opprett ny gruppe**. Skriv navn, velg type og leder, og trykk **Opprett gruppe**.",
    "Trykk **Administrer gruppe**. Sett **Leder** og **Nestleder**, og legg til deltakere med **Legg til deltaker**.",
    "Trykk **Lagre endringer**.",
  ],
  godt: "Gruppelederen ser bemanningen for sin gruppe og legger inn oppgavene framover. Ledergruppen er menighetsrådet på nettsiden.",
  seOgsa: ["personer", "lederskap"],
  tabs: ["planlegger-grupper"],
};

const personer: HelpArticle = {
  id: "personer",
  title: "Personer",
  hvor: "Planlegging → Personer",
  intro: "Personregisteret: kontaktinfo, tilgang, fravær og offentlig profil.",
  steg: [
    "Søk, eller bytt mellom **Kort** og **Tabell**. Åpne personen.",
    "Oppdater navn, telefon, e-post, tilgang, politiattest og fravær.",
    "Under **Offentlig profil på nettsiden** bestemmer du hva som kan vises utad.",
    "Trykk **Lagre alle personopplysninger & tilganger**.",
  ],
  godt: "E-postadressen her er den personen logger inn med på Min Side. Mange personer hentes inn fra Cornerstone med **Hent inn fra Cornerstone**.",
  passPa: "Registeret har personopplysninger. Del ikke skjermbilder eller lister fra det utenfor admin.",
  seOgsa: ["grupper", "lederskap"],
  tabs: ["planlegger-personer"],
};

const maler: HelpArticle = {
  id: "maler",
  title: "Maler",
  hvor: "Planlegging → Maler",
  intro: "En mal er oppskriften på et arrangement som holdes igjen og igjen: tid, sted, program og oppgaver.",
  steg: [
    "Trykk **Ny mal**, eller **Legg inn standardmal for gudstjeneste**.",
    "Gi malen tid, sted, program og oppgaver, og gjerne et bilde.",
    "**Planlegg serie** lager arrangementer fra malen, så ligger de klare i kalenderen.",
    "**Rediger** endrer malen.",
  ],
  godt: "Et arrangement laget fra en mal kan få malens bilde under Arrangementer på nettsiden.",
  seOgsa: ["arrangementer", "forside"],
  tabs: ["planlegger-maler"],
};

const semesterplan: HelpArticle = {
  id: "semesterplan",
  title: "Semesterplan",
  hvor: "Planlegging → Kalender → Semesterplan",
  intro: "Frigi planen for et semester, så går de frivillige i teamene gjennom arrangementene og tar oppgaver selv.",
  steg: [
    "Legg inn semesterets arrangementer og oppgaver i kalenderen først.",
    "Trykk **Semesterplan** øverst i Kalender, og så **Ny semesterplan**.",
    "Skriv navn, første og siste dag, svarfrist og når planen åpner. Under feltene ser du hvor mange arrangementer og personer planen gjelder.",
    "Trykk **Frigi semesterplanen**. Ingen ser planen før den åpner.",
    "**Kopier lenke** gir lenken til planen, som du kan sende på e-post eller i en gruppe. **Endre** flytter dagene eller åpningen.",
    "Planen lukkes når svarfristen er ute. **Åpne på nytt** gir den ny åpning og ny frist, og alle får flagget igjen.",
  ],
  godt: "Planen tar med alle arrangementer i perioden som har oppgaver for et team, også de som legges inn etter at planen er frigitt. Den som er med i flere team, får oppgavene fra alle på samme kort. To planer kan ikke ha samme dag, men vårplanen og høstplanen kan være åpne samtidig.",
  passPa: "Slettes planen, slettes svarene til de frivillige. Oppgavene de har tatt, blir stående.",
  seOgsa: ["arrangementer", "oppgaver"],
  tabs: ["planlegger-semesterplan"],
};

const arshjul: HelpArticle = {
  id: "arshjul",
  title: "Årshjul",
  hvor: "Planlegging → Årshjul",
  intro: "Administrative frister og det som kommer igjen hvert år, måned for måned.",
  steg: [
    "Måneden vi er i, er merket **Nå**.",
    "Trykk **Ny frist**, skriv hva det gjelder, og velg måned og dag.",
    "**Endre** eller **Ta ut** en frist som ikke passer.",
  ],
  godt: "Årshjulet starter med et standardårshjul. Endrer du det, lagres det som menighetens eget.",
  tabs: ["arshjul"],
};

const roller: HelpArticle = {
  id: "roller",
  title: "Roller",
  hvor: "Planlegging → Roller",
  intro: "Tjenesterollene på arrangementene, med instruks og team.",
  steg: [
    "Trykk **Ny rolle**. Skriv navn, og velg **Tjenesteteam (valgfritt)**.",
    "Trykk **Instruks** på rollen, og skriv hva den som har rollen, skal gjøre. Trykk **Lagre instruks**.",
    "**Legg inn standardroller** gir en ferdig liste å starte med.",
  ],
  godt: "Instruksen vises for den frivillige på Min Side og i bemanningen. Den som har svart ja til Møteleder eller Gudstjenesteleder, kan selv endre programmet for den ene gudstjenesten fra Min Side: dra postene med de seks prikkene, endre tittel og varighet med blyanten, og legge til med Ny programpost. Klokkeslettene regnes ut fra varigheten. Poster koblet til en oppgave kan ikke slettes.",
  seOgsa: ["bemanning", "maler"],
  tabs: ["planlegger-roller"],
};

const epost: HelpArticle = {
  id: "epost",
  title: "Send e-post",
  hvor: "Planlegging → Send e-post",
  intro: "Si fra til ledere og frivillige, eller send nyhetsbrev til medlemmene.",
  steg: [
    "Under **Start med**: velg en ferdig tekst, for eksempel **Nyhetsbrev**, eller **Tom e-post**.",
    "Under **Hvem skal ha den**: velg mottakere. Antallet står under listen.",
    "Skriv emne og tekst. Merk ord og bruk knappene over feltet.",
    "Trykk **Send prøve til meg** først, og så sendeknappen.",
  ],
  godt: "Hver person får sin egen e-post, og ingen ser de andres adresser. **Slik ser den ut** viser e-posten før du sender.",
  passPa: "Sendt e-post kan ikke kalles tilbake. Les prøven før du sender til alle.",
  tabs: ["epost"],
};

// ---------------------------------------------------------------- Innsikt og moduler

const analysebord: HelpArticle = {
  id: "analysebord",
  title: "Analysebord",
  hvor: "Analyse → Analysebord",
  intro: "Menighetens liv i tall over en periode, sammenlignet med perioden før.",
  steg: [
    "Velg periode: **Siste 4 uker**, **Siste 3 måneder** eller **Siste 12 måneder**.",
    "Trykk på en søyle under Oppmøte, eller **Registrer**, for å skrive inn hvor mange som var der.",
    "Les hvem som kan trenge avlastning, og hvem som ikke er brukt, før neste vaktliste lages.",
    "**Tilpass bordet** velger hvilke deler du ser. **Last ned CSV** henter tallene til et regneark.",
  ],
  godt: "Datagrunnlag nederst sier hva tallene bygger på, og hva som ikke er målt.",
  seOgsa: ["moduler"],
  tabs: ["analyse"],
  addon: "analysebord",
};

const moduler: HelpArticle = {
  id: "moduler",
  title: "Moduler",
  hvor: "Moduler",
  intro: "Tilleggsmoduler som slås av og på for menigheten.",
  steg: [
    "Les hva modulen gjør, på kortet.",
    "Slå den på med bryteren. Fanen dukker opp i menyen.",
    "Slå den av igjen når den ikke trengs. Ingenting slettes.",
  ],
  godt: "Analysebord og Besøk på nettsiden er moduler. Det som står under Planlagt, er ikke laget ennå.",
  seOgsa: ["analysebord", "besok"],
  tabs: ["moduler"],
  utenBilde: true,
};

export const helpSections: HelpSection[] = [
  {
    title: "Kom i gang",
    items: [
      { kind: "article", article: komIGang },
      { kind: "article", article: nytt },
      { kind: "article", article: tips },
    ],
  },
  {
    title: "Nettside",
    items: [
      {
        kind: "menu",
        title: "Sider & Innhold",
        articles: [siderSidetre, siderRedigere, siderInnhold, siderLagre, siderHero, siderModuler, siderHvaSkjer, siderPublisering, siderSok],
      },
      { kind: "article", article: forside },
      { kind: "article", article: nyheter },
      { kind: "article", article: taler },
      { kind: "article", article: lederskap },
      { kind: "article", article: mediebibliotek },
      { kind: "article", article: tema },
      { kind: "article", article: innstillinger },
      { kind: "article", article: besok },
    ],
  },
  {
    title: "Planlegging",
    items: [
      { kind: "article", article: oversikt },
      { kind: "article", article: arrangementer },
      { kind: "article", article: bemanning },
      { kind: "article", article: oppgaver },
      { kind: "article", article: grupper },
      { kind: "article", article: personer },
      { kind: "article", article: maler },
      { kind: "article", article: semesterplan },
      { kind: "article", article: arshjul },
      { kind: "article", article: epost },
      { kind: "article", article: roller },
    ],
  },
  {
    title: "Innsikt og moduler",
    items: [
      { kind: "article", article: analysebord },
      { kind: "article", article: moduler },
    ],
  },
];

export const defaultHelpArticleId = komIGang.id;

export function helpArticles(): HelpArticle[] {
  return helpSections.flatMap((section) =>
    section.items.flatMap((item) => (item.kind === "article" ? [item.article] : item.articles))
  );
}

export function findHelpArticle(id: string): HelpArticle {
  return helpArticles().find((article) => article.id === id) ?? komIGang;
}

/**
 * The article help opens on, coming from a tab: that tab's own article, or for the overview, the one
 * for the part of the admin that is open.
 */
export function helpArticleIdForTab(tab: StudioTab | null, area: StudioArea): string {
  if (tab === "dashboard" || tab === null) return area === "planlegging" ? oversikt.id : komIGang.id;
  return helpArticles().find((article) => article.tabs?.includes(tab))?.id ?? (area === "planlegging" ? oversikt.id : komIGang.id);
}

/** The article help opens on when nothing is asked for: the first one for the part of the admin that is open. */
export const firstHelpArticleIdFor = (area: StudioArea): string => helpArticleIdForTab(null, area);

/** The words of an article, without the marks for buttons, for searching in. */
export function helpArticleText(article: HelpArticle): string {
  return [article.title, article.hvor, article.intro, ...article.steg, article.godt ?? "", article.passPa ?? ""]
    .join(" ")
    .replace(/\*\*/g, "");
}

/** The articles whose words hold every word searched for, best hits (in the title) first. */
export function searchHelp(query: string, articles: HelpArticle[] = helpArticles()): HelpArticle[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  if (words.length === 0) return [];
  return articles
    .filter((article) => {
      const text = helpArticleText(article).toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => Number(words.some((word) => b.title.toLowerCase().includes(word))) - Number(words.some((word) => a.title.toLowerCase().includes(word))));
}

/** The names of buttons and fields an article points to, written **like this**. */
export function helpButtonNames(article: HelpArticle): string[] {
  const text = [...article.steg, article.godt ?? "", article.passPa ?? ""].join(" ");
  return [...text.matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]);
}
