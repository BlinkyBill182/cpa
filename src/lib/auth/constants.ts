export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export const tenantRoles = ["tenant_admin", "manager", "staff", "reviewer", "contractor"] as const;

export type TenantRole = (typeof tenantRoles)[number];
