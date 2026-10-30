import React from "react";
import { Link } from "react-router-dom";
import { SIGN_IN_PATH } from "../utils/routes";

/** Shown on `/` when our public website is off and no external address is configured yet. */
export const ExternalSiteFallbackPage: React.FC = () => (
  <main className="min-h-[calc(100vh-var(--demo-strip,0px))] flex flex-col items-center justify-center px-6 py-16 text-center bg-page text-stone-800">
    <h1 className="text-xl font-black tracking-tight">Planlegging uten nettside her</h1>
    <p className="mt-3 max-w-md text-sm text-stone-600">
      Menigheten bruker en egen nettside. Administrator kan legge inn adressen under Database i admin, eller logge inn for å planlegge.
    </p>
    <Link
      to={SIGN_IN_PATH}
      className="mt-8 inline-flex items-center px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold"
    >
      Logg inn
    </Link>
  </main>
);
