import React, { useState, useEffect } from "react";
import {
  X,
  LayoutGrid,
  Image,
  Quote,
  Info,
  MousePointerClick,
  Sparkles,
  Plus,
  Users,
  Briefcase,
  Calendar,
  FileText,
  Headphones,
  Heart,
} from "lucide-react";

export interface ContentBlockDefinition {
  id: string;
  title: string;
  category: "Dynamisk" | "Struktur" | "Media & Tekst" | "Typografi" | "Varsler" | "Interaksjon" | "Personer & Roller";
  isDynamic: boolean;
  description: string;
  dataSource?: string;
  icon: React.ReactNode;
  template: string;
  previewNode: React.ReactNode;
}

interface ContentBlockPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertBlock: (snippet: string) => void;
}

export const CONTENT_BLOCKS: ContentBlockDefinition[] = [
  // ⚡ DYNAMISKE MODULER
  {
    id: "module-worship",
    title: "Neste gudstjeneste",
    category: "Dynamisk",
    isDynamic: true,
    description: "Henter automatisk neste fremhevede gudstjeneste fra planleggeren med dato, tid, sted og barnekirke/kirkekaffe.",
    dataSource: "Gudstjenesteplanleggeren (Firebase)",
    icon: <Calendar className="w-5 h-5 text-amber-400" />,
    template: `:::module-worship[highlight]\n:::`,
    previewNode: (
      <div className="w-full p-2.5 rounded-lg bg-white border border-stone-200 text-stone-800 space-y-1">
        <span className="text-[9px] font-bold uppercase text-primary-700">⚡ Neste Gudstjeneste</span>
        <div className="font-bold text-stone-900 text-xs">Høsttakkefest & fellesskapsmåltid</div>
        <div className="text-[9px] text-stone-500">Søndag 11. Oktober · Kl. 11:00 · Hovedsalen</div>
      </div>
    ),
  },
  {
    id: "module-calendar",
    title: "Hva skjer",
    category: "Dynamisk",
    isDynamic: true,
    description: "De fire neste offentlige arrangementene – uten kalender-merkelapp eller lenke.",
    dataSource: "Møtekalender (Firebase)",
    icon: <Calendar className="w-5 h-5 text-sky-400" />,
    template: `:::module-calendar[grid]\n:::`,
    previewNode: (
      <div className="grid grid-cols-2 gap-1.5 text-[9px] w-full">
        <div className="p-1.5 rounded bg-white border border-stone-200 font-medium">Søndag 11. Okt · Gudstjeneste</div>
        <div className="p-1.5 rounded bg-white border border-stone-200 font-medium">Onsdag 14. Okt · Bønnemøte</div>
      </div>
    ),
  },
  {
    id: "module-kalender",
    title: "Kalender",
    category: "Dynamisk",
    isDynamic: true,
    description: "Full kalender med liste, månedsvisning og abonnement på iCal-feed.",
    dataSource: "Møtekalender (Firebase)",
    icon: <Calendar className="w-5 h-5 text-primary-400" />,
    template: `:::module-kalender[month]\n:::`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-white border border-stone-200 text-[9px] space-y-1">
        <div className="font-bold text-stone-900">Månedsrutenett med arrangementer</div>
        <div className="text-stone-500">Bytt til liste eller abonner på kalenderen</div>
      </div>
    ),
  },
  {
    id: "module-news",
    title: "Nyheter og artikler",
    category: "Dynamisk",
    isDynamic: true,
    description: "Lister automatisk de 3 nyeste publiserte artiklene fra menighetsarbeidet.",
    dataSource: "CMS Nyhetsarkiv",
    icon: <FileText className="w-5 h-5 text-emerald-400" />,
    template: `:::module-news[grid]\n:::`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-white border border-stone-200 text-[10px] space-y-1">
        <div className="font-bold text-stone-900">Velkommen til høstens gudstjenester</div>
        <div className="text-[9px] text-stone-500">3 artikler vises i responsivt rutenett</div>
      </div>
    ),
  },
  {
    id: "module-sermon",
    title: "Siste tale fra søndagen",
    category: "Dynamisk",
    isDynamic: true,
    description: "Innebygd taleavspiller for siste preken med Spotify-avspilling og arkivlenke.",
    dataSource: "CMS Prekenarkiv",
    icon: <Headphones className="w-5 h-5 text-pink-400" />,
    template: `:::module-sermon[player]\n:::`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-accent-50 border border-accent-200 text-stone-900 space-y-1 text-[10px]">
        <div className="font-bold">Guds rike er nær (Pastor Karl Nordmann)</div>
        <div className="text-[9px] text-stone-500">▶ Spill av direkte eller i Spotify</div>
      </div>
    ),
  },
  {
    id: "module-groups",
    title: "Husfellesskap & Grupper",
    category: "Dynamisk",
    isDynamic: true,
    description: "Fremhevet invitasjonsbanner til å finne et lokalt husfellesskap og nære relasjoner.",
    dataSource: "Fellesskapsregisteret",
    icon: <Users className="w-5 h-5 text-[var(--studio-icon)]" />,
    template: `:::module-groups[banner]\n:::`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-primary-900 text-white space-y-1 text-[10px]">
        <div className="font-bold">Bli med i et husfellesskap</div>
        <div className="text-[8px] text-stone-300">Grupper for alle aldre · Finn din gruppe</div>
      </div>
    ),
  },
  {
    id: "module-giving",
    title: "Givertjeneste & Vipps",
    category: "Dynamisk",
    isDynamic: true,
    description: "Viser menighetens Vipps-nummer og bankkonto for gaver fra innstillingene.",
    dataSource: "Menighetsinnstillinger",
    icon: <Heart className="w-5 h-5 text-rose-400" />,
    template: `:::module-giving[card]\n:::`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-white border border-stone-200 text-stone-900 text-center space-y-0.5 text-[10px]">
        <div className="font-bold">Støtt menighetens arbeid</div>
        <div className="text-[9px] font-mono text-accent-700">Vipps #12345 · Bankkonto</div>
      </div>
    ),
  },

  // 📝 STATISKE BLOKKER
  {
    id: "grid-2",
    title: "To-kolonne innholdsgrid",
    category: "Struktur",
    isDynamic: false,
    description: "To likeverdige kort side ved side med overskrift og ramme. Ideelt for aktiviteter, grupper og tilbud.",
    icon: <LayoutGrid className="w-5 h-5 text-emerald-400" />,
    template: `:::grid\n:::card Fellesskap & Husgrupper\nBli med i et livsnært fellesskap som møtes i hjemmene annenhver uke for samtale, bibel og kaffe.\n:::\n:::card Bønn & Omsorg\nVi ber sammen for hverandre og menigheten. Ta kontakt om du ønsker en samtale eller forbønn.\n:::\n:::`,
    previewNode: (
      <div className="grid grid-cols-2 gap-2 text-[10px] w-full">
        <div className="p-2.5 rounded-lg bg-stone-100 border border-stone-300 text-stone-800 space-y-1">
          <div className="font-bold text-stone-900 truncate">Kort 1: Fellesskap</div>
          <div className="h-1.5 w-4/5 bg-stone-300 rounded" />
        </div>
        <div className="p-2.5 rounded-lg bg-stone-100 border border-stone-300 text-stone-800 space-y-1">
          <div className="font-bold text-stone-900 truncate">Kort 2: Bønn</div>
          <div className="h-1.5 w-4/5 bg-stone-300 rounded" />
        </div>
      </div>
    ),
  },
  {
    id: "media-left",
    title: "Bilde med tekst (Venstre)",
    category: "Media & Tekst",
    isDynamic: false,
    description: "Illustrasjonsbilde på venstre side med tilhørende overskrift og brødtekst til høyre.",
    icon: <Image className="w-5 h-5 text-[var(--studio-icon)]" />,
    template: `:::media-left[https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80]\n### Fellesskap for alle generasjoner\nVi tror på verdien av nære relasjoner der alle blir sett, inkludert og verdsatt. Hos oss er det rom for både store og små spørsmål.\n:::`,
    previewNode: (
      <div className="flex items-center gap-2.5 text-[10px] w-full p-2 rounded-lg bg-stone-100 border border-stone-300">
        <div className="w-12 h-10 rounded bg-indigo-200 border border-indigo-300 shrink-0 flex items-center justify-center text-indigo-700 font-bold text-[9px]">
          Bilde
        </div>
        <div className="flex-1 space-y-1">
          <div className="font-bold text-stone-900 text-[11px] truncate">Tittel overskrift</div>
          <div className="h-1.5 w-full bg-stone-300 rounded" />
        </div>
      </div>
    ),
  },
  {
    id: "media-right",
    title: "Bilde med tekst (Høyre)",
    category: "Media & Tekst",
    isDynamic: false,
    description: "Tekst og overskrift til venstre, bilde til høyre for en variert og dynamisk sidelayout.",
    icon: <Image className="w-5 h-5 text-sky-400" />,
    template: `:::media-right[https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80]\n### Søndagssamlinger og gudstjenester\nHver søndag feirer vi gudstjeneste med sang, forkynnelse og eget opplegg for barna.\n:::`,
    previewNode: (
      <div className="flex items-center gap-2.5 text-[10px] w-full p-2 rounded-lg bg-stone-100 border border-stone-300">
        <div className="flex-1 space-y-1">
          <div className="font-bold text-stone-900 text-[11px] truncate">Tittel overskrift</div>
          <div className="h-1.5 w-full bg-stone-300 rounded" />
        </div>
        <div className="w-12 h-10 rounded bg-sky-200 border border-sky-300 shrink-0 flex items-center justify-center text-sky-700 font-bold text-[9px]">
          Bilde
        </div>
      </div>
    ),
  },
  {
    id: "quote",
    title: "Sitatblokk med kilde",
    category: "Typografi",
    isDynamic: false,
    description: "Fremhevet sitat med vertikal farget designstrek og forfatterangivelse.",
    icon: <Quote className="w-5 h-5 text-amber-400" />,
    template: `:::quote[Kari Nordmann, Hovedpastor]\nVårt ønske er at menigheten skal være et åpent hjem for alle som søker tro, varme og fellesskap.\n:::`,
    previewNode: (
      <div className="w-full p-2.5 border-l-4 border-amber-500 bg-amber-50/70 rounded-r-lg text-amber-950 space-y-1">
        <div className="italic text-[11px] font-serif">«Vårt ønske er at menigheten skal være et åpent hjem...»</div>
        <div className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">— Kari Nordmann, Hovedpastor</div>
      </div>
    ),
  },
  {
    id: "callout-info",
    title: "Fremhevet infoboks",
    category: "Varsler",
    isDynamic: false,
    description: "Blå eller farget informasjonsboks med ikon for praktiske opplysninger eller viktige beskjeder.",
    icon: <Info className="w-5 h-5 text-sky-400" />,
    template: `:::callout[info] Praktisk informasjon\nHusk å ta med egen kopp til kirkekaffen om du har lyst! Det er gratis parkering bak kirken.\n:::`,
    previewNode: (
      <div className="w-full p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-950 flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
        <div className="space-y-0.5">
          <div className="font-bold text-[10px] uppercase text-sky-800">Praktisk informasjon</div>
          <div className="text-[10px] text-sky-900">Fremhevet varselboks med ikon og ren layout.</div>
        </div>
      </div>
    ),
  },
  {
    id: "cta",
    title: "Handlingsknapp",
    category: "Interaksjon",
    isDynamic: false,
    description: "Sentrert eller venstrestilt farget handlingsknapp for påmelding, kontakt eller arrangementer.",
    icon: <MousePointerClick className="w-5 h-5 text-rose-400" />,
    template: `[Knapp: Meld deg på samlingen](/kontakt)`,
    previewNode: (
      <div className="w-full flex items-center justify-center p-2">
        <div className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5">
          <span>Meld deg på samlingen</span>
          <span>→</span>
        </div>
      </div>
    ),
  },
  {
    id: "personer-stab",
    title: "Stab & Ansatte",
    category: "Personer & Roller",
    isDynamic: true,
    description: "Viser alle ansatte i staben med bilde, stillingstittel, bio, telefon og e-post direkte fra registeret.",
    dataSource: "Personregisteret",
    icon: <Briefcase className="w-5 h-5 text-[var(--studio-icon)]" />,
    template: `:::personer[stab]`,
    previewNode: (
      <div className="grid grid-cols-2 gap-2 text-[10px] w-full p-1.5 bg-stone-100 rounded-lg border border-stone-300">
        <div className="p-2 rounded bg-white border border-stone-200 space-y-0.5">
          <div className="font-bold text-stone-900 truncate">Kari Nordmann</div>
          <div className="text-[8px] text-stone-500">Hovedpastor</div>
        </div>
        <div className="p-2 rounded bg-white border border-stone-200 space-y-0.5">
          <div className="font-bold text-stone-900 truncate">Ola Hansen</div>
          <div className="text-[8px] text-stone-500">Daglig leder</div>
        </div>
      </div>
    ),
  },
  {
    id: "personer-lederskap",
    title: "Menighetsråd & Lederskap",
    category: "Personer & Roller",
    isDynamic: true,
    description: "Viser menighetsråd og valgt lederskap fra personregisteret.",
    dataSource: "Personregisteret",
    icon: <Users className="w-5 h-5 text-[var(--studio-icon)]" />,
    template: `:::personer[lederskap]`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-white border border-stone-200 text-[10px]">
        <div className="font-bold text-stone-900">Menighetsråd</div>
        <div className="text-[9px] text-stone-500">Ledere og medlemmer med offentlig profil</div>
      </div>
    ),
  },
  {
    id: "personer-pastor",
    title: "Kun Pastor / Forkynnere",
    category: "Personer & Roller",
    isDynamic: true,
    description: "Viser pastorer og forkynnere fra personregisteret.",
    dataSource: "Personregisteret",
    icon: <Users className="w-5 h-5 text-amber-400" />,
    template: `:::personer[pastor]`,
    previewNode: (
      <div className="w-full p-2 rounded-lg bg-white border border-stone-200 text-[10px]">
        <div className="font-bold text-stone-900">Kari Nordmann</div>
        <div className="text-[9px] text-stone-500">Hovedpastor</div>
      </div>
    ),
  },
];

