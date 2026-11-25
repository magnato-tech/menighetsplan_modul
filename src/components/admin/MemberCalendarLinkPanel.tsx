import React from "react";
import { Copy } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { useTimedMessage } from "../../hooks/useTimedMessage";
import { congregationFeedUrl } from "../../utils/congregationFeed";

/**
 * Kalender for medlemmene, in the admin's Kalender tab: the address of the congregation's public
 * calendar, to copy and place on the website, in the newsletter or in the members' own calendars.
 */
export const MemberCalendarLinkPanel: React.FC = () => {
  const { surfaces } = useCms();
  const [message, showMessage] = useTimedMessage<string>();
  const url = congregationFeedUrl();

  const handleCopy = async () => {
    if (!url) {
      showMessage("Merk adressen og kopier den selv.", 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showMessage("Adressen er kopiert.", 3000);
    } catch {
      showMessage("Merk adressen og kopier den selv.", 3000);
    }
  };

  return (
    <section
      aria-label="Kalender for medlemmene"
      className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] space-y-2"
    >
      <p className="text-sm font-bold text-[var(--studio-text)]">Kalender for medlemmene</p>
      <p className="text-xs text-[var(--studio-muted)]">
        Med denne adressen kan medlemmene få menighetens åpne arrangementer inn i sin egen kalender. Legg den gjerne på
        nettsiden eller i nyhetsbrevet.
        {surfaces.minSide && " Knappene står også under Kalender på Min side."}
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Adressen til kalenderen"
          value={url ?? ""}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] text-xs text-[var(--studio-text)]"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          Kopier
        </button>
      </div>
      {message && <p className="text-xs font-medium text-[var(--studio-text)]">{message}</p>}
    </section>
  );
};
