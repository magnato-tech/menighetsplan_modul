import React, { useCallback, useEffect, useState } from "react";

interface HeroBackdropProps {
  /** One to three images. With more than one, the hero fades from one to the next. */
  images: string[];
  /** Read out for the first image. The rest are the same kind of decoration and stay silent. */
  alt?: string;
  /** Each image starts a little enlarged and settles slowly. */
  zoom?: boolean;
  secondsPerImage?: number;
  /** How dark the veil over the picture is (see utils/heroLayout.ts). Dark unless chosen. */
  veil?: "none" | "light" | "dark";
  /** Which image is on show, when the page keeps track of it (see useHeroSlides). Otherwise the backdrop turns by itself. */
  shown?: HeroShown;
}

/** The image on show, and the one fading out (-1 for none). */
export interface HeroShown {
  active: number;
  leaving: number;
}

/** Visitors who have asked their device for less motion get a still image. */
const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Which of the hero images is on show. It turns to the next by itself, unless the visitor has asked for
 * less motion. `go` shows a chosen image, and the clock starts again from there.
 */
export function useHeroSlides(count: number, secondsPerImage = 8) {
  // The image on its way out keeps its zoom while it fades, so it does not jump back to size
  const [shown, setShown] = useState<HeroShown>({ active: 0, leaving: -1 });
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    setShown({ active: 0, leaving: -1 });
  }, [count]);

  useEffect(() => {
    if (count < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setShown(({ active }) => ({ active: (active + 1) % count, leaving: active })),
      secondsPerImage * 1000
    );
    return () => window.clearInterval(timer);
  }, [count, secondsPerImage, restart]);

  const go = useCallback(
    (index: number) => {
      if (count < 2) return;
      const target = ((index % count) + count) % count;
      setShown(({ active }) => (active === target ? { active, leaving: -1 } : { active: target, leaving: active }));
      setRestart((n) => n + 1);
    },
    [count]
  );

  return { shown, go };
}

/**
 * The picture behind the hero: calm rather than busy. One image at a time, a slow zoom out,
 * and a long fade to the next. The dark veil on top keeps the headline readable on any photo.
 */
export const HeroBackdrop: React.FC<HeroBackdropProps> = ({ images, alt = "", zoom = true, secondsPerImage = 8, veil = "dark", shown: shownByPage }) => {
  const count = images.length;
  // Kept by the page when it is given, so the backdrop does not keep a clock of its own as well
  const own = useHeroSlides(shownByPage ? 0 : count, secondsPerImage);
  const shown = shownByPage ?? own.shown;

  if (count === 0) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" data-hero-backdrop>
      {images.map((src, index) => {
        const isActive = index === shown.active;
        const zooms = zoom && (isActive || index === shown.leaving);
        return (
          <img
            key={`${index}-${src}`}
            src={src}
            alt={index === 0 ? alt : ""}
            aria-hidden={isActive ? undefined : true}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ease-in-out ${
              isActive ? "opacity-100" : "opacity-0"
            } ${zooms ? "hero-zoom" : ""}`}
          />
        );
      })}
      {veil === "dark" && <div className="absolute inset-0 bg-gradient-to-t from-stone-900/95 via-stone-900/70 to-stone-900/40" />}
      {veil === "light" && <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 via-stone-900/20 to-stone-900/10" />}
    </div>
  );
};
