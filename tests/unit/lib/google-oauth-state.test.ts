import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  normalizeGoogleOAuthReturnTo,
  signGoogleOAuthState,
  verifyGoogleOAuthState,
} from "@/lib/google-oauth-state";

const originalSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

describe("Google OAuth state", () => {
  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-google-oauth-state-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = originalSecret;
    }
  });

  it("round-trips signed tenant state", async () => {
    const state = await signGoogleOAuthState({
      tenantId: "tenant-123",
      returnTo: "/en/backoffice/tenants/tenant-123",
    });

    await expect(verifyGoogleOAuthState(state)).resolves.toEqual({
      tenantId: "tenant-123",
      returnTo: "/en/backoffice/tenants/tenant-123",
    });
  });

  it("rejects the previous unsigned base64 JSON state format", async () => {
    const forgedState = Buffer.from(
      JSON.stringify({ tenantId: "victim-tenant", returnTo: "/" }),
    ).toString("base64url");

    await expect(verifyGoogleOAuthState(forgedState)).resolves.toBeNull();
  });

  it("normalizes unsafe return paths", () => {
    expect(normalizeGoogleOAuthReturnTo("//evil.example")).toBe("/");
    expect(normalizeGoogleOAuthReturnTo("https://evil.example/path")).toBe("/");
    expect(normalizeGoogleOAuthReturnTo("/safe/path")).toBe("/safe/path");
  });
});
