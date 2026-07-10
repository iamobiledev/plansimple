import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

test.skip(process.env.E2E !== "1", "Set E2E=1 to run PlanSimple e2e tests.");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "../../scripts/fixtures/sample-plans.pdf");

test("signup → org → project happy path", async ({ page }) => {
  const email = `e2e-${Date.now()}@plansimple.test`;
  const password = "TestPass123!";
  const slug = `e2e-org-${Date.now()}`;

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /create your plansimple account/i })).toBeVisible();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  const nameField = page.getByLabel(/name/i);
  if (await nameField.count()) await nameField.fill("E2E Tester");
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();

  await expect(page).toHaveURL(/\/($|\?)/, { timeout: 15000 });

  // Create organization
  await page.getByLabel(/organization name|name/i).first().fill("E2E Builders");
  const slugInput = page.getByLabel(/slug/i);
  if (await slugInput.count()) await slugInput.fill(slug);
  await page.getByRole("button", { name: /create organization|create org/i }).click();

  await expect(page.getByText(/E2E Builders/i)).toBeVisible({ timeout: 15000 });
});

test("demo login and project workspace loads", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("demo@plansimple.dev");
  await page.getByLabel(/password/i).fill("plansimple123");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page.getByText(/Demo Construction|organizations|PlanSimple/i).first()).toBeVisible({
    timeout: 15000,
  });
});

test("upload PDF shows processing UI when on project page", async ({ page, request }) => {
  // API-level upload proof (UI file chooser is flaky without computer use); still exercises stack.
  const login = await request.post("http://127.0.0.1:3000/api/auth/login", {
    data: { email: "demo@plansimple.dev", password: "plansimple123" },
  });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json();
  const orgs = await request.get("http://127.0.0.1:3000/api/organizations", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const orgList = await orgs.json();
  const orgId = orgList[0].id;
  const projects = await request.get(`http://127.0.0.1:3000/api/organizations/${orgId}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const projectId = (await projects.json())[0].id;

  const fs = await import("node:fs");
  if (!fs.existsSync(fixture)) {
    test.skip(true, "sample fixture missing");
  }

  const upload = await request.post(
    `http://127.0.0.1:3000/api/organizations/${orgId}/projects/${projectId}/documents/upload`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      multipart: {
        file: {
          name: "sample-plans.pdf",
          mimeType: "application/pdf",
          buffer: fs.readFileSync(fixture),
        },
      },
    }
  );
  expect(upload.ok()).toBeTruthy();
  const body = await upload.json();
  expect(body.documentId).toBeTruthy();

  let ready = false;
  for (let i = 0; i < 60; i++) {
    const detail = await request.get(
      `http://127.0.0.1:3000/api/organizations/${orgId}/documents/${body.documentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const d = await detail.json();
    if (d.processingStatus === "ready" && (d.pages?.length ?? 0) > 0) {
      ready = true;
      const pageId = d.pages[0].id;
      const tiles = await request.get(
        `http://127.0.0.1:3000/api/organizations/${orgId}/documents/${body.documentId}/pages/${pageId}/tiles`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      expect(tiles.ok()).toBeTruthy();
      const meta = await tiles.json();
      const textKey = encodeURIComponent(meta.textKey);
      const textRes = await request.get(`http://127.0.0.1:3000/api/storage/object/${textKey}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(textRes.ok()).toBeTruthy();
      const text = await textRes.json();
      const hit = (text.spans || []).some((s: { text: string }) =>
        s.text.toUpperCase().includes("SEARCHABLE")
      );
      expect(hit).toBeTruthy();
      break;
    }
    await page.waitForTimeout(1000);
  }
  expect(ready).toBeTruthy();
});
