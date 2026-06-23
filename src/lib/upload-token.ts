import "server-only";

import { SignJWT, jwtVerify } from "jose";

const EXPIRY_DAYS = 90;

function getSecret(): Uint8Array {
  const raw = process.env.UPLOAD_JWT_SECRET;
  if (!raw) throw new Error("UPLOAD_JWT_SECRET is not configured");
  return new TextEncoder().encode(raw);
}

/**
 * Signs a 90-day JWT for the client upload portal.
 * The token encodes the clientYearId as the JWT subject.
 */
export async function signUploadToken(clientYearId: string): Promise<string> {
  return new SignJWT({ sub: clientYearId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_DAYS}d`)
    .sign(getSecret());
}

export type UploadTokenPayload = {
  clientYearId: string;
  expiresAt: Date;
};

/**
 * Verifies a client upload JWT.
 * Returns the payload on success, null if the token is invalid or expired.
 */
export async function verifyUploadToken(
  token: string,
): Promise<UploadTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string") return null;
    return {
      clientYearId: payload.sub,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}
