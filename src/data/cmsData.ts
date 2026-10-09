import { VisualBlock } from "../utils/cmsBlocks";

export type CmsMediaStatus = "ready" | "archived";

export interface CmsMediaVariants {
  web: string;
  thumb: string;
  og: string;
}

export interface CmsMedia {
  id: string;
  title: string;
  altText: string;
  tags: string[];
  status: CmsMediaStatus;
  approvedForAi: boolean;
  source: "upload" | "url-import" | "preset";
  sourcePath: string;
  variants: CmsMediaVariants;
  width: number;
  height: number;
  byteSize: number;
  updatedAt: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  blocks?: VisualBlock[];
  showHero?: boolean;
  isPublished: boolean;
  status?: "draft" | "published" | "scheduled";
  parentPageId?: string | null; // Canonical reference to parent page (null = top-level main tab)
  parentId?: string | null; // Compatibility alias
  menuOrder?: number; // Canonical sort order in navigation menu
  navOrder?: number; // Compatibility alias
  inNavMenu?: boolean;
  linkUrl?: string; // Optional direct custom route, e.g. /hva-skjer or /taler
  updatedAt: string;
  updatedBy?: string;
  heroImage?: string;
  /** Optional screen-reader description for decorative hero; empty means alt="". */
  heroImageAlt?: string;
  /** Up to two more hero images for the front page. With them the hero fades from one image to the next. */
  heroImages?: string[];
  /** Slow zoom out on the front page hero image. On unless switched off. */
  heroZoom?: boolean;
  /** The menu lies on top of the front page hero until the visitor scrolls. On unless switched off. */
  heroMenuOverlay?: boolean;
  heroTitle?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  heroCtaSecondaryText?: string;
  heroCtaSecondaryLink?: string;
  showHeroPrimaryCta?: boolean;
  showHeroSecondaryCta?: boolean;
  metaDescription?: string;
  ogImage?: string;
  publishAt?: string; // Scheduled publish date/time in ISO 8601 format
  publishedAt?: string; // Compatibility alias
}

export interface CmsNewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: "aktuelt" | "gudstjeneste" | "ungdom" | "misjon" | "familie";
  author: string;
  publishedAt: string;
  isPublished: boolean;
  imageUrl?: string;
  gatheringRefId?: string;
  expiresAt?: string;
}

export interface CmsSermon {
  id: string;
  title: string;
  speaker: string;
  speakerPersonId?: string;
  guestSpeakerName?: string;
  gatheringId?: string;
  date: string;
  bibleText?: string;
  series?: string;
  audioUrl?: string;
  spotifyUrl?: string; // e.g. https://open.spotify.com/episode/...
  videoUrl?: string; // e.g. YouTube or Vimeo link
  summary?: string;
}

/**
 * Ensures YouTube links are converted to youtube-nocookie.com to protect user privacy
 */
