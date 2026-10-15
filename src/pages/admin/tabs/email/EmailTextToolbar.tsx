import React from "react";
import { Bold, Heading2, Link2, List } from "lucide-react";
import { linkAddressOf, makeBold, makeLink, toggleHeading, toggleList, type TextSelection } from "../../../../utils/emailToolbar";

interface EmailTextToolbarProps {
  /** The text field the buttons work on. */
  field: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (text: string) => void;
  /** Asks for the address of a link. Given in tests. */
  askAddress?: (question: string) => string | null;
}

const button =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--studio-border)] text-[11px] font-bold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer";

/** The buttons over the text: heading, bold, link and list, written as marks in the text (see utils/emailToolbar.ts). */
export const EmailTextToolbar: React.FC<EmailTextToolbarProps> = ({ field, onChange, askAddress = (question) => window.prompt(question) }) => {
  const apply = (change: (selection: TextSelection) => TextSelection | null) => {
    const element = field.current;
    if (!element) return;
    const next = change({ text: element.value, start: element.selectionStart, end: element.selectionEnd });
    if (!next) return;
    onChange(next.text);
    // After React has put the new text in the field
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.start, next.end);
    });
  };

  const link = () =>
    apply((selection) => {
      const typed = askAddress("Hvilken adresse skal lenken gå til? For eksempel www.menigheten.no eller post@menigheten.no");
      if (typed === null) return null;
      const address = linkAddressOf(typed);
      if (!address) {
        window.alert("Det ser ikke ut som en nettadresse eller en e-postadresse.");
        return null;
      }
      return makeLink(selection, address);
    });

  return (
    <div role="toolbar" aria-label="Formatering" className="flex flex-wrap gap-1.5 mb-1.5">
      <button type="button" className={button} onClick={() => apply(toggleHeading)}>
        <Heading2 className="w-3.5 h-3.5" aria-hidden="true" />
        Overskrift
      </button>
      <button type="button" className={button} onClick={() => apply(makeBold)}>
        <Bold className="w-3.5 h-3.5" aria-hidden="true" />
        Fet
      </button>
      <button type="button" className={button} onClick={link}>
        <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
        Lenke
      </button>
      <button type="button" className={button} onClick={() => apply(toggleList)}>
        <List className="w-3.5 h-3.5" aria-hidden="true" />
        Punktliste
      </button>
    </div>
  );
};
