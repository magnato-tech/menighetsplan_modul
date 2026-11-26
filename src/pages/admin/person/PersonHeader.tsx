import type { ChangeEvent } from "react";
import { Camera, Mail } from "lucide-react";
import type { Group, Person } from "../../../types";
import { studioDetailCard, studioDetailMuted, studioDetailTitle, studioSecondaryButton } from "../studioDetailTheme";

interface PersonHeaderProps {
  person: Person;
  clerkOnly: boolean;
  avatarUrl: string;
  showsRole: boolean;
  roleLabel: string;
  leaderGroups: Group[];
  handleImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  sendEmail: () => void;
}

// The fixed header of the card: picture, name, role badges and «Send e-post»
export function PersonHeader({ person, clerkOnly, avatarUrl, showsRole, roleLabel, leaderGroups, handleImageUpload, sendEmail }: PersonHeaderProps) {
  return (
    <div className={studioDetailCard}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {!clerkOnly && (
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 shadow-2xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex items-center justify-center text-indigo-700 font-bold text-base">
                  {person.name.charAt(0)}
                </div>
              )}
              <label
                htmlFor="input-avatar-upload"
                className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer shadow-xs"
                title="Last opp portrettbilde"
              >
                <Camera className="w-3 h-3" />
              </label>
              <input
                type="file"
                id="input-avatar-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <h2 className={studioDetailTitle}>{person.name}</h2>
            {clerkOnly ? (
              <p className={studioDetailMuted}>Du kan endre medlemskap i menighet og kirkesamfunn.</p>
            ) : (
              <p className="text-xs text-[var(--studio-muted)] break-words">
                {person.phone || "Ingen mobil"} · {person.email || "Ingen e-post"}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {!clerkOnly && showsRole && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    person.globalRole === "admin" || person.globalRole === "nettredaktor"
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      : "bg-slate-100 text-[var(--studio-text)] border border-[var(--studio-border)]"
                  }`}
                >
                  {roleLabel}
                </span>
              )}
              {person.congregationMember === true && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Medlem
                </span>
              )}
              {!clerkOnly &&
                leaderGroups.map((group) => (
                  <span
                    key={group.id}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-[var(--studio-text)] border border-[var(--studio-border)]"
                  >
                    Leder: {group.name}
                  </span>
                ))}
            </div>
          </div>
        </div>
        {!clerkOnly && (
          <button
            type="button"
            onClick={sendEmail}
            className={`${studioSecondaryButton} shrink-0 flex items-center gap-1.5 self-start`}
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Send e-post
          </button>
        )}
      </div>
    </div>
  );
}
