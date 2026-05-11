import { describe, expect, it } from "vitest";
import { z } from "zod";
import { tenantRoles } from "@/lib/auth/constants";

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
});

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(tenantRoles),
});

const assignSchema = z.object({
  userId: z.uuid(),
  role: z.enum(tenantRoles),
});

describe("tenant creation schema", () => {
  it("accepts valid name and slug", () => {
    const result = tenantSchema.safeParse({ name: "Cohen CPA", slug: "cohen-cpa" });
    expect(result.success).toBe(true);
  });

  it("rejects slug with uppercase letters", () => {
    const result = tenantSchema.safeParse({ name: "Cohen CPA", slug: "Cohen-CPA" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = tenantSchema.safeParse({ name: "Cohen CPA", slug: "cohen cpa" });
    expect(result.success).toBe(false);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = tenantSchema.safeParse({ name: "A", slug: "valid-slug" });
    expect(result.success).toBe(false);
  });

  it("rejects empty slug", () => {
    const result = tenantSchema.safeParse({ name: "Valid Name", slug: "" });
    expect(result.success).toBe(false);
  });
});

describe("invite member schema", () => {
  it("accepts valid email and role", () => {
    const result = inviteSchema.safeParse({ email: "test@example.com", role: "staff" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = inviteSchema.safeParse({ email: "not-an-email", role: "staff" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown role", () => {
    const result = inviteSchema.safeParse({ email: "test@example.com", role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of tenantRoles) {
      const result = inviteSchema.safeParse({ email: "test@example.com", role });
      expect(result.success).toBe(true);
    }
  });
});

describe("assign member by userId schema", () => {
  it("accepts valid UUID and role", () => {
    const result = assignSchema.safeParse({
      userId: "123e4567-e89b-12d3-a456-426614174000",
      role: "tenant_admin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID string", () => {
    const result = assignSchema.safeParse({ userId: "not-a-uuid", role: "staff" });
    expect(result.success).toBe(false);
  });
});
