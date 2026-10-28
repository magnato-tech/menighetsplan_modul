import { VolunteerRole } from "../types";

/** Standard tjenesteroller for gudstjeneste og arrangementer. */
export const DEFAULT_VOLUNTEER_ROLE_NAMES = [
  "Baking",
  "Barnekirke",
  "Bilde",
  "Forbønn",
  "Kjøkken",
  "Lovsang",
  "Lyd",
  "Møteleder",
  "Møtevert",
  "Pynting",
  "Rigging",
  "Taler",
] as const;

export type DefaultVolunteerRoleName = (typeof DEFAULT_VOLUNTEER_ROLE_NAMES)[number];

/** The id of each standard role. Ids are kept when a role leaves the standard, so the ids stored in a congregation's database stay the same. */
export const DEFAULT_VOLUNTEER_ROLE_IDS: Record<DefaultVolunteerRoleName, string> = {
  Baking: "volrole-1",
  Barnekirke: "volrole-2",
  Bilde: "volrole-3",
  Forbønn: "volrole-4",
  Kjøkken: "volrole-5",
  Lovsang: "volrole-7",
  Lyd: "volrole-8",
  Møteleder: "volrole-10",
  Møtevert: "volrole-11",
  Pynting: "volrole-12",
  Rigging: "volrole-13",
  Taler: "volrole-14",
};

/** Known team links for seeded standard roles. */
export const DEFAULT_VOLUNTEER_ROLE_TEAMS: Partial<Record<DefaultVolunteerRoleName, string>> = {
  Lyd: "group-lyd",
  Bilde: "group-lyd",
  Rigging: "group-rigging",
  Kjøkken: "group-kjokken",
  Baking: "group-kjokken",
  Pynting: "group-kjokken",
  Møtevert: "group-motevert",
  Lovsang: "group-lovsang",
  Barnekirke: "group-barn",
  Forbønn: "group-bonn",
  Møteleder: "group-moteledere",
  Taler: "group-moteledere",
};

