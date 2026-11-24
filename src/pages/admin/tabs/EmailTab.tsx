import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { List as ListIcon, Newspaper, PenLine, SendHorizontal, Settings, type LucideIcon } from "lucide-react";
import { useCms } from "../../../context/CmsContext";
import { useMinSideModules } from "../../../hooks/useMinSideModules";
import { useSemesterPlans } from "../../../hooks/useSemesterPlans";
import { studioPrimaryButton, studioSecondaryButton } from "../studioTheme";
import { DEMO } from "../../../demo";
import { requestEmail, saveEmailLog, saveReplyTo, subscribeEmailRecord } from "../../../services/email";
import { subscribeNewsletterBanner, subscribeNewsletterOptOuts } from "../../../services/newsletter";
import { formatNorwegianDateTime } from "../../../utils/dates";
import { PLAN_STATUS_LABELS, planStatus } from "../../../utils/semesterPlan";
import { newId } from "../../../utils/id";
import { EMAIL_TEMPLATES, emailDraftError, type EmailDraft, type EmailLink } from "../../../utils/emailMessage";
import { recentSameSending, stopMessage, testStopMessage, withLogEntry, withRestSent, type EmailLogEntry, type EmailOutcome, type EmailRecord, type EmailStop } from "../../../utils/emailOutcome";
import { audienceKey, audienceLabel, emailRecipients, isNewsletter, usableEmail, type EmailAudience, type EmailRecipients } from "../../../utils/emailRecipients";
import { optedOutPersonIds } from "../../../utils/newsletter";
import { daysAfter, formatLoginLinkUntil, loginLinkUntilError } from "../../../utils/loginLink";
import { testDraftFor } from "../../../utils/emailTest";
import { takeEmailHandover, type EmailList } from "../../../utils/emailLists";
import { useEmailLists } from "../../../hooks/useEmailLists";
import type { ShowFeedback, StudioData } from "../studio";
import { EmailComposer } from "./email/EmailComposer";
import { EmailSettings } from "./email/EmailSettings";
import { NewsletterView } from "./email/NewsletterView";
import { ListsView } from "./email/ListsView";
import { SentList } from "./email/SentList";
import type { ButtonOptionsProps, LinkSpan } from "./email/ButtonOptions";
import { countOf, listChip, newsletterAudience, people, resolveChips, selectionChip, type Ask, type NewsletterKind, type RecipientChip } from "./email/chips";
import { navItem, resultBox } from "./email/emailStyles";

interface EmailTabProps {
  studio: Pick<StudioData, "adminPersons" | "adminGroups" | "currentUser">;
  showFeedback: ShowFeedback;
  /** Whether e-mail can be sent here. Not in the demo, which has no real addresses. Given in tests. */
  canSend?: boolean;
  now?: () => Date;
}

/** The views: the e-mail being written, what has been sent, the saved lists, the newsletter, and the settings. */
type EmailView = "ny" | "sendte" | "lister" | "nyhetsbrev" | "innstillinger";
/** How a view is named in the address, as `&vis=`. «Ny e-post» is the page's own address. */
const VIEW_PARAM: Record<EmailView, string | null> = { ny: null, sendte: "sendte", lister: "lister", nyhetsbrev: "nyhetsbrev", innstillinger: "innstillinger" };
const viewOf = (param: string | null): EmailView => (param === "sendte" || param === "lister" || param === "nyhetsbrev" || param === "innstillinger" ? param : "ny");
const MAIN_VIEWS: { view: EmailView; label: string; icon: LucideIcon }[] = [
  { view: "ny", label: "Ny e-post", icon: PenLine },
  { view: "sendte", label: "Sendte", icon: SendHorizontal },
  { view: "lister", label: "Lister", icon: ListIcon },
  { view: "nyhetsbrev", label: "Nyhetsbrev", icon: Newspaper },
];

