import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Type } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { pageUrl } from "../../utils/menu";
import { fitsRichText, richDocOf, textOfRichDoc, type RichNode, type RichTextMode } from "../../utils/richText";

export interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** "full" in a text block (headings and lists too); "inline" where the website reads only fet, kursiv and lenker. */
  mode: RichTextMode;
  /** Shown while the text is plain text, and as the field's name for screen readers. */
  label: string;
  /** Height of the field in lines of text, as a textarea's rows. */
  rows?: number;
  className?: string;
}

// A link in a text is followed on the website as it stands: a page's address or a full web address
const LINK_ALLOWED = /^(https?:\/\/|\/|mailto:|tel:)/i;

// «/» first on an empty line opens a short list of what the line can be, as in Notion and Ghost
type Chain = ReturnType<Editor["chain"]>;
const SLASH_CHOICES: { label: string; run: (chain: Chain) => Chain }[] = [
  { label: "Overskrift", run: (chain) => chain.setHeading({ level: 2 }) },
  { label: "Underoverskrift", run: (chain) => chain.setHeading({ level: 3 }) },
  { label: "Punktliste", run: (chain) => chain.toggleBulletList() },
  { label: "Nummerert liste", run: (chain) => chain.toggleOrderedList() },
  { label: "Vanlig tekst", run: (chain) => chain.setParagraph() },
];

/** Whether the line the cursor is on holds nothing but «/», in a plain paragraph. */
const onSlashLine = (editor: Editor): boolean => {
  const { $from } = editor.state.selection;
  return $from.parent.type.name === "paragraph" && $from.parent.textContent === "/";
};

const toolbarButton = (active: boolean) =>
  `p-1.5 rounded-md cursor-pointer transition-colors ${
    active ? "bg-indigo-600 text-white" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
  }`;

/**
 * The text of a block, shown formatted with buttons over it (backlog 5). What is stored is the same text
 * with signs as before, so the website, older pages and the history read it as they always have. A text
 * with signs the field has no button for is shown as plain text, so nothing in it is lost.
 */
