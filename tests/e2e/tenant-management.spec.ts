import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "";

const skip = !OWNER_EMAIL || !OWNER_PASSWORD;

const signInAsOwner = async (page: import("@playwright/test").Page) => {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).first().fill(OWNER_EMAIL);
  await page.getByLabel(/password/i).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL("/en");
};

const cleanupTestTenant = async (slug: string) => {
  const admin = createClient(
    process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
  await admin.from("tenants").delete().eq("slug", slug);
};

test.describe("Owner tenant management", () => {
  test.skip(skip, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD required");

  const testSlug = `e2e-test-${Date.now()}`;

  test.afterAll(async () => {
    await cleanupTestTenant(testSlug);
  });

  test("owner can create a new tenant", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/en/owner/tenants");

    await expect(page.getByRole("heading", { name: /tenant management/i })).toBeVisible();
    await page.getByLabel(/tenant name/i).fill("E2E Test Office");
    await page.getByLabel(/tenant slug/i).fill(testSlug);
    await page.getByRole("button", { name: /create tenant/i }).click();

    await expect(page.getByText("E2E Test Office")).toBeVisible();
  });

  test("tenant appears with a manage members link", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/en/owner/tenants");

    await expect(page.getByText("E2E Test Office")).toBeVisible();
    await expect(page.getByRole("link", { name: /manage members/i }).first()).toBeVisible();
  });

  test("non-owner cannot access owner tenants page", async ({ page }) => {
    await page.goto("/en/owner/tenants");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Office portal", () => {
  test.skip(skip, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD required");

  test("tenant selector is shown on /en/office", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/en/office");
    await expect(page.getByRole("heading", { name: /office backoffice/i })).toBeVisible();
  });
});
