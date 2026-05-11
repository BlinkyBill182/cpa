import { NextResponse } from "next/server";

import { defaultLocale } from "@/i18n/config";
import { syncPendingInvitations } from "@/lib/auth/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/${defaultLocale}/login?error=auth`);
  }

  const { count, firstSlug } = await syncPendingInvitations(data.user);

  const destination =
    count > 0 && firstSlug
      ? `/${defaultLocale}/${firstSlug}/backoffice`
      : `/${defaultLocale}`;

  return NextResponse.redirect(`${origin}${destination}`);
}
