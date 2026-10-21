import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { toPublicProfile, publicProfilesOf } from "../../../utils/publicProfile";
import {
  Users,
  Shield,
  Briefcase,
  ExternalLink,
  Edit2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import { ShowFeedback } from "../studio";

interface StaffTabProps {
  showFeedback: ShowFeedback;
}

export const StaffTab: React.FC<StaffTabProps> = ({ showFeedback }) => {
  const { allPersons, groups, updatePerson } = useFirebase();
  // No button here fills the register with made-up persons: in a congregation's own app one press would put
  // invented persons among the real ones. The demo is filled from Database og Testdata, in demo mode only.

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [selectedPersonIdToAdd, setSelectedPersonIdToAdd] = useState<string>("");

  // 1. Staff members (isStaff === true, or fallback to persons with staffRole)
  const staffPersons = allPersons.filter((p) => p.isStaff || (p.staffRole && p.isPublicProfile));

  // 2. Leadership group (Menighetsråd & Lederskap)
  const leadershipGroup =
    groups.find((g) => g.id === "group-lederskap" || g.name.toLowerCase().includes("lederskap")) ||
    groups.find((g) => g.category === "ledergruppe");

  const leaderIds = new Set(leadershipGroup?.leaderIds || []);
  const deputyIds = new Set(leadershipGroup?.deputyLeaderIds || []);
  const leadershipMemberIds = Array.from(
    new Set([...(leadershipGroup?.leaderIds || []), ...(leadershipGroup?.memberIds || [])])
  );
  const leadershipPersons = publicProfilesOf(leadershipMemberIds, allPersons).map((p) => {
    let role = p.title || "Rådsmedlem";
    if (leaderIds.has(p.id)) role = p.title || "Leder i menighetsrådet";
    else if (deputyIds.has(p.id)) role = p.title || "Nestleder";
    return {
      ...p,
      roleInGroup: role,
      isLeader: leaderIds.has(p.id),
    };
  });

  // Non-staff persons that can be added
  const availableNonStaffPersons = allPersons.filter((p) => !staffPersons.some((sp) => sp.id === p.id));

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(text);
    showFeedback(`Kopierte «${text}» til utklippstavlen!`);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleAddPersonAsStaff = () => {
    if (!selectedPersonIdToAdd) return;
    const res = updatePerson(selectedPersonIdToAdd, {
      isStaff: true,
      staffRole: "Medarbeider",
      isPublicProfile: true,
    });
    if (res.success) {
      showFeedback("Personen er nå registrert som ansatt i staben!");
      setShowAddStaffModal(false);
      setSelectedPersonIdToAdd("");
    } else {
      showFeedback(res.error || "Kunne ikke legge til som ansatt.", "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)] flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Lederskap & Stab</span>
          </h2>
          <p className="text-xs text-[var(--studio-muted)] mt-1 max-w-2xl leading-relaxed">
            Her administreres menighetens ansatte (stab) og valgte lederskap (menighetsråd). Dataene hentes direkte fra
            personregisteret og gruppene, slik at du slipper dobbeltarbeid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddStaffModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Legg til person i staben</span>
          </button>
        </div>
      </div>

      {/* Seksjon 1: Ansatte i staben */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--studio-icon)]" />
            <h3 className="text-sm font-bold text-[var(--studio-text)] uppercase tracking-wider">
              Ansatte i staben ({staffPersons.length})
            </h3>
          </div>
          <span className="text-[11px] text-[var(--studio-muted)]">
            Definert av rolle/ansettelse på personkortet
          </span>
        </div>

        {staffPersons.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[var(--studio-row)] border border-[var(--studio-border)] text-center space-y-2">
            <p className="text-xs text-[var(--studio-muted)]">Ingen personer er registrert som ansatt i staben ennå.</p>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="text-xs text-[var(--studio-icon)] font-bold hover:underline"
            >
              + Merk en person fra registeret som stab
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {staffPersons.map((person) => {
              const isConsented = toPublicProfile(person) !== null;
              return (
                <div
                  key={person.id}
                  className="p-4 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {person.avatarUrl ? (
                        <img
                          src={person.avatarUrl}
                          alt={person.name}
                          className="w-12 h-12 rounded-xl object-cover border border-[var(--studio-border)] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[var(--studio-hover)] text-[var(--studio-accent-text)] font-black text-base flex items-center justify-center shrink-0">
                          {person.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[var(--studio-text)] text-sm truncate">{person.name}</h4>
                        <p className="text-xs text-[var(--studio-icon)] font-semibold truncate">
                          {person.staffRole || person.publicTitle || "Stabsmedlem"}
                        </p>
                        <div className="pt-1 flex items-center gap-1.5 text-[10px]">
                          {isConsented ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Synlig på nettsiden
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              Mangler samtykke
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {person.staffBio && (
                      <p className="text-[11px] text-[var(--studio-muted)] line-clamp-2 leading-relaxed">
                        {person.staffBio}
                      </p>
                    )}

                    <div className="text-[11px] text-[var(--studio-muted)] space-y-0.5 pt-1 border-t border-[var(--studio-border)]">
                      {person.publicPhone && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 text-[var(--studio-muted)]" />
                          <span>{person.publicPhone}</span>
                        </div>
                      )}
                      {person.publicEmail && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-[var(--studio-muted)]" />
                          <span className="truncate">{person.publicEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--studio-border)] flex items-center justify-between text-xs">
                    <span className="text-[10px] text-[var(--studio-muted)] uppercase font-mono">
                      {person.staffCategory || "stab"}
                    </span>
                    <Link
                      to={`/admin/person/${person.id}`}
                      className="px-2.5 py-1 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Rediger personkort</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Seksjon 2: Lederskap (Menighetsråd) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-[var(--studio-text)] uppercase tracking-wider">
              Valgt Lederskap / Menighetsråd ({leadershipPersons.length})
            </h3>
          </div>
          {leadershipGroup && (
            <Link
              to="/admin?tab=planlegger-grupper"
              className="text-[11px] text-[var(--studio-icon)] hover:text-[var(--studio-accent-text)] font-semibold flex items-center gap-1"
            >
              <span>Administrer lederskapsgruppen</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        {leadershipPersons.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[var(--studio-row)] border border-[var(--studio-border)] text-center space-y-1">
            <p className="text-xs text-[var(--studio-muted)]">Ingen deltakere funnet i lederskapsgruppen.</p>
            <Link to="/admin?tab=planlegger-grupper" className="text-xs text-[var(--studio-icon)] font-bold hover:underline">
              Gå til Grupper & Husfellesskap for å legge til deltakere
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {leadershipPersons.map((member) => (
              <div
                key={member.id}
                className="p-4 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start gap-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-xl object-cover border border-[var(--studio-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-950/80 text-amber-400 font-black text-sm flex items-center justify-center shrink-0 border border-amber-900/60">
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[var(--studio-text)] text-sm truncate">{member.name}</h4>
                    <p className="text-xs text-amber-300 font-medium truncate">{member.roleInGroup}</p>
                    {member.email && <p className="text-[11px] text-[var(--studio-muted)] truncate mt-1">{member.email}</p>}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--studio-border)] flex items-center justify-end text-xs">
                  <Link
                    to={`/admin/person/${member.id}`}
                    className="px-2.5 py-1 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Rediger profil</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seksjon 3: Innholdsblokker for nettsiden */}
      <section className="p-5 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] space-y-3">
        <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
          <Copy className="w-4 h-4 text-[var(--studio-icon)]" />
          <span>Slik setter du inn stab og lederskap på CMS-sider</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Når du redigerer en side under <strong>Sider & Innhold</strong> (f.eks. «Stab» eller «Om oss»), kan du klikke{" "}
          <strong>+ Sett inn innholdsblokk</strong> og velge en av personblokkene. Du kan også lime inn disse kodene
          direkte i teksten:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-[var(--studio-text)]">Hele staben</div>
              <code className="text-xs font-mono text-[var(--studio-accent-text)] bg-[var(--studio-panel-bg)] px-1.5 py-0.5 rounded block my-1">
                :::personer[stab]
              </code>
              <p className="text-[10px] text-[var(--studio-muted)]">Brukes f.eks. på siden «Stab» under Om menigheten.</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(":::personer[stab]")}
              className="mt-2 w-full py-1 text-[11px] font-bold rounded bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] transition-colors cursor-pointer"
            >
              {copiedSnippet === ":::personer[stab]" ? "Kopiert!" : "Kopier kode"}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-[var(--studio-text)]">Kun Pastor</div>
              <code className="text-xs font-mono text-emerald-300 bg-[var(--studio-panel-bg)] px-1.5 py-0.5 rounded block my-1">
                :::personer[pastor]
              </code>
              <p className="text-[10px] text-[var(--studio-muted)]">Brukes f.eks. på Om oss-siden eller forsiden.</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(":::personer[pastor]")}
              className="mt-2 w-full py-1 text-[11px] font-bold rounded bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] transition-colors cursor-pointer"
            >
              {copiedSnippet === ":::personer[pastor]" ? "Kopiert!" : "Kopier kode"}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-[var(--studio-text)]">Valgt Lederskap</div>
              <code className="text-xs font-mono text-amber-300 bg-[var(--studio-panel-bg)] px-1.5 py-0.5 rounded block my-1">
                :::personer[lederskap]
              </code>
              <p className="text-[10px] text-[var(--studio-muted)]">Brukes f.eks. på siden «Lederskap» for menighetsrådet.</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(":::personer[lederskap]")}
              className="mt-2 w-full py-1 text-[11px] font-bold rounded bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] transition-colors cursor-pointer"
            >
              {copiedSnippet === ":::personer[lederskap]" ? "Kopiert!" : "Kopier kode"}
            </button>
          </div>
        </div>
      </section>

      {/* Modal: Velg person fra registeret og merk som stab */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Legg til person i staben</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--studio-muted)]">
              Velg en person fra personregisteret for å registrere vedkommende som ansatt i staben:
            </p>

            <select
              value={selectedPersonIdToAdd}
              onChange={(e) => setSelectedPersonIdToAdd(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs rounded-xl"
            >
              <option value="">-- Velg person --</option>
              {availableNonStaffPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone || p.email || "Ingen kontaktinfo"})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] text-xs"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!selectedPersonIdToAdd}
                onClick={handleAddPersonAsStaff}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
              >
                Legg til som stab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