export function formatYoutubeNoCookieUrl(url: string): string {
  if (!url) return "";
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}`;
  }
  return url;
}

export interface CmsStaffMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  category: "pastor" | "stab" | "lederskap" | "barneleder";
  imageUrl?: string;
  bio?: string;
}

export interface CmsDesignTheme {
  presetId?: string;
  primaryColor: string; // e.g. #1e3a8a
  primaryName?: string;
  accentColor: string; // e.g. #d97706
  accentName?: string;
  backgroundTone: "stone" | "slate" | "warm" | "pure-white";
  headingFont: "sans" | "serif" | "display";
  bodyFont: "sans" | "serif";
  borderRadius: "sharp" | "medium" | "smooth"; // sharp=6px, medium=16px, smooth=24px
  spacingDensity: "compact" | "normal" | "spacious";
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: CmsDesignTheme;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "church-navy",
    name: "Klassisk Menighetsblå",
    description: "Tidløs, verdig dyp marinblå med varme gull/rav-detaljer. Perfekt for formelle og tradisjonsrike fellesskap.",
    theme: {
      presetId: "church-navy",
      primaryColor: "#1e3a8a",
      primaryName: "Menighetsblå",
      accentColor: "#d97706",
      accentName: "Varmt Gull",
      backgroundTone: "stone",
      headingFont: "sans",
      bodyFont: "sans",
      borderRadius: "medium",
      spacingDensity: "normal",
    },
  },
  {
    id: "nordic-sage",
    name: "Nordisk Salvie & Skog",
    description: "Rolig skogsgrønn med himmelblå aksenter og myke, organiske linjer. Gir en innbydende og varm atmosfære.",
    theme: {
      presetId: "nordic-sage",
      primaryColor: "#166534",
      primaryName: "Salviegrønn",
      accentColor: "#0284c7",
      accentName: "Himmelblå",
      backgroundTone: "warm",
      headingFont: "sans",
      bodyFont: "sans",
      borderRadius: "smooth",
      spacingDensity: "normal",
    },
  },
  {
    id: "warm-terracotta",
    name: "Varm Terracotta & Jord",
    description: "Inspirert av lune middelhavs- og naturtoner med klassisk serif-tittel for et personlig og nært uttrykk.",
    theme: {
      presetId: "warm-terracotta",
      primaryColor: "#c2410c",
      primaryName: "Terracotta",
      accentColor: "#0d9488",
      accentName: "Dyp Petrol",
      backgroundTone: "warm",
      headingFont: "serif",
      bodyFont: "sans",
      borderRadius: "medium",
      spacingDensity: "spacious",
    },
  },
  {
    id: "royal-burgundy",
    name: "Dyp Vinrød & Liturgisk Gull",
    description: "Klassisk høytidelig vinrød kombinert med dyp rav og serif-skrift. Viser respekt for kirkelig tradisjon og høytid.",
    theme: {
      presetId: "royal-burgundy",
      primaryColor: "#881337",
      primaryName: "Vinrød",
      accentColor: "#ca8a04",
      accentName: "Liturgisk Gull",
      backgroundTone: "stone",
      headingFont: "serif",
      bodyFont: "serif",
      borderRadius: "sharp",
      spacingDensity: "normal",
    },
  },
  {
    id: "modern-indigo",
    name: "Moderne Indigo & Cyan",
    description: "Frisk, moderne tech-inspirert fargeprofil med rene kontraster og skarp lesbarhet for yngre generasjoner.",
    theme: {
      presetId: "modern-indigo",
      primaryColor: "#4f46e5",
      primaryName: "Elektro Indigo",
      accentColor: "#06b6d4",
      accentName: "Frisk Cyan",
      backgroundTone: "slate",
      headingFont: "sans",
      bodyFont: "sans",
      borderRadius: "smooth",
      spacingDensity: "normal",
    },
  },
];

export const defaultCmsDesignTheme: CmsDesignTheme = THEME_PRESETS[0].theme;

export interface CmsSettings {
  churchName: string;
  appName: string;
  tagline: string;
  welcomeHeadline: string;
  welcomeSubtext: string;
  heroImageUrl?: string;
  address: string;
  phone: string;
  email: string;
  officeHours: string;
  vippsNumber: string;
  vippsDescription: string;
  bankAccount: string;
  orgNumber: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  podcastUrl?: string;
  theme?: CmsDesignTheme;
  leadershipDecisions?: {
    id: string;
    topic: string;
    question: string;
    optionA: string;
    optionB: string;
    chosenOption?: "A" | "B";
    decidedBy?: string;
    decidedAt?: string;
    notes?: string;
  }[];
  /**
   * Whether visits to the website are counted (see utils/siteTraffic.ts). Counted unless the
   * congregation has turned it off; a settings document from before the choice existed counts.
   */
  countVisits?: boolean;
}

export const initialLeadershipDecisions = [
  {
    id: "dec-1",
    topic: "Varslingskanal i produksjon",
    question: "Hvordan skal frivillige og ledere varsles om bemanningsbehov, forfall og påminnelser?",
    optionA: "Kun gratis web-pushvarsler i appen og intern chat (0 kr SMS-kostnad)",
    optionB: "Hybrid: Web-pushvarsler + SMS ved akutt forfall og påminnelser dagen før",
    chosenOption: "B" as const,
    notes: "Anbefalt av rådgiverteamet for å sikre at eldre og kritiske roller faktisk nås.",
  },
  {
    id: "dec-2",
    topic: "Innlogging for frivillige og medlemmer",
    question: "Hvilken innloggingsmetode skal være standard for menighetens medlemmer?",
    optionA: "Kun tradisjonelt brukernavn og passord",
    optionB: "Moderne valgfrihet: Google-innlogging, Vipps Login og passord",
    chosenOption: "B" as const,
    notes: "Lavest mulig terskel for norske brukere via Vipps og Google.",
  },
  {
    id: "dec-3",
    topic: "Politiattest-kontroll for barne- og ungdomsledere",
    question: "Hvordan skal oppfølging av politiattest for frivillige som arbeider med mindreårige dokumenteres?",
    optionA: "Kun i eksternt papirarkiv/ringperm utenfor datasystemet",
    optionB: "Registrere godkjenningsdato og utløp direkte på personkortet med leder-varsel",
    chosenOption: "B" as const,
    notes: "Ivaretar menighetens trygghetsrutiner og barnevernskrav.",
  },
  {
    id: "dec-4",
    topic: "Avslagsgrunn ved forfall",
    question: "Skal frivillige oppgi grunn ved avslag, og hvem skal kunne se den?",
    optionA: "Helt anonymt avslag uten mulighet for begrunnelse",
    optionB: "Valgfri privat begrunnelse synlig kun for administratoren og gruppelederen",
    chosenOption: "B" as const,
    notes: "Hindrer opplevd sosialt press i fellesskapet, samtidig som lederen forstår situasjonen.",
  },
  {
    id: "dec-5",
    topic: "Hosting, skytjenester & Prosjekteierskap",
    question: "Hvem skal eie Firebase-prosjektet og driftsavtalen i skyen?",
    optionA: "Driftes på privat utviklerkonto",
    optionB: "Eies av menighetens offisielle Google-organisasjonskonto med budsjettalarm",
    chosenOption: "B" as const,
    notes: "Sikrer institusjonell kontroll og at menigheten ikke er avhengig av enkeltpersoner.",
  },
  {
    id: "dec-6",
    topic: "Kjøreplan og programrekkefølge for gudstjenester",
    question: "Skal gudstjenestens rekkefølge (sanger, kunngjøringer, tale) være en del av løsningen?",
    optionA: "Uavhengig papirark på talerstolen/i sakristiet",
    optionB: "Integrert digital kjøreplan med tider, innslag og ansvarlige i appen",
    chosenOption: "B" as const,
    notes: "Gjør at teknikere, lovsangsledere og møteledere alltid ser samme oppdaterte versjon.",
  },
  {
    id: "dec-7",
    topic: "Maksimumsgrense for tjenestefrekvens (Omsorgsvarsel)",
    question: "Skal systemet varsle hvis samme person settes opp for ofte i løpet av en måned?",
    optionA: "Ingen advarsel – fri oppsetting av ledere",
    optionB: "Vis omsorgsvarsel dersom en person settes opp mer enn 2 søndager per måned",
    chosenOption: "B" as const,
    notes: "Forhindrer at faste ildsjeler blir utbrente og oppmuntrer til å rekruttere flere.",
  },
];

/**
 * What an installation shows before its own settings exist: nothing about any congregation.
 * Setting up a new congregation writes the real ones (name, contact, giving). Until then the
 * website leaves out every line that has nothing to say, rather than showing someone else's.
 */
export const emptyCmsSettings: CmsSettings = {
  churchName: "Menigheten",
  appName: "Menighetsplan",
  tagline: "",
  welcomeHeadline: "",
  welcomeSubtext: "",
  address: "",
  phone: "",
  email: "",
  officeHours: "",
  vippsNumber: "",
  vippsDescription: "",
  bankAccount: "",
  orgNumber: "",
  theme: defaultCmsDesignTheme,
};

/**
 * The settings of the example congregation in the demo data (see mockDocuments.ts). Made up,
 * name and all, and never shown unless the demo data has been put in the database. The e-mail
 * addresses end in .example, which no one can own.
 */
export const demoCmsSettings: CmsSettings = {
  churchName: "Fjordvik menighet",
  appName: "Menighetsplan",
  tagline: "Varmt fellesskap. Tydelig tro. Enkel tjeneste.",
  welcomeHeadline: "Velkommen til Fjordvik menighet",
  welcomeSubtext: "Et åpent hjem for alle generasjoner. Vi samles til gudstjeneste hver søndag kl. 11:00 med Sprell Levende barnekirke og kirkekaffe.",
  heroImageUrl: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1600&q=80",
  address: "Sentrumsgata 12, 4999 Fjordvik",
  phone: "912 34 567",
  email: "post@fjordvik.example",
  officeHours: "Tirsdag – Torsdag kl. 10:00 – 14:00",
  vippsNumber: "#12345",
  vippsDescription: "Fjordvik menighet",
  bankAccount: "1503.45.67890",
  orgNumber: "987 654 321",
  facebookUrl: "https://www.facebook.com/",
  leadershipDecisions: initialLeadershipDecisions,
  instagramUrl: "https://www.instagram.com/",
  youtubeUrl: "https://www.youtube.com/",
  podcastUrl: "https://spotify.com",
  theme: defaultCmsDesignTheme,
};

export const initialCmsStaff: CmsStaffMember[] = [
  {
    id: "staff-1",
    name: "Kari Nordmann",
    role: "Hovedpastor",
    email: "pastor@fjordvik.example",
    phone: "912 34 567",
    category: "pastor",
    bio: "Kari har vært pastor i Fjordvik menighet siden 2021 og brenner for bibelformidling og nære fellesskap.",
  },
  {
    id: "staff-2",
    name: "Ola Hansen",
    role: "Daglig leder & Koordinator",
    email: "post@fjordvik.example",
    phone: "923 45 678",
    category: "stab",
    bio: "Ola holder i den daglige driften, husfellesskap og frivilligkoordinering.",
  },
  {
    id: "staff-3",
    name: "Ingrid Berg",
    role: "Barne- og Ungdomsarbeider",
    email: "ung@fjordvik.example",
    phone: "934 56 789",
    category: "barneleder",
    bio: "Ingrid leder Sprell Levende søndagsskole og fredagsklubben for ungdom.",
  },
  {
    id: "staff-4",
    name: "Magnus Foss",
    role: "Menighetsrådsleder",
    email: "styre@fjordvik.example",
    phone: "945 67 890",
    category: "lederskap",
    bio: "Magnus leder menighetens styre og strategiarbeid.",
  },
];

export const initialCmsSermons: CmsSermon[] = [
  {
    id: "sermon-1",
    title: "Guds rike er nær",
    speaker: "Pastor Kari Nordmann",
    date: "2026-08-30T11:00:00.000Z",
    bibleText: "Markus 1,14–15",
    series: "Vandring gjennom Markus",
    summary: "Hva betyr det når Jesus forkynner at tiden er inne og Guds rike er kommet nær? En tale om tro og omvendelse i hverdagen.",
    audioUrl: "https://traffic.libsyn.com/preview/forcedn/voiceofhope/sample.mp3",
    spotifyUrl: "https://open.spotify.com/episode/7makk4oTQel546v09Zzwh2",
  },
  {
    id: "sermon-2",
    title: "Kalt til å følge",
    speaker: "Gjesteleder Thomas Vik",
    date: "2026-08-23T11:00:00.000Z",
    bibleText: "Matteus 4,18–22",
    series: "Disippelliv i dag",
    summary: "Da Jesus kalte disiplene ved Galileasjøen forlot de garnene straks. Hva kaller Han oss til å legge bak oss for å følge Ham?",
    audioUrl: "https://traffic.libsyn.com/preview/forcedn/voiceofhope/sample.mp3",
    spotifyUrl: "https://open.spotify.com/episode/7makk4oTQel546v09Zzwh2",
  },
  {
    id: "sermon-3",
    title: "Kraften i et åpent hjerte",
    speaker: "Pastor Kari Nordmann",
    date: "2026-08-16T11:00:00.000Z",
    bibleText: "Efeserne 3,14–21",
    series: "Rikdommen i Kristus",
    summary: "En bønn om å bli fylt av all Guds fylde, og hvordan Guds kjærlighet overgår all vår forstand og beregning.",
    audioUrl: "https://traffic.libsyn.com/preview/forcedn/voiceofhope/sample.mp3",
    spotifyUrl: "https://open.spotify.com/episode/7makk4oTQel546v09Zzwh2",
  },
];

export const initialCmsNews: CmsNewsArticle[] = [
  {
    id: "news-1",
    title: "Velkommen til gudstjeneste og fellesskap",
    slug: "velkommen-til-gudstjeneste-og-fellesskap",
    summary: "Vi er i gang for fullt med søndagsskole for barna, nye husfellesskap og spennende temaserier.",
    content: `Vi gleder oss over alt som skjer i Fjordvik menighet! Hver søndag kl. 11:00 samles vi til gudstjeneste med rom for lovsang, bønn og forkynnelse.

