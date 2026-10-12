/** One row of the list an administrator downloads. */
export interface PersonListRow {
  name: string;
  phone?: string;
  email?: string;
}

const escapeCell = (value: string): string => {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

/**
 * The visible person list as a file Excel on a Norwegian computer opens:
 * UTF-8 with a mark at the start, so æ, ø and å survive, and a semicolon between columns.
 */
export function personListFile(rows: readonly PersonListRow[]): string {
  const lines = [
    ["Navn", "Telefon", "E-post"],
    ...rows.map((row) => [row.name, row.phone ?? "", row.email ?? ""]),
  ];
  return `\uFEFF${lines.map((line) => line.map(escapeCell).join(";")).join("\r\n")}`;
}