/** Role instructions used when seeding mock data. */
export const DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS: Partial<Record<DefaultVolunteerRoleName, string>> = {
  Møteleder: [
    "Snakke med taler om tema",
    "Lytte til Gud og finne ut hvor du vil med gudstjenesten",
    "Ha dialog med lovsangsleder om setliste",
    "Sy sammen gudstjenesten og lage en kjøreplan",
    "Spørre Lars eller Magnar om en av de kan forrette nattverden og lyse velsignelsen, evt. finne noen andre som kan gjøre det",
    "Være med på å dele ut nattverden eller finne noen andre til å gjøre det",
    "Sette deg inn i søndagens info og kollekt",
    "Eventuelt lage ekstra bønnevandringsposter hvis du vil (Bønnekrukke, noe tilpasset barna, takkevegg e. l.)",
    "Forberede deg åndelig",
    "Lede bønnemøtet på søndag kl. 10.00 - 10.45. Sett Gud på tronen, vær i bønn og bruk gjerne lovsang (Kl. 10.30 kommer de andre som skal bidra i gudstjenesten for å være med å be)",
    "Ha en gjennomgang av gudstjenesten med taler, lovsangsleder og teknikere kl. 10.45",
    "Ha skrevet ut en kjøreplan som deles ut, slik at alle vet hva som skjer når",
    "Holde styr på tida og si ifra til lovsangsleder at de skal begynne gudstjenesten",
    "Lede menigheten gjennom gudstjenesten (Bli leda av Gud, observere menigheten. Vær åpen for at kjøreplanen kan endres underveis - i samarbeid med lovsangsleder)",
    "Legge til rette for å sitte igjen i salen når gudstjenesten er ferdig hvis du ønsker det",
    "Ting som skal være med i gudstjenesten som du har ansvar for: Velkommen, bønn, søndagens info, informere om nattverd og bønnevandring, informere om kollekt, avslutning og sendelse, informere om kirkekaffe",
    "Ting som kan være med i gudstjenesten som du eventuelt har ansvar for: Bibellesning, vitnesbyrd, bønn for taleren, informere om at det skal være rolig i salen etter møtet hvis du ønsker det, eventuelt andre ting som du ønsker skal være med (Instrumental, solosang, dramastykke, stillhet, delestund e.l.)",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Taler: [
    "Lage preken og forberede deg åndelig",
    "Ta kontakt med møteleder og lovsangsleder om tema",
    "Sende eventuell PowerPoint eller annet som skal opp på skjermen til den som skal styre bildet den gjeldende søndagen (Senest fredag før gudstjenesten)",
    "Møte opp senest kl. 10.00 for å være med på bønnemøtet",
    "Være med på gjennomgang av gudstjenesten kl. 10.45",
    "Holde preken (Bruk språk som passer for kirkefremmede og barn fra 11 år. Varighet: Mellom 20 og 30 minutter.)",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Forbønn: [
    "Forberede deg åndelig",
    "Være med og be på bønnemøtet søndag før gudstjenesten kl. 10.00 - 10.45",
    "Be for dem som ønsker det under gudstjenesten (Etter nattverden)",
    "Bli igjen i salen litt etter møtet er ferdig for å se om noen vil bli bedt for",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Barnekirke: [
    "Rigge klart det du trenger til opplegget du skal ha",
    "Finne frem tegnesaker til barna på et av bordene i møtesalen",
    "Eventuelt samarbeide med møtevert/gudstjenesteleder om bønnestasjon tilpasset barna",
    "Husk at du må ha hentet alt du trenger oppefra før kl. 10.00 (For å ikke forstyrre bønnemøtet)",
    "Bli med på bønnemøtet kl. 10.30 (Du kan gjerne komme fra kl. 10.00)",
    "Være med på gjennomgang av gudstjenesten kl. 10.45",
    "Ha samling/undervisning med barna under talen",
    "Sørge for at barna er tilbake i møtesalen innen nattverden",
    "Rigge ned alt du har rigga opp",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Lovsang: [
    "Passe på at du får med deg iPadene hjem fra gudstjenesten",
    "Ta kontakt med taler om tema",
    "Ta kontakt med møteleder om hva han/hun vil med gudstjenesten, og være i dialog om setliste og kjøreplan",
    "Lage setliste, fikse blekker i riktig toneart og sende dette til de som skal spille (Helst en uke før eller tidligere, senest 5 dager før)",
    "Organisere øving og oppmøtetidspunkt på søndagen",
    "Ta kontakt med lydmann om oppmøte på søndagen (Senest lørdag ettermiddag)",
    "Sende setliste til den som skal styre bildet den gjeldende søndagen (Senest når?) (Si ifra hvis det er noen nye sanger vi ikke har hatt før)",
    "Forberede deg åndelig (Lovsynge, be, lese Bibelen, lytte til Gud o.l.)",
    "Passe på at du har med iPadene med blekker i riktig toneart, og at de er ladet opp (Både til øvelse og selve gudstjenesten)",
    "Kunne sangene godt nok til at du kan lede teamet, være i tilbedelse selv og lede salen inn i det",
    "Være ferdig med å øve i salen senest kl. 10.30 og bli med på bønnemøtet som starter da",
    "Være med på gjennomgang av gudstjenesten kl. 10.45",
    "Holde styr på tida, og være klar over når dere skal opp og ned på scenen",
    "Lede menigheten i lovsang og tilbedelse (Bli leda av Gud, observere menigheten. Vær åpen for at kjøreplanen kan endres underveis - i samarbeid med møteleder)",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Lyd: [
    "Møte opp søndag morgen etter avtale med lovsangsleder",
    "Ta ansvar for linjesjekk og lydprøve",
    "Bli med på bønnemøtet kl. 10.30 (Du kan gjerne komme fra kl. 10.00)",
    "Være med på gjennomgang av gudstjenesten kl. 10.45",
    "Styre lyden (Lytte aktivt, følge med på tegn fra lovsangsteamet)",
    "Sette på rolig lovsang i det gudstjenesten er ferdig",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Bilde: [
    "Møte opp på søndag senest kl. 10.00",
    "Gjøre deg kjent med setlista, og være forberedt på at den kan endres underveis",
    "Bli med på bønnemøtet kl. 10.30 (Du kan gjerne komme fra kl. 10.00)",
    "Gjøre deg kjent med eventuelle andre ting som skal opp på skjermen (Info, videosnutt, PowerPoint e.l)",
    "Være med på gjennomgang av gudstjenesten kl. 10.45",
    "Styre tekst og eventuelt annet som skal opp på skjermen",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Møtevert: [
    "Ønske velkommen i døra fra kl. 10.40 til kl. 11.10 (Det er flere som kan finne på å komme litt seint)",
    "Eventuelt hjelpe til med praktiske oppgaver som oppstår underveis i gudstjenesten",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Rigging: [
    "Rigge opp bordene til kirkekaffen",
    "Rigge opp de faste bønnepostene (Lysgloben, korset med byrdesteiner)",
    "Ta kontakt med lovsangsleder om hvilke instrumenter som skal rigges opp",
    "Rigge opp og ned scenen (For mer detaljer om dette, snakk med Lars)",
    "Rigge ned alt du har rigget opp",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Kjøkken: [
    "Rigge klart nattverdsbordet (Bord, duk, glass, juice i karaffel, nattverdsoblater + bord, duk og brett til å sette brukte glass på)",
    "Koke kaffe og tevann ferdig til senest kl. 10.30 + sette frem te, kakao og twist/annet godt",
    "Sette frem diverse mat og drikke til kirkekaffen (Kaffe, te, kakao, saft, vann, mat og kaker)",
    "Ta ansvar for oppvask i etterkant av kirkekaffen",
    "Se over møtesalen etter brukte kaffekopper og nattverdsglass når gudstjenesten er ferdig",
    "Rydde på plass alt du har funnet frem",
    "Rydde brettene med nattverdsglass ut på kjøkkenet når nattverden er ferdig",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Baking: [
    "Bake kake(r) og ta med til gudstjenesten (Snakk med den som har ansvaret for kjøkkenet den gjeldende søndagen)",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
  Pynting: [
    "Pynte (Lys og blomst til nattverdsbordet, noe på bordene i kirkekafferommet og noe på baren ved miksepulten. Eventuelt noe på/ved scenen ved spesielle anledninger)",
    "Sjekke at det er nok små lys til globen",
    "Tenne lys (Nattverdsbordet og lysgloben + kirkekafferommet)",
    "Slukke levende lys når gudstjenesten er over",
    "Rigge ned alt som du rigga opp",
  ]
    .map((line) => `• ${line}`)
    .join("\n"),
};

/**
 * Standard instructions that have been replaced by the ones above (13 October 2026, when the
 * instructions were checked against the congregation's own sheet). A role that still has one of
 * these, has the standard text untouched, and can be given the new one. A text the congregation
 * has written or changed itself, is never one of these.
 */
const SUPERSEDED_VOLUNTEER_ROLE_INSTRUCTIONS: Partial<Record<DefaultVolunteerRoleName, string[][]>> = {
  Møteleder: [
    [
      "Snakke med taler om tema",
      "Lytte til Gud og finne ut hvor du vil med gudstjenesten",
      "Ha dialog med lovsangsleder om setliste",
      "Sy sammen gudstjenesten og lage en kjøreplan",
      "Spørre Lars eller Magnar om en av de kan forrette nattverden og lyse velsignelsen, evt. finne noen andre som kan gjøre det",
      "Være med på å dele ut nattverden eller finne noen andre til å gjøre det",
      "Sette deg inn i søndagens info og kollekt",
      "Eventuelt lage ekstra bønnevandringsposter hvis du vil (Bønnekrukke, noe tilpasset barna, takkevegg e. l.)",
      "Forberede deg åndelig",
      "Lede bønnemøtet på søndag kl. 10.00 - 10.45. Sett Gud på tronen, vær i bønn og bruk gjerne lovsang (Kl. 10.30 kommer de andre som skal bidra i gudstjenesten for å være med å be)",
      "Ha en gjennomgang av gudstjenesten med taler, lovsangsleder og teknikere kl. 10.45",
      "Ha skrevet ut en kjøreplan som deles ut, slik at alle vet hva som skjer når",
      "Holde styr på tida og si ifra til lovsangsleder at de skal begynne gudstjenesten",
      "Lede menigheten gjennom gudstjenesten (Bli leda av Gud, observere menigheten. Vær åpen for at kjøreplanen kan endres underveis - i samarbeid med lovsangsleder)",
    ],
  ],
  Barnekirke: [
    [
      "Rigge klart det du trenger til opplegget du skal ha",
      "Finne frem tegnesaker til barna på et av bordene i møtesalen",
      "Eventuelt samarbeide med møtevert/gudstjenesteleder om bønnestasjon tilpasset barna",
      "Ha samling/undervisning med barna under talen",
      "Sørge for at barna er tilbake i møtesalen innen nattverden",
      "Husk at du må ha hentet alt du trenger oppefra før kl. 10.00 (For å ikke forstyrre bønnemøtet)",
      "Rigge ned alt du har rigga opp",
    ],
  ],
  Lovsang: [
    [
      "Passe på at du får med deg iPadene hjem fra gudstjenesten",
      "Ta kontakt med taler om tema",
      "Ta kontakt med møteleder om hva han/hun vil med gudstjenesten, og være i dialog om setliste og kjøreplan",
      "Lage setliste, fikse blekker i riktig toneart og sende dette til de som skal spille (Helst en uke før eller tidligere, senest 5 dager før)",
      "Bli med på bønnemøtet kl. 10.30 (Du kan gjerne komme fra kl. 10.00)",
      "Organisere øving og oppmøtetidspunkt på søndagen",
      "Ta kontakt med lydmann om oppmøte på søndagen (Senest lørdag ettermiddag)",
      "Sende setliste til den som skal styre bildet den gjeldende søndagen (Senest når?) (Si ifra hvis det er noen nye sanger vi ikke har hatt før)",
      "Forberede deg åndelig (Lovsynge, be, lese Bibelen, lytte til Gud o.l.)",
      "Passe på at du har med iPadene med blekker i riktig toneart, og at de er ladet opp (Både til øvelse og selve gudstjenesten)",
      "Kunne sangene godt nok til at du kan lede teamet, være i tilbedelse selv og lede salen inn i det",
      "Være ferdig med å øve i salen senest kl. 10.30 og bli med på bønnemøtet som starter da",
      "Være med på gjennomgang av gudstjenesten kl. 10.45",
      "Holde styr på tida, og være klar over når dere skal opp og ned på scenen",
      "Lede menigheten i lovsang og tilbedelse (Bli leda av Gud, observere menigheten. Vær åpen for at kjøreplanen kan endres underveis - i samarbeid med møteleder)",
    ],
  ],
  Møtevert: [
    [
      "Ønske velkommen i døra fra kl. 10.40 til kl. 11.10 (Det er flere som kan finne på å komme litt seint)",
      "Eventuelt hjelpe til med praktiske oppgaver som oppstår underveis i gudstjenesten",
      "Se over møtesalen etter brukte kaffekopper og nattverdsglass når gudstjenesten er ferdig",
    ],
  ],
  Kjøkken: [
    [
      "Rigge klart nattverdsbordet (Bord, duk, glass, juice i karaffel, nattverdsoblater + bord, duk og brett til å sette brukte glass på)",
      "Koke kaffe og tevann ferdig til senest kl. 10.30 + sette frem te, kakao og twist/annet godt",
      "Sette frem diverse mat og drikke til kirkekaffen (Kaffe, te, kakao, saft, vann, mat og kaker)",
      "Rydde på plass alt du har funnet frem",
    ],
  ],
};

/** The names a standard role is also known by: the role that leads a service is called «Leder» by some. */
const ROLE_ALIASES: Record<string, DefaultVolunteerRoleName> = { leder: "Møteleder", gudstjenesteleder: "Møteleder" };

const sameText = (text: string): string => text.replace(/[•\s]+/g, " ").trim();

/**
 * The roles that can be given the standard instruction, each with that instruction: a role
 * without an instruction, and a role that still has an earlier standard instruction untouched.
 * A role with a text of its own is never among them: what the congregation has written, stands.
 */
export function rolesMissingStandardInstruction<T extends Pick<VolunteerRole, "name" | "instruction">>(roles: readonly T[]): { role: T; instruction: string }[] {
  const names = Object.keys(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS) as DefaultVolunteerRoleName[];
  return roles.flatMap((role) => {
    const wanted = role.name.trim().toLocaleLowerCase("nb");
    const name = names.find((candidate) => candidate.toLocaleLowerCase("nb") === wanted) ?? ROLE_ALIASES[wanted];
    const instruction = name ? DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS[name] : undefined;
    if (!name || !instruction) return [];
    const current = (role.instruction ?? "").trim();
    const earlier = (SUPERSEDED_VOLUNTEER_ROLE_INSTRUCTIONS[name] ?? []).some((lines) => sameText(lines.join("\n")) === sameText(current));
    return current === "" || earlier ? [{ role, instruction }] : [];
  });
}

export function volunteerRoleIdForName(name: DefaultVolunteerRoleName): string {
  const id = DEFAULT_VOLUNTEER_ROLE_IDS[name];
  if (!id) throw new Error(`Ukjent rolle: ${name}`);
  return id;
}

export function buildInitialVolunteerRoles(maxCount?: number): VolunteerRole[] {
  const count = maxCount === undefined ? DEFAULT_VOLUNTEER_ROLE_NAMES.length : Math.max(0, maxCount);
  return DEFAULT_VOLUNTEER_ROLE_NAMES.slice(0, count).map((name, index) => ({
    id: volunteerRoleIdForName(name),
    name,
    instruction: DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS[name] || "",
    groupId: DEFAULT_VOLUNTEER_ROLE_TEAMS[name],
    sortOrder: index,
  }));
}
