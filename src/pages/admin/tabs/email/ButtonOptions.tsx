import React from "react";
import { EMAIL_LINKS, type EmailLink } from "../../../../utils/emailMessage";
import { LOGIN_LINK_MAX_DAYS, daysAfter, formatLoginLinkUntil } from "../../../../utils/loginLink";
import { studioInputFull } from "../../studioTheme";
import { fieldLabel } from "./emailStyles";

export type LinkSpan = "14" | "30" | "dato";

export interface ButtonOptionsProps {
  link: EmailLink;
  onLink: (link: EmailLink) => void;
  /** Whether the semester module is on, so its button can be chosen. */
  semesterOn: boolean;
  /** The semester plans the button may open, already in the order they come. */
  plans: { id: string; text: string }[];
  plansReady: boolean;
  /** The plan the button opens, when it is a semester button. */
  plan: string | undefined;
  onPlan: (id: string) => void;
  loginLinks: boolean;
  onLoginLinks: (on: boolean) => void;
  span: LinkSpan;
  onSpan: (span: LinkSpan) => void;
  date: string;
  onDate: (date: string) => void;
  today: string;
  /** The day the login links work through, and what is wrong with it, or null. */
  until: string;
  problem: string | null;
}

/** What the button of the e-mail is: where it goes, which plan, and whether it logs the recipients in. Lives in the «Knapp» panel. */
export const ButtonOptions: React.FC<ButtonOptionsProps> = ({ link, onLink, semesterOn, plans, plansReady, plan, onPlan, loginLinks, onLoginLinks, span, onSpan, date, onDate, today, until, problem }) => (
  <div className="space-y-3">
    <div>
      <label htmlFor="email-link" className={fieldLabel}>
        Knappen fører til
      </label>
      <select id="email-link" value={link} onChange={(event) => onLink(event.target.value as EmailLink)} className={studioInputFull}>
        {(Object.keys(EMAIL_LINKS) as EmailLink[])
          .filter((choice) => choice !== "semesterplan" || semesterOn || link === "semesterplan")
          .map((choice) => (
            <option key={choice} value={choice}>
              {EMAIL_LINKS[choice].label}
            </option>
          ))}
      </select>
    </div>

    {link === "semesterplan" && (
      <div>
        <label htmlFor="email-plan" className={fieldLabel}>
          Hvilken plan
        </label>
        {plans.length > 0 ? (
          <>
            <select id="email-plan" value={plan ?? ""} onChange={(event) => onPlan(event.target.value)} className={studioInputFull}>
              {plans.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.text}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--studio-muted)] mt-1">Knappen «Planlegg semesteret» åpner planen. Den som ikke er logget inn, kommer dit rett etter innloggingen.</p>
          </>
        ) : (
          <p className="text-[11px] text-amber-500">{plansReady || !semesterOn ? "Det finnes ingen åpen eller planlagt semesterplan. Lag en under Semesterplan først." : "Henter semesterplanene …"}</p>
        )}
      </div>
    )}

    {link !== "ingen" && (
      <div>
        <label className="flex items-start gap-2 text-xs font-bold text-[var(--studio-text)] cursor-pointer">
          <input id="email-login-links" type="checkbox" checked={loginLinks} onChange={(event) => onLoginLinks(event.target.checked)} className="mt-0.5 accent-indigo-600" />
          <span>Logg mottakerne rett inn med knappen</span>
        </label>
        <p className="text-[11px] text-[var(--studio-muted)] mt-1 ml-6">
          Hver mottaker får sin egen knapp som logger dem inn, uten Google eller innloggings-e-post. Administratorer, nettredaktører og de som deler e-postadresse med andre, får vanlig knapp.
        </p>
        {loginLinks && (
          <fieldset className="mt-2 ml-6 space-y-1.5">
            <legend className="text-[11px] font-bold text-[var(--studio-text)] mb-1">Lenken virker</legend>
            {(["14", "30"] as const).map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
                <input type="radio" name="email-login-link-span" checked={span === choice} onChange={() => onSpan(choice)} className="accent-indigo-600" />
                {choice} dager
              </label>
            ))}
            <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
              <input type="radio" name="email-login-link-span" checked={span === "dato"} onChange={() => onSpan("dato")} className="accent-indigo-600" />
              til og med
              <input
                type="date"
                aria-label="Siste dag lenken virker"
                value={date}
                min={today}
                max={daysAfter(today, LOGIN_LINK_MAX_DAYS)}
                onChange={(event) => onDate(event.target.value)}
                className="px-2 py-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-bg)] text-xs"
              />
            </label>
            <p id="email-login-link-until" className={`text-[11px] ${problem ? "text-red-500" : "text-[var(--studio-muted)]"}`}>
              {problem ?? `Knappen virker til og med ${formatLoginLinkUntil(until)}. Høyst ${LOGIN_LINK_MAX_DAYS} dager.`}
            </p>
          </fieldset>
        )}
      </div>
    )}
  </div>
);
