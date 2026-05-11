import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePlatformOwner, requireTenantAccess, requireUser } from "@/lib/auth/session";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/constants";
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

const SLUG_PREFIX = "test-session-guards";
const OWNER_EMAIL = `owner-guards-${Date.now()}@test.example`;
const MEMBER_EMAIL = `member-guards-${Date.now()}@test.example`;
const OUTSIDER_EMAIL = `outsider-guards-${Date.now()}@test.example`;
const PASSWORD = "TestPassword123!";

let ownerUserId: string;
let memberUserId: string;
let outsiderUserId: string;
let tenantId: string;

const mockCookiesWithSession = (accessToken: string) => {
  vi.mocked(cookies).mockReturnValue({
    get: vi.fn((name: string) => {
      if (name === "sb-access-token") return { name, value: accessToken };
      return undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never);
};

const mockSupabaseServerClient = (accessToken: string) => {
  const env = getPublicSupabaseEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
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
  await cleanupTestTenants(SLUG_PREFIX);
  if (ownerUserId) await deleteTestUser(ownerUserId);
  if (memberUserId) await deleteTestUser(memberUserId);
  if (outsiderUserId) await deleteTestUser(outsiderUserId);
});

describe("requirePlatformOwner", () => {
  it("redirects to home when user is not a platform owner", async () => {
    const { session } = await signInTestUser(MEMBER_EMAIL, PASSWORD);

    vi.mock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(() =>
        Promise.resolve(mockSupabaseServerClient(session!.access_token)),
      ),
    }));

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
    const { session } = await signInTestUser(MEMBER_EMAIL, PASSWORD);

    vi.mock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(() =>
        Promise.resolve(mockSupabaseServerClient(session!.access_token)),
      ),
    }));

    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(() => []),
    } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never);

    try {
      await requireTenantAccess("en");
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "tenant_required");
    }
  });

  it("redirects when user is not a member of the active tenant", async () => {
    const { session } = await signInTestUser(OUTSIDER_EMAIL, PASSWORD);

    vi.mock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(() =>
        Promise.resolve(mockSupabaseServerClient(session!.access_token)),
      ),
    }));

    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name: string) => {
        if (name === ACTIVE_TENANT_COOKIE) return { name, value: tenantId };
        return undefined;
      }),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(() => []),
    } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never);

    try {
      await requireTenantAccess("en");
      expect.fail("Expected redirect");
    } catch (error) {
      expectRedirectTo(error, "tenant_access");
    }
  });
});