Under gudstjenesten har barna sin egen Sprell Levende søndagsskole i tre aldersgrupper:
- Gullgruppa (0–4 år)
- Bibeldetektivene (5–9 år)
- Tweensklubben (10–13 år)

Etter gudstjenesten er alle hjertelig velkommen til gratis kirkekaffe og en god prat i kafeen vår. Enten du har gått i kirken hele livet eller aldri har vært her før, er døren vidåpen for deg!`,
    category: "gudstjeneste",
    author: "Pastor Kari Nordmann",
    publishedAt: "2026-08-30T10:00:00.000Z",
    isPublished: true,
  },
  {
    id: "news-2",
    title: "Bli med i et husfellesskap – nære relasjoner i hverdagen",
    slug: "bli-med-i-et-husfellesskap",
    summary: "Ønsker du et mindre fellesskap å dele tro, liv og hverdag med? Nå starter nye grupper opp.",
    content: `Et husfellesskap er en gruppe på 6–12 personer som samles annenhver uke i hjemmene. Her deler vi et enkelt måltid, leser fra Bibelen, ber for hverandre og har et trygt rom for gode samtaler.

Vi har grupper for unge voksne, barnefamilier, og blandede generasjoner over hele kommunen.

Ønsker du å vite mer eller finne en gruppe som passer for deg? Ta kontakt med husgruppe-koordinatoren vår via kontaktskjemaet på nettsiden eller snakk med oss på søndag!`,
    category: "aktuelt",
    author: "Ola Hansen (Gruppeleder)",
    publishedAt: "2026-08-25T14:30:00.000Z",
    isPublished: true,
  },
  {
    id: "news-3",
    title: "Ungdomsmiljøet samles annenhver fredag",
    slug: "ungdomsmiljoet-samles-annenhver-fredag",
    summary: "Kiosk, bordtennis, lovsang og gode samtaler for alle fra 8. klasse og oppover.",
    content: `Annenhver fredag kl. 19:00 fylles ungdomssalen med ungdommer fra hele distriktet. Vi har åpen kiosk med toast og brus, turneringer i bordtennis og biljard, et kort program med appell og lovsang, og god tid til å henge sammen.

