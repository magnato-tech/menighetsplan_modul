import type { CmsPage } from "../data/cmsData";
import type { VisualBlock } from "./cmsBlocks";
import { pageUrl } from "./menu";

/** Message types from CMS parent to preview iframe. */
export type CmsToPreviewMessage =
  | { type: "cms:draft"; pageId: string; revision: number; draft: WarmDraftFields }
  | { type: "cms:draft-stored"; pageId: string; revision: number }
  | { type: "cms:focus"; blockId: string };

/** Message types from preview iframe to CMS parent. */
export type PreviewToCmsMessage =
  | { type: "preview:ready"; path: string; hash: string; revision: number; pageId?: string }
  | { type: "preview:location"; path: string; hash: string }
  | { type: "preview:blocked"; reason: "internal-route" };

export type PreviewBridgeMessage = CmsToPreviewMessage | PreviewToCmsMessage;

const COLD_DRAFT_KEYS = new Set(["content", "blocks", "heroImage", "ogImage"]);

/** Fields safe to send on every keystroke (no large blobs). */
export type WarmDraftFields = Partial<
  Pick<
    CmsPage,
    | "id"
    | "slug"
    | "title"
    | "summary"
    | "showHero"
    | "heroTitle"
    | "heroCtaText"
    | "heroCtaLink"
    | "heroCtaSecondaryText"
    | "heroCtaSecondaryLink"
    | "showHeroPrimaryCta"
    | "showHeroSecondaryCta"
    | "isPublished"
    | "inNavMenu"
    | "linkUrl"
    | "metaDescription"
    | "publishAt"
    | "status"
  >
>;

export interface PreviewDraftSnapshot extends Partial<CmsPage> {
  revision: number;
  publicPath: string;
}

const WARM_DRAFT_KEYS: (keyof WarmDraftFields)[] = [
  "id",
  "slug",
  "title",
  "summary",
  "showHero",
  "heroTitle",
  "heroCtaText",
  "heroCtaLink",
  "heroCtaSecondaryText",
  "heroCtaSecondaryLink",
  "showHeroPrimaryCta",
  "showHeroSecondaryCta",
  "isPublished",
  "inNavMenu",
  "linkUrl",
  "metaDescription",
  "publishAt",
  "status",
];

export function draftStorageKeyById(pageId: string): string {
  return `cms_preview_draft_id_${pageId}`;
}

