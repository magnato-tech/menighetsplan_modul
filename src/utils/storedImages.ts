// Pictures kept as text inside the database («data:image/…;base64,…»), from before pictures went to
// the picture store (Firebase Storage). They make every page heavier and cannot be shared on
// Facebook. These functions find them and put the store's address in their place; the upload itself
// is in services/mediaStorage.ts.

const STORED_IMAGE = /data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g;

export function isStoredImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/[a-z+.-]+;base64,/.test(value.trim());
}

/** Every picture kept as text in a value: the value itself, or inside a text such as a page's content. */
export function storedImagesIn(value: unknown): string[] {
  if (typeof value === "string") return value.match(STORED_IMAGE) ?? [];
  if (Array.isArray(value)) return value.flatMap(storedImagesIn);
  return [];
}

/** Where a picture was found: which document, and which of its fields. */
export interface StoredImagePlace {
  kind: "page" | "news" | "sermon" | "staff" | "settings";
  id: string;
  title: string;
  fields: string[];
}

/** The fields that can hold a picture, for each kind of document. */
export const IMAGE_FIELDS: Record<StoredImagePlace["kind"], string[]> = {
  page: ["heroImage", "heroImages", "ogImage", "content"],
  news: ["imageUrl", "content"],
  sermon: ["imageUrl"],
  staff: ["imageUrl"],
  settings: ["logoUrl", "logoOnDarkUrl", "heroImageUrl"],
};

/** The documents that hold pictures kept as text, and in which fields. */
export function findStoredImages(
  kind: StoredImagePlace["kind"],
  documents: readonly ({ id: string; title?: string; name?: string } & Record<string, unknown>)[]
): StoredImagePlace[] {
  return documents.flatMap((document) => {
    const fields = IMAGE_FIELDS[kind].filter((field) => storedImagesIn(document[field]).length > 0);
    return fields.length > 0 ? [{ kind, id: document.id, title: document.title || document.name || document.id, fields }] : [];
  });
}

/** The fields of a document with every picture kept as text replaced by its address in the store. */
export function withStoredImagesReplaced(
  document: Record<string, unknown>,
  fields: string[],
  addresses: ReadonlyMap<string, string>
): Record<string, unknown> {
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(STORED_IMAGE, (image) => addresses.get(image) ?? image);
    if (Array.isArray(value)) return value.map(replace);
    return value;
  };
  return Object.fromEntries(fields.map((field) => [field, replace(document[field])]));
}

/** The file type of a picture kept as text, and the ending its file gets in the store. */
export function storedImageType(image: string): { contentType: string; extension: string } {
  const contentType = /^data:(image\/[a-z+.-]+);/.exec(image)?.[1] ?? "image/jpeg";
  const extension = contentType === "image/svg+xml" ? "svg" : contentType.split("/")[1].replace("jpeg", "jpg");
  return { contentType, extension };
}
