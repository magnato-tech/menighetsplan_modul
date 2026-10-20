import { useCallback, useEffect, useRef } from "react";
import type { CmsPage } from "../data/cmsData";
import type { VisualBlock } from "../utils/cmsBlocks";
import {
  acceptParentMessage,
  buildDraftSnapshot,
  extractWarmDraft,
  postToPreview,
  writeDraftSnapshot,
  type PreviewToCmsMessage,
  type SnapshotFit,
  type WarmDraftFields,
} from "../utils/previewBridge";

interface UsePreviewBridgeParentOptions {
  editingPage: Partial<CmsPage>;
  blocks: VisualBlock[];
  revision: number;
  previousSlugRef: React.MutableRefObject<string>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onPreviewLocation?: (path: string, hash: string) => void;
  onPreviewBlocked?: () => void;
  onIframeReady?: (msg: Extract<PreviewToCmsMessage, { type: "preview:ready" }>) => void;
  /** How much of the page the preview got the last time it was stored (see writeDraftSnapshot). */
  onSnapshotFit?: (fit: SnapshotFit) => void;
}

export function usePreviewBridgeParent({
  editingPage,
  blocks,
  revision,
  previousSlugRef,
  iframeRef,
  onPreviewLocation,
  onPreviewBlocked,
  onIframeReady,
  onSnapshotFit,
}: UsePreviewBridgeParentOptions) {
  const warmPendingRef = useRef<WarmDraftFields | null>(null);
  const revisionRef = useRef(revision);
  revisionRef.current = revision;

  const flushSnapshot = useCallback(() => {
    const snapshot = buildDraftSnapshot(
      { ...editingPage, blocks },
      revisionRef.current,
      blocks
    );
    const fit = writeDraftSnapshot(snapshot, previousSlugRef.current);
    previousSlugRef.current = snapshot.slug || "";
    onSnapshotFit?.(fit);
    return snapshot;
  }, [editingPage, blocks, onSnapshotFit]);

  const sendWarmDraft = useCallback(
    (immediate = false) => {
      const iframe = iframeRef.current?.contentWindow;
      if (!iframe) return;
      const pageId = editingPage.id || "draft-page-preview";
      const warm = extractWarmDraft(editingPage);
      warmPendingRef.current = warm;
      postToPreview(
        iframe,
        { type: "cms:draft", pageId, revision: revisionRef.current, draft: warm },
        window.location.origin
      );
      if (immediate) {
        flushSnapshot();
        postToPreview(
          iframe,
          { type: "cms:draft-stored", pageId, revision: revisionRef.current },
          window.location.origin
        );
      }
    },
    [editingPage, iframeRef, flushSnapshot]
  );

  const sendFocus = useCallback(
    (blockId: string) => {
      const iframe = iframeRef.current?.contentWindow;
      if (!iframe) return;
      postToPreview(iframe, { type: "cms:focus", blockId }, window.location.origin);
    },
    [iframeRef]
  );

  const respondToReady = useCallback(
    (msg: Extract<PreviewToCmsMessage, { type: "preview:ready" }>) => {
      const iframe = iframeRef.current?.contentWindow;
      if (!iframe) return;
      flushSnapshot();
      const pageId = editingPage.id || "draft-page-preview";
      const warm = extractWarmDraft(editingPage);
      postToPreview(
        iframe,
        { type: "cms:draft", pageId, revision: revisionRef.current, draft: warm },
        window.location.origin
      );
      postToPreview(
        iframe,
        { type: "cms:draft-stored", pageId, revision: revisionRef.current },
        window.location.origin
      );
      onIframeReady?.(msg);
    },
    [editingPage, iframeRef, flushSnapshot, onIframeReady]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow ?? null;
      const msg = acceptParentMessage(event, window.location.origin, iframeWindow);
      if (!msg) return;

      switch (msg.type) {
        case "preview:ready":
          respondToReady(msg);
          break;
        case "preview:location":
          onPreviewLocation?.(msg.path, msg.hash);
          break;
        case "preview:blocked":
          onPreviewBlocked?.();
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [iframeRef, respondToReady, onPreviewLocation, onPreviewBlocked]);

  return { flushSnapshot, sendWarmDraft, sendFocus };
}
