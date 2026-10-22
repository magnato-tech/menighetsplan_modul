const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** A service counts as «Pågår nå» for this long after it starts. */
const ONGOING_MS = 2 * HOUR_MS;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Text for the countdown pill: days, hours and minutes until the start,
 * «Om 25 minutter» under an hour, «Pågår nå» while it runs, and "" once it is over.
 */
export function countdownText(start: Date, now: Date): string {
  const startMs = start.getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return "";

  if (nowMs >= startMs && nowMs < startMs + ONGOING_MS) return "Pågår nå";
  if (nowMs >= startMs) return "";

  const diff = startMs - nowMs;
  if (diff < HOUR_MS) {
    return `Om ${plural(Math.max(1, Math.floor(diff / MINUTE_MS)), "minutt", "minutter")}`;
  }

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diff % HOUR_MS) / MINUTE_MS);
  const parts: string[] = [];
  if (days > 0) parts.push(plural(days, "dag", "dager"));
  parts.push(plural(hours, "time", "timer"));
  parts.push(plural(minutes, "minutt", "minutter"));
  return `Om ${parts.join(" · ")}`;
}
