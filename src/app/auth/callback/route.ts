import { NextResponse } from "next/server";

import { defaultLocale } from "@/i18n/config";
import { syncPendingInvitations } from "@/lib/auth/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? `/${defaultLocale}`;

  if (!code) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  const invitationsResolved = await syncPendingInvitations(data.user);

  const destination = invitationsResolved > 0
    ? `/${defaultLocale}/office`
    : next;

  return NextResponse.redirect(`${origin}${destination}`);
}
