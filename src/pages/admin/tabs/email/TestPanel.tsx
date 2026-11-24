import React from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { studioInputFull, studioSecondaryButton } from "../../studioTheme";
import { fieldLabel, resultBox } from "./emailStyles";

interface TestPanelProps {
  /** The address the test goes to. Prefilled with the administrator's own. */
  address: string;
  onAddress: (address: string) => void;
  /** Whether this test is being sent. */
  testing: boolean;
  /** Whether the test cannot be sent now: in the demo, or while something else is being sent. */
  disabled: boolean;
  result: { good: boolean; text: string } | null;
  onSend: () => void;
  /** Said above the field, about what the test is. */
  note: string;
}

/** «Send prøve»: a small panel that sends a test to one address. The test is not put in the log. */
export const TestPanel: React.FC<TestPanelProps> = ({ address, onAddress, testing, disabled, result, onSend, note }) => (
  <section aria-label="Send prøve" className="p-4 rounded-xl border border-[var(--studio-border)] space-y-3">
    <p className="text-[11px] text-[var(--studio-muted)]">{note}</p>
    <div>
      <label htmlFor="email-test-address" className={fieldLabel}>
        Send prøve til
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input id="email-test-address" type="email" value={address} onChange={(event) => onAddress(event.target.value)} placeholder="din@adresse.no" className={`${studioInputFull} sm:max-w-sm`} />
        <button type="button" onClick={onSend} disabled={disabled} className={`${studioSecondaryButton} flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50`}>
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>{testing ? "Sender prøven …" : "Send"}</span>
        </button>
      </div>
    </div>
    {result && (
      <p role={result.good ? "status" : "alert"} className={resultBox(result.good)}>
        {result.good ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />}
        <span>{result.text}</span>
      </p>
    )}
  </section>
);
