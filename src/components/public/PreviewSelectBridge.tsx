import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { postToParent } from "../../utils/previewBridge";

// The outline that shows a section can be pressed, and the hand over it. Only in the preview in the
// editor; the website itself never gets it.
const STYLE = `
[data-cms-preview-target] { cursor: pointer; }
[data-cms-preview-target]:hover { outline: 3px dashed rgba(79, 70, 229, 0.75); outline-offset: -3px; }
[data-gathering-id]:hover { outline: 3px solid rgba(79, 70, 229, 0.9); outline-offset: -3px; }
`;

/**
 * In the preview beside the editor, a press on a section opens that section in the editor, and a press
 * on an event's card opens the event's picture and text. The press does not follow the section's links
 * there: the preview is for editing. The menu at the top still leads between the pages.
 */
export function PreviewSelectBridge() {
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get("embedded") === "1" && window.parent !== window;

  useEffect(() => {
    if (!embedded) return;
    const style = document.createElement("style");
    style.setAttribute("data-preview-select", "");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const section = target?.closest("[data-cms-preview-target]");
      if (!section) return;
      const blockId = section.getAttribute("data-cms-preview-target");
      if (!blockId) return;
      event.preventDefault();
      event.stopPropagation();
      const gatheringId = target?.closest("[data-gathering-id]")?.getAttribute("data-gathering-id") || undefined;
      postToParent({ type: "preview:select", blockId, ...(gatheringId ? { gatheringId } : {}) }, window.location.origin);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      style.remove();
    };
  }, [embedded]);

  return null;
}
