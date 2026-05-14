import { describe, expect, it } from "vitest";

import { parseOfficeClientsCsv, splitCsvLine } from "@/lib/csv/parse-office-clients-csv";

describe("splitCsvLine", () => {
  it("splits simple comma-separated values", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(splitCsvLine(`id,name,tax_id\n1,"Acme, LLC",123`.split("\n")[1]!)).toEqual([
      "1",
      "Acme, LLC",
      "123",
    ]);
  });
});

describe("parseOfficeClientsCsv", () => {
  it("parses header and rows", () => {
    const csv = "id,name,tax_id\n,New Co,\n00000000-0000-0000-0000-000000000099,Old Co,9";
    const { headers, rows } = parseOfficeClientsCsv(csv);
    expect(headers).toContain("id");
    expect(headers).toContain("name");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: null, name: "New Co", tax_id: null });
    expect(rows[1]?.id).toBe("00000000-0000-0000-0000-000000000099");
    expect(rows[1]?.name).toBe("Old Co");
    expect(rows[1]?.tax_id).toBe("9");
  });
});
