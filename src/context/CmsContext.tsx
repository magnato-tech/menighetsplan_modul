import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../data/collections";
import {
  createDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  deletePage as deletePageWithSubPages,
  reorderPages as reorderPagesInFirestore,
} from "../services/firestore";
import { reportWriteError } from "../services/writeErrors";
import { saveAddonChoice, subscribeAddons } from "../services/addons";
import type { AddonChoices, AddonId } from "../utils/addons";
import { newId } from "../utils/id";
import {
  CmsPage,
  CmsNewsArticle,
  CmsSermon,
  CmsStaffMember,
  CmsSettings,
  CmsMedia,
  emptyCmsSettings,
} from "../data/cmsData";
import { buildCmsMedia } from "../data/newDocuments";
import { buildMediaVariantBlobs } from "../utils/imageVariants";
import { uploadMediaVariants, deleteMediaStorageFiles } from "../services/mediaStorage";
import { findMediaUsages } from "../utils/media";

/** Whether the database has said which add-ons are on. */
export type AddonsState = "loading" | "ready" | "failed";

interface CmsContextValue {
  pages: CmsPage[];
  news: CmsNewsArticle[];
  sermons: CmsSermon[];
  staff: CmsStaffMember[];
  media: CmsMedia[];
  settings: CmsSettings;
  /**
   * Whether the pages and the news have been received from the database, and are not only the
   * copy kept in the browser. Until then, an address without a page may just not be loaded yet.
   */
  contentReady: boolean;
  /**
   * The add-ons that are on (see utils/addons.ts). None is on until the database has answered,
   * and none is on if it could not be asked.
   */
  addons: AddonChoices;
  addonsState: AddonsState;
  setAddon: (id: AddonId, on: boolean) => Promise<boolean>;
  // Every write resolves to whether it reached Firestore. A failure is already shown to the user.
  savePage: (page: Partial<CmsPage> & { id?: string }) => Promise<boolean>;
  deletePage: (pageId: string) => Promise<boolean>;
  reorderPages: (orderedPageIds: string[]) => Promise<boolean>;
  saveNews: (newsData: Partial<CmsNewsArticle> & { id?: string }) => Promise<boolean>;
  deleteNews: (newsId: string) => Promise<boolean>;
  saveSermon: (sermonData: Partial<CmsSermon> & { id?: string }) => Promise<boolean>;
  deleteSermon: (sermonId: string) => Promise<boolean>;
  saveStaff: (staffData: Partial<CmsStaffMember> & { id?: string }) => Promise<boolean>;
  deleteStaff: (staffId: string) => Promise<boolean>;
  saveSettings: (settingsData: Partial<CmsSettings>) => Promise<boolean>;
  uploadMedia: (
    file: File,
    meta: { title: string; altText: string; tags?: string[]; approvedForAi?: boolean }
  ) => Promise<CmsMedia | null>;
  updateMedia: (mediaId: string, updates: Partial<CmsMedia>) => Promise<boolean>;
  archiveMedia: (mediaId: string) => Promise<boolean>;
  deleteMedia: (mediaId: string) => Promise<{ ok: boolean; blockedByUsages?: boolean }>;
  getMediaUsages: (mediaId: string) => ReturnType<typeof findMediaUsages>;
  getPageBySlug: (slug: string) => CmsPage | undefined;
  getNewsById: (id: string) => CmsNewsArticle | undefined;
  getNewsBySlug: (slug: string) => CmsNewsArticle | undefined;
}

const CmsContext = createContext<CmsContextValue | null>(null);

// The last content received is kept in the browser, so the public site has
// something to show before Firestore has answered.
const STORAGE_KEYS = {
  pages: "menighetsplan_cms_pages_v3",
  pagesPublic: "menighetsplan_cms_pages_public_v1",
  news: "menighetsplan_cms_news_v3",
  sermons: "menighetsplan_cms_sermons_v3",
  staff: "menighetsplan_cms_staff_v3",
  media: "menighetsplan_cms_media_v1",
  settings: "menighetsplan_cms_settings_v3",
};

function readCache<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    // Unreadable or blocked storage only means there is nothing to show yet
    return null;
  }
}

/** Keeps `value` for the next visit, or forgets the entry when `value` is null. */
function writeCache(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked storage costs the head start on the next visit, nothing else
  }
}

// A listener that fails stops for good, so say which one it was
const onListenerError = (name: string) => (error: Error) => console.warn(`Firestore sync error (${name}):`, error);

