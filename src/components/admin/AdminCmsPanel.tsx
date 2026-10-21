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

export interface AdminCmsPanelProps {
  showFeedback: ShowFeedback;
  /** Set when another tab/shortcut asks for this panel to open with a new, empty editor. */
  createRequested?: boolean;
  onCreateHandled?: () => void;
}

/**
 * AdminCmsPanel - Komponent for komplett hierarkisk side- og innholdshåndtering.
 * Isolerer administrasjonslogikk for nettsidens CMS-sider ut av AdminStudio.
 */
export const AdminCmsPanel: React.FC<AdminCmsPanelProps> = ({
  showFeedback,
  createRequested = false,
  onCreateHandled,
}) => {
  const { pages, savePage, deletePage, reorderPages } = useCms();

  const [editingPage, setEditingPage] = useState<Partial<CmsPage> | null>(null);
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

  const openEditor = (page: Partial<CmsPage>, isNew: boolean) => {
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

  // The editor opens above the list. Opened from a page far down, it would come in above the screen
  // with only its bottom showing, so it is brought to the top of the screen, below the demo strip. At once:
  // a smooth scroll over a long list takes seconds.
  useEffect(() => {
    if (openCount > 0) editorRef.current?.scrollIntoView?.({ block: "start" });
  }, [openCount]);

  // Closed, the list is where one was: the page that was edited is brought back to the middle of the screen
  const closeEditor = () => {
    const id = editingPage?.id;
    setEditingPage(null);
    if (id) window.requestAnimationFrame(() => document.getElementById(`side-${id}`)?.scrollIntoView?.({ block: "center" }));
  };
  const handleCloseEditor = () => leaveEditor(closeEditor);

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

  const handleTogglePublish = async (page: CmsPage) => {
    const isCurrentlyPublished = page.isPublished !== false;
    const willBePublished = !isCurrentlyPublished;
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

  return (
    <div className="w-full space-y-6 transition-all">
      {/* Header: the title, and «+» for a new main tab. Sub-tabs are added from the tab they go under. */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Sider & Innhold på nettsiden</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            Bygg menyen på nettsiden med hovedfaner og underfaner. Klikk på statusen for å publisere en side eller sette den til kladd.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenNewPage(null)}
          aria-label="Ny hovedfane"
          title="Ny hovedfane i menyen. En underfane legges til med + på fanen den skal ligge under."
          className="shrink-0 w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
        >
          <Plus className="w-6 h-6" aria-hidden />
        </button>
      </div>

      {/* Side Editor Modal / Form */}
      {editingPage && (
        <div ref={editorRef} data-page-editor className="scroll-mt-[calc(var(--demo-strip,0px)+1rem)] space-y-3">
        {wide && menuBar.length > 0 && (
          <PageMenuBar items={menuBar} activeId={editingMainId} onJump={handleMenuOpen} sticky={false} />
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
        />
        </div>
      )}

      {/* Hierarchical Tree of Pages with Drag & Drop */}
      <PageTreeList
        hierarchicalPages={hierarchicalPages}
        orphanPages={orphanPages}
        onOpenNewPage={handleOpenNewPage}
        onOpenEditPage={handleOpenEditPage}
        onRequestDelete={setDeleteConfirmPageId}
        onDuplicate={handleDuplicatePage}
        onReorder={handleReorder}
        onTogglePublish={handleTogglePublish}
      />

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
