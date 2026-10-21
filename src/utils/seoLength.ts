/** How long a description for Google is: Google shows about 150–160 characters under the title. */
export type SeoLength = "empty" | "short" | "good" | "long";

export function seoLengthOf(text: string): SeoLength {
  const length = text.trim().length;
  if (length === 0) return "empty";
  if (length < 70) return "short";
  if (length <= 160) return "good";
  return "long";
}

/** The line under the field: how many characters, and what to do about it. */
export function seoLengthHint(text: string): string {
  const length = text.trim().length;
  switch (seoLengthOf(text)) {
    case "empty":
      return "Tomt: Google lager en beskrivelse selv fra teksten på siden.";
    case "short":
      return `${length} tegn. Kort; 150–160 tegn passer best.`;
    case "good":
      return `${length} tegn. God lengde.`;
    default:
      return `${length} tegn. Google kutter etter omtrent 160 tegn.`;
  }
}
