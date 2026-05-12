import { NextResponse } from "next/server";

import { defaultLocale } from "@/i18n/config";
import { logAuditEvent } from "@/lib/auth/audit";
import { syncPendingInvitations } from "@/lib/auth/invitations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const slug = searchParams.get("slug");
  const locale = searchParams.get("locale") ?? defaultLocale;

  if (!code) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  // Always sync pending invitations (handles admin-invite flow for all paths)
  const syncResult = await syncPendingInvitations(data.user);

  // Office-specific flow: magic link came from /[slug]/login
  if (slug) {
    const admin = createSupabaseAdminClient();

    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!tenant) {
      return NextResponse.redirect(`${origin}/${locale}?error=tenant_not_found`);
    }

    // Check if user now has a membership (from invitation sync or pre-existing)
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (membership) {
      return NextResponse.redirect(`${origin}/${locale}/${slug}/backoffice`);
    }

    // Platform owner always has access
    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_owner")
      .eq("id", data.user.id)
      .single();

    if (profile?.is_platform_owner) {
      return NextResponse.redirect(`${origin}/${locale}/${slug}/backoffice`);
    }

    const email = data.user.email?.toLowerCase() ?? "";

    // Admin approved before user clicked the link — create membership now
    const { data: approvedRequest } = await admin
      .from("tenant_access_requests")
      .select("id, role")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .eq("status", "approved")
      .maybeSingle();

    if (approvedRequest?.role) {
      await admin.from("tenant_memberships").upsert(
        { tenant_id: tenant.id, user_id: data.user.id, role: approvedRequest.role },
        { onConflict: "tenant_id,user_id" },
      );

      await logAuditEvent({
        action: "tenant.access_request.membership_created",
        actorUserId: data.user.id,
        tenantId: tenant.id,
        payload: { email, role: approvedRequest.role },
      });

      return NextResponse.redirect(`${origin}/${locale}/${slug}/backoffice`);
    }

    // Still pending — show waiting screen
    const { data: pendingRequest } = await admin
      .from("tenant_access_requests")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingRequest) {
      return NextResponse.redirect(`${origin}/${locale}/${slug}/login?status=pending`);
    }

    return NextResponse.redirect(`${origin}/${locale}/${slug}/login`);
  }

  // Generic flow: use sync result to redirect to first accepted tenant or home
  const destination =
    syncResult.count > 0 && syncResult.firstSlug
      ? `/${defaultLocale}/${syncResult.firstSlug}/backoffice`
      : `/${defaultLocale}`;

  return NextResponse.redirect(`${origin}${destination}`);
}
