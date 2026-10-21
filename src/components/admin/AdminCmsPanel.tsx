import React, { useState, useEffect, useMemo, useRef } from "react";
import { useCms } from "../../context/CmsContext";
import { CmsPage } from "../../data/cmsData";
import { buildMenuBar, buildPageTree, findOrphanPages, getParentId } from "../../utils/menu";
import { pageFingerprint } from "../../utils/pageRecord";
import { pageCopyOf } from "../../utils/pageCopy";
import { useReportUnsaved, useSaveShortcut } from "../../hooks/useUnsavedChanges";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { QUIET_HERO } from "../../utils/heroLayout";
import { newId } from "../../utils/id";
import { History, Plus } from "lucide-react";
import { clearDraftBackup, draftTimeLabel, readDraftBackup, useDraftBackup, type DraftBackup } from "../../hooks/useDraftBackup";
import { ShowFeedback } from "../../pages/admin/studio";
import { PageTreeList } from "../../pages/admin/tabs/pages/PageTreeList";
import { PageEditModal } from "../../pages/admin/tabs/pages/PageEditModal";
import { PageDeleteDialog } from "../../pages/admin/tabs/pages/PageDeleteDialog";
import { PageMenuBar } from "../../pages/admin/tabs/pages/PageMenuBar";
import { UnsavedChangesDialog } from "../../pages/admin/tabs/pages/UnsavedChangesDialog";
import { PageUnpublishDialog } from "../../pages/admin/tabs/pages/PageUnpublishDialog";

// The two views of the panel, chosen with the switch at the top
type PagesView = "rediger" | "struktur";
const VIEW_KEY = "menighetsplan:sider-visning";
const LAST_OPENED_KEY = "menighetsplan:sider-sist-apnet";

// Storage can be blocked (private mode, settings), so every access is guarded
function readStoredText(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredText(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: the choice lasts until the page is reloaded
  }
}

// The front page: slug "", "/" or "forside". Falls back to the first main tab.
function findFrontPage(pages: CmsPage[], tree: ReturnType<typeof buildPageTree>): CmsPage | undefined {
  const front = pages.find((p) => {
    const slug = (p.slug ?? "").trim().toLowerCase();
    return slug === "" || slug === "/" || slug === "forside";
  });
  return front ?? tree[0]?.page;
}

export interface AdminCmsPanelProps {
  showFeedback: ShowFeedback;
  /** Set when another tab/shortcut asks for this panel to open with a new, empty editor. */
  createRequested?: boolean;
  onCreateHandled?: () => void;
  /** Tells the admin whether a page is open in the editor, so the side menu can fold to icons. */
  onEditorOpenChange?: (open: boolean) => void;
}

/**
 * AdminCmsPanel - Komponent for komplett hierarkisk side- og innholdshåndtering.
 * Isolerer administrasjonslogikk for nettsidens CMS-sider ut av AdminStudio.
 */