Følg gjerne ungdomsarbeidet på Instagram for ferske oppdateringer og helgens program!`,
    category: "ungdom",
    author: "Ingrid Berg (Ungdomsarbeider)",
    publishedAt: "2026-08-20T18:00:00.000Z",
    isPublished: true,
  },
];

export const initialCmsPages: CmsPage[] = [
  // 1. Forside (Fast toppfane)
  {
    id: "page-forside",
    slug: "",
    title: "Forside",
    summary: "Hovedsiden for Fjordvik menighet med velkomst, neste gudstjeneste og snarveier.",
    content: `:::module-worship[highlight]
:::

## Velkommen til Fjordvik menighet
Et åpent hjem for alle generasjoner. Vi samles til gudstjeneste, bønn og nære fellesskap der tro og hverdag møtes.

:::module-calendar[grid]
:::

:::module-news[grid]
:::

:::module-sermon[player]
:::

:::module-groups[banner]
:::

:::module-giving[card]
:::`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 1,
    navOrder: 1,
    inNavMenu: true,
    linkUrl: "/",
    metaDescription: "Velkommen til Fjordvik menighet. Et åpent hjem for alle generasjoner med gudstjeneste søndager kl. 11:00, søndagsskole og fellesskap.",
    ogImage: "https://images.unsplash.com/photo-1548625361-195fe5795df5?auto=format&fit=crop&w=1200&h=630&q=80",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 2. Kalender (Toppfane)
  {
    id: "page-kalender",
    slug: "hva-skjer",
    title: "Kalender",
    summary: "Oversikt over alle gudstjenester, fellessamlinger, bønnemøter og aktiviteter.",
    content: `:::module-kalender[month]
