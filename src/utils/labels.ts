// A small label over a title, such as the group an event belongs to, is only worth its line when
// it says something the title does not.

const plain = (text: string): string =>
  text
    .toLocaleLowerCase("nb")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Whether a label only repeats the title: «Gudstjeneste & Storsamling» over «Gudstjeneste», or the
 * same words the other way round. An empty label says nothing either.
 */
export function repeatsTitle(label: string | null | undefined, title: string | null | undefined): boolean {
  const a = plain(label ?? "");
  const b = plain(title ?? "");
  if (a === "") return true;
  if (b === "") return false;
  const words = (text: string) => ` ${text} `;
  return words(a).includes(words(b)) || words(b).includes(words(a));
}
