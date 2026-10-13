import type { YearWheelItem } from "../utils/yearWheel";

// The standard annual wheel: what a congregation sees until it has changed something. It is the
// wheel of the first congregation, given by the product owner on 13 October 2026 as a picture.
// Where the picture cut a title short, a word cut in the middle is written out when there was no
// doubt what it was, and what came after it is left out, not guessed. The congregation writes the
// rest itself, since every item can be edited. The code names no denomination (see
// tests/neutral-code.test.ts), so the report at the end of the year goes to «kirkesamfunnet».
// PMF in March stands as it was given.

const item = (month: number, day: number, title: string): Omit<YearWheelItem, "id"> => ({ month, day, title });

const ITEMS: Omit<YearWheelItem, "id">[] = [
  item(1, 15, "Rapportere trossamfunnsstatistikk"),
  item(1, 31, "Rapportere skattemelding"),
  item(1, 31, "Regnskap og planlegging"),

  item(2, 15, "Sende ut innkallelse til årsmøte"),
  item(2, 28, "Nominasjon av kandidater"),
  item(2, 28, "Regnskapsrapportering"),

  item(3, 1, "Rapportere menighetsstatistikk"),
  item(3, 20, "PMF (uke 11)"),
  item(3, 31, "Årsmøte"),
  item(3, 31, "Månedsregnskap"),

  item(4, 30, "Menighetsweekend"),
  item(4, 30, "Ferdigstille kalender for høsten"),
  item(4, 30, "Melde arrangementer til utleier"),
  item(4, 30, "Rapportering av årsregnskap"),

  item(5, 31, "Månedsregnskap"),

  item(6, 15, "Utegudstjeneste (søknadsfrist)"),
  item(6, 30, "Gudstjenesteliste for høsthalvåret"),
  item(6, 30, "Månedsregnskap"),

  item(7, 31, "MVA-rapportering"),

  item(8, 15, "Nedsette komité"),
  item(8, 31, "Fastsette datoer for lederskapet"),
  item(8, 31, "Gudstjenesteledermøte"),
  item(8, 31, "Kartlegging av frivillige"),
  item(8, 31, "Sjekke politiattester"),

  item(9, 30, "Ferdigstille kalender for vårhalvåret"),
  item(9, 30, "Melde arrangementer til utleier"),
  item(9, 30, "Månedsregnskap"),

  item(10, 31, "Menighetsmøte"),
  item(10, 31, "Kampanje for faste givere"),
  item(10, 31, "Planleggingsstart for advent"),

  item(11, 30, "Budsjettarbeid for kommende år"),
  item(11, 30, "Planlegging av menighetsweekend"),

  item(12, 20, "Gudstjenesteliste for vårhalvåret"),
  item(12, 24, "Adventsamling"),
  item(12, 31, "Planlegging av neste år"),
  item(12, 31, "Rapportering til kirkesamfunnet"),
];

/** The standard wheel, each item with an id that is the same every time. */
export const DEFAULT_YEAR_WHEEL: readonly YearWheelItem[] = ITEMS.map((entry, at) => ({ id: `standard-${at + 1}`, ...entry }));
