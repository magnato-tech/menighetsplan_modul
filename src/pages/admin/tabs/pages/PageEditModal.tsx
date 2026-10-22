import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { CmsPage } from "../../../../data/cmsData";
import {
  Edit3,
  X,
  Eye,
  LayoutGrid,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone, Save, History, MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { VersionHistoryDialog } from "../../../../components/admin/VersionHistoryDialog";
import { restoredFields } from "../../../../utils/contentVersions";
import { useMediaMap } from "../../../../hooks/useMediaMap";
import { resolveShareableMediaUrl } from "../../../../utils/media";
import { ContentBlockPickerModal } from "./ContentBlockPickerModal";
import { useCms } from "../../../../context/CmsContext";
import { useTimedMessage } from "../../../../hooks/useTimedMessage";
import { shareableImageUrl } from "../../../../utils/seoUtils";
import { VisualBlockManager } from "./VisualBlockManager";
import { usePreviewBridgeParent } from "../../../../hooks/usePreviewBridgeParent";
import {
  buildDraftSnapshot,
  buildEmbeddedPreviewUrl,
  buildNewTabPreviewUrl,
  writeDraftSnapshot,
  type SnapshotFit,
} from "../../../../utils/previewBridge";
import {
  parseContentToVisualBlocks,
  serializeVisualBlocksToContent,
  resolveVisualBlocks,
  CMS_PREVIEW_TARGET_HERO,
  VisualBlock,
} from "../../../../utils/cmsBlocks";
import { ensureSectionAnchors } from "../../../../utils/cmsLinks";
import { blockPeriodBadge } from "../../../../utils/blockSettings";
import { PageSectionNav, type PageSection } from "../../../../components/admin/PageSectionNav";
import { readStoredFlag, writeStoredFlag } from "../../../../utils/storedFlag";
import { useMediaQuery } from "../../../../hooks/useMediaQuery";
import { usePaneWidth } from "../../../../hooks/usePaneWidth";
import { EditorTextSizeControl, useEditorTextSize, EDITOR_TEXT_ZOOM } from "../../../../components/admin/EditorTextSize";
import { SettingsSection } from "./editor/SettingsSection";
import { HeroSection } from "./editor/HeroSection";
import { SeoSection } from "./editor/SeoSection";
import { PublishSection } from "./editor/PublishSection";

/**
 * Brings a field into view in the scrolling column it stands in (the fields beside the preview), near
 * the top, without moving the page around it.
 */
// Returns false when no scrolling column holds the element, so the caller can scroll the page instead.
export function scrollIntoColumn(element: HTMLElement, offset = 16): boolean {
  let column = element.parentElement;
  while (column && !(column.scrollHeight > column.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(column).overflowY))) {
    column = column.parentElement;
  }
  if (!column) return false;
  const top = element.getBoundingClientRect().top - column.getBoundingClientRect().top + column.scrollTop - offset;
  column.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  return true;
}

