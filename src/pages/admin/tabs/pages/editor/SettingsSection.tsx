import React from "react";
import { FolderTree } from "lucide-react";
import { CmsPage } from "../../../../../data/cmsData";
import { CmsLinkPicker } from "../../../../../components/admin/CmsLinkPicker";

export interface SettingsSectionProps {
  editingPage: Partial<CmsPage>;
  onUpdate: (updated: Partial<CmsPage>) => void;
  availableParentPages: CmsPage[];
  currentParentId: string | null | undefined;
  handleParentChange: (val: string) => void;
  currentOrder: number;
  handleOrderChange: (num: number) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  editingPage,
  onUpdate,
  availableParentPages,
  currentParentId,
  handleParentChange,
  currentOrder,
  handleOrderChange,
}) => {
  return (
    <div data-page-section="settings" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tittel */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Sidetittel (Vises i meny og header)</label>
          <input
            type="text"
            required
            value={editingPage.title || ""}
            onChange={(e) => onUpdate({ ...editingPage, title: e.target.value })}
            placeholder="f.eks. Om oss, Barn & Unge, Kontakt"
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* URL Slug */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Adresse (f.eks. om-oss)</label>
          <input
            type="text"
            value={editingPage.slug || ""}
            onChange={(e) => onUpdate({ ...editingPage, slug: e.target.value })}
            placeholder="om-oss (eller genereres automatisk fra tittel)"
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs font-mono focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Ekstern eller overstyrt intern lenke */}
      <div className="space-y-1 bg-[var(--studio-row)] p-3 rounded-xl border border-[var(--studio-border)]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">
            Overstyr lenkeadresse (valgfritt)
          </label>
          <span className="text-[10px] text-[var(--studio-muted)]">
            Peker menyvalget til en innebygd side som /hva-skjer, /fellesskap eller /taler, eller til en full nettadresse
          </span>
        </div>
        <CmsLinkPicker
          value={editingPage.linkUrl || ""}
          onChange={(linkUrl) => onUpdate({ ...editingPage, linkUrl })}
          currentPageId={editingPage.id}
          allowEmpty
          emptyLabel="Bruk sidens vanlige adresse"
        />
      </div>

      {/* Hovedmeny-hierarki og Rekkefølge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--studio-row)] p-4 rounded-xl border border-[var(--studio-border)]">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
            <span>Hovedfane / Forelder</span>
          </label>
          <select
            value={currentParentId || ""}
            onChange={(e) => handleParentChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Ingen (Dette er en topp-nivå hovedfane)</option>
            {availableParentPages.map((parent) => (
              <option key={parent.id} value={parent.id}>
                📁 Underfane under: {parent.title} (/{parent.slug})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[var(--studio-muted)]">
            Velg hvilken hovedside denne siden hører under for å bygge nedtrekksmeny.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
            <span>Rekkefølge i meny</span>
          </label>
          <input
            type="number"
            min="1"
            value={currentOrder}
            onChange={(e) => handleOrderChange(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <p className="text-[11px] text-[var(--studio-muted)]">
            Lavere tall vises først i toppmenyen eller underfanelisten.
          </p>
        </div>
      </div>

    </div>
  );
};
