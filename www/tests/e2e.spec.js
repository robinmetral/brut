import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000");
});

test("should render", async ({ page }) => {
  await expect(page).toHaveTitle(/Brut/);
  await expect(page.locator("text=Welcome to Brut").first()).toBeVisible();
});

test("should navigate to other pages", async ({ page }) => {
  await page.click("text=Blog");
  await expect(page.locator("h1").first()).toHaveText("Blog");
  await page.click("text=Unpopular Opinion");
  await expect(page).toHaveTitle(/Unpopular Opinion/);
});
