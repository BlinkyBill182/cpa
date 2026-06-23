import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");

  if (googleError) {
    return NextResponse.redirect(`${siteUrl}/?drive_error=${encodeURIComponent(googleError)}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${siteUrl}/?drive_error=missing_params`);
  }

  let state: { tenantId: string; returnTo: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as {
      tenantId: string;
      returnTo: string;
    };
  } catch {
    return NextResponse.redirect(`${siteUrl}/?drive_error=invalid_state`);
  }

  const { tenantId, returnTo } = state;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  const redirectUri = `${siteUrl}/api/google-callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokens.refresh_token) {
    console.error("[google-callback] Token exchange failed:", tokens.error ?? "no refresh_token");
    return NextResponse.redirect(
      `${siteUrl}${returnTo}?drive_error=${encodeURIComponent(tokens.error ?? "no_refresh_token")}`,
    );
  }

  // Upsert the refresh token into tenant_secrets
  const supabase = createSupabaseAdminClient();
  const { error: dbError } = await supabase.from("tenant_secrets").upsert(
    {
      tenant_id: tenantId,
      service: "google_drive_oauth",
      encrypted_key: tokens.refresh_token,
      is_active: true,
    },
    { onConflict: "tenant_id,service" },
  );

  if (dbError) {
    console.error("[google-callback] DB upsert error:", dbError.message);
    return NextResponse.redirect(`${siteUrl}${returnTo}?drive_error=db_error`);
  }

  return NextResponse.redirect(`${siteUrl}${returnTo}?drive_connected=1`);
}