export const AdminCmsPanel: React.FC<AdminCmsPanelProps> = ({
  showFeedback,
  createRequested = false,
  onCreateHandled,
  onEditorOpenChange,
}) => {
  const { pages, savePage, deletePage, reorderPages } = useCms();

  const [editingPage, setEditingPage] = useState<Partial<CmsPage> | null>(null);
  // Editor or tree: one at a time, so the page is not split in two parts. Remembered between visits.
  const [view, setView] = useState<PagesView>(() => (readStoredText(VIEW_KEY) === "struktur" ? "struktur" : "rediger"));
  useEffect(() => writeStoredText(VIEW_KEY, view), [view]);
  // A page that is taken off the website is only asked about here, before it is saved as a draft
  const [unpublishPage, setUnpublishPage] = useState<CmsPage | null>(null);

  // Report the editor state up, and reset it when this panel goes away
  useEffect(() => {
    onEditorOpenChange?.(editingPage !== null);
  }, [editingPage, onEditorOpenChange]);
  useEffect(() => () => onEditorOpenChange?.(false), [onEditorOpenChange]);
  const [isNewPage, setIsNewPage] = useState(false);
  const [deleteConfirmPageId, setDeleteConfirmPageId] = useState<string | null>(null);
  // Counts each time the editor is opened, so it is brought into view then, and not on every Lagre
  const [openCount, setOpenCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  // The page as it was opened or last saved, to tell whether the editor holds changes that are not saved
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const unsaved = editingPage !== null && pageFingerprint(editingPage) !== savedFingerprint;
  // What was asked for while there were changes not saved: done after Lagre or Forkast, dropped on Bli her
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  // Opening, moving to another page and closing go through here, so changes are not lost without asking
  const leaveEditor = (action: () => void) => {
    if (unsaved) setPendingLeave(() => action);
    else action();
  };
  // What is typed is kept in this browser until it is saved (see useDraftBackup). A draft left from
  // before, that differs from the page, is offered when the page is opened again.
  const backupKey = editingPage ? `side:${editingPage.id ?? "ny"}` : null;
  const [offeredBackup, setOfferedBackup] = useState<DraftBackup<Partial<CmsPage>> | null>(null);
  useDraftBackup(backupKey, editingPage, unsaved, offeredBackup !== null);

  // Opening a page always shows the editor, also when it is opened from the tree
  const openEditor = (page: Partial<CmsPage>, isNew: boolean) => {
    setView("rediger");
    // Remembered, so the same page is open the next time the panel is shown
    if (page.id) writeStoredText(LAST_OPENED_KEY, page.id);
    setEditingPage(page);
    setIsNewPage(isNew);
    setSavedFingerprint(pageFingerprint(page));
    setOpenCount((n) => n + 1);
    const backup = readDraftBackup<Partial<CmsPage>>(`side:${page.id ?? "ny"}`);
    setOfferedBackup(backup && pageFingerprint(backup.draft) !== pageFingerprint(page) ? backup : null);
  };
  const restoreBackup = () => {
    if (!offeredBackup) return;
    setEditingPage((current) => (current ? { ...current, ...offeredBackup.draft, id: current.id } : current));
    setOfferedBackup(null);
  };
  const discardBackup = () => {
    if (backupKey) clearDraftBackup(backupKey);
    setOfferedBackup(null);
  };

  // A page opened from far down the tree would come in scrolled away, so the panel is brought to the top of
  // the screen, with the view switch in sight above the editor. At once: a smooth scroll takes seconds.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openCount > 0) panelRef.current?.scrollIntoView?.({ block: "start" });
  }, [openCount]);

  // Closed, the tree shows the page that was edited, brought back to the middle of the screen
  const closeEditor = () => {
    const id = editingPage?.id;
    setEditingPage(null);
    if (id) window.requestAnimationFrame(() => document.getElementById(`side-${id}`)?.scrollIntoView?.({ block: "center" }));
  };
  // Closing the editor goes to the tree, where the page is listed
  const handleCloseEditor = () =>
    leaveEditor(() => {
      closeEditor();
      setView("struktur");
    });

  // The switch at the top. Going to the tree closes the editor (after asking about unsaved changes).
  // Going to the editor opens the page the effect picks.
  const handleSwitchView = (next: PagesView) => {
    if (next === view) return;
    if (next === "rediger") {
      setView("rediger");
      return;
    }
    leaveEditor(() => {
      closeEditor();
      setView("struktur");
    });
  };

  const handleOpenEditPage = (page: CmsPage) => {
    if (editingPage?.id === page.id) return;
    leaveEditor(() => openEditor({ ...page }, false));
  };

  const handleOpenNewPage = (parentId?: string | null) => {
    const parentVal = parentId || null;
    const siblings = pages.filter((p) => getParentId(p) === parentVal);
    const nextOrder = siblings.length + 1;

    leaveEditor(() => openEditor({
      title: "",
      slug: "",
      summary: "",
      content: "## Ny seksjon\nSkriv artikkel eller infotekst her...\n\n- Punkt 1\n- Punkt 2",
      isPublished: true,
      inNavMenu: true,
      parentPageId: parentVal,
      parentId: parentVal,
      menuOrder: nextOrder,
      navOrder: nextOrder,
      // A new page begins without buttons and line under the headline; they are switched on when wanted
      ...QUIET_HERO,
    }, true));
  };

  // A copy opens in the editor as a new page; it is stored, as a draft, only when it is saved
  const handleDuplicatePage = (page: CmsPage) =>
    leaveEditor(() => {
      openEditor(pageCopyOf(page, pages), true);
      showFeedback(`En kopi av «${page.title}» er åpnet. Den lagres som kladd når du trykker Lagre.`);
    });

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveEditingPage();
  };

  /** Saves the page in the editor and keeps it open. False when it was not saved. */
  const saveEditingPage = async (): Promise<boolean> => {
    if (!editingPage || !editingPage.title) {
      showFeedback("Siden må ha en tittel", "error");
      return false;
    }
    const cleanSlug = (editingPage.slug || editingPage.title.toLowerCase().replace(/\s+/g, "-"))
      .toLowerCase()
      .replace(/^\//, "")
      .trim();

    const parentVal =
      editingPage.parentPageId !== undefined
        ? editingPage.parentPageId
        : editingPage.parentId || null;

    const orderVal =
      typeof editingPage.menuOrder === "number"
        ? editingPage.menuOrder
        : typeof editingPage.navOrder === "number"
        ? editingPage.navOrder
        : 1;

    // A new page gets its id here, so the next Lagre updates it instead of making another
    const id = editingPage.id || newId("page");
    const toSave = {
      ...editingPage,
      id,
      slug: cleanSlug,
      parentPageId: parentVal,
      parentId: parentVal,
      menuOrder: orderVal,
      navOrder: orderVal,
      inNavMenu: editingPage.inNavMenu !== false,
      isPublished: editingPage.isPublished !== false,
      linkUrl: editingPage.linkUrl?.trim() || undefined,
    };
    const saved = await savePage(toSave);

    if (!saved) return false;
    // The page stays open, so one can go on with it; Lukk goes back to the list
    setEditingPage((current) => (current ? { ...current, id, slug: cleanSlug } : current));
    setSavedFingerprint(pageFingerprint(toSave));
    setIsNewPage(false);
    // Saved: the draft kept in the browser is not needed any more
    clearDraftBackup(`side:${editingPage.id ?? "ny"}`);
    clearDraftBackup(`side:${id}`);
    setOfferedBackup(null);
    showFeedback("Siden ble lagret og menystrukturen ble oppdatert!");
    return true;
  };

  // The studio is told, for the mark in the side menu and the question before leaving the studio
  useReportUnsaved("cms-sider", unsaved, editingPage?.title, saveEditingPage);
  useSaveShortcut(editorRef, editingPage !== null, saveEditingPage);

  const handleSaveAndLeave = async () => {
    const action = pendingLeave;
    setPendingLeave(null);
    if ((await saveEditingPage()) && action) action();
  };

  const handleDiscardAndLeave = () => {
    const action = pendingLeave;
    setPendingLeave(null);
    // Thrown away on purpose: it is not offered again
    if (backupKey) clearDraftBackup(backupKey);
    action?.();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmPageId) return;
    const pageId = deleteConfirmPageId;
    setDeleteConfirmPageId(null);
    const success = await deletePage(pageId);
    if (success) {
      showFeedback("Siden ble slettet");
      // The open page is gone, so the editor closes without asking. The effect then opens another page.
      if (editingPage?.id === pageId) {
        setEditingPage(null);
        writeStoredText(LAST_OPENED_KEY, null);
      }
    }
  };

  const handleReorder = async (orderedPageIds: string[]) => {
    const success = await reorderPages(orderedPageIds);
    if (success) {
      showFeedback("Menyrekkefølgen ble oppdatert!");
    } else {
      showFeedback("Kunne ikke oppdatere menyrekkefølgen", "error");
    }
  };

  const setPublished = async (page: CmsPage, willBePublished: boolean) => {
    const success = await savePage({
      ...page,
      isPublished: willBePublished,
    });
    if (success) {
      showFeedback(
        willBePublished
          ? `«${page.title}» er nå publisert på nettsiden!`
          : `«${page.title}» er satt til kladd (upublisert).`
      );
    } else {
      showFeedback("Kunne ikke oppdatere publiseringsstatus", "error");
    }
  };

  // Publishing saves at once. Taking a page off the website is asked about first (see PageUnpublishDialog).
  const handleTogglePublish = (page: CmsPage) => {
    if (page.isPublished !== false) {
      setUnpublishPage(page);
      return;
    }
    void setPublished(page, true);
  };

  const confirmUnpublish = async () => {
    const page = unpublishPage;
    setUnpublishPage(null);
    if (page) await setPublished(page, false);
  };

  // Shows or hides a page in the website's menu. Only the menu flag changes.
  const handleToggleNavMenu = async (page: CmsPage) => {
    const willShow = page.inNavMenu === false;
    const success = await savePage({ ...page, inNavMenu: willShow });
    if (success) {
      showFeedback(willShow ? `«${page.title}» vises nå i menyen` : `«${page.title}» er tatt ut av menyen`);
    } else {
      showFeedback("Kunne ikke oppdatere menyen", "error");
    }
  };

  // Every page is listed here, drafts and pages hidden from the menu included
  const hierarchicalPages = useMemo(() => buildPageTree(pages), [pages]);
  // The website's menu over the editor, on a large screen: a page in it opens in the editor
  const menuBar = useMemo(() => buildMenuBar(hierarchicalPages), [hierarchicalPages]);
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const editingMainId = editingPage ? getParentId(editingPage as CmsPage) || editingPage.id || null : null;
  const handleMenuOpen = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (page) handleOpenEditPage(page);
  };
  const orphanPages = useMemo(() => findOrphanPages(pages), [pages]);

  const availableParentPages = useMemo(() => {
    return pages.filter((p) => !getParentId(p) && p.id !== editingPage?.id);
  }, [pages, editingPage?.id]);

  const subPagesOfDeleted = useMemo(() => {
    if (!deleteConfirmPageId) return 0;
    return pages.filter((p) => getParentId(p) === deleteConfirmPageId).length;
  }, [pages, deleteConfirmPageId]);

  useEffect(() => {
    if (createRequested) {
      handleOpenNewPage();
      onCreateHandled?.();
    }
  }, [createRequested, onCreateHandled]);

  // In the editor view with no page open, the page last opened is shown, else the front page.
  // Not while a new page is being asked for. Once a page is open this does nothing, so it cannot loop.
  useEffect(() => {
    if (view !== "rediger" || editingPage || createRequested || pages.length === 0) return;
    const remembered = readStoredText(LAST_OPENED_KEY);
    const page = pages.find((p) => p.id === remembered) ?? findFrontPage(pages, hierarchicalPages);
    if (page) openEditor({ ...page }, false);
  }, [view, editingPage, createRequested, pages, hierarchicalPages]);

  return (
    <div ref={panelRef} className="w-full space-y-6 transition-all scroll-mt-[calc(var(--demo-strip,0px)+1rem)]">
      {/* Header: the title, and «+» for a new main tab. Sub-tabs are added from the tab they go under. */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Sider & Innhold på nettsiden</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            Rediger sidene, eller bytt til Sidestruktur for å ordne menyen, publisere, kopiere og slette sider.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {/* Switch: the editor or the tree, styled like the mode switch in the editor */}
          <div role="group" aria-label="Velg visning" className="flex items-center gap-1 bg-[var(--studio-input)] p-1 rounded-xl border border-[var(--studio-border)]">
            {(
              [
                { id: "rediger", label: "Rediger" },
                { id: "struktur", label: "Sidestruktur" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => handleSwitchView(option.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  view === option.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleOpenNewPage(null)}
            aria-label="Ny hovedfane"
            title="Ny hovedfane i menyen. En underfane legges til med + på fanen den skal ligge under."
            className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
          >
            <Plus className="w-6 h-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* Side Editor Modal / Form. Only in the editor view. */}
      {view === "rediger" && editingPage && (
        <div ref={editorRef} data-page-editor className="scroll-mt-[calc(var(--demo-strip,0px)+1rem)] space-y-3">
        {wide && menuBar.length > 0 && (
          <PageMenuBar items={menuBar} activeId={editingMainId} onJump={handleMenuOpen} sticky={false} />
        )}
        {/* Narrow screens: the website's menu as a list, since the menu bar above does not fit */}
        {!wide && menuBar.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--studio-muted)]">
            <span>Side</span>
            <select
              aria-label="Side"
              value={editingPage.id ?? ""}
              onChange={(e) => handleMenuOpen(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] text-[var(--studio-text)] text-xs px-3 py-2"
            >
              {!editingPage.id && (
                <option value="" disabled>
                  Ny side
                </option>
              )}
              {menuBar.map((item) => (
                <React.Fragment key={item.id}>
                  <option value={item.id}>{item.title || "Uten tittel"}</option>
                  {item.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {`– ${child.title || "Uten tittel"}`}
                    </option>
                  ))}
                </React.Fragment>
              ))}
            </select>
          </label>
        )}
        {offeredBackup && (
          <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950">
            <p className="text-xs leading-relaxed flex items-start gap-2">
              <History className="w-4 h-4 shrink-0 mt-px text-amber-600" aria-hidden="true" />
              <span>
                <strong>Et utkast ble ikke lagret.</strong> Denne nettleseren tok vare på endringer i siden fra {draftTimeLabel(offeredBackup.savedAt)}.
              </span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={discardBackup} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer">
                Forkast utkastet
              </button>
              <button type="button" onClick={restoreBackup} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer">
                Hent tilbake utkastet
              </button>
            </div>
          </div>
        )}
        <PageEditModal
          editingPage={editingPage}
          isNewPage={isNewPage}
          availableParentPages={availableParentPages}
          onUpdate={(patch) => setEditingPage((prev) => (prev ? { ...prev, ...patch } : patch))}
          onSave={handleSavePage}
          onClose={handleCloseEditor}
          onDuplicate={
            editingPage.id
              ? () => {
                  const page = pages.find((x) => x.id === editingPage.id);
                  if (page) handleDuplicatePage(page);
                }
              : undefined
          }
          onDelete={editingPage.id ? () => setDeleteConfirmPageId(editingPage.id!) : undefined}
        />
        </div>
      )}

      {/* Hierarchical Tree of Pages with Drag & Drop. Only in the tree view. */}
      {view === "struktur" && (
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={orphanPages}
          onOpenNewPage={handleOpenNewPage}
          onOpenEditPage={handleOpenEditPage}
          onRequestDelete={setDeleteConfirmPageId}
          onDuplicate={handleDuplicatePage}
          onReorder={handleReorder}
          onTogglePublish={handleTogglePublish}
          onToggleNavMenu={handleToggleNavMenu}
        />
      )}

      <PageUnpublishDialog page={unpublishPage} onConfirm={confirmUnpublish} onCancel={() => setUnpublishPage(null)} />

      <UnsavedChangesDialog
        open={pendingLeave !== null}
        pageTitle={editingPage?.title}
        onSave={handleSaveAndLeave}
        onDiscard={handleDiscardAndLeave}
        onStay={() => setPendingLeave(null)}
      />

      {/* Slettebekreftelse Modal */}
      <PageDeleteDialog
        pageId={deleteConfirmPageId}
        subPagesCount={subPagesOfDeleted}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmPageId(null)}
      />
    </div>
  );
};
