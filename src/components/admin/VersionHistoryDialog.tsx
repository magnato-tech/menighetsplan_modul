import React, { useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { fetchVersions } from "../../services/contentVersions";
import { formatNorwegianDateTime } from "../../utils/dates";
import { MAX_VERSIONS, type ContentKind, type ContentVersion } from "../../utils/contentVersions";

interface VersionHistoryDialogProps {
  kind: ContentKind;
  targetId: string;
  /** Puts the version into the editor. It is stored only when the editor's Lagre is pressed. */
  onRestore: (version: ContentVersion) => void;
  onClose: () => void;
}

/** «Historikk»: the earlier versions of a page or an article, newest first, each of which can be put back. */
export const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({ kind, targetId, onRestore, onClose }) => {
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchVersions(kind, targetId)
      .then((found) => current && setVersions(found))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [kind, targetId]);

  return (
    <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="version-history-title" className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h3 id="version-history-title" className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--studio-icon)]" />
            <span>Historikk</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk" className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Hver gang {kind === "page" ? "siden" : "artikkelen"} lagres med en endring, tas versjonen før vare på. De {MAX_VERSIONS} siste står her.
          Gjenopprett legger versjonen inn i redigeringen; den lagres først når du trykker Lagre.
        </p>
        <div className="overflow-y-auto space-y-2" data-version-list>
          {failed && <p className="text-xs text-rose-600">Historikken kunne ikke hentes.</p>}
          {!failed && versions === null && <p className="text-xs text-[var(--studio-muted)]">Henter historikken …</p>}
          {versions?.length === 0 && <p className="text-xs text-[var(--studio-muted)]">Ingen tidligere versjoner ennå. De tas vare på fra neste lagring.</p>}
          {versions?.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)]">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--studio-text)]">{formatNorwegianDateTime(version.savedAt)}</div>
                <div className="text-[11px] text-[var(--studio-muted)] truncate">{version.title || "Uten tittel"}</div>
              </div>
              <button
                type="button"
                onClick={() => onRestore(version)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Gjenopprett</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