const newestFirst = (a: { publishedAt: string }, b: { publishedAt: string }) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
const latestDateFirst = (a: { date: string }, b: { date: string }) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

/**
 * A CMS collection as Firestore has it, starting from the copy kept in the browser, and
 * whether Firestore has answered yet. A write shows up here through the listener; nothing
 * else changes the list.
 */
function useCmsCollection<T>(
  name: string,
  storageKey: string,
  compare?: (a: T, b: T) => number,
  filterPublishedOnly = false
): [T[], boolean] {
  const [items, setItems] = useState<T[]>(() => readCache<T[]>(storageKey) ?? []);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    let isFirst = true;
    const source = filterPublishedOnly
      ? query(collection(db, name), where("isPublished", "==", true))
      : collection(db, name);
    return onSnapshot(
      source,
      (snapshot) => {
        // Opened without a connection, Firestore first reports an empty collection. Keep the copy we have.
        const emptyBecauseOffline = isFirst && snapshot.empty && snapshot.metadata.fromCache;
        isFirst = false;
        if (emptyBecauseOffline) return;

        const list = snapshot.docs.map((d) => d.data() as T);
        if (compare) list.sort(compare);
        setItems(list);
        writeCache(storageKey, list);
        setAnswered(true);
      },
      onListenerError(name)
    );
  }, [name, storageKey, compare]);
  return [items, answered];
}

/** The site settings. Until a settings document exists they are empty: nothing about any congregation is shown. */
function useCmsSettings(): CmsSettings {
  const [settings, setSettings] = useState<CmsSettings>(
    () => readCache<CmsSettings>(STORAGE_KEYS.settings) ?? emptyCmsSettings
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, CMS_COLLECTIONS.SETTINGS, CMS_SETTINGS_DOC_ID),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as CmsSettings;
            setSettings(data);
            writeCache(STORAGE_KEYS.settings, data);
          } else if (!snapshot.metadata.fromCache) {
            // Only the server can say the document is gone; without a connection it is merely not fetched yet
            setSettings(emptyCmsSettings);
            writeCache(STORAGE_KEYS.settings, null);
          }
        },
        onListenerError(CMS_COLLECTIONS.SETTINGS)
      ),
    []
  );

  return settings;
}

/**
 * Which add-ons are on. Nothing is kept in the browser for the next visit: a visitor's browser
 * has no use for how the admin is set up, and an add-on must never be on by a guess.
 */
function useCmsAddons(): { addons: AddonChoices; addonsState: AddonsState } {
  const [state, setState] = useState<{ addons: AddonChoices; addonsState: AddonsState }>({ addons: {}, addonsState: "loading" });

  useEffect(
    () =>
      subscribeAddons(
        (addons) => setState({ addons, addonsState: "ready" }),
        (error) => {
          onListenerError("addons")(error);
          setState({ addons: {}, addonsState: "failed" });
        }
      ),
    []
  );

  return state;
}

/** Waits for the server's answer, so an editor can stay open with what was typed if the save fails. */
async function attempt(action: string, write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (err) {
    reportWriteError(action, err);
    return false;
  }
}

