import React from "react";
import { Link } from "react-router-dom";
import { SIGN_IN_PATH } from "../utils/routes";

/** Shown when Min side is turned off for the installation. */
export const MinSideUnavailablePage: React.FC = () => (
  <main className="min-h-[calc(100vh-var(--demo-strip,0px))] flex flex-col items-center justify-center px-6 py-16 text-center bg-slate-100 text-slate-800">
    <h1 className="text-xl font-black tracking-tight">Min side er ikke i bruk</h1>
    <p className="mt-3 max-w-md text-sm text-slate-600">
      Menigheten har slått av Min side i admin. Ta kontakt med administrator hvis du trenger tilgang til oppgaver eller grupper.
    </p>
    <Link to={SIGN_IN_PATH} className="mt-8 text-sm font-bold text-indigo-700 underline underline-offset-2">
      Logg inn
    </Link>
  </main>
);
