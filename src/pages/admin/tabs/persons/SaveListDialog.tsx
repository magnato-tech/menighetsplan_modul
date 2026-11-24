import React, { useState } from "react";
import { listNameError, type EmailList, type EmailListKind } from "../../../../utils/emailLists";
import { studioCardPadded, studioInputFull, studioOverlay, studioPrimaryButton, studioSecondaryButton } from "../../studioTheme";

interface SaveListDialogProps {
  /** How many persons the list would have today. */
  count: number;
  /** Said under the count: what the filter asks for. Empty when nothing is asked for. */
  filterText: string;
  /** Whether a filter can be kept: not while the search field has text, which is not kept. */
  canFilter: boolean;
  /** The lists already saved, for the names that are taken. */
  lists: EmailList[];
  saving: boolean;
  onSave: (name: string, kind: EmailListKind) => void;
  onClose: () => void;
}

/** «Lagre som liste»: names the list and chooses whether it follows the filter or keeps the persons as they are now. */
export const SaveListDialog: React.FC<SaveListDialogProps> = ({ count, filterText, canFilter, lists, saving, onSave, onClose }) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EmailListKind>(canFilter ? "filter" : "fixed");
  // Whether the save has been tried: an empty or taken name is said then, and not before
  const [tried, setTried] = useState(false);
  const error = tried ? listNameError(name, lists) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (listNameError(name, lists)) return;
    onSave(name.trim(), canFilter ? kind : "fixed");
  };

  return (
    <div className={`${studioOverlay} flex items-center justify-center p-4`} onClick={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-list-heading"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className={`${studioCardPadded} w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl`}
      >
        <div>
          <h3 id="save-list-heading" className="text-sm font-bold text-[var(--studio-text)]">
            Lagre som liste
          </h3>
          <p className="text-xs text-[var(--studio-muted)] mt-1">
            {count} {count === 1 ? "person" : "personer"}
            {filterText ? `: ${filterText}` : ""}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="input-list-name" className="block text-[11px] font-bold text-[var(--studio-muted)]">
            Navn på listen
          </label>
          <input id="input-list-name" type="text" required autoFocus value={name} onChange={(event) => setName(event.target.value)} className={studioInputFull} />
          {error && (
            <p role="alert" className="text-xs font-bold text-red-400">
              {error}
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-bold text-[var(--studio-muted)] mb-1">Hvordan listen holder seg oppdatert</legend>
          {canFilter && (
            <label className="flex items-start gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
              <input id="list-kind-filter" type="radio" name="list-kind" value="filter" checked={kind === "filter"} onChange={() => setKind("filter")} className="mt-0.5" />
              <span>
                <span className="font-bold block">Oppdateres av seg selv (anbefalt)</span>
                <span className="text-[11px] text-[var(--studio-muted)]">Listen husker filteret. Nye som passer, kommer med automatisk.</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
            <input id="list-kind-fixed" type="radio" name="list-kind" value="fixed" checked={kind === "fixed" || !canFilter} onChange={() => setKind("fixed")} className="mt-0.5" />
            <span>
              <span className="font-bold block">Fast utvalg</span>
              <span className="text-[11px] text-[var(--studio-muted)]">Listen husker personene slik de er nå.</span>
            </span>
          </label>
          {!canFilter && <p className="text-[11px] text-[var(--studio-muted)]">Et søk lagres ikke, så listen blir et fast utvalg av personene som vises nå.</p>}
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--studio-border)]">
          <button type="button" onClick={onClose} disabled={saving} className={studioSecondaryButton}>
            Avbryt
          </button>
          <button type="submit" disabled={saving} className={`${studioPrimaryButton} px-4 py-2 text-xs disabled:opacity-50`}>
            {saving ? "Lagrer …" : "Lagre liste"}
          </button>
        </div>
      </form>
    </div>
  );
};
