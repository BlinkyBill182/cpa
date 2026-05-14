/** Strip BOM and whitespace from a header cell. */
export const normalizeHeaderCell = (s: string) => s.trim().replace(/^\ufeff/, "");

/** Split one CSV record line respecting double-quoted fields (single-line record). */
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

/**
 * Split file into logical CSV records so quoted fields may contain newlines
 * (common for Google Sheets exports).
 */
export const splitCsvRecords = (text: string): string[] => {
  const records: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
          cur += c;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
      cur += c;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (cur.trim().length > 0) records.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim().length > 0) records.push(cur);
  return records;
};

const isNameHeader = (h: string) => {
  const x = normalizeHeaderCell(h);
  return x === "שם" || x.toLowerCase() === "name";
};

const isTaxIdHeader = (h: string) => {
  const x = normalizeHeaderCell(h);
  return x === "ת.ז" || x.toLowerCase() === "tax_id";
};

const isIdHeader = (h: string) => normalizeHeaderCell(h).toLowerCase() === "id";

export type OfficeClientCsvRow = {
  /** Our row UUID when present in CSV (optional). */
  id: string | null;
  name: string;
  /** National / company ID (ת.ז, tax_id column). */
  tax_id: string | null;
};

export const parseOfficeClientsCsv = (
  text: string,
): { headers: string[]; rows: OfficeClientCsvRow[] } => {
  const records = splitCsvRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const rawHeaders = splitCsvLine(records[0]);
  const headers = rawHeaders.map(normalizeHeaderCell);

  let nameIdx = -1;
  let taxIdx = -1;
  let idIdx = -1;
  for (let j = 0; j < rawHeaders.length; j++) {
    const cell = rawHeaders[j] ?? "";
    if (nameIdx < 0 && isNameHeader(cell)) nameIdx = j;
    if (taxIdx < 0 && isTaxIdHeader(cell)) taxIdx = j;
    if (idIdx < 0 && isIdHeader(cell)) idIdx = j;
  }

  if (nameIdx < 0) {
    return { headers, rows: [] };
  }

  const rows: OfficeClientCsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cells = splitCsvLine(records[i]);
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
