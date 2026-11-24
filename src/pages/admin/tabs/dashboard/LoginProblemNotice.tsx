import React from "react";
import { Link } from "react-router-dom";
import { studioTabUrl } from "../../studio";

/**
 * The line on Oversikt when someone tried to sign in with an address the register does not know:
 * the number, and the way to the board that deals with it. Nothing is shown when there is none.
 */
export const LoginProblemNotice: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--studio-surface)] border border-amber-500/60">
      <p className="text-sm font-bold text-[var(--studio-text)]">{count} prøvde å logge inn med en ukjent e-postadresse</p>
      <Link
        to={studioTabUrl("planlegger-medlemskap")}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold whitespace-nowrap"
      >
        Gå til Oppgaver
      </Link>
    </div>
  );
};
