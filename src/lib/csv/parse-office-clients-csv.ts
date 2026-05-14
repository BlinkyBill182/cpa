/** Split one CSV line respecting double-quoted fields. */
export const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

export type OfficeClientCsvRow = {
  id: string | null;
  name: string;
  tax_id: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

export const parseOfficeClientsCsv = (text: string): { headers: string[]; rows: OfficeClientCsvRow[] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map(norm);
  const idIdx = headers.indexOf("id");
  const nameIdx = headers.indexOf("name");
  if (nameIdx < 0) {
    return { headers, rows: [] };
  }
  const taxIdx = headers.indexOf("tax_id");

  const rows: OfficeClientCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) continue;
    const rawId = idIdx >= 0 ? (cells[idIdx] ?? "").trim() : "";
    const id = rawId.length > 0 ? rawId : null;
    const taxRaw = taxIdx >= 0 ? (cells[taxIdx] ?? "").trim() : "";
    const tax_id = taxRaw.length > 0 ? taxRaw : null;
    rows.push({ id, name, tax_id });
  }

  return { headers, rows };
};