:::`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 2,
    navOrder: 2,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 3. Grupper/Aktiviteter (Toppfane med underfaner)
  {
    id: "page-grupper",
    slug: "grupper",
    title: "Grupper/ aktiviteter...",
    summary: "Oversikt over kor, fellesskap, ungdomsarbeid og barneaktiviteter.",
    content: `## Små og store fellesskap\nI menigheten har vi et mangfold av grupper og samlinger gjennom uken for ulike aldre og interesser.`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 3,
    navOrder: 3,
    inNavMenu: true,
    linkUrl: "/fellesskap",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-gospelkor",
    slug: "gospelkoret",
    title: "Gospelkoret",
    summary: "Vårt voksne gospelkor som synger på gudstjenester og holder egne konserter.",
    content: `## Gospelkoret\nGospelkoret øver annenhver tirsdag kl. 19:30 i Hovedsalen. Vi synger moderne og tradisjonell gospel, spirituals og lovsang. Alle sangglade er velkommen til prøveøvelse!`,
    isPublished: true,
    status: "published",
    parentPageId: "page-grupper",
    parentId: "page-grupper",
    menuOrder: 1,
    navOrder: 1,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-gullrekka",
    slug: "gullrekka",
    title: "Gullrekka",
    summary: "Seniorfellesskap med formiddagstreff, foredrag, god bevertning og fellessang.",
    content: `## Gullrekka (Seniorer)\nSeniorfellesskapet samles første torsdag i hver måned kl. 11:30 i Kafeen. Her er det lunsj, sosialt samvær, aktuelt tema og andakt.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-grupper",
    parentId: "page-grupper",
    menuOrder: 2,
    navOrder: 2,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-apent-hus",
    slug: "apent-hus",
    title: "Åpent hus",
    summary: "Uformelt møtested for nabolaget med gratis kaffe, vaffel og en god prat.",
    content: `## Åpent hus i kirkestua\nHver onsdag mellom kl. 11:00 og 13:00 åpner vi dørene for nabolaget. Kom innom for en kaffekopp, nystekt vaffel eller bare for å hilse på!`,
    isPublished: true,
    status: "published",
    parentPageId: "page-grupper",
    parentId: "page-grupper",
    menuOrder: 3,
    navOrder: 3,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-amadeus",
    slug: "amadeus",
    title: "Amadeus",
    summary: "Barnekor og musikkgruppe for sangglade gutter og jenter.",
    content: `## Amadeus Barnekor\nAmadeus er for barn fra 1. til 7. klasse. Vi øver på sanger, rytmer og opptrer jevnlig på familiegudstjenestene.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-grupper",
    parentId: "page-grupper",
    menuOrder: 4,
    navOrder: 4,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-konfirmant",
    slug: "konfirmantsamling",
    title: "Konfirmantsaml...",
    summary: "Konfirmantundervisning, turer og opplevelser for 9. klassinger.",
    content: `## Konfirmasjon i menigheten\nKonfirmantåret hos oss byr på undervisning om livets store spørsmål, leir, felleskap og personlig vekst. Påmelding skjer hver vår for kommende skoleår.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-grupper",
    parentId: "page-grupper",
    menuOrder: 5,
    navOrder: 5,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 4. Utleie (Toppfane med underfaner)
  {
    id: "page-utleie",
    slug: "utleie",
    title: "Utleie",
    summary: "Leie av lokaler til selskaper, dåp, minnesamvær, kurs og konferanser.",
    content: `## Utleie av lokaler i kirkebygget\nVi leier ut våre moderne, tilrettelagte lokaler sentralt i Fjordvik. Bygget har heis, fullt utstyrt kjøkken, topp moderne AV-utstyr og god parkeringskapasitet.`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 4,
    navOrder: 4,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-utleie-kurs",
    slug: "utleie-for-kurs",
    title: "Utleie for kur...",
    summary: "Møterom, storsal og teknisk utstyr for foredrag, kurs og generalforsamlinger.",
    content: `## Kurs & Konferanser\nHovedsalen rommer opptil 250 personer med projektor, trådløse mikrofoner og scene. Mindre møterom er tilgjengelige for 10–30 personer med WiFi og skjermer.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-utleie",
    parentId: "page-utleie",
    menuOrder: 1,
    navOrder: 1,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-utleie-selskap",
    slug: "utleie-selskap",
    title: "Utleie selskap...",
    summary: "Festlokaler med stordekketøy, kjøkken og koselig peisestue for dåp, konfirmasjon og minnesamvær.",
    content: `## Selskaper & Minnestunder\nKafeen og peisestua har hyggelig atmosfære og sitteplasser for opptil 90 gjester. Fullt industrikjøkken med rask oppvaskmaskin, dekketøy og kaffetraktere.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-utleie",
    parentId: "page-utleie",
    menuOrder: 2,
    navOrder: 2,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-utleie-bilder",
    slug: "utleie-bilder",
    title: "Bilder",
    summary: "Fotogalleri av våre lokaler, møterom, kjøkken og uteområder.",
    content: `## Se bilder av lokalene våre\nHer kan du få et inntrykk av Hovedsalen, Kafeen, Peisestua, Møterommene og Kjøkkenet før du bestiller leie.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-utleie",
    parentId: "page-utleie",
    menuOrder: 3,
    navOrder: 3,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 5. Om (Toppfane med underfaner)
  {
    id: "page-om-oss",
    slug: "om-oss",
    title: "Om",
    summary: "Bli kjent med hvem vi er, hva vi tror på og vårt hjerte for byen og nærmiljøet.",
    content: `## Velkommen til fellesskapet\nVi er en levende menighet for alle generasjoner. Vi ønsker å være et åpent hjem for alle mennesker. Uansett hvor du er på din trosreise, er du hjertelig velkommen hos oss.\n\n## Vår visjon\n«Guds ære – menneskers frelse». Vi drømmer om en menighet der mennesker opplever Jesu kjærlighet, finner tilhørighet og blir utrustet til å tjene sine medmennesker.`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 5,
    navOrder: 5,
    inNavMenu: true,
    metaDescription: "Bli kjent med Fjordvik menighet – vår visjon, verdier, fellesskap, lederskap og tilhørighet.",
    ogImage: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&h=630&q=80",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-om-stab",
    slug: "stab",
    title: "Stab",
    summary: "Bli kjent med menighetens ansatte og koordinerende medarbeidere.",
    content: `## Våre ansatte\nHer finner du kontaktinformasjon til pastoren og våre ansatte medarbeidere i Fjordvik menighet.\n\n:::personer[stab]`,
    isPublished: true,
    status: "published",
    parentPageId: "page-om-oss",
    parentId: "page-om-oss",
    menuOrder: 1,
    navOrder: 1,
    inNavMenu: true,
    updatedAt: "2026-08-28T10:00:00.000Z",
  },
  {
    id: "page-om-lederskap",
    slug: "lederskap",
    title: "Lederskap",
    summary: "Menighetsrådet og menighetens valgte lederskap.",
    content: `## Valgt lederskap\nMenighetsrådet velges av menighetens årsmøte og har det overordnede åndelige og administrative ansvaret for menigheten.\n\n:::personer[lederskap]`,
    isPublished: true,
    status: "published",
    parentPageId: "page-om-oss",
    parentId: "page-om-oss",
    menuOrder: 2,
    navOrder: 2,
    inNavMenu: true,
    updatedAt: "2026-08-28T10:00:00.000Z",
  },
  {
    id: "page-om-aktuelt",
    slug: "aktuelt",
    title: "Aktuelt",
    summary: "Ferske artikler, hilsener fra pastoren og rapporter fra arbeidet.",
    content: `## Aktuelt og nyheter\nFølg med på hva som skjer i menigheten. Se også vår forside for kommende arrangementer.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-om-oss",
    parentId: "page-om-oss",
    menuOrder: 3,
    navOrder: 3,
    inNavMenu: true,
    linkUrl: "/#aktuelt",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "page-om-misjon",
    slug: "misjon",
    title: "Misjon",
    summary: "Vårt samarbeid med misjonsorganisasjoner lokalt og internasjonalt.",
    content: `## Tilhørighet og samarbeid\nMenigheten samarbeider tett med misjonsorganisasjoner lokalt og internasjonalt for å utbre evangeliet og drive diakonalt arbeid.`,
    isPublished: true,
    status: "published",
    parentPageId: "page-om-oss",
    parentId: "page-om-oss",
    menuOrder: 4,
    navOrder: 4,
    inNavMenu: true,
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 6. Kontakt (Toppfane)
  {
    id: "page-kontakt",
    slug: "kontakt",
    title: "Kontakt",
    summary: "Besøksadresse, telefon, e-post, kontortider og Vipps for givertjeneste.",
    content: `## Besøksadresse og kontor\nFjordvik menighet\nSentrumsgata 12, 4999 Fjordvik\nKontortid: Tirsdag – Torsdag kl. 10:00 – 14:00\n\n## Gaver og kollekt\nTusen takk for enhver gave til menighetens arbeid!\nVipps: #12345 · Bankkonto: 1503.45.67890`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 6,
    navOrder: 6,
    inNavMenu: true,
    metaDescription: "Kontakt Fjordvik menighet. Finn besøksadresse, åpningstider, telefon, e-post og informasjon om givertjeneste og samtaler.",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  // 7. Personvern (Skjult fra hovedmeny, men aktiv på URL)
  {
    id: "page-personvern",
    slug: "personvern",
    title: "Personvern",
    summary: "Informasjon om hvordan menigheten behandler personopplysninger i henhold til GDPR.",
    content: `## Personvernerklæring (GDPR)\nFjordvik menighet behandler personopplysninger i henhold til personopplysningsloven og EUs personvernforordning (GDPR). Opplysninger om medlemmer og frivillige lagres trygt i europeiske skytjenester og utleveres aldri til tredjepart uten samtykke.`,
    isPublished: true,
    status: "published",
    parentPageId: null,
    parentId: null,
    menuOrder: 7,
    navOrder: 7,
    inNavMenu: false, // Skjult fra toppmeny (oransje X)
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
];
