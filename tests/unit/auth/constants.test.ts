import { describe, expect, it } from "vitest";
import { ACTIVE_TENANT_COOKIE, tenantRoles } from "@/lib/auth/constants";

describe("tenantRoles", () => {
  it("contains the expected roles", () => {
    expect(tenantRoles).toContain("tenant_admin");
    expect(tenantRoles).toContain("manager");
    expect(tenantRoles).toContain("staff");
    expect(tenantRoles).toContain("reviewer");
    expect(tenantRoles).toContain("contractor");
  });

  it("has exactly five roles", () => {
    expect(tenantRoles).toHaveLength(5);
  });

  it("does not include unexpected roles", () => {
    const unexpectedRoles = ["superadmin", "owner", "admin", "guest"];
    for (const role of unexpectedRoles) {
      expect(tenantRoles).not.toContain(role);
    }
  });
});

describe("ACTIVE_TENANT_COOKIE", () => {
  it("is a non-empty string", () => {
    expect(typeof ACTIVE_TENANT_COOKIE).toBe("string");
    expect(ACTIVE_TENANT_COOKIE.length).toBeGreaterThan(0);
  });

  it("does not contain spaces", () => {
    expect(ACTIVE_TENANT_COOKIE).not.toContain(" ");
  });
});
