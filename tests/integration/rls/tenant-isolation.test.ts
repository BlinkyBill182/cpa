import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupTestTenants,
  createTestUser,
  deleteTestUser,
  getTestAdmin,
  getTestAnonClient,
  signInTestUser,
} from "../../helpers/supabase";

const SLUG_PREFIX = "test-rls-isolation";
const OWNER_EMAIL = `owner-rls-${Date.now()}@test.example`;
const TENANT_A_MEMBER_EMAIL = `member-a-rls-${Date.now()}@test.example`;
const TENANT_B_MEMBER_EMAIL = `member-b-rls-${Date.now()}@test.example`;
const PASSWORD = "TestPassword123!";

let ownerUserId: string;
let memberAUserId: string;
let memberBUserId: string;
let tenantAId: string;
let tenantBId: string;

beforeEach(async () => {
  const admin = getTestAdmin();

  const owner = await createTestUser(OWNER_EMAIL, PASSWORD);
  ownerUserId = owner.id;
  await admin.from("profiles").upsert({ id: ownerUserId, is_platform_owner: true });

  const memberA = await createTestUser(TENANT_A_MEMBER_EMAIL, PASSWORD);
  memberAUserId = memberA.id;

  const memberB = await createTestUser(TENANT_B_MEMBER_EMAIL, PASSWORD);
  memberBUserId = memberB.id;

  const ts = Date.now();
  const { data: tenantA } = await admin
    .from("tenants")
    .insert({ name: "Tenant A", slug: `${SLUG_PREFIX}-a-${ts}`, created_by: ownerUserId })
    .select("id")
    .single();
  tenantAId = tenantA!.id;

  const { data: tenantB } = await admin
    .from("tenants")
    .insert({ name: "Tenant B", slug: `${SLUG_PREFIX}-b-${ts}`, created_by: ownerUserId })
    .select("id")
    .single();
  tenantBId = tenantB!.id;

  await admin
    .from("tenant_memberships")
    .insert({ tenant_id: tenantAId, user_id: memberAUserId, role: "staff" });

  await admin
    .from("tenant_memberships")
    .insert({ tenant_id: tenantBId, user_id: memberBUserId, role: "staff" });

  await admin.from("office_clients").insert([
    { tenant_id: tenantAId, name: "Client A1" },
    { tenant_id: tenantBId, name: "Client B1" },
  ]);
});

afterEach(async () => {
  await cleanupTestTenants(SLUG_PREFIX);
  if (ownerUserId) await deleteTestUser(ownerUserId);
  if (memberAUserId) await deleteTestUser(memberAUserId);
  if (memberBUserId) await deleteTestUser(memberBUserId);
});

describe("RLS tenant isolation", () => {
  it("member of tenant A cannot see tenant B clients", async () => {
    const { session } = await signInTestUser(TENANT_A_MEMBER_EMAIL, PASSWORD);
    const client = getTestAnonClient();
    await client.auth.setSession(session!);

    const { data: clients } = await client
      .from("office_clients")
      .select("name, tenant_id");

    const tenantBClients = (clients ?? []).filter((c) => c.tenant_id === tenantBId);
    expect(tenantBClients).toHaveLength(0);
  });

  it("member of tenant A can see only their own tenant clients", async () => {
    const { session } = await signInTestUser(TENANT_A_MEMBER_EMAIL, PASSWORD);
    const client = getTestAnonClient();
    await client.auth.setSession(session!);

    const { data: clients } = await client
      .from("office_clients")
      .select("name, tenant_id");

    expect(clients?.every((c) => c.tenant_id === tenantAId)).toBe(true);
  });

  it("member of tenant A cannot see tenant B in tenants table", async () => {
    const { session } = await signInTestUser(TENANT_A_MEMBER_EMAIL, PASSWORD);
    const client = getTestAnonClient();
    await client.auth.setSession(session!);

    const { data: tenants } = await client.from("tenants").select("id");

    const tenantBVisible = (tenants ?? []).some((t) => t.id === tenantBId);
    expect(tenantBVisible).toBe(false);
  });

  it("unauthenticated user sees no data", async () => {
    const client = getTestAnonClient();

    const { data: clients } = await client.from("office_clients").select("id");
    expect(clients).toHaveLength(0);

    const { data: tenants } = await client.from("tenants").select("id");
    expect(tenants).toHaveLength(0);
  });
});