/** Scrolls the preview pane so the target block is visible. Returns false if already fully in view. */
export function scrollPreviewToTarget(
  scrollRoot: HTMLElement,
  target: HTMLElement,
  offset = 16,
  // A scaled frame is placed at frame.top on screen, and drawn at frame.scale of its own pixels.
  frame: { top: number; scale: number } = { top: 0, scale: 1 }
): boolean {
  const rootRect = scrollRoot.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const visibleTop = rootRect.top + offset;
  const visibleBottom = rootRect.bottom - offset;
  const targetTop = frame.top + targetRect.top * frame.scale;
  const targetBottom = frame.top + targetRect.bottom * frame.scale;
  const targetHeight = targetRect.height * frame.scale;
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

// Pixel sizes of the split view. The preview never gets less than PREVIEW_MIN_PX.
const FIELDS_MIN_PX = 380;
const PREVIEW_MIN_PX = 480;
const SECTION_LIST_PX = 220;
const GAP_PX = 24; // gap-6 in the layout
const DIVIDER_PX = 10;
const KEY_STEP_PX = 24;
// The desktop preview is laid out at this width, and scaled down when its column is narrower.
const DESKTOP_PREVIEW_PX = 1280;

export interface PageEditModalProps {
  editingPage: Partial<CmsPage>;
  isNewPage: boolean;
  availableParentPages: CmsPage[];
  onUpdate: (updated: Partial<CmsPage>) => void;
  onSave: (e: React.FormEvent) => void;
  onPreview?: (draft: Partial<CmsPage>) => void;
  onClose: () => void;
  // Copies the page. The parent does the copying.
  onDuplicate?: () => void;
  // Asks to delete the page. The parent asks the user before it deletes anything.
  onDelete?: () => void;
}

export const PageEditModal: React.FC<PageEditModalProps> = ({
  editingPage,
  isNewPage,
  availableParentPages,
  onUpdate,
  onSave,
  onPreview,
  onClose,
  onDuplicate,
  onDelete,
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
  const [snapshotFit, setSnapshotFit] = useState<SnapshotFit>("full");
  // The fields column width the user dragged to. null is the default (40 %). liveFieldsWidth is set while dragging.
  const { width: storedFieldsWidth, setWidth: setFieldsWidth } = usePaneWidth("menighetsplan:feltbredde");
  const [liveFieldsWidth, setLiveFieldsWidth] = useState<number | null>(null);
  const fieldsWidth = liveFieldsWidth ?? storedFieldsWidth;
  const fieldsRef = useRef<HTMLDivElement>(null);
  const splitRowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; latest: number } | null>(null);
  // The text size applies to the fields only, not to the preview or the section list
  const [textSize, setTextSize] = useEditorTextSize();
  const fieldsZoomStyle: React.CSSProperties = { zoom: EDITOR_TEXT_ZOOM[textSize] };
  // Height of the desktop preview frame, which follows the window height
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Width of the preview's scroll box, measured while the preview is shown
  const [previewAvailableWidth, setPreviewAvailableWidth] = useState<number | null>(null);

  // View mode state: edit (full-width form), split (side-by-side with real frontend), preview (full-width real frontend)
  // «Historikk»: the earlier versions of the page, one of which can be put back into the editor
  const [showHistory, setShowHistory] = useState(false);
  // The «⋯» menu in the top bar: copy or delete the page
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    // Escape and a click outside close the menu. The listeners only exist while it is open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [menuOpen]);
  // A section pressed in the preview, to be opened in the block list (nonce: the same section pressed again opens it again)
  const [openRequest, setOpenRequest] = useState<{ blockId: string; gatheringId?: string; nonce: number } | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return "split";
    }
    return "edit";
  });

  // The section list: one section's fields at a time, when the screen is wide enough for three panes.
  // The list can be folded away, and the choice is remembered in the browser.
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [navCollapsed, setNavCollapsed] = useState(() => readStoredFlag("menighetsplan:seksjoner-skjult", false));
  const setCollapsed = (next: boolean) => {
    setNavCollapsed(next);
    writeStoredFlag("menighetsplan:seksjoner-skjult", next);
  };
  // Without matchMedia (tests, server) the fallback keeps today's layout with all sections under each other.
  const wideSplit = useMediaQuery("(min-width: 1600px)", false);
  const wideEdit = useMediaQuery("(min-width: 1024px)", false);
  const navFits = viewMode === "split" ? wideSplit : viewMode === "edit" ? wideEdit : false;
  const showNav = navFits && !navCollapsed;

  // Responsive device simulation in preview area: desktop (full width), tablet (768px), mobile (390px)
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Desktop in a column narrower than 1280 px is scaled to fit, so it keeps the desktop layout. null: no scaling.
  const previewScale =
    previewDevice === "desktop" && previewAvailableWidth && previewAvailableWidth < DESKTOP_PREVIEW_PX
      ? Math.max(previewAvailableWidth / DESKTOP_PREVIEW_PX, 0.25)
      : null;
  // Ref callback: the observer lives as long as the preview is mounted, which happens again after a layout change.
  const attachPreviewScroll = useCallback((node: HTMLDivElement | null) => {
    previewScrollRef.current = node;
    // Without ResizeObserver (tests) the frame is never scaled
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setPreviewAvailableWidth(entries[0].contentRect.width));
    observer.observe(node);
    return () => {
      observer.disconnect();
      previewScrollRef.current = null;
    };
  }, []);

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

  const cleanSlug = (editingPage.slug || editingPage.title?.toLowerCase().replace(/\s+/g, "-") || "side")
    .toLowerCase()
    .replace(/^\//, "")
    .trim();
  const targetPath = editingPage.linkUrl?.trim() || (cleanSlug === "forside" || !cleanSlug ? "/" : `/${cleanSlug}`);
  const embeddedPreviewUrl = buildEmbeddedPreviewUrl(targetPath);
  const previewUrl = buildNewTabPreviewUrl(targetPath);

  const isHomePage = cleanSlug === "forside" || (!cleanSlug && targetPath === "/");
  // The choices for the front page picture are shown for the page that is the front page, whatever its address field says
  const isFrontPage = editingPage.linkUrl === "/" || editingPage.id === "page-forside" || editingPage.slug === "forside";

  const visualBlocks = useMemo(
    () => ensureSectionAnchors(resolveVisualBlocks(editingPage, { home: isHomePage })),
    [editingPage, isHomePage]
  );

  const sections = useMemo<PageSection[]>(
    () => [
      { id: "settings", kind: "settings", label: "Sideinnstillinger", detail: "Tittel, adresse og menyen" },
      { id: "hero", kind: "hero", label: "Toppbilde" },
      ...visualBlocks.map((block) => ({
        id: block.id,
        kind: "block" as const,
        label: block.title?.trim() || "Uten tittel",
        detail: block.isDynamic ? "Modul" : "Innhold",
        hidden: block.hidden === true,
        badge: blockPeriodBadge(block.settings) ?? undefined,
      })),
      { id: "seo", kind: "seo", label: "Søk og deling" },
      { id: "publish", kind: "publish", label: "Publisering" },
    ],
    [visualBlocks]
  );
  // A block that was deleted leaves its id behind; the hero is shown then.
  const activeId = sections.some((section) => section.id === activeSection) ? activeSection : "hero";

  // Brings a section's first field into view in the page; used by the select on narrow screens.
  const goToSection = (id: string) => {
    const target = id === "hero" ? CMS_PREVIEW_TARGET_HERO : id;
    const element =
      (document.querySelector(`[data-page-editor] [data-cms-editor-target="${CSS.escape(target)}"]`) as HTMLElement | null) ??
      (document.querySelector(`[data-page-editor] [data-page-section="${CSS.escape(id)}"]`) as HTMLElement | null);
    if (!element) return;
    if (!scrollIntoColumn(element)) element.scrollIntoView({ block: "start" });
  };

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
    onSnapshotFit: setSnapshotFit,
    // A press on a section in the preview opens it here: the hero's fields, or the block in the list
    onPreviewSelect: (blockId, gatheringId) => {
      setFocusedPreviewTarget(blockId);
      setActiveSection(blockId === CMS_PREVIEW_TARGET_HERO ? "hero" : blockId);
      if (viewMode === "preview") setViewMode("split");
      if (blockId !== CMS_PREVIEW_TARGET_HERO) setOpenRequest({ blockId, gatheringId, nonce: Date.now() });
      // After the block has opened, its fields are brought into view in the column beside the preview
      window.setTimeout(() => {
        const field = document.querySelector(`[data-page-editor] [data-cms-editor-target="${CSS.escape(blockId)}"]`);
        if (field) scrollIntoColumn(field as HTMLElement);
      }, 120);
    },
  });

  const handleSaveActiveDraftToStorage = () => {
    const snapshot = buildDraftSnapshot(
      { ...editingPage, slug: cleanSlug, blocks: visualBlocks },
      previewRevision,
      visualBlocks
    );
    setSnapshotFit(writeDraftSnapshot(snapshot, previousSlugRef.current));
    previousSlugRef.current = cleanSlug;
  };

  useEffect(() => {
    setPreviewRevision((r) => r + 1);
  }, [editingPage.title, editingPage.summary, editingPage.heroTitle, editingPage.heroCtaText, editingPage.heroCtaLink, editingPage.heroCtaSecondaryText, editingPage.heroCtaSecondaryLink, editingPage.showHeroPrimaryCta, editingPage.showHeroSecondaryCta, editingPage.showHeroSubtext, editingPage.heroHeight, editingPage.heroTitleStyle, editingPage.heroTitleSize, editingPage.heroTitleFont, editingPage.heroImageTitles, editingPage.heroArrows, editingPage.heroZoom, editingPage.heroFocus, editingPage.heroMenuOverlay, editingPage.heroMenuStyle, editingPage.heroVeil, editingPage.heroImage, editingPage.heroImages, editingPage.content, editingPage.isPublished, editingPage.linkUrl, cleanSlug]);

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
      // A scaled frame sits at its own top on screen, and is drawn smaller than its layout
      const frame =
        previewScale !== null && previewIframeRef.current
          ? { top: previewIframeRef.current.getBoundingClientRect().top, scale: previewScale }
          : undefined;
      if (target && container) scrollPreviewToTarget(container, target, 16, frame);
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
  }, [focusedPreviewTarget, previewDevice, previewScale, viewMode, sendFocus]);

  // Beside the fields the width style is set only on wide screens; below lg the columns stack.
  const fieldsColumnClass = wideEdit ? "shrink-0" : "w-full";
  const fieldsStyle: React.CSSProperties | undefined = wideEdit
    ? {
        width: fieldsWidth ?? undefined,
        flexBasis: fieldsWidth ? undefined : "40%",
        // A width kept from a wider screen still leaves the preview its least width
        maxWidth: `calc(100% - ${(showNav ? SECTION_LIST_PX + 3 * GAP_PX : 2 * GAP_PX) + DIVIDER_PX + PREVIEW_MIN_PX}px)`,
      }
    : undefined;

  // The fields column can be shown narrower or wider. The preview keeps the rest of the row.
  const clampFieldsWidth = (px: number, withList: boolean): number => {
    const rowWidth = splitRowRef.current?.getBoundingClientRect().width ?? 0;
    // Without a measured row (tests, hidden) there is no upper limit
    const upper =
      rowWidth > 0
        ? rowWidth - (withList ? SECTION_LIST_PX + 3 * GAP_PX : 2 * GAP_PX) - DIVIDER_PX - PREVIEW_MIN_PX
        : Infinity;
    return Math.round(Math.max(FIELDS_MIN_PX, Math.min(px, upper)));
  };

  const endFieldsDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    // A click without moving keeps the default width instead of fixing today's measure
    if (drag.latest !== drag.startWidth) setFieldsWidth(drag.latest);
    setLiveFieldsWidth(null);
  };

  // The line between the fields and the preview. It is hidden below lg, where the columns stack.
  const renderSplitter = (withList: boolean) => {
    const dragging = liveFieldsWidth !== null;
    return (
      <>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Dra for å endre bredden på feltene"
          aria-valuenow={fieldsWidth ?? undefined}
          tabIndex={0}
          title="Dra for å endre bredden. Dobbeltklikk for standard."
          onPointerDown={(e) => {
            // Keeps the drag going when the pointer leaves the line
            e.currentTarget.setPointerCapture?.(e.pointerId);
            const startWidth = fieldsRef.current?.getBoundingClientRect().width ?? 0;
            dragRef.current = { startX: e.clientX, startWidth, latest: startWidth };
            setLiveFieldsWidth(startWidth);
          }}
          onPointerMove={(e) => {
            const drag = dragRef.current;
            if (!drag) return;
            drag.latest = clampFieldsWidth(drag.startWidth + e.clientX - drag.startX, withList);
            setLiveFieldsWidth(drag.latest);
          }}
          onPointerUp={endFieldsDrag}
          onPointerCancel={endFieldsDrag}
          onDoubleClick={() => {
            setLiveFieldsWidth(null);
            setFieldsWidth(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const current = fieldsWidth ?? fieldsRef.current?.getBoundingClientRect().width ?? 0;
            const step = e.key === "ArrowRight" ? KEY_STEP_PX : -KEY_STEP_PX;
            setFieldsWidth(clampFieldsWidth(current + step, withList));
          }}
          className="hidden lg:flex group w-2.5 shrink-0 self-stretch cursor-col-resize justify-center rounded-sm focus:outline-none"
        >
          <span
            className={`w-px h-full transition-colors group-hover:bg-indigo-500 group-focus-visible:bg-indigo-500 ${
              dragging ? "bg-indigo-500" : "bg-[var(--studio-border)]"
            }`}
          />
        </div>
        {/* While dragging, a transparent layer keeps the preview iframe from taking the pointer */}
        {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" aria-hidden="true" />}
      </>
    );
  };

  // Real frontend preview container: exact 1:1 public website rendering
  const renderLiveFrontendPreview = () => {
    const frameHeight = Math.round(viewportHeight * 0.7);

    return (
      <div className="flex flex-col h-full bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl overflow-hidden shadow-2xl">
        {/* Preview Sub-Toolbar */}
        <div className="px-4 py-2.5 bg-[var(--studio-panel-bg)] border-b border-[var(--studio-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-[var(--studio-text)]">Ekte nettside-rendering</span>
            <span className="text-[var(--studio-muted)] hidden xl:inline">· 1:1 produksjonslayout & tema</span>
            {previewScale !== null && (
              <span className="text-[var(--studio-muted)]">· vist i {Math.round(previewScale * 100)} %</span>
            )}
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
            {snapshotFit !== "full" && (
              <span className="text-[11px] text-amber-300" role="status">
                {snapshotFit === "saved-images"
                  ? "Nye bilder vises her når siden er lagret"
                  : snapshotFit === "fields-only"
                    ? "Siden er for stor til å vises før lagring: innholdsblokkene vises slik de sist ble lagret"
                    : "Siden er for stor til å vises før lagring: lagre for å se endringene"}
              </span>
            )}
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
          ref={attachPreviewScroll}
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
            style={previewScale !== null ? { height: frameHeight } : undefined}
          >
            <iframe
              ref={previewIframeRef}
              key={`${editingPage.id || "new"}-${cleanSlug}`}
              title="Forhåndsvisning av nettsiden"
              src={embeddedPreviewUrl}
              className={previewScale !== null ? "block border-0 bg-white" : "w-full min-h-[70vh] border-0 bg-white"}
              style={
                previewScale !== null
                  ? {
                      width: DESKTOP_PREVIEW_PX,
                      height: frameHeight / previewScale,
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }
                  : undefined
              }
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

  // Each part of the form is its own function, so the section list can show one at a time.
  const renderSettingsSection = () => (
    <SettingsSection
      editingPage={editingPage}
      onUpdate={onUpdate}
      availableParentPages={availableParentPages}
      currentParentId={currentParentId}
      handleParentChange={handleParentChange}
      currentOrder={currentOrder}
      handleOrderChange={handleOrderChange}
    />
  );

  const renderHeroSection = () => (
    <HeroSection
      editingPage={editingPage}
      onUpdate={onUpdate}
      focusedPreviewTarget={focusedPreviewTarget}
      setFocusedPreviewTarget={setFocusedPreviewTarget}
      isFrontPage={isFrontPage}
      isHomePage={isHomePage}
      copiedIngress={copiedIngress}
      showCopiedIngress={showCopiedIngress}
    />
  );

  // With onlyBlockId, the section list shows this one block: its heading is left out, and the order is changed in the list.
  const renderBlocksSection = (onlyBlockId?: string) => (
    <div data-page-section="blocks" className="space-y-4">
      {/* Visuell Blokkbygger & Modulstyring */}
      <div className="space-y-3 bg-[var(--studio-row)] p-4 sm:p-5 rounded-2xl border border-[var(--studio-border)]">
        {!onlyBlockId && (
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
        )}

        <VisualBlockManager
          blocks={visualBlocks}
          onChange={handleBlocksChange}
          onOpenBlockPicker={() => setIsBlockPickerOpen(true)}
          selectedBlockId={focusedPreviewTarget === CMS_PREVIEW_TARGET_HERO ? null : focusedPreviewTarget}
          onSelectBlock={setFocusedPreviewTarget}
          currentPageId={editingPage.id}
          openRequest={openRequest}
          onlyBlockId={onlyBlockId}
          orderInNav={Boolean(onlyBlockId)}
        />
      </div>
    </div>
  );

  const renderSeoSection = () => (
    <SeoSection
      editingPage={editingPage}
      onUpdate={onUpdate}
      showSeoDetails={showSeoDetails}
      setShowSeoDetails={setShowSeoDetails}
      siteHost={siteHost}
      cleanSlug={cleanSlug}
      previewTitle={previewTitle}
      previewDescription={previewDescription}
      shareImage={shareImage}
    />
  );

  const renderPublishSection = () => (
    <PublishSection
      editingPage={editingPage}
      onUpdate={onUpdate}
    />
  );

  const renderFormFields = () => (
    <>
      {renderSettingsSection()}
      {renderHeroSection()}
      {renderBlocksSection()}
      {renderSeoSection()}
      {renderPublishSection()}
    </>
  );

  const renderSectionNav = () => (
    <div className="w-[220px] shrink-0 sticky top-[calc(var(--demo-strip,0px)+6rem)] max-h-[82vh]">
      <PageSectionNav
        sections={sections}
        activeId={activeId}
        onSelect={(id) => {
          setActiveSection(id);
          if (id === "seo") setShowSeoDetails(true);
          if (id !== "settings" && id !== "seo" && id !== "publish") {
            setFocusedPreviewTarget(id === "hero" ? CMS_PREVIEW_TARGET_HERO : id);
          }
        }}
        onReorderBlocks={(ids) =>
          handleBlocksChange(
            ids
              .map((id) => visualBlocks.find((block) => block.id === id))
              .filter((block): block is VisualBlock => Boolean(block))
          )
        }
        onToggleHidden={(id) =>
          handleBlocksChange(visualBlocks.map((block) => (block.id === id ? { ...block, hidden: !block.hidden } : block)))
        }
        onCollapse={() => setCollapsed(true)}
        onAddBlock={() => setIsBlockPickerOpen(true)}
      />
    </div>
  );

  // Beside the list only the chosen section's fields are shown.
  const renderActiveSection = () =>
    activeId === "settings"
      ? renderSettingsSection()
      : activeId === "hero"
      ? renderHeroSection()
      : activeId === "seo"
      ? renderSeoSection()
      : activeId === "publish"
      ? renderPublishSection()
      : renderBlocksSection(activeId);

  return (
    <form
      onSubmit={onSave}
      // The editor fills the room it has in every mode, so the fields are not squeezed into a narrow middle
      className="p-4 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-indigo-500/80 shadow-2xl space-y-5 transition-all w-full max-w-none"
    >
      {/* The top bar stays in view while the page scrolls, so Lagre is always within reach */}
      <div className="sticky top-[var(--demo-strip,0px)] z-30 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 rounded-t-2xl bg-[var(--studio-surface)] flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 border-b border-[var(--studio-border)] pb-3">
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

        {viewMode !== "preview" && <EditorTextSizeControl value={textSize} onChange={setTextSize} />}

        {navFits && navCollapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Vis seksjoner"
            className="px-3 py-1.5 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-panel-bg)] text-[var(--studio-accent-text)] border border-indigo-700/60 text-xs font-semibold cursor-pointer"
          >
            Seksjoner
          </button>
        )}

        {/* On narrow screens there is no list beside the fields, so a select jumps to a section instead */}
        {!navFits && viewMode !== "preview" && (
          <select
            aria-label="Gå til seksjon"
            value=""
            onChange={(e) => goToSection(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs cursor-pointer"
          >
            <option value="">Gå til seksjon …</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        )}

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

          {!isNewPage && (onDuplicate || onDelete) && (
            // The wrapper is the anchor for the menu, and the reference for closing it on an outside click
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Mer"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="p-1.5 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-panel-bg)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-indigo-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Flere valg for siden"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-[var(--studio-icon)]" aria-hidden />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 z-40 min-w-[11rem] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-lg py-1"
                >
                  {onDuplicate && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onDuplicate();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[var(--studio-icon)]" aria-hidden />
                      <span>Kopier siden</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 text-rose-600 hover:bg-[var(--studio-hover)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      <span>Slett siden</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {editingPage.id && !isNewPage && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="px-3 py-1.5 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-panel-bg)] text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-indigo-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Tidligere versjoner av siden"
            >
              <History className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span className="hidden sm:inline">Historikk</span>
            </button>
          )}

          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Lagre siden"
          >
            <Save className="w-4 h-4" aria-hidden />
            <span>Lagre</span>
          </button>

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
      ) : viewMode === "split" && showNav ? (
        <div ref={splitRowRef} className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {renderSectionNav()}
          <div ref={fieldsRef} className={`${fieldsColumnClass} space-y-4 overflow-y-auto max-h-[82vh] pr-2`} style={fieldsStyle}>
            <div className="space-y-4" style={fieldsZoomStyle}>
              {renderActiveSection()}
            </div>
          </div>
          {renderSplitter(true)}
          <div className="flex-1 min-w-0 w-full sticky top-[calc(var(--demo-strip,0px)+6rem)]">
            {renderLiveFrontendPreview()}
          </div>
        </div>
      ) : viewMode === "split" ? (
        <div ref={splitRowRef} className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div ref={fieldsRef} className={`${fieldsColumnClass} space-y-4 overflow-y-auto max-h-[82vh] pr-2`} style={fieldsStyle}>
            <div className="space-y-4" style={fieldsZoomStyle}>
              {renderFormFields()}
            </div>
          </div>
          {renderSplitter(false)}
          <div className="flex-1 min-w-0 w-full sticky top-[calc(var(--demo-strip,0px)+6rem)]">
            {renderLiveFrontendPreview()}
          </div>
        </div>
      ) : viewMode === "edit" && showNav ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {renderSectionNav()}
          <div className="flex-1 min-w-0">
            <div className="space-y-4" style={fieldsZoomStyle}>
              {renderActiveSection()}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4" style={fieldsZoomStyle}>
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

      {showHistory && editingPage.id && (
        <VersionHistoryDialog
          kind="page"
          targetId={editingPage.id}
          current={editingPage as Record<string, unknown>}
          onRestore={(version) => {
            onUpdate(restoredFields(version) as Partial<CmsPage>);
            setShowHistory(false);
          }}
          onClose={() => setShowHistory(false)}
        />
      )}
      <ContentBlockPickerModal
        isOpen={isBlockPickerOpen}
        onClose={() => setIsBlockPickerOpen(false)}
        onInsertBlock={insertComponentSnippet}
      />
    </form>
  );
};
