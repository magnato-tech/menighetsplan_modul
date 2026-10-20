import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdminDetailRoute } from "../utils/adminStudioRoutes";
import {
  useAdminTaskDetail,
  formatNorwegianDateTime,
  GROUP_CATEGORIES,
} from "../hooks/useAppHooks";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { StudioDetailShell, StudioDetailNotFound } from "./admin/StudioDetailShell";
import {
  studioDetailCard,
  studioDetailSection,
  studioDetailInput,
  studioDetailTitle,
  studioDetailLink,
  studioDetailRow,
} from "./admin/studioDetailTheme";
import { useTimedMessage } from "../hooks/useTimedMessage";
import {
  Calendar,
  MapPin,
  Users,
  Phone,
  Mail,
  FileText,
  Save,
  Info,
  ChevronRight,
  Sparkles,
  Users2,
  Hash,
} from "lucide-react";

export const AdminTaskDetailPage: React.FC = () => {
  const detailRoute = useAdminDetailRoute();
  const taskId = detailRoute?.kind === "task" ? detailRoute.id : "";

  const {
    isAdmin,
    task,
    gathering,
    group,
    allAssignedPersonsWithStatus,
    confirmedCount,
    isFullyCovered,
    missingCount,
    updateTaskInstruction,
    updateTaskNeededCount,
  } = useAdminTaskDetail(taskId || "");

  const [instruction, setInstruction] = useState<string>("");
  const [neededCountInput, setNeededCountInput] = useState<string>("");
  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (task) {
      setInstruction(task.instruction || task.description || "");
      setNeededCountInput(task.neededCount !== undefined ? String(task.neededCount) : "");
    }
  }, [task]);

  const showFeedback = (text: string, type: "success" | "error" = "success") => setFeedback({ text, type });

  const handleSaveInstruction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task) return;

    setIsSaving(true);
    const res = updateTaskInstruction(instruction);
    setIsSaving(false);

    if (res.success) {
      showFeedback("Instruksen for rollen ble oppdatert!");
    } else {
      showFeedback(res.error || "Kunne ikke lagre instruksen.", "error");
    }
  };

  const handleSaveNeededCount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task) return;

    let parsedCount: number | undefined = undefined;
    if (neededCountInput.trim() !== "") {
      const num = parseInt(neededCountInput.trim(), 10);
      if (isNaN(num) || num < 0) {
        showFeedback("Behov må være et positivt heltall eller tomt.", "error");
        return;
      }
      parsedCount = num;
    }

    const res = updateTaskNeededCount(parsedCount);
    if (res.success) {
      showFeedback(
        parsedCount !== undefined
          ? `Bemanningsbehov satt til ${parsedCount} personer.`
          : "Bemanningsbehov ble tilbakestilt til 'ikke satt'."
      );
    } else {
      showFeedback(res.error || "Kunne ikke lagre bemanningsbehov.", "error");
    }
  };

  // Access denied screen if user is not admin
  if (!isAdmin) {
    return <AdminAccessRequired target="oppgavekortet i admin-flaten" />;
  }

  if (!task) {
    return (
      <StudioDetailNotFound
        backTab="planlegger-oppgaver"
        backLabel="Tilbake til oppgaver"
        title="Fant ikke oppgaven"
        description="Oppgaven kan være slettet eller ID-en er ugyldig."
      />
    );
  }

  const categoryLabel = group
    ? GROUP_CATEGORIES.find((c) => c.id === (group.category || "tjenestegruppe"))?.label || "Tjenestegruppe"
    : "Tjenestegruppe";

  const formattedDate = gathering ? formatNorwegianDateTime(gathering.startsAt) : "Tidspunkt ikke oppgitt";

  return (
    <StudioDetailShell
      backTab="planlegger-oppgaver"
      backLabel="Tilbake til oppgaver"
      badge="Oppgavekort"
      feedback={feedback}
    >
      <div className="space-y-4">
        {/* Main Task Overview Card */}
        <div className={studioDetailCard}>
          {/* Header & Status */}
          <div className="flex items-start justify-between gap-2 border-b border-[var(--studio-border)] pb-3">
            <div>
              <h1 className={studioDetailTitle + " leading-snug"}>{task.title}</h1>
            </div>

            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                isFullyCovered
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : task.status === "vacant"
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}
            >
              {task.neededCount !== undefined
                ? isFullyCovered
                  ? "Fullt dekket"
                  : `Mangler: ${missingCount}`
                : task.status === "confirmed"
                ? "Dekket / Bekreftet"
                : task.status === "vacant"
                ? "Trenger vikar"
                : "Ledig oppgave"}
            </span>
          </div>

          {/* Samling Details */}
          <div className="space-y-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Samling
            </span>
            <div className={studioDetailRow + " space-y-1"}>
              {gathering ? (
                <Link
                  to={"/admin/samling/" + gathering.id}
                  className={studioDetailLink + " transition-colors flex items-center justify-between"}
                >
                  <span>{gathering.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                </Link>
              ) : (
                <p className="font-bold text-[var(--studio-text)]">Ukjent samling</p>
              )}
              <div className="text-[11px] text-[var(--studio-muted)] flex items-center gap-1.5 font-medium">
                <span>{formattedDate}</span>
              </div>
              {gathering?.location && (
                <div className="text-[11px] text-[var(--studio-muted)] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--studio-muted)] shrink-0" />
                  <span>{gathering.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Gruppe Details */}
          <div className="space-y-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
              Gruppe
            </span>
            <div className={studioDetailRow + " flex items-center justify-between"}>
              <div>
                {group ? (
                  <Link
                    to={"/admin/gruppe/" + group.id}
                    id="link-task-group"
                    className={studioDetailLink + " transition-colors flex items-center gap-1"}
                  >
                    {group.name}
                    <ChevronRight className="w-3 h-3 text-[var(--studio-muted)]" />
                  </Link>
                ) : (
                  <span className="font-bold text-[var(--studio-text)]">Ukjent gruppe</span>
                )}
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                {categoryLabel}
              </span>
            </div>
          </div>

          {/* Bemanningsbehov Section */}
          <div className="space-y-2 text-xs border-t border-[var(--studio-border)] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-indigo-600" />
                Bemanningsbehov
              </span>
              <span className="text-[11px] font-bold text-[var(--studio-text)]">
                {task.neededCount !== undefined ? `${task.neededCount} personer` : "Behov ikke satt"}
              </span>
            </div>

            <form onSubmit={handleSaveNeededCount} className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={neededCountInput}
                onChange={(e) => setNeededCountInput(e.target.value)}
                placeholder="F.eks. 2 (eller tomt for 'ikke satt')"
                className={studioDetailInput}
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[var(--studio-surface)] hover:bg-[var(--studio-bg)] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Oppdater behov
              </button>
            </form>
          </div>

          {/* Personstatus for oppgaven */}
          <div className="space-y-2 text-xs border-t border-[var(--studio-border)] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] flex items-center gap-1">
                <Users2 className="w-3.5 h-3.5 text-emerald-600" />
                Personstatus for oppgaven ({allAssignedPersonsWithStatus.length})
              </span>
              <span className="text-[10px] font-semibold text-[var(--studio-muted)]">
                {confirmedCount} bekreftet
              </span>
            </div>

            {allAssignedPersonsWithStatus.length === 0 ? (
              <div className="p-3 bg-[var(--studio-row)] rounded-xl border border-[var(--studio-border)] text-[var(--studio-muted)] italic text-xs">
                Ingen personer er tilknyttet eller forespurt for denne oppgaven ennå.
              </div>
            ) : (
              <div className="space-y-2">
                {allAssignedPersonsWithStatus.map(({ person, assignment, response }) => (
                  <div
                    key={assignment.id}
                    className={studioDetailRow + " flex items-start justify-between gap-2"}
                  >
                    <div className="space-y-0.5">
                      {person ? (
                        <Link
                          to={"/admin/person/" + person.id}
                          className={studioDetailLink + " transition-colors inline-flex items-center gap-1"}
                        >
                          {person.name}
                          <ChevronRight className="w-3 h-3 text-[var(--studio-muted)]" />
                        </Link>
                      ) : (
                        <span className="font-bold text-[var(--studio-text)]">Ukjent person</span>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-[var(--studio-muted)] pt-0.5">
                        {person?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[var(--studio-muted)]" />
                            {person.phone}
                          </span>
                        )}
                        {person?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[var(--studio-muted)]" />
                            {person.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {response !== "confirmed" ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          response === "withdrawn"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : response === "declined"
                            ? "bg-slate-200 text-[var(--studio-text)]"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {response === "withdrawn" ? "Forfall" : response === "declined" ? "Avslått" : "Forespurt"}
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 self-center" title="Bekreftet" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Edit Task Instruction Section */}
        <form onSubmit={handleSaveInstruction} className="space-y-3">
          <section
            id="admin-task-instruction-section"
            className={studioDetailSection}
          >
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
              <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Instruks for rollen
              </span>
            </div>

            {/* Explanatory banner */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">Rollebeskrivelse</p>
                <p className="text-[11px] text-amber-850 mt-0.5">
                  Instruksen beskriver hva personen som har rollen skal gjøre. Den tilhører oppgaven/rollen, og deles av alle som ser eller tildeles oppgaven.
                </p>
              </div>
            </div>

            {/* Textarea for editing instruction */}
            <div className="space-y-1.5">
              <label
                htmlFor="textarea-task-instruction"
                className="text-xs font-bold text-[var(--studio-muted)] block"
              >
                Rediger instruks:
              </label>
              <textarea
                id="textarea-task-instruction"
                rows={5}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Skriv inn en detaljert instruks for hva personen som har denne rollen skal gjøre..."
                className={studioDetailInput}
              />
            </div>

            {/* Save Button */}
            <div className="pt-1">
              <button
                type="submit"
                id="btn-save-task-instruction"
                disabled={isSaving}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Lagrer..." : "Lagre instruks"}
              </button>
            </div>
          </section>
        </form>

        {/* Member View Link for comparison */}
        <div className="p-3 bg-[var(--studio-row)] rounded-2xl border border-[var(--studio-border)] text-center">
          <Link
            to={`/oppgave/${task.id}`}
            id="link-view-task-as-member"
            className="text-xs font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-accent-text)] inline-flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
            Se oppgaven slik frivillige ser den (/oppgave/{task.id})
          </Link>
        </div>
      </div>
    </StudioDetailShell>
  );
};
