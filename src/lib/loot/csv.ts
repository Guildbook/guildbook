/**
 * RFC 4180-style CSV: quoted fields may hold commas, doubled quotes and newlines. Returns one array of cells per record
 * with the 1-based line it started on. Trailing whitespace after a record (RCLootCouncil leaves tabs) is ignored.
 */
export function parseCsv(text: string, delimiter = ","): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let i = 0;

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    const last = cells.length - 1;
    cells[last] = cells[last]!.replace(/[ \t]+$/, "");
    if (cells.some((c) => c.trim() !== "")) records.push({ line: startLine, cells });
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      startLine = line;
    } else {
      cell += ch;
    }
    i++;
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return records;
}
