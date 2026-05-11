import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncPendingInvitations } from "@/lib/auth/invitations";
import {
  cleanupTestTenants,
  createTestUser,
  deleteTestUser,
  getTestAdmin,
} from "../../helpers/supabase";

const SLUG_PREFIX = "test-sync-inv";
const OWNER_EMAIL = `owner-sync-${Date.now()}@test.example`;
const INVITEE_EMAIL = `invitee-sync-${Date.now()}@test.example`;
const PASSWORD = "TestPassword123!";

let ownerUserId: string;
let inviteeUserId: string;
let tenantId: string;

beforeEach(async () => {
  const admin = getTestAdmin();

  const owner = await createTestUser(OWNER_EMAIL, PASSWORD);
  ownerUserId = owner.id;

  const invitee = await createTestUser(INVITEE_EMAIL, PASSWORD);
  inviteeUserId = invitee.id;

  await admin.from("profiles").upsert({ id: ownerUserId, is_platform_owner: true });

  const { data: tenant } = await admin
    .from("tenants")
    .insert({ name: "Test Sync Tenant", slug: `${SLUG_PREFIX}-${Date.now()}`, created_by: ownerUserId })
    .select("id")
    .single();

  tenantId = tenant!.id;

  await admin.from("tenant_invitations").insert({
    tenant_id: tenantId,
    invited_email: INVITEE_EMAIL.toLowerCase(),
    role: "staff",
    invited_by: ownerUserId,
  });
});

afterEach(async () => {
  await cleanupTestTenants(SLUG_PREFIX);
  if (ownerUserId) await deleteTestUser(ownerUserId);
  if (inviteeUserId) await deleteTestUser(inviteeUserId);
});

describe("syncPendingInvitations", () => {
  it("creates a tenant membership for the invited user", async () => {
    const admin = getTestAdmin();
    const { data: inviteeAuth } = await admin.auth.admin.getUserById(inviteeUserId);

    await syncPendingInvitations(inviteeAuth.user!);

    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", inviteeUserId)
      .single();

    expect(membership?.role).toBe("staff");
  });

  it("marks the invitation as accepted", async () => {
    const admin = getTestAdmin();
    const { data: inviteeAuth } = await admin.auth.admin.getUserById(inviteeUserId);

    await syncPendingInvitations(inviteeAuth.user!);

    const { data: invitation } = await admin
      .from("tenant_invitations")
      .select("status, accepted_user_id")
      .eq("tenant_id", tenantId)
      .eq("invited_email", INVITEE_EMAIL.toLowerCase())
      .single();

    expect(invitation?.status).toBe("accepted");
    expect(invitation?.accepted_user_id).toBe(inviteeUserId);
  });

  it("returns the number of resolved invitations", async () => {
    const admin = getTestAdmin();
    const { data: inviteeAuth } = await admin.auth.admin.getUserById(inviteeUserId);

    const count = await syncPendingInvitations(inviteeAuth.user!);

    expect(count).toBe(1);
  });

  it("returns 0 and does nothing if no pending invitations exist", async () => {
    const admin = getTestAdmin();
    const { data: ownerAuth } = await admin.auth.admin.getUserById(ownerUserId);

    const count = await syncPendingInvitations(ownerAuth.user!);

    expect(count).toBe(0);
  });

  it("is idempotent — running twice does not create duplicate memberships", async () => {
    const admin = getTestAdmin();
    const { data: inviteeAuth } = await admin.auth.admin.getUserById(inviteeUserId);

    await syncPendingInvitations(inviteeAuth.user!);
    await syncPendingInvitations(inviteeAuth.user!);

    const { data: memberships } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", inviteeUserId);

    expect(memberships).toHaveLength(1);
  });
});