export function draftStorageKeyBySlug(slug: string): string {
  const clean = slug.toLowerCase().replace(/^\//, "").trim();
  return `cms_preview_draft_${clean || "forside"}`;
}

export function extractWarmDraft(page: Partial<CmsPage>): WarmDraftFields {
  const warm: WarmDraftFields = {};
  for (const key of WARM_DRAFT_KEYS) {
    if (page[key] !== undefined) {
      (warm as Record<string, unknown>)[key] = page[key];
    }
  }
  return warm;
}

/** Rejects cold blobs in warm draft messages. */
export function applyWarmDraft(base: Partial<CmsPage>, warm: WarmDraftFields): Partial<CmsPage> {
  for (const key of Object.keys(warm)) {
    if (COLD_DRAFT_KEYS.has(key)) {
      throw new Error(`Warm draft must not contain cold field: ${key}`);
    }
  }
  return { ...base, ...warm };
}

export function buildDraftSnapshot(
  page: Partial<CmsPage>,
  revision: number,
  blocks?: VisualBlock[]
): PreviewDraftSnapshot {
  const slug = (page.slug || "").toLowerCase().replace(/^\//, "").trim();
  const publicPath = page.linkUrl?.trim() || (slug === "forside" || !slug ? "/" : `/${slug}`);
  return {
    ...page,
    slug,
    blocks: blocks ?? page.blocks,
    revision,
    publicPath,
  };
}

/** How much of the page the preview got: everything, all but images that only exist unsaved, only the form fields, or nothing. */
export type SnapshotFit = "full" | "saved-images" | "fields-only" | "none";

const ID_KEY_PREFIX = "cms_preview_draft_id_";
const isInlineImage = (value: unknown) => typeof value === "string" && value.startsWith("data:");

/** The snapshot without uploaded images that live as text in the page: the preview shows those as last saved. */
function withSavedImages(snapshot: PreviewDraftSnapshot): PreviewDraftSnapshot {
  const lighter: PreviewDraftSnapshot = { ...snapshot };
  if (isInlineImage(lighter.heroImage)) delete lighter.heroImage;
  if (isInlineImage(lighter.ogImage)) delete lighter.ogImage;
  if (lighter.heroImages?.some(isInlineImage)) delete lighter.heroImages;
  return lighter;
}

/** Only the fields typed in the form: the content blocks are shown as last saved. */
function fieldsOnly(snapshot: PreviewDraftSnapshot): PreviewDraftSnapshot {
  const lighter = withSavedImages(snapshot);
  delete lighter.content;
  delete lighter.blocks;
  return lighter;
}

/**
 * Stores the page being edited for the preview frame. The whole page is stored once, under its id; the
 * other two keys only say which page it is. Pages with uploaded images can be larger than the browser
 * allows (about 5 MB), so a page that does not fit is stored again without them, and then without the
 * content blocks. Snapshots of other pages edited earlier are removed first, so they do not take the room.
 */
export function writeDraftSnapshot(
  snapshot: PreviewDraftSnapshot,
  previousSlug?: string,
  storage: Storage | undefined = typeof sessionStorage === "undefined" ? undefined : sessionStorage
): SnapshotFit {
  if (!storage) return "none";
  const pageId = snapshot.id || "draft-page-preview";
  const idKey = draftStorageKeyById(pageId);

  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && key.startsWith(ID_KEY_PREFIX) && key !== idKey) storage.removeItem(key);
  }

  const pointer = JSON.stringify({ id: pageId, slug: snapshot.slug, linkUrl: snapshot.linkUrl, publicPath: snapshot.publicPath });
  const attempts: [SnapshotFit, PreviewDraftSnapshot][] = [
    ["full", snapshot],
    ["saved-images", withSavedImages(snapshot)],
    ["fields-only", fieldsOnly(snapshot)],
  ];
  for (const [fit, candidate] of attempts) {
    try {
      storage.removeItem(idKey);
      storage.setItem(idKey, JSON.stringify(candidate));
      storage.setItem("cms_preview_active", pointer);
      storage.setItem(draftStorageKeyBySlug(snapshot.slug || ""), pointer);
      if (previousSlug && previousSlug !== snapshot.slug) {
        storage.removeItem(draftStorageKeyBySlug(previousSlug));
      }
      return fit;
    } catch (error) {
      if (fit === "fields-only") {
        console.warn("Forhåndsvisningen fikk ikke plass til siden i nettleseren", error);
      }
    }
  }
  return "none";
}

export function readDraftSnapshotById(pageId: string): PreviewDraftSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftStorageKeyById(pageId));
    if (!raw) return null;
    return JSON.parse(raw) as PreviewDraftSnapshot;
  } catch {
    return null;
  }
}

