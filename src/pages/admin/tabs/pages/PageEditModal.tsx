import React, { useState, useMemo, useRef, useEffect } from "react";
import { CmsPage } from "../../../../data/cmsData";
import {
  Edit3,
  X,
  FolderTree,
  Eye,
  LayoutGrid,
  Globe,
  Search,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Clock,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { CmsMediaPicker } from "../../../../components/admin/CmsMediaPicker";
import { useMediaMap } from "../../../../hooks/useMediaMap";
import { resolveShareableMediaUrl } from "../../../../utils/media";
import { ContentBlockPickerModal } from "./ContentBlockPickerModal";
import { useCms } from "../../../../context/CmsContext";
import { useTimedMessage } from "../../../../hooks/useTimedMessage";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import { shareableImageUrl } from "../../../../utils/seoUtils";
import { VisualBlockManager } from "./VisualBlockManager";
import { usePreviewBridgeParent } from "../../../../hooks/usePreviewBridgeParent";
import {
  buildDraftSnapshot,
  buildEmbeddedPreviewUrl,
  buildNewTabPreviewUrl,
  writeDraftSnapshot,
} from "../../../../utils/previewBridge";
import {
  parseContentToVisualBlocks,
  serializeVisualBlocksToContent,
  resolveVisualBlocks,
  CMS_PREVIEW_TARGET_HERO,
  VisualBlock,
} from "../../../../utils/cmsBlocks";
import { ensureSectionAnchors } from "../../../../utils/cmsLinks";
import { CmsLinkPicker } from "../../../../components/admin/CmsLinkPicker";

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

/** Scrolls the preview pane so the target block is visible. Returns false if already fully in view. */
export function scrollPreviewToTarget(
  scrollRoot: HTMLElement,
  target: HTMLElement,
  offset = 16
): boolean {
  const rootRect = scrollRoot.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const visibleTop = rootRect.top + offset;
  const visibleBottom = rootRect.bottom - offset;
  const targetTop = targetRect.top;
  const targetBottom = targetRect.bottom;
  const targetHeight = targetRect.height;
  const rootHeight = rootRect.height;

  if (targetTop >= visibleTop && targetBottom <= visibleBottom) {
    return false;
  }

  let scrollTop: number;
  if (targetHeight > rootHeight - 2 * offset) {
    scrollTop = targetTop - rootRect.top + scrollRoot.scrollTop - offset;
  } else if (targetTop < visibleTop) {
    scrollTop = targetTop - rootRect.top + scrollRoot.scrollTop - offset;
  } else {
    scrollTop =
      targetBottom - rootRect.top + scrollRoot.scrollTop - (rootHeight - offset);
  }

  scrollRoot.scrollTo({ top: Math.max(0, scrollTop), behavior: "smooth" });
  return true;
}

function getPresetDate(type: "tomorrow" | "sunday" | "monday"): string {
  const d = new Date();
  if (type === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (type === "sunday") {
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSunday);
    d.setHours(8, 0, 0, 0);
  } else if (type === "monday") {
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

export interface PageEditModalProps {
  editingPage: Partial<CmsPage>;
  isNewPage: boolean;
  availableParentPages: CmsPage[];
  onUpdate: (updated: Partial<CmsPage>) => void;
  onSave: (e: React.FormEvent) => void;
  onPreview?: (draft: Partial<CmsPage>) => void;
  onClose: () => void;
}

export const PageEditModal: React.FC<PageEditModalProps> = ({
  editingPage,
  isNewPage,
  availableParentPages,
  onUpdate,
  onSave,
  onPreview,
  onClose,
}) => {
  const { settings } = useCms();
  const mediaById = useMediaMap();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [isBlockPickerOpen, setIsBlockPickerOpen] = useState(false);
  const [showSeoDetails, setShowSeoDetails] = useState(false);
  const [copiedIngress, showCopiedIngress] = useTimedMessage<true>(2000);
  const [focusedPreviewTarget, setFocusedPreviewTarget] = useState<string>(CMS_PREVIEW_TARGET_HERO);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const previousSlugRef = useRef("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewLocationPath, setPreviewLocationPath] = useState<string | null>(null);
  const [previewBlockedNotice, setPreviewBlockedNotice] = useState(false);

  // View mode state: edit (full-width form), split (side-by-side with real frontend), preview (full-width real frontend)
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return "split";
    }
    return "edit";
  });

  // Responsive device simulation in preview area: desktop (full width), tablet (768px), mobile (390px)
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Search and share card preview values
  const siteHost = window.location.host;
  const previewTitle = `${editingPage.title || "Sidetittel"} – ${settings.churchName}`;
  const previewDescription =
    editingPage.metaDescription?.trim() ||
    editingPage.summary?.trim() ||
    `Velkommen til ${editingPage.title || "siden"} i ${settings.churchName}.`;
  const shareImage =
    resolveShareableMediaUrl(editingPage.ogImage, mediaById) ||
    shareableImageUrl(editingPage.ogImage, origin) ||
    resolveShareableMediaUrl(editingPage.heroImage, mediaById) ||
    shareableImageUrl(editingPage.heroImage, origin);

  const insertComponentSnippet = (snippet: string) => {
    const parsedNew = parseContentToVisualBlocks(snippet);
    if (parsedNew.length > 0) {
      const nextBlocks = [...visualBlocks, ...parsedNew];
      handleBlocksChange(nextBlocks);
    } else {
      const current = editingPage.content || "";
      const separator = current && !current.endsWith("\n\n") ? (current.endsWith("\n") ? "\n" : "\n\n") : "";
      onUpdate({ ...editingPage, content: current + separator + snippet });
    }
  };

  const currentParentId =
    editingPage.parentPageId !== undefined
      ? editingPage.parentPageId
      : editingPage.parentId || null;

  const currentOrder =
    typeof editingPage.menuOrder === "number"
      ? editingPage.menuOrder
      : typeof editingPage.navOrder === "number"
      ? editingPage.navOrder
      : 1;

  const handleParentChange = (val: string) => {
    const parentVal = val ? val : null;
    onUpdate({
      ...editingPage,
      parentPageId: parentVal,
      parentId: parentVal, // Keep compatibility alias in sync
    });
  };

  const handleOrderChange = (num: number) => {
    onUpdate({
      ...editingPage,
      menuOrder: num,
      navOrder: num, // Keep compatibility alias in sync
    });
  };

  const publishTime = editingPage.publishAt ? new Date(editingPage.publishAt).getTime() : 0;
  const isFutureScheduled =
    editingPage.isPublished !== false &&
    Boolean(publishTime && publishTime > Date.now());

  const handlePublishDateChange = (val: string) => {
    if (!val) {
      onUpdate({
        ...editingPage,
        publishAt: undefined,
        publishedAt: undefined,
      });
      return;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return;
    const iso = d.toISOString();
    const isFuture = d.getTime() > Date.now();
    onUpdate({
      ...editingPage,
      publishAt: iso,
      publishedAt: iso,
      isPublished: true, // Auto-enable publishing when scheduling a date
      status: isFuture ? "scheduled" : "published",
    });
  };

  const cleanSlug = (editingPage.slug || editingPage.title?.toLowerCase().replace(/\s+/g, "-") || "side")
    .toLowerCase()
    .replace(/^\//, "")
    .trim();
  const targetPath = editingPage.linkUrl?.trim() || (cleanSlug === "forside" || !cleanSlug ? "/" : `/${cleanSlug}`);
  const embeddedPreviewUrl = buildEmbeddedPreviewUrl(targetPath);
  const previewUrl = buildNewTabPreviewUrl(targetPath);

  const isHomePage = cleanSlug === "forside" || (!cleanSlug && targetPath === "/");

  const visualBlocks = useMemo(
    () => ensureSectionAnchors(resolveVisualBlocks(editingPage, { home: isHomePage })),
    [editingPage, isHomePage]
  );

  const handleBlocksChange = (newBlocks: VisualBlock[]) => {
    const anchored = ensureSectionAnchors(newBlocks);
    const serialized = serializeVisualBlocksToContent(anchored);
    onUpdate({
      blocks: anchored,
      content: serialized,
    });
    setPreviewRevision((r) => r + 1);
  };

  const { flushSnapshot, sendWarmDraft, sendFocus } = usePreviewBridgeParent({
    editingPage: { ...editingPage, slug: cleanSlug },
    blocks: visualBlocks,
    revision: previewRevision,
    previousSlugRef,
    iframeRef: previewIframeRef,
    onPreviewLocation: (path) => setPreviewLocationPath(path),
    onPreviewBlocked: () => {
      setPreviewBlockedNotice(true);
      window.setTimeout(() => setPreviewBlockedNotice(false), 4000);
    },
  });

  const handleSaveActiveDraftToStorage = () => {
    try {
      const snapshot = buildDraftSnapshot(
        { ...editingPage, slug: cleanSlug, blocks: visualBlocks },
        previewRevision,
        visualBlocks
      );
      writeDraftSnapshot(snapshot, previousSlugRef.current);
      previousSlugRef.current = cleanSlug;
    } catch {}
  };

  useEffect(() => {
    setPreviewRevision((r) => r + 1);
  }, [editingPage.title, editingPage.summary, editingPage.heroTitle, editingPage.heroCtaText, editingPage.heroCtaLink, editingPage.heroCtaSecondaryText, editingPage.heroCtaSecondaryLink, editingPage.heroImage, editingPage.content, editingPage.isPublished, editingPage.linkUrl, cleanSlug]);

  useEffect(() => {
    if (viewMode === "edit") return;
    const timer = window.setTimeout(() => {
      sendWarmDraft(true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [viewMode, previewRevision, sendWarmDraft]);

  useEffect(() => {
    if (viewMode === "edit") return;
    flushSnapshot();
  }, [cleanSlug, targetPath, viewMode, flushSnapshot]);

  useEffect(() => {
    if (viewMode === "edit" || !focusedPreviewTarget) return;
    sendFocus(focusedPreviewTarget);

    const iframeDoc = previewIframeRef.current?.contentDocument;
    const scrollRoot = iframeDoc?.documentElement;
    if (!scrollRoot) return;

    const findTarget = () =>
      iframeDoc?.querySelector(
        `[data-cms-preview-target="${focusedPreviewTarget}"]`
      ) as HTMLElement | null;

    const scrollIfNeeded = () => {
      const target = findTarget();
      const container = previewScrollRef.current;
      if (target && container) scrollPreviewToTarget(container, target);
      else target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const frame = window.requestAnimationFrame(scrollIfNeeded);
    const target = findTarget();
    let resizeObserver: ResizeObserver | null = null;
    if (target && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scrollIfNeeded);
      resizeObserver.observe(target);
    }

    if (target instanceof HTMLElement) {
      iframeDoc
        ?.querySelectorAll("[data-cms-preview-focused]")
        .forEach((el) => el.removeAttribute("data-cms-preview-focused"));
      target.setAttribute("data-cms-preview-focused", "true");
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [focusedPreviewTarget, previewDevice, viewMode, sendFocus]);

  // Real frontend preview container: exact 1:1 public website rendering
  const renderLiveFrontendPreview = () => {

    return (
      <div className="flex flex-col h-full bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl overflow-hidden shadow-2xl">
        {/* Preview Sub-Toolbar */}
        <div className="px-4 py-2.5 bg-[var(--studio-panel-bg)] border-b border-[var(--studio-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-[var(--studio-text)]">Ekte nettside-rendering</span>
            <span className="text-[var(--studio-muted)] hidden xl:inline">· 1:1 produksjonslayout & tema</span>
          </div>

          {/* Enhetsvelger: Desktop (Full) | Nettbrett | Mobil */}
          <div className="flex items-center gap-1 bg-[var(--studio-bg)] p-0.5 rounded-lg border border-[var(--studio-border)]">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === "desktop"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
              }`}
              title="Full bredde desktop-layout (tilpasser seg skjermen)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("tablet")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === "tablet"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
              }`}
              title="Nettbrett-format (768px bredde)"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Nettbrett</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === "mobile"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
              }`}
              title="Mobil-format (390px bredde)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobil</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--studio-muted)] font-mono bg-[var(--studio-bg)] px-2 py-0.5 rounded border border-[var(--studio-border)] hidden sm:inline">
              {previewLocationPath || targetPath}
            </span>
            {previewBlockedNotice && (
              <span className="text-[11px] text-amber-300 hidden sm:inline">
                Admin og Min side åpnes ikke i forhåndsvisningen
              </span>
            )}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleSaveActiveDraftToStorage}
              className="px-2.5 py-1 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-[var(--studio-border)] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Åpne forhåndsvisningen i egen full nettleserfane"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span className="hidden sm:inline">Ny fane</span>
            </a>
          </div>
        </div>

        <div
          ref={previewScrollRef}
          className="cms-preview-scroll-root flex-1 overflow-y-auto bg-[var(--studio-overlay)] p-2 sm:p-4 max-h-[82vh] flex justify-center items-start"
        >
          <style>{`
            .cms-preview-scroll-root iframe[data-cms-preview-focused="true"] {
              outline: none;
            }
          `}</style>
          <div
            className={`self-start shrink-0 transition-all duration-200 overflow-hidden bg-white ${
              previewDevice === "desktop"
                ? "w-full rounded-xl shadow-lg border border-stone-200/40"
                : previewDevice === "tablet"
                ? "w-[768px] max-w-full rounded-2xl shadow-2xl border-4 border-[var(--studio-border)]"
                : "w-[390px] max-w-full rounded-3xl shadow-2xl border-8 border-[var(--studio-border)]"
            }`}
          >
            <iframe
              ref={previewIframeRef}
              key={`${editingPage.id || "new"}-${cleanSlug}`}
              title="Forhåndsvisning av nettsiden"
              src={embeddedPreviewUrl}
              className="w-full min-h-[70vh] border-0 bg-white"
              onLoad={() => {
                handleSaveActiveDraftToStorage();
                sendWarmDraft(true);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderFormFields = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tittel */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Sidetittel (Vises i meny og header)</label>
          <input
            type="text"
            required
            value={editingPage.title || ""}
            onChange={(e) => onUpdate({ ...editingPage, title: e.target.value })}
            placeholder="f.eks. Om oss, Barn & Unge, Kontakt"
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* URL Slug */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Adresse (f.eks. om-oss)</label>
          <input
            type="text"
            value={editingPage.slug || ""}
            onChange={(e) => onUpdate({ ...editingPage, slug: e.target.value })}
            placeholder="om-oss (eller genereres automatisk fra tittel)"
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs font-mono focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Ekstern eller overstyrt intern lenke */}
      <div className="space-y-1 bg-[var(--studio-row)] p-3 rounded-xl border border-[var(--studio-border)]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">
            Overstyr lenkeadresse (valgfritt)
          </label>
          <span className="text-[10px] text-[var(--studio-muted)]">
            Peker menyvalget til en innebygd side som /hva-skjer, /fellesskap eller /taler, eller til en full nettadresse
          </span>
        </div>
        <CmsLinkPicker
          value={editingPage.linkUrl || ""}
          onChange={(linkUrl) => onUpdate({ ...editingPage, linkUrl })}
          currentPageId={editingPage.id}
          allowEmpty
          emptyLabel="Bruk sidens vanlige adresse"
        />
      </div>

      {/* Hovedmeny-hierarki og Rekkefølge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--studio-row)] p-4 rounded-xl border border-[var(--studio-border)]">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
            <span>Hovedfane / Forelder</span>
          </label>
          <select
            value={currentParentId || ""}
            onChange={(e) => handleParentChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Ingen (Dette er en topp-nivå hovedfane)</option>
            {availableParentPages.map((parent) => (
              <option key={parent.id} value={parent.id}>
                📁 Underfane under: {parent.title} (/{parent.slug})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[var(--studio-muted)]">
            Velg hvilken hovedside denne siden hører under for å bygge nedtrekksmeny.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
            <span>Rekkefølge i meny</span>
          </label>
          <input
            type="number"
            min="1"
            value={currentOrder}
            onChange={(e) => handleOrderChange(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <p className="text-[11px] text-[var(--studio-muted)]">
            Lavere tall vises først i toppmenyen eller underfanelisten.
          </p>
        </div>
      </div>

      {/* 📌 Fast Toppramme (Hero) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFocusedPreviewTarget(CMS_PREVIEW_TARGET_HERO)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setFocusedPreviewTarget(CMS_PREVIEW_TARGET_HERO);
        }}
        data-cms-editor-target={CMS_PREVIEW_TARGET_HERO}
        className={`bg-[var(--studio-input)] border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm cursor-pointer transition-all ${
          focusedPreviewTarget === CMS_PREVIEW_TARGET_HERO
            ? "border-indigo-400 ring-2 ring-indigo-500/60"
            : "border-indigo-700/80"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-950 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h4 className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider flex items-center gap-2">
              <span>📌 Hero / Toppbanner</span>
              <span className="text-[10px] text-[var(--studio-accent-text)] font-normal bg-indigo-950 px-2 py-0.5 rounded border border-[var(--studio-accent-border)]">
                Fast toppramme
              </span>
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-[var(--studio-accent-text)]">
            Låst øverst · Kan ikke flyttes eller slettes
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Tittel i Hero</label>
          <input
            type="text"
            value={editingPage.heroTitle || ""}
            onChange={(e) => onUpdate({ ...editingPage, heroTitle: e.target.value })}
            placeholder={isHomePage ? settings.welcomeHeadline || "Velkommen til menigheten" : editingPage.title || "Overskrift i toppbanneret"}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <p className="text-[11px] text-[var(--studio-muted)]">
            Sidetittelen over styrer menyen. Dette feltet er overskriften i toppbanneret.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--studio-muted)] block">
              Ingress / Undertittel
            </label>
            {editingPage.summary && (
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...editingPage,
                    metaDescription: editingPage.summary,
                  });
                  showCopiedIngress(true);
                }}
                className="text-[10px] text-[var(--studio-icon)] hover:text-[var(--studio-accent-text)] flex items-center gap-1 cursor-pointer transition-colors"
                title="Kopier denne ingressen til meta-beskrivelsen for søkemotorer og sosiale medier"
              >
                {copiedIngress ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Kopiert til SEO-felt</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Bruk som SEO-beskrivelse</span>
                  </>
                )}
              </button>
            )}
          </div>
          <textarea
            rows={2}
            value={editingPage.summary || ""}
            onChange={(e) => onUpdate({ ...editingPage, summary: e.target.value })}
            placeholder="En engasjerende setning eller to som oppsummerer sidens budskap..."
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 resize-y"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">
            Bakgrunnsbilde
          </label>
          <CmsMediaPicker
            label="Hovedbilde"
            value={editingPage.heroImage || ""}
            onChange={(url) => onUpdate({ heroImage: url })}
            decorative
            altValue={editingPage.heroImageAlt || ""}
            onAltChange={(heroImageAlt) => onUpdate({ heroImageAlt })}
            helpText="Dekorativt bakgrunnsbilde. Beskrivelse for skjermleser er valgfritt."
            compact={false}
          />
        </div>

        {(editingPage.linkUrl === "/" || editingPage.id === "page-forside" || editingPage.slug === "forside") && (
          <div className="space-y-2.5 p-3 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)]">
            <div>
              <span className="text-xs font-semibold text-[var(--studio-text)] block">Flere toppbilder og bevegelse</span>
              <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
                Med flere bilder toner toppen rolig fra det ene til det neste. Opptil tre bilder i alt.
              </p>
            </div>
            {[0, 1].map((index) => (
              <CmsMediaPicker
                key={index}
                label={`Toppbilde ${index + 2}`}
                value={editingPage.heroImages?.[index] || ""}
                onChange={(url) => {
                  const next = [...(editingPage.heroImages || [])];
                  next[index] = url;
                  onUpdate({ heroImages: next.filter(Boolean) });
                }}
                decorative
              />
            ))}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
              <input
                type="checkbox"
                checked={editingPage.heroZoom !== false}
                onChange={(e) => onUpdate({ heroZoom: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
              />
              <span>Rolig zoom på toppbildet</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
              <input
                type="checkbox"
                checked={editingPage.heroMenuOverlay !== false}
                onChange={(e) => onUpdate({ heroMenuOverlay: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
              />
              <span>Menyen ligger oppå toppbildet til man scroller</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--studio-muted)] block">Primærknapp</label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--studio-muted)] shrink-0">
                <input
                  type="checkbox"
                  checked={editingPage.showHeroPrimaryCta !== false}
                  onChange={(e) => onUpdate({ showHeroPrimaryCta: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                />
                <span>Vis på siden</span>
              </label>
            </div>
            <input
              type="text"
              value={editingPage.heroCtaText || ""}
              onChange={(e) => onUpdate({ ...editingPage, heroCtaText: e.target.value })}
              placeholder={isHomePage ? "Se hva som skjer" : "Knappetekst"}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
            />
            <CmsLinkPicker
              value={editingPage.heroCtaLink || ""}
              onChange={(heroCtaLink) => onUpdate({ ...editingPage, heroCtaLink })}
              currentPageId={editingPage.id}
              allowEmpty={isHomePage}
              emptyLabel={isHomePage ? "Hva skjer på forsiden (anbefalt)" : "Ingen lenke"}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--studio-muted)] block">Sekundærknapp</label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--studio-muted)] shrink-0">
                <input
                  type="checkbox"
                  checked={editingPage.showHeroSecondaryCta !== false}
                  onChange={(e) => onUpdate({ showHeroSecondaryCta: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                />
                <span>Vis på siden</span>
              </label>
            </div>
            <input
              type="text"
              value={editingPage.heroCtaSecondaryText || ""}
              onChange={(e) => onUpdate({ ...editingPage, heroCtaSecondaryText: e.target.value })}
              placeholder={isHomePage ? "Bli kjent med oss" : "Knappetekst"}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
            />
            <CmsLinkPicker
              value={editingPage.heroCtaSecondaryLink || ""}
              onChange={(heroCtaSecondaryLink) =>
                onUpdate({ ...editingPage, heroCtaSecondaryLink })
              }
              currentPageId={editingPage.id}
              allowEmpty
              emptyLabel="Ingen lenke"
            />
          </div>
        </div>
      </div>

      {/* Visuell Blokkbygger & Modulstyring */}
      <div className="space-y-3 bg-[var(--studio-row)] p-4 sm:p-5 rounded-2xl border border-[var(--studio-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--studio-border)] pb-3">
          <div>
            <label className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider block">
              Innholdsblokker & Moduler
            </label>
            <p className="text-[11px] text-[var(--studio-muted)]">
              Flytt kort opp eller ned, skjul dem, eller velg en layout. Innholdet i dynamiske moduler hentes av systemet.
            </p>
          </div>
        </div>

        <VisualBlockManager
          blocks={visualBlocks}
          onChange={handleBlocksChange}
          onOpenBlockPicker={() => setIsBlockPickerOpen(true)}
          selectedBlockId={focusedPreviewTarget === CMS_PREVIEW_TARGET_HERO ? null : focusedPreviewTarget}
          onSelectBlock={setFocusedPreviewTarget}
          currentPageId={editingPage.id}
        />
      </div>

      {/* SEO & Deling i sosiale medier */}
      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)]/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSeoDetails(!showSeoDetails)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[var(--studio-surface)]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[var(--studio-icon)]" />
            <div>
              <span className="text-xs font-bold text-[var(--studio-text)] block">
                Søkemotoroptimalisering (SEO) & Delingskort
              </span>
              <span className="text-[11px] text-[var(--studio-muted)] block">
                Tilpass hvordan siden vises på Google, Facebook og andre sosiale medier.
              </span>
            </div>
          </div>
          {showSeoDetails ? (
            <ChevronUp className="w-4 h-4 text-[var(--studio-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--studio-muted)]" />
          )}
        </button>

        {showSeoDetails && (
          <div className="p-4 pt-2 border-t border-[var(--studio-border)]/70 space-y-4 bg-[var(--studio-panel-bg)]/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--studio-muted)] block">
                  Meta-beskrivelse for søkemotorer
                </label>
                <textarea
                  rows={2}
                  value={editingPage.metaDescription || ""}
                  onChange={(e) => onUpdate({ ...editingPage, metaDescription: e.target.value })}
                  placeholder="Kort beskrivelse (ca. 150-160 tegn) som Google viser under sidetittelen..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 resize-y"
                />
              </div>

              <div className="space-y-1">
                <CmsMediaPicker
                  label="Delingsbilde (OpenGraph / Facebook / Twitter)"
                  value={editingPage.ogImage || ""}
                  onChange={(ogImage) => onUpdate({ ...editingPage, ogImage })}
                  helpText="La stå tom for å bruke hovedbildet automatisk når det har en delbar adresse."
                  compact
                />
              </div>
            </div>

            {/* Google Search Result Preview */}
            <div className="p-3 rounded-xl bg-white border border-stone-200 text-stone-800 space-y-1 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <Search className="w-3 h-3 text-stone-400" />
                <span className="truncate">{siteHost} › {cleanSlug}</span>
              </div>
              <div className="text-sm font-semibold text-blue-700 hover:underline truncate">
                {previewTitle}
              </div>
              <div className="text-xs text-stone-600 leading-snug line-clamp-2">
                {previewDescription}
              </div>
            </div>

            {/* Social Share Card Preview */}
            <div className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--studio-muted)]">
                <Share2 className="w-3 h-3 text-[var(--studio-icon)]" />
                <span>Forhåndsvisning av delebilde på sosiale medier</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                {shareImage ? (
                  <img
                    src={shareImage}
                    alt={editingPage.title || "Forhåndsvisning"}
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-[var(--studio-surface)] flex items-center justify-center text-[var(--studio-muted)] text-xs gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[var(--studio-muted)]" />
                    <span>Intet bilde valgt (standard logo/toppbanner benyttes)</span>
                  </div>
                )}
                <div className="p-3 space-y-1 bg-[var(--studio-input)]">
                  <div className="text-[10px] font-semibold text-[var(--studio-icon)] uppercase tracking-wider">
                    {siteHost}
                  </div>
                  <h4 className="text-xs font-bold text-[var(--studio-text)] truncate">{previewTitle}</h4>
                  <p className="text-[11px] text-[var(--studio-muted)] line-clamp-2 leading-relaxed">{previewDescription}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publisering & Synlighet */}
      <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-4">
        <h4 className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider">
          Publisering & Synlighet
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] cursor-pointer hover:border-[var(--studio-border)] transition-colors">
            <input
              type="checkbox"
              checked={editingPage.isPublished !== false}
              onChange={(e) => onUpdate({ ...editingPage, isPublished: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-[var(--studio-text)] text-xs">Aktiver publisering</span>
              <span className="text-[11px] text-[var(--studio-muted)] block leading-tight mt-0.5">
                Når aktivert, vil siden være synlig for publikum (eller automatisk fra planlagt dato).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] cursor-pointer hover:border-[var(--studio-border)] transition-colors">
            <input
              type="checkbox"
              checked={editingPage.inNavMenu !== false}
              onChange={(e) => onUpdate({ ...editingPage, inNavMenu: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-[var(--studio-text)] text-xs">Vis i offentlig meny</span>
              <span className="text-[11px] text-[var(--studio-muted)] block leading-tight mt-0.5">
                Vises i toppmenyen eller nedtrekksmenyen. Slått av er siden bare tilgjengelig via direkte lenke.
              </span>
            </div>
          </label>
        </div>

        {/* 'Publiseringsdato'-velger (Planlagt publisering) */}
        <div className="p-3.5 rounded-xl bg-[var(--studio-overlay)] border border-[var(--studio-border)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span>Publiseringsdato & tidspunkt (Planlegging)</span>
            </label>
            {editingPage.publishAt && (
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    ...editingPage,
                    publishAt: undefined,
                    publishedAt: undefined,
                  })
                }
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Fjern tidsplan og publiser umiddelbart"
              >
                <X className="w-3 h-3" />
                <span>Nullstill dato (publiser umiddelbart)</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <input
                type="datetime-local"
                value={toDatetimeLocal(editingPage.publishAt)}
                onChange={(e) => handlePublishDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Hurtigvalg-knapper */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("tomorrow"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til i morgen kl. 09:00"
              >
                I morgen 09:00
              </button>
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("sunday"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til kommende søndag kl. 08:00"
              >
                Søndag 08:00
              </button>
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("monday"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til neste mandag kl. 09:00"
              >
                Mandag 09:00
              </button>
            </div>
          </div>

          {/* Forklarende statusmelding basert på valgt dato */}
          {editingPage.publishAt ? (
            isFutureScheduled ? (
              <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800/80 text-blue-200 text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-blue-100">
                    Planlagt for automatisk publisering:
                  </span>
                  <p className="text-[11px] text-blue-300/90 leading-relaxed">
                    Siden holdes automatisk som en skjult kladd for publikum frem til{" "}
                    <strong className="text-[var(--studio-text)] font-semibold">
                      {formatNorwegianDateTime(editingPage.publishAt)}
                    </strong>
                    . Da går siden automatisk over til statusen «Publisert» uten manuell handling.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-300">
                  Publiseringsdato er passert ({formatNorwegianDateTime(editingPage.publishAt)}). Siden er aktiv og synlig på nettsiden.
                </span>
              </div>
            )
          ) : (
            <p className="text-[11px] text-[var(--studio-muted)]">
              💡 La feltet stå tomt hvis du vil publisere siden umiddelbart ved lagring.
            </p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <form
      onSubmit={onSave}
      className={`p-4 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-indigo-500/80 shadow-2xl space-y-5 transition-all ${
        viewMode === "split"
          ? "w-full max-w-none"
          : viewMode === "preview"
          ? "w-full max-w-none"
          : "max-w-4xl mx-auto w-full"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--studio-border)] pb-3">
        <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-[var(--studio-icon)]" />
          <span>
            {isNewPage
              ? currentParentId
                ? "Opprett ny underfane"
                : "Opprett ny hovedfane"
              : `Rediger side: ${editingPage.title || "Uten tittel"}`}
          </span>
        </h3>

        {/* Modus-velger: Rediger | Splitt | Forhåndsvis */}
        <div className="flex items-center gap-1 bg-[var(--studio-input)] p-1 rounded-xl border border-[var(--studio-border)]">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "edit"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Rediger</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "split"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Splitt</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "preview"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Forhåndsvis</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleSaveActiveDraftToStorage}
            className="px-3 py-1.5 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-panel-bg)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-indigo-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Åpne en ekte forhåndsvisning av dette utkastet i en ny nettleserfane"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
            <span className="hidden sm:inline">Forhåndsvis i ny fane</span>
            <span className="sm:hidden">Ny fane</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer transition-colors"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === "preview" ? (
        <div className="space-y-4">
          {renderLiveFrontendPreview()}
        </div>
      ) : viewMode === "split" ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-[460px] xl:w-[500px] 2xl:w-[540px] shrink-0 space-y-4 overflow-y-auto max-h-[82vh] pr-2">
            {renderFormFields()}
          </div>
          <div className="flex-1 min-w-0 w-full sticky top-0">
            {renderLiveFrontendPreview()}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {renderFormFields()}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--studio-border)]">
        <div className="flex items-center gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleSaveActiveDraftToStorage}
            className="px-4 py-2 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-panel-bg)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-indigo-700/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            title="Åpne en ekte forhåndsvisning av dette utkastet i en ny nettleserfane"
          >
            <ExternalLink className="w-4 h-4 text-[var(--studio-icon)]" />
            <span>Forhåndsvis i ny fane</span>
          </a>
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(editingPage)}
              className="hidden"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--studio-hover)] hover:bg-[var(--studio-border)] text-[var(--studio-text)] text-xs font-semibold cursor-pointer transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
          >
            Lagre side
          </button>
        </div>
      </div>

      <ContentBlockPickerModal
        isOpen={isBlockPickerOpen}
        onClose={() => setIsBlockPickerOpen(false)}
        onInsertBlock={insertComponentSnippet}
      />
    </form>
  );
};
