import { CMS_COLLECTIONS } from "../data/collections";
import type { DatasetDocument } from "./dataset";
import { parseMediaAltComment } from "./media";

// A congregation's website shown in the demo (see utils/demoSite.ts) is shown without the
// pictures of its staff. The demo presents the product to others, and a picture of a person is
// not used for that without the person having said yes. The names and titles stand, as they do
// on the congregation's own website; the pictures do not.
//
// A picture of a member of the staff is found in three places in a set: on the person in the
// staff register, in a block of picture and text on a page (the congregation's own page of
// staff is made of them), and anywhere else the same picture is used.

type Collections = Record<string, DatasetDocument[]>;

/** A block of picture and text on a page, as it is written in the page's text. */
export interface PictureBlock {
  /** The address of the picture. */
  url: string;
  /** The text beside it, with the description of the picture. */
  text: string;
}

const opensPictureBlock = (line: string): boolean => /^:::media-(left|right)/.test(line.trim());
const endsBlock = (line: string): boolean => line.trim().startsWith(":::");
const urlOf = (opening: string): string => /^:::media-(?:left|right)\[(.*?)\]/.exec(opening.trim())?.[1]?.trim() ?? "";

/**
 * The text of a page with pictures taken out: every block of picture and text that `taken`
 * says yes to is left as its text alone. Without `taken`, every picture goes. Everything else
 * in the text is as it was.
 */
export function withoutPictures(content: string, taken: (block: PictureBlock) => boolean = () => true): string {
  const lines = content.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!opensPictureBlock(lines[i])) {
      kept.push(lines[i]);
      continue;
    }
    const opening = lines[i];
    const body: string[] = [];
    while (i + 1 < lines.length && !endsBlock(lines[i + 1])) body.push(lines[++i]);
    const closing = i + 1 < lines.length ? lines[++i] : null;

    if (taken({ url: urlOf(opening), text: body.join("\n") })) {
      // The text stands. The description of the picture goes with the picture
      kept.push(...body.filter((line, index) => !(index === 0 && parseMediaAltComment(line) !== null)));
    } else {
      kept.push(opening, ...body, ...(closing === null ? [] : [closing]));
    }
  }
  return kept.join("\n");
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
/** The address of a picture without what is asked of it (size, cropping), so the same picture is known again. */
const samePicture = (url: string): string => url.split("?")[0];

/**
 * A congregation's website without the pictures of its staff:
 *
 * - nobody in the staff register has a picture
 * - a block of picture and text that names one of the staff, or shows a picture from the
 *   register, is left as its text
 * - a page that names two or more of the staff is a page about people, and has no pictures
 *   in its text and none above it
 * - a news article that uses a picture from the register has none
 */
export function withoutStaffPictures(collections: Collections): Collections {
  const staff = collections[CMS_COLLECTIONS.STAFF] ?? [];
  // A name of a few letters would be found in any text
  const names = staff.map((member) => text(member.name).trim()).filter((name) => name.length >= 5);
  const portraits = new Set(staff.map((member) => samePicture(text(member.imageUrl))).filter(Boolean));
  const namedIn = (words: string): number => names.filter((name) => words.includes(name)).length;
  const isPortrait = (block: PictureBlock): boolean => portraits.has(samePicture(block.url)) || namedIn(block.text) > 0;

  const result: Collections = { ...collections };

  if (collections[CMS_COLLECTIONS.STAFF]) {
    result[CMS_COLLECTIONS.STAFF] = staff.map(({ imageUrl: _picture, ...member }) => member as DatasetDocument);
  }

  if (collections[CMS_COLLECTIONS.PAGES]) {
    result[CMS_COLLECTIONS.PAGES] = collections[CMS_COLLECTIONS.PAGES].map((page) => {
      const content = text(page.content);
      if (namedIn(`${text(page.title)}\n${content}`) < 2) return { ...page, content: withoutPictures(content, isPortrait) };
      const { heroImage: _one, heroImages: _several, ogImage: _shared, ...aboutPeople } = page;
      return { ...aboutPeople, content: withoutPictures(content) } as DatasetDocument;
    });
  }

  if (collections[CMS_COLLECTIONS.NEWS]) {
    result[CMS_COLLECTIONS.NEWS] = collections[CMS_COLLECTIONS.NEWS].map((article) => {
      const withText: DatasetDocument = { ...article, content: withoutPictures(text(article.content), isPortrait) };
      if (!portraits.has(samePicture(text(article.imageUrl)))) return withText;
      const { imageUrl: _picture, ...withoutPicture } = withText;
      return withoutPicture as DatasetDocument;
    });
  }

  return result;
}
