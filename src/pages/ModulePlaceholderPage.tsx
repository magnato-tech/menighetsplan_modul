import React from "react";
import { Link } from "react-router-dom";
import { Calendar, MessageSquare, ArrowLeft, ToggleLeft } from "lucide-react";
import { useModuleConfig } from "../hooks/useAppHooks";

interface Props {
  module: "kalender" | "meldinger";
}

export const ModulePlaceholderPage: React.FC<Props> = ({ module }) => {
  const { kalender, meldinger } = useModuleConfig();
  const isEnabled = module === "kalender" ? kalender === "on" : meldinger === "on";

  const isKalender = module === "kalender";
  const title = isKalender ? "Kalender" : "Meldinger";
  const stubMessage = isKalender ? "Kalender kommer snart" : "Meldinger kommer snart";
  const description = isKalender
    ? "Denne modulen er slått på. Full kalendervisning kommer i en senere versjon."
    : "Denne modulen er slått på. Meldinger på tvers av grupper kommer i en senere versjon.";

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              {isKalender ? (
                <Calendar className="w-4 h-4 text-emerald-600" />
              ) : (
                <MessageSquare className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{title}</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Valgfri modul
              </span>
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isEnabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            Status: {isEnabled ? "På (on)" : "Av (off)"}
          </span>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
            {isKalender ? (
              <Calendar className="w-6 h-6 text-slate-600" />
            ) : (
              <MessageSquare className="w-6 h-6 text-slate-600" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">{stubMessage}</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {description}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              to="/minside"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til Min side
            </Link>
            <Link
              to="/admin/settings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ToggleLeft className="w-4 h-4" />
              Modulinnstillinger
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
