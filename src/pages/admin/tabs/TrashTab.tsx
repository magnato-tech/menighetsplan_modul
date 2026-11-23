import React, { useEffect, useState } from "react";
import { useCms } from "../../../context/CmsContext";
import { editedWhen } from "../../../utils/lastEdited";
import { TRASH_KIND_NAMES, removedForGoodAt, trashLabel, type TrashItem } from "../../../utils/trash";
import type { ShowFeedback, StudioData } from "../studio";
import { studioPrimaryButton } from "../studioTheme";

interface TrashTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

/** «Papirkurv»: what was deleted from the website in the last 30 days, and can be put back. */
export const TrashTab: React.FC<TrashTabProps> = ({ studio, showFeedback }) => {
  const { fetchTrash, restoreFromTrash } = useCms();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Opened once: the list is read again only when the tab is opened again
  useEffect(() => {
    let active = true;
    fetchTrash()
      .then((list) => {
        if (active) setItems(list);
      })
      .catch((error) => {
        console.error("Kunne ikke hente papirkurven:", error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const restore = async (item: TrashItem) => {
    setRestoring(item.deletionGroup);
    const ok = await restoreFromTrash(item);
    setRestoring(null);
    if (!ok) return;
    showFeedback(`«${item.title}» er hentet tilbake`);
    setItems((list) => list?.filter((other) => other.deletionGroup !== item.deletionGroup) ?? null);
  };

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--studio-text)]">Papirkurv</h2>
        <p className="text-sm text-[var(--studio-muted)] mt-1">
          Det som er slettet fra nettsiden de siste 30 dagene. Hent det tilbake, så står det der det sto. Etter 30 dager slettes det for godt.
        </p>
      </div>

      {failed && <p className="text-sm text-red-400">Papirkurven kunne ikke hentes. Prøv igjen senere.</p>}
      {!failed && items === null && <p className="text-sm text-[var(--studio-muted)]">Henter papirkurven …</p>}
      {items?.length === 0 && <p className="text-sm text-[var(--studio-muted)]">Papirkurven er tom.</p>}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--studio-border)]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--studio-surface)] text-[var(--studio-muted)] text-xs">
              <tr>
                <th className="px-3 py-2 font-semibold">Slettet</th>
                <th className="px-3 py-2 font-semibold">Hva</th>
                <th className="px-3 py-2 font-semibold">Når og av hvem</th>
                <th className="px-3 py-2 font-semibold">Går for godt</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const name = item.deletedBy ? studio.adminPersons.find((p) => p.person.id === item.deletedBy)?.person.name : undefined;
                return (
                  <tr key={item.deletionGroup} className="border-t border-[var(--studio-border)] text-[var(--studio-text)]">
                    <td className="px-3 py-2 font-semibold">{trashLabel(item)}</td>
                    <td className="px-3 py-2">{TRASH_KIND_NAMES[item.kind]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {editedWhen(item.deletedAt, now, true)}
                      {name ? ` · ${name}` : ""}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{editedWhen(removedForGoodAt(item.deletedAt), now, false)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void restore(item)}
                        disabled={restoring === item.deletionGroup}
                        className={`${studioPrimaryButton} px-3 py-1.5 text-xs disabled:opacity-50`}
                      >
                        Hent tilbake
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
