import { expect, test } from "@playwright/test";

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "";

test.describe("Login page", () => {
  test("renders both sign-in form and magic link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /התחברות/ })).toBeVisible();
    await expect(page.getByLabel(/אימייל/).first()).toBeVisible();
    await expect(page.getByLabel(/סיסמה/)).toBeVisible();
    await expect(page.getByRole("button", { name: /שלחו לינק כניסה/ })).toBeVisible();
  });

  test("shows error message for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/אימייל/).first().fill("wrong@example.com");
    await page.getByLabel(/סיסמה/).fill("wrongpassword123");
    await page.getByRole("button", { name: /המשך/ }).click();
    await expect(page).toHaveURL(/error=auth/);
    await expect(page.getByText(/ההתחברות נכשלה/)).toBeVisible();
  });

  test("redirects to backoffice after successful owner login", async ({ page }) => {
    test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD required");
    await page.goto("/login");
    await page.getByLabel(/אימייל/).first().fill(OWNER_EMAIL);
    await page.getByLabel(/סיסמה/).fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /המשך/ }).click();
    await page.waitForURL("/backoffice/tenants", { timeout: 15000 });
    await expect(page).toHaveURL("/backoffice/tenants");
  });

  test("magic link form submits and navigates away from the blank form", async ({ page }) => {
    await page.goto("/login");
    const magicLinkForm = page.locator("form").last();
    await expect(magicLinkForm.getByLabel(/אימייל/)).toBeVisible();
    await magicLinkForm.getByLabel(/אימייל/).fill("any@example.com");
    await page.getByRole("button", { name: /שלחו לינק כניסה/ }).click();
    await page.waitForURL((url) => url.searchParams.has("otp") || url.searchParams.has("error"), {
      timeout: 10000,
    });
  });
});

test.describe("Protected routes redirect unauthenticated users", () => {
  test("/backoffice/tenants redirects to login", async ({ page }) => {
    await page.goto("/backoffice/tenants");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/some-office/backoffice redirects to login", async ({ page }) => {
    await page.goto("/some-office/backoffice");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/some-office/backoffice/team redirects to login", async ({ page }) => {
    await page.goto("/some-office/backoffice/team");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Locale routing", () => {
  test("root / serves content without locale prefix", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("/login renders Hebrew text", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /התחברות/ })).toBeVisible();
  });

  test("unknown locale returns 404", async ({ page }) => {
    const response = await page.goto("/fr/login");
    expect(response?.status()).toBe(404);
  });
});
