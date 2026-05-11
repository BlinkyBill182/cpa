import { expect, test } from "@playwright/test";

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "";

test.describe("Login page", () => {
  test("renders both sign-in form and magic link form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("shows error message for wrong credentials", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/email/i).first().fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/error=auth/);
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
  });

  test("redirects to home after successful login", async ({ page }) => {
    test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD required");
    await page.goto("/en/login");
    await page.getByLabel(/email/i).first().fill(OWNER_EMAIL);
    await page.getByLabel(/password/i).fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL("/en");
    await expect(page).toHaveURL("/en");
  });

  test("magic link form submits and navigates away from the blank form", async ({ page }) => {
    await page.goto("/en/login");
    const magicLinkForm = page.locator("form").last();
    await expect(magicLinkForm.getByLabel(/email/i)).toBeVisible();
    await magicLinkForm.getByLabel(/email/i).fill("any@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await page.waitForURL((url) => url.searchParams.has("otp") || url.searchParams.has("error"), {
      timeout: 10000,
    });
  });
});

test.describe("Protected routes redirect unauthenticated users", () => {
  test("/en/owner/tenants redirects to login", async ({ page }) => {
    await page.goto("/en/owner/tenants");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("/en/office redirects to login", async ({ page }) => {
    await page.goto("/en/office");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("/en/office/team redirects to login", async ({ page }) => {
    await page.goto("/en/office/team");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Locale routing", () => {
  test("root / redirects to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en/);
  });

  test("/he/login renders Hebrew text", async ({ page }) => {
    await page.goto("/he/login");
    await expect(page.getByRole("heading", { name: /התחברות/ })).toBeVisible();
  });

  test("unknown locale returns 404", async ({ page }) => {
    const response = await page.goto("/fr/login");
    expect(response?.status()).toBe(404);
  });
});
