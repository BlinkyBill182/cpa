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

const SLUG_PREFIX = "test-session-guards";
const OWNER_EMAIL = `owner-guards-${Date.now()}@test.example`;
const MEMBER_EMAIL = `member-guards-${Date.now()}@test.example`;
const OUTSIDER_EMAIL = `outsider-guards-${Date.now()}@test.example`;
const PASSWORD = "TestPassword123!";

let ownerUserId: string;
let memberUserId: string;
let outsiderUserId: string;
let tenantSlug: string;

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

  tenantSlug = `${SLUG_PREFIX}-${Date.now()}`;

  const { data: tenant } = await admin
    .from("tenants")
    .insert({
      name: "Guards Test Tenant",
      slug: tenantSlug,
      created_by: ownerUserId,
    })
    .select("id")
    .single();

  await admin
    .from("tenant_memberships")
    .insert({ tenant_id: tenant!.id, user_id: memberUserId, role: "staff" });
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

describe("requireTenantAccessBySlug", () => {
  it("calls notFound when the slug does not match any tenant", async () => {
    const { requireTenantAccessBySlug } = await import("@/lib/auth/session");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    const { session } = await signInTestUser(MEMBER_EMAIL, PASSWORD);
    const client = makeServerClientFor(session!.access_token);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    try {
      await requireTenantAccessBySlug("en", "slug-that-does-not-exist");
      expect.fail("Expected notFound");
    } catch (error) {
      expect((error as Error).message).toMatch(/not.?found/i);
    }
  });

  it("redirects when user is not a member of the tenant", async () => {
    const { requireTenantAccessBySlug } = await import("@/lib/auth/session");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    const { session } = await signInTestUser(OUTSIDER_EMAIL, PASSWORD);
    const client = makeServerClientFor(session!.access_token);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    try {
      await requireTenantAccessBySlug("en", tenantSlug);
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "tenant_access");
    }
  });
});