type Notice = { good: boolean; text: string };
/** A question asked in the page: its text, the words of its yes button, and what answering it does. */
type Question = { text: string; yes: string; answer: (yes: boolean) => void };

/** What a send says when the e-mail settings have not been read yet. */
const NOT_LOADED = "Innstillingene for e-post er ikke lastet ennå. Vent litt og prøv igjen.";

const EMPTY: EmailDraft = { subject: "", text: "", link: "minside" };
/** Only what is sent: a ready-made text has a name and an audience too, which the draft has not. */
const draftOf = ({ subject, text, link, planId }: EmailDraft): EmailDraft =>
  link === "semesterplan" && planId !== undefined ? { subject, text, link, planId } : { subject, text, link };
/** The draft with another button. Only a semester plan's button has a plan; every other link leaves it out. */
const withLink = (current: EmailDraft, link: EmailLink, planId: string | undefined): EmailDraft => draftOf({ ...current, link, planId });
/** Nobody, for a composer with no recipients chosen. */
const NOBODY: EmailRecipients = { recipients: [], withoutEmail: [], optedOut: [] };
/** Where this browser keeps the last choice of how long login links work. Only a convenience: anything unreadable gives 30 days. */
const LINK_CHOICE_KEY = "menighetsplan_innloggingslenke_varighet";
function readLinkChoice(): { span: "14" | "30" | "dato"; date: string | null } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LINK_CHOICE_KEY) ?? "null") as { span?: unknown; date?: unknown } | null;
    const span = saved?.span === "14" || saved?.span === "30" || saved?.span === "dato" ? saved.span : "30";
    return { span, date: typeof saved?.date === "string" ? saved.date : null };
  } catch {
    return { span: "30", date: null };
  }
}
function keepLinkChoice(span: string, date: string): void {
  try {
    window.localStorage.setItem(LINK_CHOICE_KEY, JSON.stringify({ span, date }));
  } catch {
    // Blocked storage only means the choice is asked again next time
  }
}

/** One sending, as the page has it: the text, who it goes to, and what the log calls them. */
interface Sending {
  draft: EmailDraft;
  audience: EmailAudience;
  onlyPersonIds?: string[];
  label: string;
  recipients: EmailRecipients;
  loginLinks: boolean;
}

