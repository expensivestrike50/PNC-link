// Verify a repository-root static preview opens the current public/ app.
// Start a static server from the repository root at port 8080 first.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const origin = process.env.PNC_ROOT_PREVIEW_URL || "http://localhost:8080";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/#/owner");
  await expect(page).toHaveURL(/\/public\/#\/home$/);
  await expect(
    page.getByRole("heading", {
      name: "A thoughtful transition starts with a connected plan.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".demo-bar")).toContainText(
    "connected services are unavailable",
  );
  await page
    .getByRole("button", { name: "Explore the advisor workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A clearer view of every client.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#portfolio-results tbody tr")).toHaveCount(4);
  await expect
    .poll(() =>
      page.locator(".brand-box img").evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.goto(origin + "/public/#/sample-owner");
  // Sample links open the dashboard.
  await expect(page.getByRole("heading", { name: "James D. Bennett", exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Family & legacy", exact: true })
    .click();
  await expect(page.locator(".relationship-card")).toHaveCount(2);
  await page.goto(origin + "/#/sample-advisor");
  await expect(page.getByRole("heading", { name: "Priya Shah", exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/pnc-link-root-preview.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: root preview redirects retired routes to current app; public assets load under /public/; static API failure leaves read-only samples usable; direct owner/advisor walkthrough links work.",
  );
} finally {
  await browser.close();
}
