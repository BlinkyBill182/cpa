import { cookies } from "next/headers";

import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/constants";

export const setActiveTenant = async (tenantId: string) => {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
};

export const getActiveTenant = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
};

export const clearActiveTenant = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_TENANT_COOKIE);
};
