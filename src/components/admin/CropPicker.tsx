import React, { useRef, useState } from "react";
import { Crop as CropIcon } from "lucide-react";
import { useResolvedMediaUrl } from "../../hooks/useMediaMap";
import { cropFromRect, formatCrop, objectStyleOf, parseCrop, visibleRect, type Crop, type PictureRect } from "../../utils/focusPoint";

interface CropPickerProps {
  /** The picture: an address, or a picture from the media library. */
  image: string;
  /** The crop as stored, "x% y%" or "x% y% z". The middle, without zoom, when not chosen. */
  value?: string;
  onChange: (value: string) => void;
  /** Width over height of the place the picture is shown, 16:9 unless chosen. */
  aspect?: number;
  /** The heading, «Endre utsnitt» unless chosen. */
  label?: string;
}

/** How far an arrow key moves the frame, as a share of the whole picture. */
const ARROW_STEP = 0.02;

const within = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));

/**
 * The frame over the whole picture is the part that is shown. It is dragged to move, and the zoom makes it
 * smaller, so the picture fills more of the place. The result is stored as the crop, and the live box shows it.
 */
export const CropPicker: React.FC<CropPickerProps> = ({ image, value, onChange, aspect = 16 / 9, label = "Endre utsnitt" }) => {
  const src = useResolvedMediaUrl(image);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Where a drag began: the frame as it stood, and the size of the picture on screen
  const drag = useRef<{ pointerX: number; pointerY: number; boxWidth: number; boxHeight: number; rect: PictureRect } | null>(null);

  if (!src) return null;
  const crop: Crop = parseCrop(value) ?? { x: 50, y: 50, zoom: 1 };
  const rect = natural ? visibleRect(natural, aspect, crop) : null;

  const commit = (left: number, top: number, width: number, height: number, zoom: number) => {
    onChange(formatCrop({ ...cropFromRect(left, top, width, height), zoom }));
  };

  const moveFrame = (left: number, top: number, current: PictureRect) => {
    commit(within(left, 1 - current.width), within(top, 1 - current.height), current.width, current.height, crop.zoom);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const box = boxRef.current?.getBoundingClientRect();
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, boxWidth: Math.max(1, box?.width ?? 1), boxHeight: Math.max(1, box?.height ?? 1), rect };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const { rect: from } = start;
    moveFrame(
      from.left + (event.clientX - start.pointerX) / start.boxWidth,
      from.top + (event.clientY - start.pointerY) / start.boxHeight,
      from
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rect) return;
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-ARROW_STEP, 0],
      ArrowRight: [ARROW_STEP, 0],
      ArrowUp: [0, -ARROW_STEP],
      ArrowDown: [0, ARROW_STEP],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    moveFrame(rect.left + step[0], rect.top + step[1], rect);
  };

  // The zoom keeps the middle of the frame where it is, so the frame shrinks around its centre
  const changeZoom = (zoom: number) => {
    if (!natural || !rect) {
      onChange(formatCrop({ ...crop, zoom }));
      return;
    }
    const next = visibleRect(natural, aspect, { x: 50, y: 50, zoom });
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    commit(
      within(centreX - next.width / 2, 1 - next.width),
      within(centreY - next.height / 2, 1 - next.height),
      next.width,
      next.height,
      zoom
    );
  };

  return (
    <div className="space-y-2" data-crop-picker>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold flex items-center gap-1.5 text-[var(--studio-text)]">
          <CropIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[10px] font-semibold cursor-pointer hover:underline text-[var(--studio-muted)]"
        >
          Tilbakestill
        </button>
      </div>

      <div ref={boxRef} className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-black/10 select-none">
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          className="block h-auto max-h-[260px] max-w-full object-contain pointer-events-none"
        />
        {rect && (
          // The veil is the frame's shadow, which the box clips to the picture
          <div
            role="group"
            tabIndex={0}
            aria-label={`Utsnitt, ${Math.round(crop.zoom * 10) / 10} ganger zoom. Dra rammen eller bruk piltastene.`}
            data-crop-frame
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="absolute cursor-move touch-none border-2 border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            style={{
              left: `${rect.left * 100}%`,
              top: `${rect.top * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
            }}
          />
        )}
      </div>

      <label className="flex items-center gap-3 text-[11px] font-semibold text-[var(--studio-text)]">
        <span className="shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={crop.zoom}
          aria-label="Zoom"
          onChange={(event) => changeZoom(Number(event.target.value))}
          className="w-full accent-indigo-600"
        />
      </label>

      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-[var(--studio-muted)]">Slik blir det</span>
        <div className="relative w-44 max-w-full overflow-hidden rounded-lg border border-black/10 bg-stone-200" style={{ aspectRatio: `${aspect}` }}>
          <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={objectStyleOf(value)} />
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-[var(--studio-muted)]">Dra rammen dit bildet skal vises, og bruk Zoom for å gå nærmere.</p>
    </div>
  );
};
