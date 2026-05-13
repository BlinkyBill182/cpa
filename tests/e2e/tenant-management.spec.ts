import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "";

const skip = !OWNER_EMAIL || !OWNER_PASSWORD;

const TEST_TENANT_NAME = "E2E Test Office";
const TEST_TENANT_SLUG = "e2e-test-office-stable";

const signInAsOwner = async (page: import("@playwright/test").Page) => {
  await page.goto("/login");
  await page.getByLabel(/אימייל/).first().fill(OWNER_EMAIL);
  await page.getByLabel(/סיסמה/).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /המשך/ }).click();
  await page.waitForURL((url) => url.pathname === "/backoffice/tenants" || url.pathname === "/", {
    timeout: 15000,
  });
};

const getAdmin = () =>
  createClient(
    process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

test.describe("Owner tenant management", () => {
  test.skip(skip, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD required");

  test.beforeAll(async () => {
    await getAdmin().from("tenants").delete().eq("slug", TEST_TENANT_SLUG);
  });

  test.afterAll(async () => {
    await getAdmin().from("tenants").delete().eq("slug", TEST_TENANT_SLUG);
  });

  test("owner can create a new tenant", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/backoffice/tenants");

    await expect(page.getByRole("heading", { name: /ניהול דיירים/ })).toBeVisible();
    await page.getByLabel(/שם הדייר/).fill(TEST_TENANT_NAME);
    await page.getByLabel(/מזהה דייר/).fill(TEST_TENANT_SLUG);
    await page.getByRole("button", { name: /יצירת דייר/ }).click();

    await expect(page.getByText(TEST_TENANT_NAME)).toBeVisible();
  });

  test("tenant card shows a manage members link", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/backoffice/tenants");

    await expect(page.getByText(TEST_TENANT_NAME)).toBeVisible({ timeout: 10000 });
    const card = page.locator("article").filter({ hasText: TEST_TENANT_NAME });
    await expect(card.getByRole("link", { name: /ניהול חברים/ })).toBeVisible();
  });

  test("non-owner cannot access backoffice tenants page", async ({ page }) => {
    await page.goto("/backoffice/tenants");
    await expect(page).toHaveURL(/\/login/);
  });
});
