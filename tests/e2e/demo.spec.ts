import { expect, test } from "@playwright/test";

test("đăng nhập demo và mở danh sách hồ sơ", async ({ page }) => {
  await page.goto("/");
  await page.locator("input").nth(0).fill("admin@hosobds.local");
  await page.locator("input").nth(1).fill("demo123");
  await page.locator("button[type=submit]").click();
  await expect(page.getByText("Chào anh Khoa")).toBeVisible({ timeout: 15_000 });
  await page.locator("nav[aria-label]").getByRole("button").nth(1).click();
  await expect(page.getByText("HS-2026-0073")).toBeVisible();
});
