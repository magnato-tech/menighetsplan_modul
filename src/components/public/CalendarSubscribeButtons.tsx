import React from "react";
import { CalendarPlus, Copy } from "lucide-react";
import { useTimedMessage } from "../../hooks/useTimedMessage";
import { googleCalendarSubscribeUrl } from "../../utils/calendarFeed";

export interface CalendarSubscribeButtonsProps {
  resolveFeedUrl: () => string | null;
  missingMessage?: string;
  tone?: "primary" | "emerald";
  compact?: boolean;
}

const toneClasses = {
  primary: {
    google: "text-white bg-primary-700 hover:bg-primary-800",
    copy: "text-primary-900 border-primary-300 bg-white hover:bg-primary-50",
    hint: "text-primary-900",
  },
  emerald: {
    google: "text-white bg-emerald-700 hover:bg-emerald-800",
    copy: "text-emerald-900 border-emerald-300 bg-white hover:bg-emerald-50",
    hint: "text-emerald-900",
  },
} as const;

export const CalendarSubscribeButtons: React.FC<CalendarSubscribeButtonsProps> = ({
  resolveFeedUrl,
  missingMessage = "Kunne ikke lage kalenderlenken. Prøv igjen.",
  tone = "primary",
  compact = false,
}) => {
  const [hint, showHint] = useTimedMessage<string>();
  const classes = toneClasses[tone];
  const textSize = compact ? "text-xs" : "text-[11px]";
  const pad = compact ? "px-3 py-2" : "px-3 py-1.5";

  const handleCopy = () => {
    const url = resolveFeedUrl();
    if (!url) {
      showHint(missingMessage);
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => showHint("Lenken er kopiert. Lim den inn i kalenderappen din, eller i Google under «Fra nettadresse»."),
      () => showHint(url)
    );
  };

  const handleGoogle = () => {
    const url = resolveFeedUrl();
    if (!url) {
      showHint(missingMessage);
      return;
    }
    window.open(googleCalendarSubscribeUrl(url), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGoogle}
          className={`inline-flex items-center gap-1.5 rounded-lg font-bold cursor-pointer ${textSize} ${pad} ${classes.google}`}
        >
          <CalendarPlus className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} />
          Legg til i Google Kalender
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 rounded-lg font-bold border cursor-pointer ${textSize} ${pad} ${classes.copy}`}
        >
          <Copy className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} />
          Kopier abonnementslenke
        </button>
      </div>
      {hint && <p className={`${textSize} font-medium ${classes.hint}`}>{hint}</p>}
    </div>
  );
};
