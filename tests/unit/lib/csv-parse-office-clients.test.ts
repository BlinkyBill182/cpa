import { describe, expect, it } from "vitest";

import {
  parseOfficeClientsCsv,
  splitCsvLine,
  splitCsvRecords,
} from "@/lib/csv/parse-office-clients-csv";

describe("splitCsvLine", () => {
  it("splits simple comma-separated values", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(splitCsvLine(`1,"Acme, LLC",123`)).toEqual(["1", "Acme, LLC", "123"]);
  });
});

describe("splitCsvRecords", () => {
  it("keeps newlines inside quoted fields as one record", () => {
    const csv = `ת.ז,שם,col\n1,"line A\nline B",x\n2,only,y`;
    const records = splitCsvRecords(csv);
    expect(records).toHaveLength(3);
    expect(splitCsvLine(records[1]!)).toEqual(["1", "line A\nline B", "x"]);
  });
});

describe("parseOfficeClientsCsv", () => {
  it("parses Hebrew headers (שם, ת.ז)", () => {
    const csv = "ת.ז,שם,אחר\n123456,דוגמה א,פ";
    const { headers, rows } = parseOfficeClientsCsv(csv);
    expect(headers[0]).toBe("ת.ז");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: null, name: "דוגמה א", tax_id: "123456" });
  });

  it("still parses English id,name,tax_id", () => {
    const csv = "id,name,tax_id\n,New Co,\n00000000-0000-0000-0000-000000000099,Old Co,9";
    const { rows } = parseOfficeClientsCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: null, name: "New Co", tax_id: null });
    expect(rows[1]?.id).toBe("00000000-0000-0000-0000-000000000099");
  });
});
