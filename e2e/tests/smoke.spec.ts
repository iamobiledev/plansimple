import { test, expect } from "@playwright/test";

test.skip(process.env.E2E !== "1", "Set E2E=1 to run PlanSimple e2e tests.");

test("signup flow placeholder", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /create your plansimple account/i })).toBeVisible();
});
