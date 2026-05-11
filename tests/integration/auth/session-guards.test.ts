import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import {
  cleanupTestTenants,
  createTestUser,
  deleteTestUser,
  getTestAdmin,
  signInTestUser,
} from "../../helpers/supabase";
import { expectRedirectTo } from "../../helpers/redirect";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

const SLUG_PREFIX = "test-session-guards";
const OWNER_EMAIL = `owner-guards-${Date.now()}@test.example`;
const MEMBER_EMAIL = `member-guards-${Date.now()}@test.example`;
const OUTSIDER_EMAIL = `outsider-guards-${Date.now()}@test.example`;
const PASSWORD = "TestPassword123!";

let ownerUserId: string;
let memberUserId: string;
let outsiderUserId: string;
let tenantId: string;

const makeServerClientFor = (accessToken: string) => {
  const env = getPublicSupabaseEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
};

beforeEach(async () => {
  const admin = getTestAdmin();

  const owner = await createTestUser(OWNER_EMAIL, PASSWORD);
  ownerUserId = owner.id;
  await admin.from("profiles").upsert({ id: ownerUserId, is_platform_owner: true });

  const member = await createTestUser(MEMBER_EMAIL, PASSWORD);
  memberUserId = member.id;

  const outsider = await createTestUser(OUTSIDER_EMAIL, PASSWORD);
  outsiderUserId = outsider.id;

  const { data: tenant } = await admin
    .from("tenants")
    .insert({
      name: "Guards Test Tenant",
      slug: `${SLUG_PREFIX}-${Date.now()}`,
      created_by: ownerUserId,
    })
    .select("id")
    .single();

  tenantId = tenant!.id;

  await admin
    .from("tenant_memberships")
    .insert({ tenant_id: tenantId, user_id: memberUserId, role: "staff" });
});

afterEach(async () => {
  vi.clearAllMocks();
  await cleanupTestTenants(SLUG_PREFIX);
  if (ownerUserId) await deleteTestUser(ownerUserId);
  if (memberUserId) await deleteTestUser(memberUserId);
  if (outsiderUserId) await deleteTestUser(outsiderUserId);
});

describe("requirePlatformOwner", () => {
  it("redirects to home when user is not a platform owner", async () => {
    const { requirePlatformOwner } = await import("@/lib/auth/session");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    const { session } = await signInTestUser(MEMBER_EMAIL, PASSWORD);
    const client = makeServerClientFor(session!.access_token);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    try {
      await requirePlatformOwner("en");
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "/en");
    }
  });
});

describe("requireTenantAccess", () => {
  it("redirects when no active tenant cookie is set", async () => {
    const { requireTenantAccess } = await import("@/lib/auth/session");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const { getActiveTenant } = await import("@/lib/auth/tenant-context");

    const { session } = await signInTestUser(MEMBER_EMAIL, PASSWORD);
    const client = makeServerClientFor(session!.access_token);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(getActiveTenant).mockResolvedValue(null);

    try {
      await requireTenantAccess("en");
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "tenant_required");
    }
  });

  it("redirects when user is not a member of the active tenant", async () => {
    const { requireTenantAccess } = await import("@/lib/auth/session");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const { getActiveTenant } = await import("@/lib/auth/tenant-context");

    const { session } = await signInTestUser(OUTSIDER_EMAIL, PASSWORD);
    const client = makeServerClientFor(session!.access_token);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(getActiveTenant).mockResolvedValue(tenantId);

    try {
      await requireTenantAccess("en");
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "tenant_access");
    }
  });
});
