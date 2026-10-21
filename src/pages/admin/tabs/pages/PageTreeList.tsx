import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CmsPage } from "../../../../data/cmsData";
import { PageNode, pageUrl, getMenuOrder, buildMenuBar } from "../../../../utils/menu";
import { useTimedMessage } from "../../../../hooks/useTimedMessage";
import { PageMenuBar } from "./PageMenuBar";
import { useMediaQuery } from "../../../../hooks/useMediaQuery";
import {
  Folder,
  FileText,
  CornerDownRight,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Plus,
  AlertTriangle,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderOpen,
  Eye,
  Image as ImageIcon,
  Clock,
} from "lucide-react";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import { useCms } from "../../../../context/CmsContext";
import { buildLinkContext, pageHasBrokenLinks } from "../../../../utils/cmsLinks";

interface PageTreeListProps {
  hierarchicalPages: PageNode[];
  orphanPages: CmsPage[];
  onOpenNewPage: (parentId?: string | null) => void;
  onOpenEditPage: (page: CmsPage) => void;
  onRequestDelete: (pageId: string) => void;
  /** Opens a copy of the page in the editor. */
  onDuplicate?: (page: CmsPage) => void;
  onReorder?: (orderedPageIds: string[]) => void;
  onPreviewPage?: (page: CmsPage) => void;
  onTogglePublish?: (page: CmsPage) => void;
}