export default function RichTextField({ value, onChange, mode, label, rows = 4, className = "" }: RichTextFieldProps) {
  const fits = fitsRichText(value, mode);
  const [plain, setPlain] = useState(!fits);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkHint, setLinkHint] = useState("");
  // The text this field last handed on, so a change from outside (another block, Gjenopprett) is told from its own
  const emitted = useRef(value);
  // The editor keeps the handler it was made with, so it calls the newest one through here
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // The «/» list: null when closed, else the choice that is marked
  const [slash, setSlash] = useState<number | null>(null);
  const slashRef = useRef<number | null>(null);
  slashRef.current = slash;
  const chooseRef = useRef<(index: number) => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        hardBreak: false,
        heading: mode === "full" ? { levels: [1, 2, 3] } : false,
        bulletList: mode === "full" ? {} : false,
        orderedList: mode === "full" ? {} : false,
        listItem: mode === "full" ? {} : false,
        listKeymap: mode === "full" ? {} : false,
        link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: (url) => LINK_ALLOWED.test(url) },
      }),
    ],
    content: fits ? (richDocOf(value, mode) as never) : undefined,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: "outline-hidden",
      },
      handleKeyDown: (_view, event) => {
        const marked = slashRef.current;
        if (marked === null) return false;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setSlash((marked + step + SLASH_CHOICES.length) % SLASH_CHOICES.length);
          return true;
        }
        if (event.key === "Enter") {
          chooseRef.current(marked);
          return true;
        }
        if (event.key === "Escape") {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const text = textOfRichDoc(current.getJSON() as RichNode, mode);
      emitted.current = text;
      onChangeRef.current(text);
      if (mode === "full") setSlash(onSlashLine(current) ? 0 : null);
    },
    onSelectionUpdate: ({ editor: current }) => {
      if (!onSlashLine(current)) setSlash(null);
    },
  });

  chooseRef.current = (index: number) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    SLASH_CHOICES[index].run(editor.chain().focus().deleteRange({ from: $from.start(), to: $from.end() })).run();
    setSlash(null);
  };

  // A text put in from outside: shown anew, formatted when it fits, else as plain text
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const nowFits = fitsRichText(value, mode);
    if (nowFits && editor) editor.commands.setContent(richDocOf(value, mode) as never, { emitUpdate: false });
    if (!nowFits) setPlain(true);
  }, [value, editor, mode]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }: { editor: Editor | null }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      h2: current?.isActive("heading", { level: 2 }) ?? false,
      h3: current?.isActive("heading", { level: 3 }) ?? false,
      bullet: current?.isActive("bulletList") ?? false,
      ordered: current?.isActive("orderedList") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });

  const showFormatted = () => {
    if (!fitsRichText(value, mode) || !editor) return;
    emitted.current = value;
    editor.commands.setContent(richDocOf(value, mode) as never, { emitUpdate: false });
    setPlain(false);
  };

  const openLink = () => {
    if (!editor) return;
    const href = (editor.getAttributes("link").href as string | undefined) ?? "";
    if (!href && editor.state.selection.empty) {
      setLinkHint("Merk ordene som skal bli en lenke, og trykk Lenke.");
      setLinkOpen(true);
      return;
    }
    setLinkHint("");
    setLinkDraft(href);
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!editor) return;
    const href = linkDraft.trim();
    if (!LINK_ALLOWED.test(href)) {
      setLinkHint("Adressen må begynne med https://, eller med / for en side på nettsiden.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  };
  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const fieldClass = `w-full px-3 py-2 rounded-lg bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus-within:border-indigo-500 ${className}`;

  if (plain) {
    return (
      <div className="space-y-1">
        <textarea rows={rows} aria-label={label} className={`${fieldClass} focus:outline-hidden`} value={value} onChange={(e) => onChange(e.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-[var(--studio-muted)]">
            {fitsRichText(value, mode)
              ? "Vist som tekst med tegn."
              : "Teksten har tegn som feltet ikke har knapper for, så den vises som tekst. Ingenting blir borte."}
          </p>
          {fitsRichText(value, mode) && (
            <button type="button" onClick={showFormatted} className="shrink-0 text-[10px] font-semibold text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] cursor-pointer">
              Vis formatert
            </button>
          )}
        </div>
      </div>
    );
  }

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (editor) command(editor.chain().focus()).run();
  };

  return (
    <div className="space-y-1" data-rich-text-field={mode}>
      <div className={`${fieldClass} p-0`}>
        <div role="toolbar" aria-label="Formatering" className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-[var(--studio-border)]">
          {mode === "full" && (
            <>
              <button type="button" title="Overskrift" aria-label="Overskrift" aria-pressed={active?.h2} className={toolbarButton(!!active?.h2)} onClick={() => run((c) => c.toggleHeading({ level: 2 }))}>
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" title="Underoverskrift" aria-label="Underoverskrift" aria-pressed={active?.h3} className={toolbarButton(!!active?.h3)} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}>
                <Heading3 className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 mx-1 bg-[var(--studio-border)]" aria-hidden="true" />
            </>
          )}
          <button type="button" title="Fet" aria-label="Fet" aria-pressed={active?.bold} className={toolbarButton(!!active?.bold)} onClick={() => run((c) => c.unsetItalic().toggleBold())}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Kursiv" aria-label="Kursiv" aria-pressed={active?.italic} className={toolbarButton(!!active?.italic)} onClick={() => run((c) => c.unsetBold().toggleItalic())}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          {mode === "full" && (
            <>
              <span className="w-px h-4 mx-1 bg-[var(--studio-border)]" aria-hidden="true" />
              <button type="button" title="Punktliste" aria-label="Punktliste" aria-pressed={active?.bullet} className={toolbarButton(!!active?.bullet)} onClick={() => run((c) => c.toggleBulletList())}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" title="Nummerert liste" aria-label="Nummerert liste" aria-pressed={active?.ordered} className={toolbarButton(!!active?.ordered)} onClick={() => run((c) => c.toggleOrderedList())}>
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <span className="w-px h-4 mx-1 bg-[var(--studio-border)]" aria-hidden="true" />
          <button type="button" title="Lenke" aria-label="Lenke" aria-pressed={active?.link} className={toolbarButton(!!active?.link)} onClick={openLink}>
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Vis som tekst med tegn"
            onClick={() => setPlain(true)}
            className="ml-auto px-1.5 py-1 rounded-md text-[10px] font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer flex items-center gap-1"
          >
            <Type className="w-3 h-3" />
            <span>Vis som tekst</span>
          </button>
        </div>
        {linkOpen && <LinkRow draft={linkDraft} hint={linkHint} onDraft={setLinkDraft} onApply={applyLink} onRemove={active?.link ? removeLink : undefined} onClose={() => setLinkOpen(false)} />}
        {slash !== null && (
          <div role="listbox" aria-label="Gjør linjen til" className="mx-2 mt-1 mb-2 p-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-lg max-w-[14rem]" data-slash-menu>
            {SLASH_CHOICES.map((choice, index) => (
              <button
                key={choice.label}
                type="button"
                role="option"
                aria-selected={index === slash}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseRef.current(index)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs cursor-pointer ${index === slash ? "bg-indigo-600 text-white" : "text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"}`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        <EditorContent
          editor={editor}
          style={{ minHeight: `${rows * 1.5 + 1}em` }}
          className="px-3 py-2 cursor-text [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-hidden [&_p]:my-0.5 [&_h1]:text-base [&_h1]:font-black [&_h1]:mt-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-[var(--studio-accent-text)] [&_code]:font-mono [&_code]:px-1 [&_code]:rounded [&_code]:bg-[var(--studio-hover)]"
          onClick={() => editor?.commands.focus()}
        />
      </div>
    </div>
  );
}

/** The row under the buttons where a link's address is written, or a page on the website is chosen. */
function LinkRow({
  draft,
  hint,
  onDraft,
  onApply,
  onRemove,
  onClose,
}: {
  draft: string;
  hint: string;
  onDraft: (value: string) => void;
  onApply: () => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const { pages } = useCms();
  const choosable = pages.filter((page) => page.isPublished !== false && !page.linkUrl);
  const needsSelection = hint.startsWith("Merk");

  return (
    <div className="px-2 py-2 border-b border-[var(--studio-border)] space-y-1.5 bg-[var(--studio-surface)]">
      {!needsSelection && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            autoFocus
            aria-label="Lenkens adresse"
            placeholder="https://… eller /kontakt"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
            className="flex-1 min-w-[10rem] px-2 py-1 rounded-md bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <select
            aria-label="Velg en side på nettsiden"
            value=""
            onChange={(e) => e.target.value && onDraft(e.target.value)}
            className="px-2 py-1 rounded-md bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
          >
            <option value="">Velg en side …</option>
            {choosable.map((page) => (
              <option key={page.id} value={pageUrl(page)}>
                {page.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={onApply} className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
            Bruk
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="px-2.5 py-1 rounded-md text-rose-600 hover:bg-[var(--studio-hover)] text-xs font-semibold cursor-pointer">
              Fjern lenke
            </button>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {hint ? <p className="text-[10px] text-amber-600">{hint}</p> : <span />}
        <button type="button" onClick={onClose} className="text-[10px] font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
          Lukk
        </button>
      </div>
    </div>
  );
}
