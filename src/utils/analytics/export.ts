import { parseIsoToDateAndTime } from "../dates";
import type { CountedGathering } from "./attendance";

// ============================================================================
// Export
// ============================================================================

function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? "" : String(value);
  // A spreadsheet runs text that starts like a formula; an apostrophe keeps it text
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The counted gatherings as a semicolon-separated table, the way Norwegian spreadsheets
 * open it. A gathering without a count has empty number cells, never a zero.
 */
export function headcountCsv(rows: CountedGathering[]): string {
  const header = ["Dato", "Klokkeslett", "Samling", "Type", "Voksne", "Barn", "Totalt", "Merknad"];
  const lines = rows.map((row) => {
    const { date, time } = parseIsoToDateAndTime(row.gathering.startsAt);
    return [
      date,
      time,
      row.gathering.title,
      row.isWorship ? "Gudstjeneste" : "Arrangement",
      row.headcount?.adults,
      row.headcount?.children,
      row.total,
      row.headcount?.note,
    ]
      .map(csvCell)
      .join(";");
  });
  return [header.join(";"), ...lines].join("\r\n");
}
