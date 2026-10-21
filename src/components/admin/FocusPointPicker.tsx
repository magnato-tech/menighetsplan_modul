import React from "react";
import { Crosshair } from "lucide-react";
import { useResolvedMediaUrl } from "../../hooks/useMediaMap";
import { FOCUS_MIDDLE, focusPointFromPress, formatFocusPoint, parseFocusPoint } from "../../utils/focusPoint";

interface FocusPointPickerProps {
  /** The picture: an address, or a picture from the media library. */
  image: string;
  value: string;
  onChange: (value: string) => void;
  /** Dark ground (the admin) or light ground (the event's form). */
  tone?: "dark" | "light";
}

/**
 * Press the most important place in the picture, a face or the words on a poster, and it stays in view
 * when the picture is cut to fit the hero or a card. Without a choice the middle is kept, as before.
 */
export const FocusPointPicker: React.FC<FocusPointPickerProps> = ({ image, value, onChange, tone = "dark" }) => {
  const src = useResolvedMediaUrl(image);
  if (!src) return null;
  const point = parseFocusPoint(value) ?? FOCUS_MIDDLE;
  const chosen = parseFocusPoint(value) !== null;
  const muted = tone === "dark" ? "text-[var(--studio-muted)]" : "text-slate-500";
  const strong = tone === "dark" ? "text-[var(--studio-text)]" : "text-slate-700";

  return (
    <div className="space-y-1.5" data-focus-point-picker>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${strong}`}>
          <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
          Fokuspunkt
        </span>
        {chosen && (
          <button type="button" onClick={() => onChange("")} className={`text-[10px] font-semibold cursor-pointer hover:underline ${muted}`}>
            Midtstill
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={`Velg fokuspunkt i bildet. Nå: ${point.x} % fra venstre, ${point.y} % fra toppen`}
        onClick={(event) => onChange(formatFocusPoint(focusPointFromPress(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())))}
        className="relative block w-full overflow-hidden rounded-lg cursor-crosshair border border-black/10"
      >
        <img src={src} alt="" className="block w-full h-auto select-none pointer-events-none" draggable={false} />
        <span
          aria-hidden="true"
          className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-indigo-600/80 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        />
      </button>
      <p className={`text-[10px] leading-relaxed ${muted}`}>
        Trykk på det viktigste i bildet, for eksempel et ansikt eller teksten på en plakat. Det blir stående synlig når bildet beskjæres.
      </p>
    </div>
  );
};
