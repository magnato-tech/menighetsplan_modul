import React from "react";
import { DynamicModuleType } from "../../utils/cmsBlocks";
import {
  MODULE_PRESENTATION_FIELDS,
  ModulePresentationConfig,
} from "../../utils/modulePresentation";
import { CmsMediaPicker } from "./CmsMediaPicker";
import { CmsLinkPicker } from "./CmsLinkPicker";
import { WhatsOnEventsEditor } from "./WhatsOnEventsEditor";
import { useFirebase } from "../../context/FirebaseDataContext";
import { whatsOnGroupIds } from "../../utils/whatsOn";

const fieldClass =
  "w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-indigo-500";

interface ModulePresentationEditorProps {
  moduleType: DynamicModuleType;
  config: ModulePresentationConfig;
  onChange: (config: ModulePresentationConfig) => void;
  onSave: () => void;
  dataSourceNote?: string;
  currentPageId?: string;
  /** In «Hva skjer»: an event whose picture and text are opened at once (its card was pressed in the preview). */
  openEvent?: { id: string; nonce: number } | null;
}

/** The groups with coming public events, to pick the one whose events «Hva skjer» shows. */
const GroupSelect: React.FC<{ value: string; onChange: (groupId: string) => void }> = ({ value, onChange }) => {
  const { gatherings, groups } = useFirebase();
  const ids = whatsOnGroupIds(gatherings, Date.now());
  const options = groups.filter((group) => ids.includes(group.id) || group.id === value);
  return (
    <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Velg gruppe</option>
      {options.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );
};

export const ModulePresentationEditor: React.FC<ModulePresentationEditorProps> = ({
  moduleType,
  config,
  onChange,
  onSave,
  dataSourceNote,
  currentPageId,
  openEvent,
}) => {
  const fields = MODULE_PRESENTATION_FIELDS[moduleType];
  const set = (key: string, value: string) => onChange({ ...config, [key]: value });

  return (
    <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300">Rediger presentasjon</span>
        <button
          type="button"
          onClick={onSave}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
        >
          Bruk endringer
        </button>
      </div>
      {dataSourceNote && (
        <p className="text-[10px] text-slate-500">{dataSourceNote}</p>
      )}

      {fields.map((field) => {
        if (field.showWhen && (config[field.showWhen.key] || "") !== field.showWhen.value) return null;

        if (field.type === "toggle") {
          return (
            <label key={field.key} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={config[field.key] !== "off"}
                onChange={(e) => set(field.key, e.target.checked ? "on" : "off")}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <span>{field.label}</span>
            </label>
          );
        }

        if (field.type === "group") {
          return (
            <label key={field.key} className="space-y-1 block">
              <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
              <GroupSelect value={config[field.key] || ""} onChange={(groupId) => set(field.key, groupId)} />
              {field.help && <p className="text-[10px] text-slate-500">{field.help}</p>}
            </label>
          );
        }

        if (field.type === "image") {
          const altKey = `${field.key}Alt`;
          return (
            <div key={field.key} className="space-y-2">
              <CmsMediaPicker
                label={field.label}
                value={config[field.key] || ""}
                onChange={(url) => set(field.key, url)}
                helpText={field.help}
                decorative
                altValue={config[altKey] || ""}
                onAltChange={(alt) => set(altKey, alt)}
              />
            </div>
          );
        }

        if (field.type === "color") {
          return (
            <label key={field.key} className="space-y-1 block">
              <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config[field.key] || "#1e3a5f"}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="w-10 h-9 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                />
                <input
                  className={fieldClass}
                  value={config[field.key] || ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder || "Tom for standard"}
                />
              </div>
            </label>
          );
        }

        if (field.type === "textarea") {
          return (
            <label key={field.key} className="space-y-1 block">
              <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
              <textarea
                rows={3}
                className={fieldClass}
                value={config[field.key] || ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          );
        }

        if (field.type === "select" && field.options) {
          return (
            <label key={field.key} className="space-y-1 block">
              <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
              <select
                className={fieldClass}
                value={config[field.key] || field.options[0]?.value || ""}
                onChange={(e) => set(field.key, e.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {field.help && <p className="text-[10px] text-slate-500">{field.help}</p>}
            </label>
          );
        }

        if (field.type === "link") {
          return (
            <div key={field.key} className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 block">{field.label}</span>
              <CmsLinkPicker
                value={config[field.key] || ""}
                onChange={(next) => set(field.key, next)}
                currentPageId={currentPageId}
                allowEmpty
                emptyLabel="Ingen lenke"
              />
            </div>
          );
        }

        return (
          <label key={field.key} className="space-y-1 block">
            <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
            <input
              className={fieldClass}
              value={config[field.key] || ""}
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </label>
        );
      })}

      {moduleType === "module-calendar" && <WhatsOnEventsEditor config={config} openEvent={openEvent} />}
    </div>
  );
};
