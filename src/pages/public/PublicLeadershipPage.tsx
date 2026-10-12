import React from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useCms } from "../../context/CmsContext";
import { publicProfilesOf } from "../../utils/publicProfile";
import { isGroupPublic } from "../../utils/visibility";
import {
  Shield,
  Phone,
  Mail,
  ArrowLeft,
  Briefcase,
  Layers,
  HeartHandshake,
} from "lucide-react";

export const PublicLeadershipPage: React.FC = () => {
  const { groups, allPersons } = useFirebase();
  const { settings } = useCms();

  // Only people who have consented to a public profile are listed, and with
  // their public contact details, never the private ones.
  const getGroupMembersWithRoles = (group: typeof groups[0]) => {
    const leaderIds = new Set(group.leaderIds || []);
    const deputyIds = new Set(group.deputyLeaderIds || []);
    const allIds = Array.from(new Set([...(group.leaderIds || []), ...(group.memberIds || [])]));

    return publicProfilesOf(allIds, allPersons)
      .map((person) => {
        let roleInGroup = "Deltaker";
        if (leaderIds.has(person.id)) roleInGroup = "Leder";
        else if (deputyIds.has(person.id)) roleInGroup = "Nestleder";

        return {
          person,
          roleInGroup,
          isLeader: leaderIds.has(person.id),
        };
      })
      .sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return a.person.name.localeCompare(b.person.name);
      });
  };

  // The leadership groups an admin has not hidden, and that have someone to show
  const ledergrupper = groups.filter(
    (g) => g.category === "ledergruppe" && isGroupPublic(g) && getGroupMembersWithRoles(g).length > 0
  );

  // Specific groups
  const stabsgrupper = ledergrupper.filter(
    (g) => g.name.toLowerCase().includes("stab") || g.tags?.includes("stab")
  );
  const styregrupper = ledergrupper.filter(
    (g) =>
      (g.name.toLowerCase().includes("lederskap") ||
        g.name.toLowerCase().includes("råd") ||
        g.name.toLowerCase().includes("styre")) &&
      !stabsgrupper.some((sg) => sg.id === g.id)
  );
  const gruppeledergrupper = ledergrupper.filter(
    (g) =>
      g.name.toLowerCase().includes("gruppeleder") &&
      !stabsgrupper.some((sg) => sg.id === g.id) &&
      !styregrupper.some((sg) => sg.id === g.id)
  );
  const andreLedergrupper = ledergrupper.filter(
    (g) =>
      !stabsgrupper.some((sg) => sg.id === g.id) &&
      !styregrupper.some((sg) => sg.id === g.id) &&
      !gruppeledergrupper.some((sg) => sg.id === g.id)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <Link
          to="/om-oss"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tilbake til Om menigheten</span>
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>Ledergrupper & Stab</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight">
          Lederskap og medarbeidere
        </h1>
        <p className="text-base sm:text-lg text-stone-600 max-w-2xl font-medium leading-relaxed">
          I {settings.churchName} ledes arbeidet av stabsgruppen, det valgte menighetsrådet og et dedikert lag av gruppeledere.
        </p>
      </div>

      {/* Seksjon 1: Stabsgruppe */}
      <section className="space-y-6">
        <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-800 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Stabsgruppe</h2>
              <p className="text-xs text-stone-500">Menighetens ansatte og koordinerende medarbeidere</p>
            </div>
          </div>
        </div>

        {stabsgrupper.length === 0 ? (
          <p className="text-xs text-stone-500">Ingen kontaktpersoner er lagt ut ennå.</p>
        ) : (
          stabsgrupper.map((group) => {
            const members = getGroupMembersWithRoles(group);
            return (
              <div key={group.id} className="space-y-4">
                {group.description && (
                  <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                    {group.description}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {members.map(({ person, isLeader }) => (
                    <div
                      key={person.id}
                      className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs hover:border-primary-300 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {person.avatarUrl && (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                            <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-50 text-primary-800">
                            {person.title || (isLeader ? "Hovedpastor / Leder" : "Stabsmedlem")}
                          </span>
                          <h3 className="font-bold text-stone-900 text-lg">{person.name}</h3>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-stone-100 flex flex-col gap-1.5 text-xs text-stone-600">
                        {person.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-stone-400" />
                            <a href={`tel:${person.phone}`} className="hover:text-stone-900 font-medium">
                              {person.phone}
                            </a>
                          </div>
                        )}
                        {person.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-stone-400" />
                            <a href={`mailto:${person.email}`} className="hover:text-stone-900 truncate font-medium">
                              {person.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Seksjon 2: Lederskapsgruppe (Menighetsråd & Styre) */}
      <section className="space-y-6 pt-4">
        <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-100 text-accent-800 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Lederskapsgruppe (Menighetsråd)</h2>
              <p className="text-xs text-stone-500">Valgt styre og åndelig lederskap</p>
            </div>
          </div>
        </div>

        {styregrupper.length === 0 ? (
          <p className="text-xs text-stone-500">Ingen kontaktpersoner er lagt ut ennå.</p>
        ) : (
          styregrupper.map((group) => {
            const members = getGroupMembersWithRoles(group);
            return (
              <div key={group.id} className="space-y-4">
                {group.description && (
                  <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                    {group.description}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {members.map(({ person, roleInGroup, isLeader }) => (
                    <div
                      key={person.id}
                      className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs hover:border-accent-300 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-3">
                        {person.avatarUrl && (
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                            <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent-50 text-accent-900">
                            {person.title || (isLeader ? "Menighetsrådsleder" : roleInGroup)}
                          </span>
                          <h4 className="font-bold text-stone-900 text-base">{person.name}</h4>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex flex-col gap-1 text-xs text-stone-500">
                        {person.phone && <div>Tlf: {person.phone}</div>}
                        {person.email && <div className="truncate">E-post: {person.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Seksjon 3: Gruppeledergruppe */}
      {gruppeledergrupper.length > 0 && (
        <section className="space-y-6 pt-4">
          <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900">Gruppeledergruppe</h2>
                <p className="text-xs text-stone-500">Ledere for husgrupper, vekstgrupper og tjenester</p>
              </div>
            </div>
          </div>

          {gruppeledergrupper.map((group) => {
            const members = getGroupMembersWithRoles(group);
            return (
              <div key={group.id} className="space-y-4">
                {group.description && (
                  <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                    {group.description}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {members.map(({ person, isLeader }) => (
                    <div
                      key={person.id}
                      className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-stone-900 text-sm">{person.name}</div>
                        <div className="text-[11px] text-stone-500">
                          {person.title || (isLeader ? "Koordinator" : "Gruppeleder")}
                        </div>
                      </div>
                      {person.phone && (
                        <a
                          href={`tel:${person.phone}`}
                          className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs"
                          title="Ring"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Seksjon 4: Andre ledergrupper */}
      {andreLedergrupper.length > 0 && (
        <section className="space-y-6 pt-4">
          {andreLedergrupper.map((group) => {
            const members = getGroupMembersWithRoles(group);
            return (
              <div key={group.id} className="space-y-3">
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-600" />
                  <span>{group.name}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {members.map(({ person, roleInGroup }) => (
                    <div key={person.id} className="bg-white rounded-xl border p-4">
                      <div className="font-bold text-sm text-stone-900">{person.name}</div>
                      <div className="text-xs text-stone-500">{person.title || roleInGroup}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Info Card */}
      <div className="bg-stone-100 rounded-2xl p-6 sm:p-8 border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-black text-stone-900">Ønsker du kontakt med lederskapet?</h3>
          <p className="text-xs text-stone-600">
            Pastoren og våre ledere er tilgjengelige for personlige samtaler, sjelesorg, bønn eller praktiske spørsmål.
          </p>
        </div>
        <Link
          to="/kontakt"
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0 shadow-xs"
        >
          Kontakt oss
        </Link>
      </div>
    </div>
  );
};