/** E-mail from the administration to the leaders and the volunteers, and the newsletter, with a log of what has been sent. */
export const EmailTab: React.FC<EmailTabProps> = ({ studio, showFeedback, canSend = DEMO === null, now = () => new Date() }) => {
  const persons = useMemo(() => studio.adminPersons.map((row) => row.person), [studio.adminPersons]);
  const groups = useMemo(() => studio.adminGroups.map((row) => row.group), [studio.adminGroups]);
  // The saved lists of persons, followed live: suggested in «Til», and shown under «Lister»
  const listsState = useEmailLists(true);
  const lists = useMemo<EmailList[]>(() => listsState.lists ?? [], [listsState.lists]);
  const churchName = useCms().settings.churchName?.trim() || "Menigheten";
  // The view is kept in the address, as the other sub-views of the admin are (see studio.ts)
  const [searchParams, setSearchParams] = useSearchParams();
  const view = viewOf(searchParams.get("vis"));

  // undefined while what is stored is being read
  const [record, setRecord] = useState<EmailRecord | undefined>(undefined);
  const [replyTo, setReplyTo] = useState("");
  // The keys that have unsubscribed: undefined while they are read, null when the database refuses them
  const [optOutKeys, setOptOutKeys] = useState<string[] | null | undefined>(undefined);
  const [banner, setBanner] = useState<string | null | undefined>(undefined);
  // The e-mail and the newsletter each keep their own text and recipients
  // «Til» starts empty: nobody is chosen for the administrator, and a template never changes who gets it
  const [chips, setChips] = useState<RecipientChip[]>([]);
  const [draft, setDraft] = useState<EmailDraft>(draftOf(EMAIL_TEMPLATES[0]));
  const [newsDraft, setNewsDraft] = useState<EmailDraft>(draftOf(EMAIL_TEMPLATES.find((template) => isNewsletter(template.audience)) ?? EMPTY));
  const [newsKind, setNewsKind] = useState<NewsletterKind>("members");
  // Shown above the view, so a stopped sending is told wherever it was started
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  // The question waiting for an answer, shown where the notices are. Nothing is sent while one is open.
  const [question, setQuestion] = useState<Question | null>(null);
  const questionBox = useRef<HTMLDivElement>(null);
  const questionYes = useRef<HTMLButtonElement>(null);
  // The panel «Send prøve»: its own address and its own result, apart from the sending
  const [testAddressText, setTestAddressText] = useState(() => studio.currentUser?.email ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Notice | null>(null);
  // Whether the button of each recipient is a personal login link (see utils/loginLink.ts). Off unless ticked.
  const [loginLinks, setLoginLinks] = useState(false);
  // How long the login links work: 14 or 30 days, or through a chosen day. The choice is kept in this browser.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
  const [linkSpan, setLinkSpan] = useState<LinkSpan>(() => readLinkChoice().span);
  const [linkDate, setLinkDate] = useState(() => readLinkChoice().date ?? daysAfter(today, 30));
  const loginLinkUntil = linkSpan === "dato" ? linkDate : daysAfter(today, Number(linkSpan));
  const loginLinkProblem = loginLinkUntilError(loginLinkUntil, today);
  useEffect(() => keepLinkChoice(linkSpan, linkDate), [linkSpan, linkDate]);

  // The selection handed over from «Personer» (see utils/emailLists.ts) becomes the only recipient, once, when the page opens
  useEffect(() => {
    const handover = takeEmailHandover();
    if (handover) setChips([selectionChip(handover)]);
  }, []);

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

  const storedReplyTo = record?.replyTo ?? "";
  const optedOutIds = useMemo(() => optedOutPersonIds(persons, optOutKeys ?? []), [persons, optOutKeys]);
  const optedOutPersons = useMemo(
    () => (optOutKeys === undefined || optOutKeys === null ? optOutKeys : persons.filter((person) => optedOutIds.has(person.id))),
    [optOutKeys, persons, optedOutIds]
  );

  // Who the e-mail goes to: the chips in «Til» as one audience, and the newsletter's audience as chosen
  const target = useMemo(() => resolveChips(chips, persons, groups, lists), [chips, persons, groups, lists]);
  const composerRecipients = useMemo(
    () => (target ? emailRecipients(target.audience, persons, groups, target.onlyPersonIds, optedOutIds) : NOBODY),
    [target, persons, groups, optedOutIds]
  );
  const newsRecipients = useMemo(() => emailRecipients(newsletterAudience(newsKind), persons, groups, undefined, optedOutIds), [newsKind, persons, groups, optedOutIds]);
  const newsCounts = useMemo(
    () => ({
      members: countOf(emailRecipients(newsletterAudience("members"), persons, groups, undefined, optedOutIds)),
      everyone: countOf(emailRecipients(newsletterAudience("everyone"), persons, groups, undefined, optedOutIds)),
    }),
    [persons, groups, optedOutIds]
  );

  const loginLinksOn = loginLinks && draft.link !== "ingen";
  const loginNote = loginLinksOn ? (loginLinkProblem ?? `Logger mottakerne inn, til og med ${formatLoginLinkUntil(loginLinkUntil)}`) : null;

  // The semester plans the button may open: those not yet closed, in the order they come
  const semesterOn = useMinSideModules().isOn("semesterplan");
  const { plans, ready: plansReady } = useSemesterPlans(semesterOn);
  const choosablePlans = plans.filter((plan) => planStatus(plan, now()) !== "lukket");
  const planChoices = choosablePlans.map((plan) => ({ id: plan.id, text: `${plan.name} (${PLAN_STATUS_LABELS[planStatus(plan, now())]})` }));
  /** The plan a semester button opens: the one given if it can still be chosen, else the first that can. */
  const planFor = (current: string | undefined): string | undefined => (current !== undefined && choosablePlans.some((plan) => plan.id === current) ? current : choosablePlans[0]?.id);
  const chosenPlan = planFor(draft.planId);
  // When the plans arrive later, or the one given is closed, the button opens the first that can be chosen
  useEffect(() => {
    if (draft.link !== "semesterplan" || chosenPlan === draft.planId) return;
    setDraft((current) => withLink(current, "semesterplan", chosenPlan));
  }, [draft.link, draft.planId, chosenPlan]);

  const chooseTemplate = (id: string) => {
    setError(null);
    setResult(null);
    const template = EMAIL_TEMPLATES.find((candidate) => candidate.id === id);
    if (template) {
      setDraft(withLink(template, template.link, template.link === "semesterplan" ? planFor(undefined) : undefined));
    } else setDraft(EMPTY);
  };
  const chooseLink = (link: EmailLink) => setDraft((current) => withLink(current, link, link === "semesterplan" ? planFor(current.planId) : undefined));
  const choosePlan = (planId: string) => setDraft((current) => withLink(current, "semesterplan", planId));

  /** The address and the link choice, as the «Knapp» panel shows them. */
  const buttonProps: ButtonOptionsProps = {
    link: draft.link,
    onLink: chooseLink,
    semesterOn,
    plans: planChoices,
    plansReady,
    plan: chosenPlan,
    onPlan: choosePlan,
    loginLinks,
    onLoginLinks: setLoginLinks,
    span: linkSpan,
    onSpan: setLinkSpan,
    date: linkDate,
    onDate: (value) => {
      setLinkDate(value);
      setLinkSpan("dato");
    },
    today,
    until: loginLinkUntil,
    problem: loginLinkProblem,
  };

  /** Moves to another view. Notices belong to the view they were made in, so they are cleared. */
  const showView = (next: EmailView) => {
    setError(null);
    setResult(null);
    setTestResult(null);
    // A question asked in the view left behind counts as «Avbryt»
    question?.answer(false);
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        const value = VIEW_PARAM[next];
        if (value === null) params.delete("vis");
        else params.set("vis", value);
        return params;
      },
      { replace: true }
    );
  };

  const storeReplyTo = () => {
    const address = usableEmail(replyTo);
    if (!address) return showFeedback("Skriv en gyldig e-postadresse som svar skal gå til.", "error");
    saveReplyTo(address).then(
      () => showFeedback("Svaradressen er lagret."),
      () => showFeedback("Svaradressen kunne ikke lagres. Prøv igjen.", "error")
    );
  };

  /** What stands in the way of a test, or null. The draft is not looked at: a test sends a fixed one when the page's is not valid. */
  const testBlocked = (withLoginLinks: boolean): string | null => {
    if (!canSend) return "Demoen sender ikke e-post.";
    if (storedReplyTo === "") return "Lagre adressen svar skal gå til, før du sender.";
    if (withLoginLinks && loginLinkProblem) return loginLinkProblem;
    return null;
  };

  /** What stands in the way of sending a text, or null. */
  const preflight = (source: EmailDraft, withLoginLinks: boolean): string | null => testBlocked(withLoginLinks) ?? emailDraftError(source);

  /** What a sending that stopped is told with. */
  const stopText = (sent: number, stopped: EmailStop, left: number, detail?: string): string => `${sent > 0 ? `${people(sent)} fikk e-posten. ` : ""}${stopMessage(stopped, left, detail)}`;

  /** What is added to a success text about the login links that were sent, or nothing. */
  const loginLinksText = (outcome: EmailOutcome): string => (outcome.ok && outcome.loginLinks ? ` ${outcome.loginLinks} av dem fikk knapp som logger dem rett inn.` : "");

  const tell = (outcome: EmailOutcome, done: string) => {
    if (!outcome.ok) return setResult({ good: false, text: outcome.message });
    if (outcome.stopped) return setResult({ good: false, text: stopText(outcome.sent, outcome.stopped, outcome.remainingPersonIds.length, outcome.detail) });
    setResult({ good: true, text: done });
  };

  /** Asks the administrator in the page, and resolves with the answer: true for the yes button, false for «Avbryt» or Escape. */
  const ask: Ask = (text, yes = "Send") => new Promise<boolean>((resolve) => setQuestion({ text, yes, answer: (ok) => { setQuestion(null); resolve(ok); } }));

  // A question is read at once: its yes button has the focus, and the box is in view
  useEffect(() => {
    if (!question) return;
    questionYes.current?.focus();
    const box = questionBox.current;
    // jsdom has no scrolling
    if (box && typeof box.scrollIntoView === "function") box.scrollIntoView({ block: "nearest" });
  }, [question]);

  /** Sends the test to the one address the panel names, and logs that it was sent. A newsletter test gets its audience too. */
  const sendTestMail = async (source: EmailDraft, newsletter: NewsletterKind | null) => {
    if (question) return;
    const address = usableEmail(testAddressText);
    if (!address) return setTestResult({ good: false, text: "Skriv en gyldig e-postadresse." });
    const withLoginLinks = newsletter === null && loginLinksOn;
    const wrong = testBlocked(withLoginLinks);
    if (wrong) return setTestResult({ good: false, text: wrong });
    const testDraft = testDraftFor(source, churchName);
    setTesting(true);
    setTestResult(null);
    // With the box ticked, the test carries a login link too, when the address is a member's (see server/emailSending.ts)
    const testLoginLinks = withLoginLinks && testDraft.link !== "ingen" ? { loginLinks: true as const, loginLinkUntil } : {};
    const outcome = await requestEmail({ ...testDraft, mode: "test", to: address, ...(newsletter ? { audience: newsletterAudience(newsletter) } : {}), ...testLoginLinks });
    setTesting(false);
    if (outcome.ok && record) {
      const entry: EmailLogEntry = {
        id: newId("epost"),
        sentAt: now().toISOString(),
        audience: { kind: "persons" },
        // The log never holds an address (see utils/emailOutcome.ts)
        audienceLabel: "Test til én adresse",
        subject: testDraft.subject.trim(),
        sent: outcome.sent,
        withoutEmail: 0,
        stopped: outcome.stopped,
        remainingPersonIds: [],
      };
      saveEmailLog(withLogEntry(record.log, entry)).catch(() => showFeedback("Prøven er sendt, men loggen kunne ikke lagres.", "error"));
    }
    if (!outcome.ok) return setTestResult({ good: false, text: outcome.message });
    if (outcome.stopped) return setTestResult({ good: false, text: testStopMessage(outcome.stopped, outcome.detail) });
    const clock = now().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    setTestResult({ good: true, text: `Sendt til ${address} kl. ${clock}. Utsendingen virker. Kom den ikke fram, sjekk søppelposten.` });
  };

  /** Sends an e-mail to all of its recipients, after the questions the administrator is asked, and logs it. */
  const sendMail = async (sendingNow: Sending) => {
    if (!record) return setError(NOT_LOADED);
    const { personCount, addressNote } = countOf(sendingNow.recipients);
    const wrong = preflight(sendingNow.draft, sendingNow.loginLinks) ?? (sendingNow.recipients.recipients.length === 0 ? "Ingen av mottakerne har en e-postadresse." : null);
    setError(wrong);
    if (wrong) return;
    const to = sendingNow.label;
    const subject = sendingNow.draft.subject.trim();
    const before = recentSameSending(record.log, audienceKey, sendingNow.audience, sendingNow.draft.subject, now());
    if (before && !(await ask(`Denne e-posten ble sendt til «${to}» ${formatNorwegianDateTime(before.sentAt)}. Vil du sende den en gang til?`))) return;
    if (!(await ask(`Du sender «${subject}» til ${people(personCount)}${addressNote} (${to}). Vil du sende?`))) return;

    setSending(true);
    setResult(null);
    const outcome = await requestEmail({
      ...sendingNow.draft,
      mode: "send",
      audience: sendingNow.audience,
      ...(sendingNow.onlyPersonIds ? { onlyPersonIds: sendingNow.onlyPersonIds } : {}),
      ...(sendingNow.loginLinks ? { loginLinks: true as const, loginLinkUntil } : {}),
    });
    setSending(false);
    if (outcome.ok) {
      const entry: EmailLogEntry = {
        id: newId("epost"),
        sentAt: now().toISOString(),
        audience: sendingNow.audience,
        audienceLabel: to,
        subject,
        sent: outcome.sent,
        withoutEmail: outcome.withoutEmail,
        stopped: outcome.stopped,
        remainingPersonIds: outcome.remainingPersonIds,
      };
      saveEmailLog(withLogEntry(record.log, entry)).catch(() => showFeedback("E-posten er sendt, men loggen kunne ikke lagres.", "error"));
    }
    tell(outcome, `E-posten er sendt til ${people(outcome.ok ? outcome.sent : 0)}.${loginLinksText(outcome)}`);
  };

  /** «Send e-post til listen» under «Lister»: «Ny e-post» with the list as its only chip. */
  const sendToList = (list: EmailList) => {
    setChips([listChip(list)]);
    showView("ny");
  };

  /** «Send til» in «Ny e-post»: the chips as they stand. */
  const sendComposer = () => {
    if (question) return;
    if (!record) return setError(NOT_LOADED);
    if (!target) return setError(preflight(draft, loginLinksOn) ?? "Legg til minst én mottaker.");
    void sendMail({ draft, audience: target.audience, onlyPersonIds: target.onlyPersonIds, label: target.label, recipients: composerRecipients, loginLinks: loginLinksOn });
  };

  /** «Send til» in «Nyhetsbrev»: the newsletter as it stands. Never with login links. */
  const sendNewsletter = () => {
    if (question) return;
    const audience = newsletterAudience(newsKind);
    void sendMail({ draft: newsDraft, audience, label: audienceLabel(audience, groups), recipients: newsRecipients, loginLinks: false });
  };

  /** Sends to those a stopped sending left: the same e-mail as stands in the form now, with the text of its kind. */
  const sendRest = async (entry: EmailLogEntry) => {
    if (question) return;
    if (!record) return setError(NOT_LOADED);
    const newsletter = isNewsletter(entry.audience);
    const source = newsletter ? newsDraft : draft;
    const withLoginLinks = loginLinksOn && !newsletter;
    const wrong = preflight(source, withLoginLinks);
    setError(wrong);
    if (wrong) return;
    if (!(await ask(`Du sender «${source.subject.trim()}» til ${people(entry.remainingPersonIds.length)} som gjenstår (${entry.audienceLabel}). Teksten er den som står i skjemaet nå. Vil du sende?`))) return;
    setSending(true);
    setResult(null);
    const outcome = await requestEmail({
      ...source,
      mode: "send",
      audience: entry.audience,
      onlyPersonIds: entry.remainingPersonIds,
      ...(withLoginLinks ? { loginLinks: true as const, loginLinkUntil } : {}),
    });
    setSending(false);
    if (outcome.ok) {
      const next = withRestSent(record.log, entry.id, outcome.remainingPersonIds, outcome.stopped).map((other) => (other.id === entry.id ? { ...other, sent: other.sent + outcome.sent } : other));
      saveEmailLog(next).catch(() => showFeedback("E-posten er sendt, men loggen kunne ikke lagres.", "error"));
    }
    tell(outcome, `E-posten er sendt til ${people(outcome.ok ? outcome.sent : 0)} som gjensto.${loginLinksText(outcome)}`);
  };

  const templates = [
    ...EMAIL_TEMPLATES.filter((template) => !isNewsletter(template.audience)).map((template) => ({ id: template.id, label: template.label })),
    { id: "tom", label: "Tom e-post" },
  ];
  const busy = sending || testing;

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

      <div className="grid grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)] gap-6">
        <nav aria-label="Visning" className="flex flex-row flex-wrap lg:flex-col gap-1">
          {MAIN_VIEWS.map((item) => (
            <button key={item.view} type="button" aria-current={view === item.view ? "page" : undefined} onClick={() => showView(item.view)} className={navItem(view === item.view)}>
              <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="lg:mt-auto lg:pt-4">
            <button type="button" aria-current={view === "innstillinger" ? "page" : undefined} onClick={() => showView("innstillinger")} className={navItem(view === "innstillinger")}>
              <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Innstillinger</span>
            </button>
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {error && (
            <p role="alert" className="text-xs font-bold text-red-400">
              {error}
            </p>
          )}
          {result && (
            <p role="status" className={resultBox(result.good)}>
              <span>{result.text}</span>
            </p>
          )}

          {question && (
            <div ref={questionBox} role="alertdialog" aria-labelledby="email-question" onKeyDown={(event) => event.key === "Escape" && question.answer(false)} className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
              <p id="email-question" className="text-xs font-bold text-[var(--studio-text)]">
                {question.text}
              </p>
              <div className="flex flex-wrap gap-2">
                <button ref={questionYes} type="button" onClick={() => question.answer(true)} className={`${studioPrimaryButton} px-3 py-1.5 text-xs`}>
                  {question.yes}
                </button>
                <button type="button" onClick={() => question.answer(false)} className={studioSecondaryButton}>
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {view === "ny" && (
            <EmailComposer
              canSend={canSend}
              churchName={churchName}
              storedReplyTo={storedReplyTo}
              persons={persons}
              groups={groups}
              lists={lists}
              chips={chips}
              onChips={setChips}
              recipients={composerRecipients}
              draft={draft}
              setDraft={setDraft}
              templates={templates}
              onTemplate={chooseTemplate}
              buttonProps={buttonProps}
              loginNote={loginNote}
              previewLogin={{ loginLink: loginLinksOn, loginLinkUntil: loginLinkProblem ? undefined : loginLinkUntil }}
              sending={sending}
              testing={testing}
              onSend={sendComposer}
              testAddress={testAddressText}
              onTestAddress={setTestAddressText}
              testResult={testResult}
              onSendTest={() => void sendTestMail(draft, null)}
              onOpenSettings={() => showView("innstillinger")}
            />
          )}

          {view === "sendte" && <SentList record={record} busy={busy} canSend={canSend} onSendRest={(entry) => void sendRest(entry)} />}

          {view === "lister" && (
            <ListsView lists={listsState.lists} problem={listsState.problem} persons={persons} groups={groups} canSend={canSend} showFeedback={showFeedback} onSendToList={sendToList} ask={ask} />
          )}

          {view === "nyhetsbrev" && (
            <NewsletterView
              canSend={canSend}
              churchName={churchName}
              banner={banner}
              optedOut={optedOutPersons}
              showFeedback={showFeedback}
              ask={ask}
              draft={newsDraft}
              setDraft={setNewsDraft}
              kind={newsKind}
              onKind={setNewsKind}
              counts={newsCounts}
              recipients={newsRecipients}
              sending={sending}
              testing={testing}
              onSend={sendNewsletter}
              testAddress={testAddressText}
              onTestAddress={setTestAddressText}
              testResult={testResult}
              onSendTest={() => void sendTestMail(newsDraft, newsKind)}
            />
          )}

          {view === "innstillinger" && (
            <EmailSettings replyTo={replyTo} onReplyTo={setReplyTo} storedReplyTo={storedReplyTo} loaded={record !== undefined} onSave={storeReplyTo} />
          )}
        </div>
      </div>
    </div>
  );
};
