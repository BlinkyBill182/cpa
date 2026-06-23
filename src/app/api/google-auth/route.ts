import { NextRequest, NextResponse } from "next/server";

import { requirePlatformOwner } from "@/lib/auth/session";
import { normalizeGoogleOAuthReturnTo, signGoogleOAuthState } from "@/lib/google-oauth-state";

export async function GET(request: NextRequest) {
  await requirePlatformOwner();

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const returnTo = normalizeGoogleOAuthReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!clientId) return NextResponse.json({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" }, { status: 500 });
  if (!clientSecret) return NextResponse.json({ error: "GOOGLE_OAUTH_CLIENT_SECRET not configured" }, { status: 500 });

  const state = await signGoogleOAuthState({ tenantId, returnTo });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/api/google-callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent", // always return refresh_token
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