export const PageTreeList: React.FC<PageTreeListProps> = ({
  hierarchicalPages,
  orphanPages,
  onOpenNewPage,
  onOpenEditPage,
  onRequestDelete,
  onDuplicate,
  onReorder,
  onPreviewPage,
  onTogglePublish,
}) => {
  const { pages } = useCms();
  const linkContext = useMemo(() => buildLinkContext(pages), [pages]);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<"top" | "sub" | null>(null);
  const [draggingParentId, setDraggingParentId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  // Tilstand for kollapsede foreldrenoder (huskes i localStorage for redaktøren)
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("menighetsplan_collapsed_pages");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleCollapse = (parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      try {
        localStorage.setItem("menighetsplan_collapsed_pages", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const handleCollapseAll = () => {
    const allWithChildren = hierarchicalPages
      .filter((n) => n.children.length > 0)
      .map((n) => n.page.id);
    const next = new Set(allWithChildren);
    setCollapsedParentIds(next);
    try {
      localStorage.setItem("menighetsplan_collapsed_pages", JSON.stringify([...next]));
    } catch {}
  };

  const handleExpandAll = () => {
    const next = new Set<string>();
    setCollapsedParentIds(next);
    try {
      localStorage.setItem("menighetsplan_collapsed_pages", JSON.stringify([]));
    } catch {}
  };

  // The website's menu at the top: a click scrolls the list to the page, opening its tab if it is folded
  const menuBar = useMemo(() => buildMenuBar(hierarchicalPages), [hierarchicalPages]);
  // Only on a large screen: the bar is for the computer, not the phone. Where it cannot tell, it is left out
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const [highlightedId, highlight] = useTimedMessage<string>(1800);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);

  const jumpTo = (pageId: string, parentId?: string) => {
    const folded = parentId ?? pageId;
    if (collapsedParentIds.has(folded) && (parentId || hierarchicalPages.some((n) => n.page.id === pageId && n.children.length > 0))) {
      toggleCollapse(folded);
    }
    setJumpTarget(pageId);
  };

  // Scrolled after the list is drawn, so a tab that was just opened has its sub-pages in place
  useEffect(() => {
    if (!jumpTarget) return;
    document.getElementById(`side-${jumpTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(jumpTarget);
    setJumpTarget(null);
  }, [jumpTarget, highlight]);

  // The main tab in view is marked in the menu bar
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.menuPage;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = hierarchicalPages.find((n) => visible.has(n.page.id));
        if (first) setActiveId(first.page.id);
      },
      { rootMargin: "-90px 0px -55% 0px" }
    );
    document.querySelectorAll<HTMLElement>("[data-menu-page]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [hierarchicalPages, wide]);

  // Helper to reorder an array of items by moving one item before or after a target
  const moveInArray = (list: string[], sourceId: string, targetId: string, position: "before" | "after") => {
    const filtered = list.filter((id) => id !== sourceId);
    const targetIndex = filtered.indexOf(targetId);
    if (targetIndex === -1) return list;
    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    filtered.splice(insertIndex, 0, sourceId);
    return filtered;
  };

  // Move single item one position up or down among siblings
  const handleMoveStep = (siblings: CmsPage[], pageId: string, direction: "up" | "down") => {
    if (!onReorder) return;
    const ids = siblings.map((p) => p.id);
    const idx = ids.indexOf(pageId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= ids.length) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(reordered);
  };

  // Top-level drag handlers
  const handleDragStartTop = (e: React.DragEvent, pageId: string) => {
    e.dataTransfer.setData("text/plain", pageId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(pageId);
    setDraggingType("top");
    setDraggingParentId(null);
  };

  const handleDragOverTop = (e: React.DragEvent, targetPageId: string) => {
    if (draggingType !== "top" || draggingId === targetPageId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";

    setDragOverId(targetPageId);
    setDropPosition(pos);
  };

  const handleDropTop = (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();
    if (draggingType !== "top" || !draggingId || draggingId === targetPageId || !dropPosition) {
      handleDragEnd();
      return;
    }
    const currentTopIds = hierarchicalPages.map((n) => n.page.id);
    const newOrderedIds = moveInArray(currentTopIds, draggingId, targetPageId, dropPosition);
    onReorder?.(newOrderedIds);
    handleDragEnd();
  };

  // Sub-level drag handlers
  const handleDragStartSub = (e: React.DragEvent, pageId: string, parentId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", pageId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(pageId);
    setDraggingType("sub");
    setDraggingParentId(parentId);
  };

  const handleDragOverSub = (e: React.DragEvent, targetPageId: string, parentId: string) => {
    if (draggingType !== "sub" || draggingParentId !== parentId || draggingId === targetPageId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";

    setDragOverId(targetPageId);
    setDropPosition(pos);
  };

  const handleDropSub = (e: React.DragEvent, targetPageId: string, parentId: string, children: CmsPage[]) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingType !== "sub" || draggingParentId !== parentId || !draggingId || draggingId === targetPageId || !dropPosition) {
      handleDragEnd();
      return;
    }
    const currentSubIds = children.map((c) => c.id);
    const newOrderedIds = moveInArray(currentSubIds, draggingId, targetPageId, dropPosition);
    onReorder?.(newOrderedIds);
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDraggingType(null);
    setDraggingParentId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  const topLevelPages = hierarchicalPages.map((n) => n.page);

  const renderStatusIndicator = (page: CmsPage, compact = false) => {
    const isFutureScheduled =
      page.isPublished !== false &&
      Boolean(page.publishAt && new Date(page.publishAt).getTime() > Date.now());
    const published = page.isPublished !== false && !isFutureScheduled;

    if (isFutureScheduled) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePublish?.(page);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all cursor-pointer ${
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
          } bg-blue-950/90 hover:bg-blue-900 text-blue-300 border border-blue-500/80 shadow-xs hover:border-blue-400 ring-1 ring-blue-500/20`}
          title={`Status: Planlagt publisert ${formatNorwegianDateTime(page.publishAt!)}. Klikk for å endre til kladd.`}
          aria-label={`Planlagt publisert ${page.publishAt}. Klikk for å sette til kladd.`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.9)]"></span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-300" />
            <span>Planlagt</span>
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePublish?.(page);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all cursor-pointer ${
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
        } ${
          published
            ? "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/70 shadow-xs hover:border-emerald-500"
            : "bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-500/80 shadow-xs hover:border-amber-400 ring-1 ring-amber-500/20"
        }`}
        title={
          published
            ? "Status: Publisert (synlig for alle). Klikk for å endre til kladd."
            : "Status: Kladd (upublisert og skjult). Klikk for å publisere."
        }
        aria-label={published ? "Publisert side. Klikk for å sette til kladd." : "Kladd. Klikk for å publisere."}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {published ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]"></span>
          )}
        </span>
        <span>{published ? "Publisert" : "Kladd"}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {wide && menuBar.length > 0 && (
        <PageMenuBar
          items={menuBar}
          activeId={activeId}
          onJump={jumpTo}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
          canFold={hierarchicalPages.some((n) => n.children.length > 0)}
        />
      )}

      {/* Hierarchy toolbar with Collapse/Expand All controls. On a large screen they stand in the menu bar */}
      {!wide && hierarchicalPages.some((n) => n.children.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 py-1 text-xs border-b border-[var(--studio-border)] pb-2">
          <div className="flex items-center gap-2 text-[var(--studio-muted)]">
            <span className="text-[11px] font-medium text-[var(--studio-muted)]">
              Fold inn underfaner med vinkelpilen foran mappen eller ved dobbeltklikk på boksen. Dra eller bruk piler for å sortere.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] border border-[var(--studio-border)] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Kollaps alle underfaner"
            >
              <ChevronsDownUp className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span>Kollaps alle</span>
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] border border-[var(--studio-border)] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Utvid alle underfaner"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span>Utvid alle</span>
            </button>
          </div>
        </div>
      )}

      {hierarchicalPages.map((item, topIdx) => {
        const parent = item.page;
        const hasChildren = item.children.length > 0;
        const isCollapsed = collapsedParentIds.has(parent.id);
        const targetUrl = pageUrl(parent);
        const parentOrder = getMenuOrder(parent);

        const isBeingDragged = draggingId === parent.id;
        const isDragOver = dragOverId === parent.id;

        return (
          <div
            key={parent.id}
            id={`side-${parent.id}`}
            data-menu-page={parent.id}
            onDragOver={(e) => handleDragOverTop(e, parent.id)}
            onDrop={(e) => handleDropTop(e, parent.id)}
            onDoubleClick={() => {
              if (hasChildren) {
                toggleCollapse(parent.id);
              }
            }}
            className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 relative scroll-mt-[calc(var(--demo-strip,0px)+4.5rem)] ${
              highlightedId === parent.id ? "ring-2 ring-indigo-500" : ""
            } ${
              hasChildren ? "cursor-default select-none" : ""
            } ${
              isBeingDragged
                ? "opacity-40 border-dashed border-indigo-400 bg-slate-850 shadow-inner"
                : isDragOver
                ? dropPosition === "before"
                  ? "border-t-4 border-t-indigo-400 border-[var(--studio-border)] bg-[var(--studio-surface)] ring-2 ring-indigo-500/40"
                  : "border-b-4 border-b-indigo-400 border-[var(--studio-border)] bg-[var(--studio-surface)] ring-2 ring-indigo-500/40"
                : parent.isPublished === false
                ? "border-amber-600/60 bg-slate-850/95 shadow-xs hover:border-amber-500 ring-1 ring-amber-500/15"
                : "border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-xs hover:border-[var(--studio-border)]"
            }`}
          >
            {/* Top Level Main Tab Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Drag Handle */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStartTop(e, parent.id)}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-icon)] hover:bg-[var(--studio-hover)]/60 transition-colors shrink-0"
                  title="Dra og slipp for å endre rekkefølge på toppmenyen"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Step Up / Down arrows for keyboard & touch accessibility */}
                <div
                  className="flex flex-col gap-0.5 shrink-0"
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={topIdx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveStep(topLevelPages, parent.id, "up");
                    }}
                    className={`p-0.5 rounded transition-colors ${
                      topIdx === 0
                        ? "text-[var(--studio-muted)] cursor-not-allowed"
                        : "text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                    }`}
                    title="Flytt opp i menyen"
                    aria-label="Flytt opp"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={topIdx === topLevelPages.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveStep(topLevelPages, parent.id, "down");
                    }}
                    className={`p-0.5 rounded transition-colors ${
                      topIdx === topLevelPages.length - 1
                        ? "text-[var(--studio-muted)] cursor-not-allowed"
                        : "text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                    }`}
                    title="Flytt ned i menyen"
                    aria-label="Flytt ned"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-700/60 text-[var(--studio-accent-text)] text-[11px] font-mono font-bold flex items-center justify-center shrink-0"
                      title="Menyrekkefølge"
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      #{parentOrder}
                    </span>

                    {/* Vinkelpil (< / >) og Mappeikon foran sidetittelen */}
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(parent.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(parent.id);
                        }}
                        className="px-1.5 py-1 -ml-1 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs group"
                        title={
                          isCollapsed
                            ? "Vis underfaner (klikk eller dobbeltklikk på boksen)"
                            : "Kollaps underfaner (klikk eller dobbeltklikk på boksen)"
                        }
                        aria-label={isCollapsed ? "Vis underfaner" : "Kollaps underfaner"}
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[var(--studio-icon)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--studio-icon)] group-hover:translate-y-0.5 transition-transform shrink-0" />
                        )}
                        {isCollapsed ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 pl-1">
                        <Folder className="w-4 h-4 text-amber-400/80 shrink-0" />
                      </div>
                    )}

                    <h3
                      className={`font-bold text-[var(--studio-text)] text-base truncate ${
                        hasChildren ? "hover:text-[var(--studio-accent-text)] transition-colors cursor-pointer" : ""
                      }`}
                      title={
                        hasChildren
                          ? isCollapsed
                            ? "Dobbeltklikk for å utvide underfaner"
                            : "Dobbeltklikk for å kollapse underfaner"
                          : undefined
                      }
                    >
                      {parent.title}
                    </h3>
                    <span className="text-xs font-mono text-[var(--studio-icon)] bg-[var(--studio-bg)] px-2 py-0.5 rounded">
                      {targetUrl}
                    </span>

                    {/* Draft/Published Status Indicator */}
                    <div onDoubleClick={(e) => e.stopPropagation()}>
                      {renderStatusIndicator(parent)}
                    </div>

                    {parent.inNavMenu !== false ? (
                      <span className="text-[10px] font-bold text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)]/60 px-2 py-0.5 rounded">
                        I toppmeny
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-stone-400 bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-0.5 rounded">
                        Skjult fra meny
                      </span>
                    )}

                    {pageHasBrokenLinks(parent, linkContext) && (
                      <span
                        className="text-[10px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-700/50 px-2 py-0.5 rounded inline-flex items-center gap-1"
                        title="En eller flere lenker på siden peker på noe som ikke finnes"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Lenke trenger oppmerksomhet</span>
                      </span>
                    )}

                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(parent.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(parent.id);
                        }}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isCollapsed
                            ? "text-sky-300 bg-sky-950/90 border-sky-700 hover:bg-sky-900"
                            : "text-sky-300 bg-sky-950/60 border-sky-800/60 hover:bg-sky-900/60"
                        }`}
                        title={
                          isCollapsed
                            ? "Klikk eller dobbeltklikk på boksen for å utvide underfaner"
                            : "Klikk eller dobbeltklikk på boksen for å kollapse underfaner"
                        }
                      >
                        <span>
                          {item.children.length} underfane{item.children.length > 1 ? "r" : ""}
                        </span>
                        <span className="text-[9px] text-sky-400/80 font-mono">
                          {isCollapsed ? "(skjult)" : ""}
                        </span>
                      </button>
                    )}

                    {parent.heroImage && (
                      <span
                        className="text-[10px] font-semibold text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded flex items-center gap-1"
                        title="Siden har et eget opplastet hovedbilde"
                      >
                        <ImageIcon className="w-3 h-3 text-sky-400" />
                        <span>Hovedbilde</span>
                      </span>
                    )}
                  </div>

                  {parent.summary && (
                    <p className="text-xs text-[var(--studio-muted)] line-clamp-1 pl-1">{parent.summary}</p>
                  )}
                </div>
              </div>

              {/* Main Tab Actions */}
              <div
                className="flex items-center gap-1.5 text-xs shrink-0 self-end sm:self-auto"
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onOpenNewPage(parent.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-[var(--studio-accent-text)] border border-[var(--studio-accent-border)]/60 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Opprett ny underfane som legger seg under denne fanen"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Underfane</span>
                </button>
                <a
                  href={`${targetUrl}${targetUrl.includes("?") ? "&" : "?"}preview=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (onPreviewPage) onPreviewPage(parent);
                  }}
                  className="p-1.5 rounded-lg bg-[var(--studio-accent-bg)] hover:bg-indigo-900 text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-[var(--studio-accent-border)]/60 transition-colors"
                  title="Forhåndsvis side i ny fane med ekte offentlig styling"
                  aria-label="Forhåndsvis side"
                >
                  <Eye className="w-4 h-4 text-[var(--studio-icon)]" />
                </a>
                <Link
                  to={targetUrl}
                  target="_blank"
                  className="p-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] transition-colors"
                  title="Åpne i ny fane"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => onOpenEditPage(parent)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-hover)] hover:bg-[var(--studio-border)] text-[var(--studio-text)] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rediger</span>
                </button>
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => onDuplicate(parent)}
                    className="p-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer transition-colors"
                    title="Kopier siden"
                    aria-label={`Kopier siden «${parent.title}»`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRequestDelete(parent.id)}
                  className="p-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400 cursor-pointer transition-colors"
                  title="Slett fane"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-tabs Tree (Rendered hierarchically underneath with drag & drop) */}
            {hasChildren && !isCollapsed && (
              <div
                className="ml-3 sm:ml-6 pl-3 sm:pl-6 border-l-2 border-indigo-500/30 space-y-2 pt-1 pb-1"
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {item.children.map((child, cIdx) => {
                  const childOrder = getMenuOrder(child);
                  const childUrl = pageUrl(child);

                  const isSubDragged = draggingId === child.id;
                  const isSubOver = dragOverId === child.id;

                  return (
                    <div
                      key={child.id}
                      id={`side-${child.id}`}
                      onDragOver={(e) => handleDragOverSub(e, child.id, parent.id)}
                      onDrop={(e) => handleDropSub(e, child.id, parent.id, item.children)}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative scroll-mt-[calc(var(--demo-strip,0px)+4.5rem)] ${
                        highlightedId === child.id ? "ring-2 ring-indigo-500" : ""
                      } before:absolute before:-left-3 sm:before:-left-6 before:top-1/2 before:w-3 sm:before:w-6 before:h-0.5 before:bg-indigo-500/30 ${
                        isSubDragged
                          ? "opacity-40 border-dashed border-indigo-400 bg-[var(--studio-panel-bg)]"
                          : isSubOver
                          ? dropPosition === "before"
                            ? "border-t-2 border-t-indigo-400 border-[var(--studio-border)] ring-1 ring-indigo-500/40"
                            : "border-b-2 border-b-indigo-400 border-[var(--studio-border)] ring-1 ring-indigo-500/40"
                          : child.isPublished === false
                          ? "border-amber-700/50 bg-[var(--studio-bg)]/95 hover:border-amber-600/60 ring-1 ring-amber-500/10"
                          : "border-[var(--studio-border)] bg-[var(--studio-row)] hover:border-[var(--studio-border)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Sub-page Drag Handle */}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStartSub(e, child.id, parent.id)}
                          onDragEnd={handleDragEnd}
                          className="cursor-grab active:cursor-grabbing p-1 rounded text-[var(--studio-muted)] hover:text-[var(--studio-icon)] hover:bg-[var(--studio-surface)] transition-colors shrink-0"
                          title="Dra og slipp for å endre rekkefølge blant underfanene"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Move Up/Down arrows for sub-page */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={cIdx === 0}
                            onClick={() => handleMoveStep(item.children, child.id, "up")}
                            className={`p-0.5 rounded transition-colors ${
                              cIdx === 0
                                ? "text-[var(--studio-text)] cursor-not-allowed"
                                : "text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] hover:bg-[var(--studio-surface)] cursor-pointer"
                            }`}
                            title="Flytt underfane opp"
                            aria-label="Flytt underfane opp"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={cIdx === item.children.length - 1}
                            onClick={() => handleMoveStep(item.children, child.id, "down")}
                            className={`p-0.5 rounded transition-colors ${
                              cIdx === item.children.length - 1
                                ? "text-[var(--studio-text)] cursor-not-allowed"
                                : "text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] hover:bg-[var(--studio-surface)] cursor-pointer"
                            }`}
                            title="Flytt underfane ned"
                            aria-label="Flytt underfane ned"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CornerDownRight className="w-3.5 h-3.5 text-[var(--studio-icon)] shrink-0" />
                            <span className="w-5 h-5 rounded bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-muted)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                              #{childOrder ?? cIdx + 1}
                            </span>
                            <FileText className="w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0" />
                            <h4 className="font-semibold text-[var(--studio-text)] text-sm truncate">{child.title}</h4>
                            <span className="text-[11px] font-mono text-[var(--studio-icon)] bg-[var(--studio-panel-bg)] px-2 py-0.5 rounded">
                              /{child.slug}
                            </span>

                            {/* Draft/Published Status Indicator */}
                            {renderStatusIndicator(child, true)}

                            {child.inNavMenu !== false ? (
                              <span className="text-[10px] font-semibold text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] px-1.5 py-0.5 rounded">
                                I meny
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-stone-400 bg-[var(--studio-panel-bg)] px-1.5 py-0.5 rounded">
                                Skjult
                              </span>
                            )}

                            {pageHasBrokenLinks(child, linkContext) && (
                              <span
                                className="text-[10px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-700/50 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                title="En eller flere lenker på siden peker på noe som ikke finnes"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Lenke</span>
                              </span>
                            )}

                            {child.heroImage && (
                              <span
                                className="text-[10px] font-semibold text-sky-300 bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.5 rounded flex items-center gap-1"
                                title="Siden har et eget opplastet hovedbilde"
                              >
                                <ImageIcon className="w-2.5 h-2.5 text-sky-400" />
                                <span>Bilde</span>
                              </span>
                            )}
                          </div>
                          {child.summary && (
                            <p className="text-xs text-[var(--studio-muted)] line-clamp-1 pl-1">{child.summary}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs shrink-0 self-end sm:self-auto">
                        <a
                          href={`${childUrl}${childUrl.includes("?") ? "&" : "?"}preview=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (onPreviewPage) onPreviewPage(child);
                          }}
                          className="p-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-[var(--studio-accent-border)]/40 transition-colors"
                          title="Forhåndsvis underside i ny fane med ekte offentlig styling"
                          aria-label="Forhåndsvis underside"
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                        </a>
                        <Link
                          to={childUrl}
                          target="_blank"
                          className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] transition-colors"
                          title="Åpne i ny fane"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onOpenEditPage(child)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] font-semibold flex items-center gap-1 text-[11px] cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Rediger</span>
                        </button>
                        {onDuplicate && (
                          <button
                            type="button"
                            onClick={() => onDuplicate(child)}
                            className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer transition-colors"
                            title="Kopier siden"
                            aria-label={`Kopier siden «${child.title}»`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRequestDelete(child.id)}
                          className="p-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400 cursor-pointer transition-colors"
                          title="Slett underside"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasChildren && isCollapsed && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(parent.id);
                }}
                className="ml-3 sm:ml-6 pl-3 sm:pl-6 py-2 text-xs text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] cursor-pointer flex items-center gap-2 transition-colors border-l-2 border-indigo-500/20 group"
                title="Klikk eller dobbeltklikk for å vise underfaner"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-icon)] group-hover:translate-x-0.5 transition-transform" />
                <span className="font-medium">
                  {item.children.length} underfane{item.children.length > 1 ? "r" : ""} er skjult – klikk eller dobbeltklikk for å utvide
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Orphan Pages if any */}
      {orphanPages.length > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--studio-input)] border border-amber-900/50 space-y-3 mt-6">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Frittstående sider uten tilordnet overordnet fane</span>
          </h3>
          <div className="space-y-2">
            {orphanPages.map((op) => (
              <div
                key={op.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                  op.isPublished === false
                    ? "border-amber-700/50 bg-[var(--studio-surface)]/95 ring-1 ring-amber-500/10"
                    : "border-[var(--studio-border)] bg-[var(--studio-surface)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                  <span className="font-semibold text-[var(--studio-text)]">{op.title}</span>
                  <span className="font-mono text-[var(--studio-icon)]">/{op.slug}</span>
                  {renderStatusIndicator(op, true)}
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`/${op.slug}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] border border-[var(--studio-accent-border)]/40 transition-colors"
                    title="Forhåndsvis side i ny fane"
                    aria-label="Forhåndsvis side"
                  >
                    <Eye className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenEditPage(op)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition-colors"
                  >
                    Tilordne overordnet fane
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
