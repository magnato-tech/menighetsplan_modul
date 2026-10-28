// Cards in columns without gaps: each card goes into the column that is shortest so far. The heights are
// estimates (see estimatedTeamHeight in staffingRoster.ts), so the layout is the same on every screen.

/** The number of columns a width holds: as many as fit at `minWidth`, with `gap` between them, at least one. */
export function columnCountFor(width: number, minWidth = 320, gap = 16): number {
  return Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
}

/**
 * Distributes the cards, in their order, over the columns. Each card goes into the column with the lowest
 * total so far; a tie goes to the leftmost column. Returns the indexes of the cards per column, in order.
 * So the first row reads left to right in the order of the cards.
 */
export function masonryColumns(heights: number[], columnCount: number): number[][] {
  const count = Math.max(1, Math.floor(columnCount));
  const columns: number[][] = Array.from({ length: count }, () => []);
  const totals = Array.from({ length: count }, () => 0);
  heights.forEach((height, index) => {
    let shortest = 0;
    for (let c = 1; c < count; c++) if (totals[c] < totals[shortest]) shortest = c;
    columns[shortest].push(index);
    totals[shortest] += height;
  });
  return columns;
}
