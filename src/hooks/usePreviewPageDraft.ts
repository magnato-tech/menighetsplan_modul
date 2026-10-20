import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { CmsPage } from "../data/cmsData";
import {
  acceptIframeMessage,
  applyWarmDraft,
  pathsMatchDraft,
  readDraftSnapshotById,
  readDraftSnapshotForPath,
  readPreviewModeFlags,
  type WarmDraftFields,
} from "../utils/previewBridge";
import { pageUrl } from "../utils/menu";
import { scrollToPreviewTarget } from "../utils/previewScroll";
import { useCms } from "../context/CmsContext";

/**
 * Merges session-storage draft and warm bridge overlay for the page being edited in preview.
 */
export function usePreviewPageDraft(
  basePage: CmsPage | null | undefined,
  forcedPath?: string
): {
  draftPage: Partial<CmsPage> | null;
  isLiveDraft: boolean;
  relaxLinkValidation: boolean;
} {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { pages } = useCms();
  const [warmOverlay, setWarmOverlay] = useState<WarmDraftFields>({});
  const [storageRevision, setStorageRevision] = useState(0);

  const flags = useMemo(() => {
    const isIframe = typeof window !== "undefined" && window.parent !== window;
    return readPreviewModeFlags(searchParams.toString(), isIframe);
  }, [searchParams]);

  const currentPath = forcedPath || location.pathname;
  const snapshot = useMemo(() => {
    if (!flags.preview) return null;
    if (basePage?.id) {
      const byId = readDraftSnapshotById(basePage.id);
      if (byId && pathsMatchDraft(currentPath, byId.publicPath || pageUrl({ slug: byId.slug || "", linkUrl: byId.linkUrl }))) {
        return byId;
      }
    }
    return readDraftSnapshotForPath(currentPath, pages);
  }, [flags.preview, basePage?.id, currentPath, pages, storageRevision]);

  const isEditingTarget = Boolean(
    snapshot &&
      pathsMatchDraft(
        currentPath,
        snapshot.publicPath || pageUrl({ slug: snapshot.slug || "", linkUrl: snapshot.linkUrl })
      )
  );

  useEffect(() => {
    if (!flags.preview) return;

    const handler = (event: MessageEvent) => {
      const msg = acceptIframeMessage(event, window.location.origin, window.parent);
      if (!msg) return;

      if (msg.type === "cms:draft") {
        if (!snapshot?.id || msg.pageId !== snapshot.id) return;
        if (!isEditingTarget) return;
        setWarmOverlay((prev) => ({ ...prev, ...msg.draft }));
      }
      if (msg.type === "cms:draft-stored") {
        if (!snapshot?.id || msg.pageId !== snapshot.id) return;
        setStorageRevision((r) => r + 1);
        setWarmOverlay({});
      }
      if (msg.type === "cms:focus") {
        const target = document.querySelector(`[data-cms-preview-target="${msg.blockId}"]`);
        // Below the website's menu, so the top of the section is not hidden behind it
        if (target) scrollToPreviewTarget(target);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [flags.preview, snapshot?.id, isEditingTarget]);

  const draftPage = useMemo(() => {
    if (!isEditingTarget || !snapshot) return null;
    const { revision: _r, publicPath: _p, ...rest } = snapshot;
    const base = basePage ? { ...basePage } : {};
    return applyWarmDraft({ ...base, ...rest }, warmOverlay);
  }, [isEditingTarget, snapshot, basePage, warmOverlay]);

  return {
    draftPage,
    isLiveDraft: Boolean(draftPage),
    relaxLinkValidation: flags.preview,
  };
}