// Each write builds the complete document, so a field left out in the editor gets its default
const writes = {
  setAddon: (id: AddonId, on: boolean) =>
    attempt(on ? "slå på modulen" : "slå av modulen", () => saveAddonChoice(id, on)),
  savePage: (pageData: Partial<CmsPage> & { id?: string }) => {
    const resolvedParent =
      pageData.parentPageId !== undefined
        ? pageData.parentPageId
        : pageData.parentId || null;

    const resolvedOrder =
      typeof pageData.menuOrder === "number"
        ? pageData.menuOrder
        : typeof pageData.navOrder === "number"
        ? pageData.navOrder
        : 99;

    const isPublished = pageData.isPublished !== false;
    const publishAt = pageData.publishAt?.trim() || pageData.publishedAt?.trim() || undefined;
    const isFutureScheduled = Boolean(
      isPublished && publishAt && new Date(publishAt).getTime() > Date.now()
    );

    const resolvedStatus: "draft" | "published" | "scheduled" = !isPublished
      ? "draft"
      : isFutureScheduled
      ? "scheduled"
      : "published";

    const page: CmsPage = {
      id: pageData.id || newId("page"),
      slug: (pageData.slug || `side-${Date.now()}`).toLowerCase().trim().replace(/^\//, ""),
      title: pageData.title || "Uten tittel",
      summary: pageData.summary || "",
      content: pageData.content || "",
      isPublished,
      status: resolvedStatus,
      parentPageId: resolvedParent,
      parentId: resolvedParent, // dual compatibility alias
      menuOrder: resolvedOrder,
      navOrder: resolvedOrder, // dual compatibility alias
      inNavMenu: pageData.inNavMenu !== false,
      // Left out of the stored document when the page has no link of its own
      linkUrl: pageData.linkUrl || undefined,
      updatedAt: new Date().toISOString(),
      heroImage: pageData.heroImage || "",
      heroImageAlt: pageData.heroImageAlt?.trim() || undefined,
      heroImages: (pageData.heroImages || []).filter(Boolean).slice(0, 2),
      heroZoom: pageData.heroZoom !== false,
      heroMenuOverlay: pageData.heroMenuOverlay !== false,
      heroTitle: pageData.heroTitle || "",
      heroCtaText: pageData.heroCtaText || "",
      heroCtaLink: pageData.heroCtaLink || "",
      heroCtaSecondaryText: pageData.heroCtaSecondaryText || "",
      heroCtaSecondaryLink: pageData.heroCtaSecondaryLink || "",
      showHeroPrimaryCta: pageData.showHeroPrimaryCta !== false,
      showHeroSecondaryCta: pageData.showHeroSecondaryCta !== false,
      showHero: true,
      metaDescription: pageData.metaDescription?.trim() || undefined,
      ogImage: pageData.ogImage?.trim() || undefined,
      publishAt,
      publishedAt: publishAt,
    };
    return attempt("lagre siden", () => createDocument(CMS_COLLECTIONS.PAGES, page));
  },

  saveNews: (newsData: Partial<CmsNewsArticle> & { id?: string }) => {
    const article: CmsNewsArticle = {
      id: newsData.id || newId("news"),
      title: newsData.title || "Nyhetsartikkel",
      slug: (newsData.slug || `nyhet-${Date.now()}`).toLowerCase().trim(),
      summary: newsData.summary || "",
      content: newsData.content || "",
      category: newsData.category || "aktuelt",
      author: newsData.author || "Menigheten",
      publishedAt: newsData.publishedAt || new Date().toISOString(),
      isPublished: newsData.isPublished !== false,
      imageUrl: newsData.imageUrl || "",
    };
    return attempt("lagre nyhetsartikkelen", () => createDocument(CMS_COLLECTIONS.NEWS, article));
  },
  deleteNews: (newsId: string) =>
    attempt("slette nyhetsartikkelen", () => deleteDocument(CMS_COLLECTIONS.NEWS, newsId)),

  saveSermon: (sermonData: Partial<CmsSermon> & { id?: string }) => {
    const sermon: CmsSermon = {
      id: sermonData.id || newId("sermon"),
      title: sermonData.title || "Tale",
      speaker: sermonData.speaker || "Pastor",
      date: sermonData.date || new Date().toISOString(),
      bibleText: sermonData.bibleText || "",
      series: sermonData.series || "",
      audioUrl: sermonData.audioUrl || "",
      spotifyUrl: sermonData.spotifyUrl || "",
      videoUrl: sermonData.videoUrl || "",
      summary: sermonData.summary || "",
    };
    return attempt("lagre talen", () => createDocument(CMS_COLLECTIONS.SERMONS, sermon));
  },
  deleteSermon: (sermonId: string) => attempt("slette talen", () => deleteDocument(CMS_COLLECTIONS.SERMONS, sermonId)),

  saveStaff: (staffData: Partial<CmsStaffMember> & { id?: string }) => {
    const member: CmsStaffMember = {
      id: staffData.id || newId("staff"),
      name: staffData.name || "Navn",
      role: staffData.role || "Medarbeider",
      email: staffData.email || "",
      phone: staffData.phone || "",
      category: staffData.category || "stab",
      bio: staffData.bio || "",
      imageUrl: staffData.imageUrl || "",
    };
    return attempt("lagre medarbeideren", () => createDocument(CMS_COLLECTIONS.STAFF, member));
  },
  deleteStaff: (staffId: string) => attempt("slette medarbeideren", () => deleteDocument(CMS_COLLECTIONS.STAFF, staffId)),
};

const normalizeSlug = (slug: string) => slug.toLowerCase().replace(/^\//, "").trim();

export const CmsProvider: React.FC<{ children: React.ReactNode; publicPagesOnly?: boolean }> = ({
  children,
  publicPagesOnly = false,
}) => {
  const [pages, pagesAnswered] = useCmsCollection<CmsPage>(
    CMS_COLLECTIONS.PAGES,
    publicPagesOnly ? STORAGE_KEYS.pagesPublic : STORAGE_KEYS.pages,
    undefined,
    publicPagesOnly
  );
  const [news, newsAnswered] = useCmsCollection<CmsNewsArticle>(CMS_COLLECTIONS.NEWS, STORAGE_KEYS.news, newestFirst);
  const [sermons] = useCmsCollection<CmsSermon>(CMS_COLLECTIONS.SERMONS, STORAGE_KEYS.sermons, latestDateFirst);
  const [staff] = useCmsCollection<CmsStaffMember>(CMS_COLLECTIONS.STAFF, STORAGE_KEYS.staff);
  const [media] = useCmsCollection<CmsMedia>(
    CMS_COLLECTIONS.MEDIA,
    STORAGE_KEYS.media,
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const settings = useCmsSettings();
  const { addons, addonsState } = useCmsAddons();
  const contentReady = pagesAnswered && newsAnswered;

  const value: CmsContextValue = useMemo(
    () => ({
      pages,
      news,
      sermons,
      staff,
      media,
      settings,
      contentReady,
      addons,
      addonsState,
      ...writes,
      uploadMedia: async (file, meta) => {
        try {
          const draft = buildCmsMedia({
            title: meta.title,
            altText: meta.altText,
            tags: meta.tags,
            approvedForAi: meta.approvedForAi,
            source: "upload",
            sourcePath: "",
            variants: { web: "", thumb: "", og: "" },
            width: 0,
            height: 0,
            byteSize: 0,
          });
          const blobs = await buildMediaVariantBlobs(file);
          const uploaded = await uploadMediaVariants(draft.id, blobs);
          const document = buildCmsMedia({
            ...draft,
            id: draft.id,
            sourcePath: uploaded.sourcePath,
            variants: uploaded.variants,
            width: blobs.width,
            height: blobs.height,
            byteSize: uploaded.byteSize,
          });
          const ok = await attempt("laste opp bildet", () =>
            createDocument(CMS_COLLECTIONS.MEDIA, document)
          );
          return ok ? document : null;
        } catch (err) {
          reportWriteError("laste opp bildet", err);
          return null;
        }
      },
      updateMedia: (mediaId, updates) =>
        attempt("oppdatere bildet", () =>
          setDocument(CMS_COLLECTIONS.MEDIA, mediaId, {
            ...media.find((m) => m.id === mediaId),
            ...updates,
            updatedAt: new Date().toISOString(),
          })
        ),
      archiveMedia: (mediaId) =>
        attempt("arkivere bildet", () =>
          updateDocument(CMS_COLLECTIONS.MEDIA, mediaId, {
            status: "archived",
            updatedAt: new Date().toISOString(),
          })
        ),
      deleteMedia: async (mediaId) => {
        const usages = findMediaUsages(mediaId, pages, news, staff);
        if (usages.length > 0) return { ok: false, blockedByUsages: true };
        try {
          await deleteMediaStorageFiles(mediaId);
          const ok = await attempt("slette bildet", () =>
            deleteDocument(CMS_COLLECTIONS.MEDIA, mediaId)
          );
          return { ok };
        } catch (err) {
          reportWriteError("slette bildet", err);
          return { ok: false };
        }
      },
      getMediaUsages: (mediaId) => findMediaUsages(mediaId, pages, news, staff),
      deletePage: (pageId: string) => {
        const subPageIds = pages
          .filter((p) => (p.parentPageId !== undefined ? p.parentPageId === pageId : p.parentId === pageId))
          .map((p) => p.id);
        return attempt("slette siden", () => deletePageWithSubPages(pageId, subPageIds));
      },
      reorderPages: (orderedPageIds: string[]) =>
        attempt("endre rekkefølge på sidene", () => reorderPagesInFirestore(orderedPageIds)),
      saveSettings: (settingsData: Partial<CmsSettings>) =>
        attempt("lagre innstillingene", () =>
          setDocument(CMS_COLLECTIONS.SETTINGS, CMS_SETTINGS_DOC_ID, { ...settings, ...settingsData })
        ),
      getPageBySlug: (slug: string) => pages.find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)),
      getNewsById: (id: string) => news.find((n) => n.id === id),
      getNewsBySlug: (slug: string) => news.find((n) => n.slug.toLowerCase() === slug.toLowerCase()),
    }),
    [pages, news, sermons, staff, media, settings, contentReady, addons, addonsState]
  );

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
};

export const useCms = () => {
  const context = useContext(CmsContext);
  if (!context) throw new Error("useCms must be used within a CmsProvider");
  return context;
};
