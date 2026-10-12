import React, { useEffect } from "react";
import { CmsMediaPicker } from "../admin/CmsMediaPicker";
import type { GatheringFormValues } from "../../utils/gatheringForm";

interface GatheringWebsiteFieldsProps {
  values: GatheringFormValues;
  onChange: (changes: Partial<GatheringFormValues>) => void;
  /** Called once, when the fields have been fetched and stand in the form. */
  onReady?: () => void;
}

const field = "w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "block text-xs font-bold text-slate-700 mb-1";

/**
 * How the event is presented on the website: picture, lead, longer text and a link. The part of
 * the event's form that is fetched first when it is opened, since it brings the media library.
 */
const GatheringWebsiteFields: React.FC<GatheringWebsiteFieldsProps> = ({ values, onChange, onReady }) => {
  // Nothing is given back to React: what onReady answers (a browser may answer a scroll with a promise) is not a clean-up
  useEffect(() => {
    onReady?.();
  }, []);

  return (
  <div className="space-y-4">
    {/* The picture chooser is drawn for the dark admin, and gets a dark ground here too */}
    <div className="rounded-xl bg-slate-900 p-4">
      <CmsMediaPicker
        label="Bilde"
        value={values.imageUrl}
        onChange={(url) => onChange({ imageUrl: url })}
        helpText="Liggende bilde, gjerne 16:9. Vises på kortet på forsiden."
        altValue={values.imageAlt}
        onAltChange={(alt) => onChange({ imageAlt: alt })}
      />
    </div>

    <div>
      <label htmlFor="gathering-summary" className={label}>
        Ingress
      </label>
      <textarea
        id="gathering-summary"
        rows={2}
        value={values.summary}
        onChange={(e) => onChange({ summary: e.target.value })}
        placeholder="En setning eller to om arrangementet. Vises på kortet på forsiden."
        className={field}
      />
    </div>

    <div>
      <label htmlFor="gathering-content" className={label}>
        Tekst
      </label>
      <textarea
        id="gathering-content"
        rows={7}
        value={values.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Alt den som vil komme, trenger å vite."
        className={`${field} leading-relaxed`}
      />
      <p className="text-[11px] text-slate-500 mt-1">Skrives som teksten på en side: tom linje mellom avsnitt, ## foran en overskrift og - foran et punkt.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label htmlFor="gathering-link" className={label}>
          Lenke (valgfritt)
        </label>
        <input
          id="gathering-link"
          type="text"
          inputMode="url"
          value={values.linkUrl}
          onChange={(e) => onChange({ linkUrl: e.target.value })}
          placeholder="https://… for eksempel til påmelding"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="gathering-link-label" className={label}>
          Tekst på knappen
        </label>
        <input
          id="gathering-link-label"
          type="text"
          value={values.linkLabel}
          onChange={(e) => onChange({ linkLabel: e.target.value })}
          placeholder="f.eks. Meld deg på"
          className={field}
        />
      </div>
    </div>
  </div>
  );
};

export default GatheringWebsiteFields;