export function readDraftSnapshotForPath(pathname: string, pages: CmsPage[]): PreviewDraftSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "") || "/";

  try {
    const activeRaw = sessionStorage.getItem("cms_preview_active");
    if (activeRaw) {
      const active = JSON.parse(activeRaw) as PreviewDraftSnapshot;
      const activePath =
        active.publicPath ||
        pageUrl({ slug: active.slug || "", linkUrl: active.linkUrl });
      if (activePath === normalized || (normalized === "/" && (active.slug === "" || active.slug === "forside"))) {
        const byId = active.id ? readDraftSnapshotById(active.id) : null;
        return byId || active;
      }
    }

    for (const page of pages) {
      const pPath = pageUrl(page);
      if (pPath !== normalized) continue;
      const byId = readDraftSnapshotById(page.id);
      if (byId) return byId;
      const bySlug = sessionStorage.getItem(draftStorageKeyBySlug(page.slug));
      if (bySlug) {
        const found = JSON.parse(bySlug) as PreviewDraftSnapshot;
        return (found.id ? readDraftSnapshotById(found.id) : null) || found;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isInternalPath(path: string): boolean {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function isValidPageId(pageId: unknown): pageId is string {
  return typeof pageId === "string" && pageId.length > 0;
}

function isValidRevision(revision: unknown): revision is number {
  return typeof revision === "number" && Number.isFinite(revision);
}

/** Validates and normalizes an incoming bridge message. Returns null if rejected. */
export function parseBridgeMessage(data: unknown): PreviewBridgeMessage | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  const type = msg.type;
  if (typeof type !== "string") return null;

  switch (type) {
    case "cms:draft": {
      if (!isValidPageId(msg.pageId) || !isValidRevision(msg.revision)) return null;
      const draft = msg.draft;
      if (!draft || typeof draft !== "object") return null;
      for (const key of Object.keys(draft as object)) {
        if (COLD_DRAFT_KEYS.has(key)) return null;
      }
      return {
        type: "cms:draft",
        pageId: msg.pageId,
        revision: msg.revision,
        draft: draft as WarmDraftFields,
      };
    }
    case "cms:draft-stored": {
      if (!isValidPageId(msg.pageId) || !isValidRevision(msg.revision)) return null;
      return { type: "cms:draft-stored", pageId: msg.pageId, revision: msg.revision };
    }
    case "cms:focus": {
      if (typeof msg.blockId !== "string" || !msg.blockId) return null;
      return { type: "cms:focus", blockId: msg.blockId };
    }
    case "preview:ready": {
      if (!isInternalPath(msg.path as string) || !isValidRevision(msg.revision)) return null;
      return {
        type: "preview:ready",
        path: msg.path as string,
        hash: typeof msg.hash === "string" ? msg.hash : "",
        revision: msg.revision,
        pageId: typeof msg.pageId === "string" ? msg.pageId : undefined,
      };
    }
    case "preview:location": {
      if (!isInternalPath(msg.path as string)) return null;
      return {
        type: "preview:location",
        path: msg.path as string,
        hash: typeof msg.hash === "string" ? msg.hash : "",
      };
    }
    case "preview:blocked": {
      if (msg.reason !== "internal-route") return null;
      return { type: "preview:blocked", reason: "internal-route" };
    }
    default:
      return null;
  }
}

export function isCmsToPreviewMessage(msg: PreviewBridgeMessage): msg is CmsToPreviewMessage {
  return msg.type.startsWith("cms:");
}

export function isPreviewToCmsMessage(msg: PreviewBridgeMessage): msg is PreviewToCmsMessage {
  return msg.type.startsWith("preview:");
}

export interface MessageEventLike {
  origin: string;
  source: MessageEventSource | null;
  data: unknown;
}

/** Parent-side: accept only messages from the registered iframe window. */
export function acceptParentMessage(
  event: MessageEventLike,
  expectedOrigin: string,
  iframeWindow: Window | null
): PreviewToCmsMessage | null {
  if (event.origin !== expectedOrigin) return null;
  if (!iframeWindow || event.source !== iframeWindow) return null;
  const parsed = parseBridgeMessage(event.data);
  if (!parsed || !isPreviewToCmsMessage(parsed)) return null;
  return parsed;
}

/** Iframe-side: accept only messages from parent. */
export function acceptIframeMessage(
  event: MessageEventLike,
  expectedOrigin: string,
  parentWindow: Window
): CmsToPreviewMessage | null {
  if (event.origin !== expectedOrigin) return null;
  if (event.source !== parentWindow) return null;
  const parsed = parseBridgeMessage(event.data);
  if (!parsed || !isCmsToPreviewMessage(parsed)) return null;
  return parsed;
}

export function postToPreview(iframeWindow: Window | null, message: CmsToPreviewMessage, origin: string): void {
  iframeWindow?.postMessage(message, origin);
}

export function postToParent(message: PreviewToCmsMessage, origin: string): void {
  window.parent.postMessage(message, origin);
}

/** Preview mode flags read once at document load. */
export interface PreviewModeFlags {
  preview: boolean;
  embedded: boolean;
}

export function readPreviewModeFlags(search: string, isIframe: boolean): PreviewModeFlags {
  const params = new URLSearchParams(search);
  const preview = params.get("preview") === "true";
  const embedded = preview && isIframe && params.get("embedded") === "1";
  return { preview, embedded };
}

/** Builds search string to preserve on internal navigation. */
export function previewSearchFor(flags: PreviewModeFlags): string {
  if (!flags.preview) return "";
  const params = new URLSearchParams();
  params.set("preview", "true");
  if (flags.embedded) params.set("embedded", "1");
  return `?${params.toString()}`;
}

export function pathsMatchDraft(publicPath: string, draftPath: string): boolean {
  const a = publicPath === "/" ? "/" : publicPath.replace(/\/$/, "") || "/";
  const b = draftPath === "/" ? "/" : draftPath.replace(/\/$/, "") || "/";
  return a === b;
}

export function buildEmbeddedPreviewUrl(publicPath: string): string {
  const base = publicPath || "/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}preview=true&embedded=1`;
}

export function buildNewTabPreviewUrl(publicPath: string): string {
  const base = publicPath || "/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}preview=true`;
}
