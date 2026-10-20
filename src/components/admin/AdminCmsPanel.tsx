import React, { useState, useEffect, useMemo } from "react";
import { useCms } from "../../context/CmsContext";
import { CmsPage } from "../../data/cmsData";
import { buildPageTree, findOrphanPages, getParentId } from "../../utils/menu";
import { QUIET_HERO } from "../../utils/heroLayout";
import { Plus } from "lucide-react";
import { ShowFeedback } from "../../pages/admin/studio";
import { PageTreeList } from "../../pages/admin/tabs/pages/PageTreeList";
import { PageEditModal } from "../../pages/admin/tabs/pages/PageEditModal";
import { PageDeleteDialog } from "../../pages/admin/tabs/pages/PageDeleteDialog";

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

  const handleOpenEditPage = (page: CmsPage) => {
    setEditingPage({ ...page });
    setIsNewPage(false);
  };

  const handleOpenNewPage = (parentId?: string | null) => {
    const parentVal = parentId || null;
    const siblings = pages.filter((p) => getParentId(p) === parentVal);
    const nextOrder = siblings.length + 1;

    setEditingPage({
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
    });
    setIsNewPage(true);
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPage || !editingPage.title) {
      showFeedback("Siden må ha en tittel", "error");
      return;
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

    const saved = await savePage({
      ...editingPage,
      slug: cleanSlug,
      parentPageId: parentVal,
      parentId: parentVal,
      menuOrder: orderVal,
      navOrder: orderVal,
      inNavMenu: editingPage.inNavMenu !== false,
      isPublished: editingPage.isPublished !== false,
      linkUrl: editingPage.linkUrl?.trim() || undefined,
    });

    if (!saved) return;
    setEditingPage(null);
    showFeedback("Siden ble lagret og menystrukturen ble oppdatert!");
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
        <PageEditModal
          editingPage={editingPage}
          isNewPage={isNewPage}
          availableParentPages={availableParentPages}
          onUpdate={(patch) => setEditingPage((prev) => (prev ? { ...prev, ...patch } : patch))}
          onSave={handleSavePage}
          onClose={() => setEditingPage(null)}
        />
      )}

      {/* Hierarchical Tree of Pages with Drag & Drop */}
      <PageTreeList
        hierarchicalPages={hierarchicalPages}
        orphanPages={orphanPages}
        onOpenNewPage={handleOpenNewPage}
        onOpenEditPage={handleOpenEditPage}
        onRequestDelete={setDeleteConfirmPageId}
        onReorder={handleReorder}
        onTogglePublish={handleTogglePublish}
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
