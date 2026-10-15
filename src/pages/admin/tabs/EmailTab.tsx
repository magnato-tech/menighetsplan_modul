import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { useCms } from "../../../context/CmsContext";
import { DEMO } from "../../../demo";
import { requestEmail, saveEmailLog, saveReplyTo, subscribeEmailRecord } from "../../../services/email";
import { subscribeNewsletterBanner, subscribeNewsletterOptOuts } from "../../../services/newsletter";
import { formatNorwegianDateTime } from "../../../utils/dates";
import { newId } from "../../../utils/id";
import { EMAIL_LINKS, EMAIL_SUBJECT_MAX, EMAIL_TEMPLATES, EMAIL_TEXT_MAX, emailDraftError, renderEmail, type EmailDraft, type EmailLink } from "../../../utils/emailMessage";
import { recentSameSending, stopMessage, withLogEntry, withRestSent, type EmailLogEntry, type EmailOutcome, type EmailRecord } from "../../../utils/emailOutcome";
import { audienceKey, audienceLabel, emailRecipients, isNewsletter, toEmailAudience, usableEmail, type EmailAudience } from "../../../utils/emailRecipients";
import { TEST_UNSUBSCRIBE_TOKEN, optedOutPersonIds, unsubscribeUrlOf } from "../../../utils/newsletter";
import { isServiceGroup } from "../../../utils/personDirectory";
import type { ShowFeedback, StudioData } from "../studio";
import { studioCardPadded, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../studioTheme";
import { EmailTextToolbar } from "./email/EmailTextToolbar";
import { NewsletterBannerCard } from "./email/NewsletterBannerCard";
import { NewsletterOptOutsCard } from "./email/NewsletterOptOutsCard";

interface EmailTabProps {
  studio: Pick<StudioData, "adminPersons" | "adminGroups">;
  showFeedback: ShowFeedback;
  /** Whether e-mail can be sent here. Not in the demo, which has no real addresses. Given in tests. */
  canSend?: boolean;
  now?: () => Date;
}

const EMPTY: EmailDraft = { subject: "", text: "", link: "minside" };
/** Only what is sent: a ready-made text has a name and an audience too, which the draft has not. */
const draftOf = ({ subject, text, link }: EmailDraft): EmailDraft => ({ subject, text, link });
const people = (count: number): string => (count === 1 ? "1 person" : `${count} personer`);
const label = "block text-[11px] font-bold text-[var(--studio-muted)] mb-1";

/** E-mail from the administration to the leaders and the volunteers, and the newsletter, with a log of what has been sent. */
export const EmailTab: React.FC<EmailTabProps> = ({ studio, showFeedback, canSend = DEMO === null, now = () => new Date() }) => {
  const persons = useMemo(() => studio.adminPersons.map((row) => row.person), [studio.adminPersons]);
  const groups = useMemo(() => studio.adminGroups.map((row) => row.group), [studio.adminGroups]);
  const churchName = useCms().settings.churchName?.trim() || "Menigheten";

  // undefined while what is stored is being read
  const [record, setRecord] = useState<EmailRecord | undefined>(undefined);
  const [replyTo, setReplyTo] = useState("");
  const [templateId, setTemplateId] = useState<string>(EMAIL_TEMPLATES[0].id);
  const [audience, setAudience] = useState<EmailAudience>(EMAIL_TEMPLATES[0].audience);
  const [draft, setDraft] = useState<EmailDraft>(draftOf(EMAIL_TEMPLATES[0]));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [result, setResult] = useState<{ good: boolean; text: string } | null>(null);
  // The keys that have unsubscribed: undefined while they are read, null when the database refuses them
  const [optOutKeys, setOptOutKeys] = useState<string[] | null | undefined>(undefined);
  const [banner, setBanner] = useState<string | null | undefined>(undefined);
  const textField = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () =>
      subscribeEmailRecord(
        (stored) => {
          setRecord(stored);
          setReplyTo((typed) => (typed === "" ? stored.replyTo : typed));
        },
        () => {
          setRecord({ replyTo: "", log: [] });
          showFeedback("Det som er lagret om e-post, kunne ikke leses.", "error");
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(
    () =>
      subscribeNewsletterOptOuts(
        (keys) => setOptOutKeys(keys),
        () => setOptOutKeys(null)
      ),
    []
  );
  useEffect(
    () =>
      subscribeNewsletterBanner(
        (stored) => setBanner(stored),
        () => setBanner(null)
      ),
    []
  );

  const newsletter = isNewsletter(audience);
  const optedOutIds = useMemo(() => optedOutPersonIds(persons, optOutKeys ?? []), [persons, optOutKeys]);
  const optedOutPersons = useMemo(() => (optOutKeys === undefined || optOutKeys === null ? optOutKeys : persons.filter((person) => optedOutIds.has(person.id))), [optOutKeys, persons, optedOutIds]);
  const { recipients, withoutEmail, optedOut } = useMemo(() => emailRecipients(audience, persons, groups, undefined, optedOutIds), [audience, persons, groups, optedOutIds]);
  const storedReplyTo = record?.replyTo ?? "";
  const preview = useMemo(
    () =>
      renderEmail({
        draft,
        churchName,
        siteUrl: window.location.origin,
        firstName: "Kari",
        ...(newsletter ? { newsletter: { unsubscribeUrl: unsubscribeUrlOf(window.location.origin, TEST_UNSUBSCRIBE_TOKEN), bannerUrl: banner ?? null } } : {}),
      }),
    [draft, churchName, newsletter, banner]
  );

  const choose = (id: string) => {
    setTemplateId(id);
    setError(null);
    setResult(null);
    const template = EMAIL_TEMPLATES.find((candidate) => candidate.id === id);
    if (template) {
      setDraft(draftOf(template));
      setAudience(template.audience);
    } else setDraft(EMPTY);
  };

  const storeReplyTo = () => {
    const address = usableEmail(replyTo);
    if (!address) return showFeedback("Skriv en gyldig e-postadresse som svar skal gå til.", "error");
    saveReplyTo(address).then(
      () => showFeedback("Svaradressen er lagret."),
      () => showFeedback("Svaradressen kunne ikke lagres. Prøv igjen.", "error")
    );
  };

  /** What stands in the way of sending, or null. */
  const blocked = (): string | null => {
    if (!canSend) return "Demoen sender ikke e-post.";
    if (storedReplyTo === "") return "Lagre adressen svar skal gå til, før du sender.";
    return emailDraftError(draft);
  };

  const tell = (outcome: EmailOutcome, done: string) => {
    if (!outcome.ok) return setResult({ good: false, text: outcome.message });
    if (outcome.stopped) return setResult({ good: false, text: `${outcome.sent > 0 ? `${people(outcome.sent)} fikk e-posten. ` : ""}${stopMessage(outcome.stopped, outcome.remainingPersonIds.length, outcome.detail)}` });
    setResult({ good: true, text: done });
  };

  const sendTest = async () => {
    const wrong = blocked();
    setError(wrong);
    if (wrong) return;
    setBusy("test");
    setResult(null);
    const outcome = await requestEmail(newsletter ? { ...draft, mode: "test", audience } : { ...draft, mode: "test" });
    setBusy(null);
    tell(outcome, "Prøven er sendt til e-postadressen du er logget inn med. Sjekk innboksen, og søppelposten.");
  };

  const send = async () => {
    const wrong = blocked() ?? (recipients.length === 0 ? "Ingen av mottakerne har en e-postadresse." : null);
    setError(wrong);
    if (wrong || !record) return;
    const to = audienceLabel(audience, groups);
    const before = recentSameSending(record.log, audienceKey, audience, draft.subject, now());
    if (before && !confirm(`Denne e-posten ble sendt til «${to}» ${formatNorwegianDateTime(before.sentAt)}. Vil du sende den en gang til?`)) return;
    if (!confirm(`Du sender «${draft.subject.trim()}» til ${people(recipients.length)} (${to}). Vil du sende?`)) return;

    setBusy("send");
    setResult(null);
    const outcome = await requestEmail({ ...draft, mode: "send", audience });
    setBusy(null);
    if (outcome.ok) {
      const entry: EmailLogEntry = {
        id: newId("epost"),
        sentAt: now().toISOString(),
        audience,
        audienceLabel: to,
        subject: draft.subject.trim(),
        sent: outcome.sent,
        withoutEmail: outcome.withoutEmail,
        stopped: outcome.stopped,
        remainingPersonIds: outcome.remainingPersonIds,
      };
      saveEmailLog(withLogEntry(record.log, entry)).catch(() => showFeedback("E-posten er sendt, men loggen kunne ikke lagres.", "error"));
    }
    tell(outcome, `E-posten er sendt til ${people(outcome.ok ? outcome.sent : 0)}.`);
  };

  /** Sends to those a stopped sending left: the same e-mail as stands in the form now. */
  const sendRest = async (entry: EmailLogEntry) => {
    const wrong = blocked();
    setError(wrong);
    if (wrong || !record) return;
    if (!confirm(`Du sender «${draft.subject.trim()}» til ${people(entry.remainingPersonIds.length)} som gjenstår (${entry.audienceLabel}). Teksten er den som står i skjemaet nå. Vil du sende?`)) return;
    setBusy("send");
    setResult(null);
    const outcome = await requestEmail({ ...draft, mode: "send", audience: entry.audience, onlyPersonIds: entry.remainingPersonIds });
    setBusy(null);
    if (outcome.ok) {
      const next = withRestSent(record.log, entry.id, outcome.remainingPersonIds, outcome.stopped).map((other) => (other.id === entry.id ? { ...other, sent: other.sent + outcome.sent } : other));
      saveEmailLog(next).catch(() => showFeedback("E-posten er sendt, men loggen kunne ikke lagres.", "error"));
    }
    tell(outcome, `E-posten er sendt til ${people(outcome.ok ? outcome.sent : 0)} som gjensto.`);
  };

  const audienceValue = audience.kind === "group" ? `group:${audience.groupId}` : audience.kind;
  const chooseAudience = (value: string) => {
    const next = toEmailAudience(value.startsWith("group:") ? { kind: "group", groupId: value.slice(6) } : { kind: value });
    if (next) setAudience(next);
  };
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Send e-post</h2>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Si fra til lederne og de frivillige, for eksempel når et nytt semester starter, eller send nyhetsbrev til medlemmene. Hver person får sin egen e-post, og ingen ser de andres adresser.
        </p>
      </div>

      {!canSend && (
        <p id="email-demo-note" role="note" className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-[var(--studio-text)]">
          Demoen sender ikke e-post: personene her er oppdiktet. Siden virker på samme måte hos en menighet, og der går e-posten ut.
        </p>
      )}

      <section aria-label="Svaradresse" className={studioCardPadded}>
        <label htmlFor="email-reply-to" className={label}>
          Svar går til
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="email-reply-to"
            type="email"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
            placeholder="post@menigheten.no"
            className={`${studioInputFull} sm:max-w-sm`}
          />
          <button type="button" onClick={storeReplyTo} disabled={record === undefined || (usableEmail(replyTo) ?? "") === storedReplyTo} className={`${studioSecondaryButton} disabled:opacity-50`}>
            Lagre
          </button>
        </div>
        <p className="text-[11px] text-[var(--studio-muted)] mt-2">
          E-posten sendes fra en adresse ingen leser. Den som svarer, når denne adressen.
          {record !== undefined && storedReplyTo === "" && <strong className="text-amber-500"> Ingen adresse er lagret ennå.</strong>}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="E-posten" className={`${studioCardPadded} space-y-4`}>
          <div>
            <span className={label}>Start med</span>
            <div className="flex flex-wrap gap-2">
              {[...EMAIL_TEMPLATES.map((template) => ({ id: template.id, text: template.label })), { id: "tom", text: "Tom e-post" }].map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={templateId === choice.id}
                  onClick={() => choose(choice.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-colors ${
                    templateId === choice.id ? "bg-indigo-600 border-indigo-600 text-white" : "border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                  }`}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="email-audience" className={label}>
              Hvem skal ha den
            </label>
            <select id="email-audience" value={audienceValue} onChange={(event) => chooseAudience(event.target.value)} className={studioInputFull}>
              <optgroup label="Nyhetsbrev">
                <option value="members">Medlemmer av menigheten</option>
                <option value="everyone">Alle i registeret med e-post</option>
              </optgroup>
              <option value="leaders">Ledere og nestledere i tjenestegruppene</option>
              <option value="serviceGroups">Alle i tjenestegruppene</option>
              <optgroup label="Én gruppe">
                {sortedGroups.map((group) => (
                  <option key={group.id} value={`group:${group.id}`}>
                    {group.name}
                    {isServiceGroup(group) ? "" : " (ikke tjenestegruppe)"}
                  </option>
                ))}
              </optgroup>
            </select>
            <p id="email-recipient-count" className="text-[11px] text-[var(--studio-muted)] mt-2">
              <strong className="text-[var(--studio-text)]">{people(recipients.length)}</strong> får e-posten.
              {withoutEmail.length > 0 && (
                <>
                  {" "}
                  {people(withoutEmail.length)} mangler e-postadresse og får den ikke: {withoutEmail.map((person) => person.name).join(", ")}.
                </>
              )}
              {optedOut.length > 0 && ` ${people(optedOut.length)} har meldt seg av nyhetsbrevet.`}
            </p>
            {newsletter && (
              <p className="text-[11px] text-[var(--studio-muted)] mt-1">
                Et nyhetsbrev får toppbildet øverst og en lenke nederst der mottakeren kan melde seg av. Medlemmer er de som er merket som medlem av menigheten i personregisteret.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email-subject" className={label}>
              Emne
            </label>
            <input id="email-subject" type="text" maxLength={EMAIL_SUBJECT_MAX} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className={studioInputFull} />
          </div>

          <div>
            <label htmlFor="email-text" className={label}>
              Tekst
            </label>
            <EmailTextToolbar field={textField} onChange={(text) => setDraft((current) => ({ ...current, text }))} />
            <textarea ref={textField} id="email-text" rows={newsletter ? 16 : 9} maxLength={EMAIL_TEXT_MAX} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} className={`${studioInputFull} leading-relaxed`} />
            <p className="text-[11px] text-[var(--studio-muted)] mt-1">
              En tom linje gir nytt avsnitt. Merk tekst og trykk på en knapp over feltet for overskrift, fet skrift, lenke eller punktliste.{" "}
              {newsletter ? "Toppbildet og lenken til avmelding legges til av seg selv." : "Hilsenen med fornavn og knappen legges til av seg selv."}
            </p>
          </div>

          <div>
            <label htmlFor="email-link" className={label}>
              Knappen fører til
            </label>
            <select id="email-link" value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value as EmailLink })} className={studioInputFull}>
              {(Object.keys(EMAIL_LINKS) as EmailLink[]).map((link) => (
                <option key={link} value={link}>
                  {EMAIL_LINKS[link].label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-xs font-bold text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button type="button" onClick={sendTest} disabled={busy !== null || !canSend} className={`${studioSecondaryButton} flex items-center justify-center gap-1.5 disabled:opacity-50`}>
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>{busy === "test" ? "Sender prøven …" : "Send prøve til meg"}</span>
            </button>
            <button type="button" onClick={send} disabled={busy !== null || !canSend || record === undefined} className={`${studioPrimaryButton} flex items-center justify-center gap-1.5 disabled:opacity-50`}>
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{busy === "send" ? "Sender …" : `Send til ${people(recipients.length)}`}</span>
            </button>
          </div>

          {result && (
            <p role="status" className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${result.good ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"} text-[var(--studio-text)]`}>
              {result.good ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />}
              <span>{result.text}</span>
            </p>
          )}
        </section>

        <section aria-label="Slik ser den ut" className={`${studioCardPadded} space-y-3`}>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Slik ser den ut</h3>
          <dl className="text-[11px] text-[var(--studio-muted)] space-y-0.5">
            <div>
              <dt className="inline font-bold">Fra: </dt>
              <dd className="inline">{churchName}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Emne: </dt>
              <dd className="inline text-[var(--studio-text)]">{preview.subject || "–"}</dd>
            </div>
          </dl>
          <iframe
            id="email-preview"
            title="Slik ser e-posten ut"
            srcDoc={preview.html}
            // No scripts can run in it; the same origin only lets the browser draw it as a frame of the page
            sandbox="allow-same-origin"
            className="w-full h-[560px] rounded-xl bg-white border border-[var(--studio-border)]"
          />
          <p className="text-[11px] text-[var(--studio-muted)]">
            {newsletter ? "Lenkene virker ikke her, bare i e-posten." : "«Kari» står her for fornavnet til den som får e-posten. Lenkene virker ikke her, bare i e-posten."}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NewsletterBannerCard banner={banner} churchName={churchName} showFeedback={showFeedback} />
        <NewsletterOptOutsCard optedOut={optedOutPersons} showFeedback={showFeedback} />
      </div>

      <section aria-label="Sendt" className={studioCardPadded}>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)] mb-3">Sendt</h3>
        {record === undefined ? (
          <p className="text-xs text-[var(--studio-muted)]">Henter loggen …</p>
        ) : record.log.length === 0 ? (
          <p className="text-xs text-[var(--studio-muted)] italic">Ingen e-post er sendt herfra ennå.</p>
        ) : (
          <ul className="divide-y divide-[var(--studio-border)]">
            {record.log.map((entry) => (
              <li key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--studio-text)] break-words">{entry.subject}</p>
                  <p className="text-[11px] text-[var(--studio-muted)]">
                    {formatNorwegianDateTime(entry.sentAt)} · {entry.audienceLabel} · sendt til {people(entry.sent)}
                    {entry.withoutEmail > 0 && ` · ${entry.withoutEmail} uten e-postadresse`}
                  </p>
                  {entry.remainingPersonIds.length > 0 && <p className="text-[11px] font-bold text-amber-500">Stoppet før alle hadde fått den: {people(entry.remainingPersonIds.length)} gjenstår.</p>}
                </div>
                {entry.remainingPersonIds.length > 0 && (
                  <button type="button" onClick={() => sendRest(entry)} disabled={busy !== null || !canSend} className={`${studioSecondaryButton} shrink-0 disabled:opacity-50`}>
                    Send til dem som gjenstår
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