export const ContentBlockPickerModal: React.FC<ContentBlockPickerModalProps> = ({
  isOpen,
  onClose,
  onInsertBlock,
}) => {
  const [activeTab, setActiveTab] = useState<"alle" | "dynamisk" | "statisk">("alle");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredBlocks = CONTENT_BLOCKS.filter((block) => {
    if (activeTab === "dynamisk") return block.isDynamic;
    if (activeTab === "statisk") return !block.isDynamic;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-overlay)] backdrop-blur-xs p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Felles blokkbibliotek"
    >
      <div className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--studio-border)] bg-[var(--studio-bg)]/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-[var(--studio-icon)]">
              <Sparkles className="w-4 h-4 text-[var(--studio-icon)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--studio-text)]">Felles blokkbibliotek</h3>
              <p className="text-xs text-[var(--studio-muted)]">
                Velg blant statiske innholdsformater eller dynamiske moduler som henter sanntidsdata.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] transition-colors cursor-pointer"
            title="Lukk (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-6 py-2.5 bg-[var(--studio-panel-bg)] border-b border-[var(--studio-border)] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("alle")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "alle"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            Alle blokker ({CONTENT_BLOCKS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dynamisk")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "dynamisk"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-icon)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            <Sparkles className="w-3 h-3 text-[var(--studio-icon)]" />
            <span>⚡ Dynamiske moduler ({CONTENT_BLOCKS.filter((b) => b.isDynamic).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statisk")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "statisk"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
            }`}
          >
            📝 Statisk innhold ({CONTENT_BLOCKS.filter((b) => !b.isDynamic).length})
          </button>
        </div>

        {/* Content list with previews */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBlocks.map((block) => (
              <div
                key={block.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 group ${
                  block.isDynamic
                    ? "bg-[var(--studio-input)] border-indigo-700/60 hover:border-indigo-400"
                    : "bg-slate-850/80 border-[var(--studio-border)] hover:border-slate-500"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)]">
                        {block.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-[var(--studio-text)] text-sm">{block.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {block.isDynamic ? (
                            <span className="text-[10px] font-bold text-[var(--studio-accent-text)] bg-indigo-950 px-2 py-0.5 rounded border border-[var(--studio-accent-border)] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[var(--studio-icon)]" />
                              <span>⚡ Dynamisk modul</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                              📝 Statisk innhold
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--studio-muted)]">{block.category}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
                    {block.description}
                  </p>

                  {block.dataSource && (
                    <div className="text-[11px] text-[var(--studio-accent-text)] bg-[var(--studio-panel-bg)] p-1.5 rounded border border-[var(--studio-border)]">
                      <strong>Datakilde:</strong> {block.dataSource}
                    </div>
                  )}

                  {/* Visual mini-preview */}
                  <div className="p-2.5 rounded-lg bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] pointer-events-none select-none">
                    {block.previewNode}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onInsertBlock(block.template);
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sett inn denne blokken</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
