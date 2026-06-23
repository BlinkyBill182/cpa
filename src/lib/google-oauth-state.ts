import "server-only";

import { SignJWT, jwtVerify } from "jose";

const STATE_EXPIRY = "10m";

export type GoogleOAuthState = {
  tenantId: string;
  returnTo: string;
};

function getSecret(): Uint8Array {
  const raw = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!raw) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not configured");
  return new TextEncoder().encode(raw);
}

export function normalizeGoogleOAuthReturnTo(returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export async function signGoogleOAuthState(state: GoogleOAuthState): Promise<string> {
  return new SignJWT({
    tenantId: state.tenantId,
    returnTo: normalizeGoogleOAuthReturnTo(state.returnTo),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_EXPIRY)
    .sign(getSecret());
}

export async function verifyGoogleOAuthState(token: string): Promise<GoogleOAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.tenantId !== "string" || typeof payload.returnTo !== "string") {
      return null;
    }

    return {
      tenantId: payload.tenantId,
      returnTo: normalizeGoogleOAuthReturnTo(payload.returnTo),
    };
  } catch {
    return null;
  }
}
