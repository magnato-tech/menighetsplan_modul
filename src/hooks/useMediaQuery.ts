import { useEffect, useState } from "react";

/**
 * Whether the screen matches a media query, following it as the window changes. Where the browser
 * cannot tell (a test, the server), it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const read = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}
