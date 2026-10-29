import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:8889");
await page
  .getByRole("heading", {
    name: "A thoughtful transition starts with a connected plan.",
  })
  .waitFor();
await page
  .getByRole("button", { name: "Explore demo", exact: true })
  .click();
// Explore demo opens the dashboard; the case overview is one click away.
await page.getByRole("heading", { name: "James D. Bennett", exact: true }).waitFor();
await page.getByRole("link", { name: "My transition", exact: true }).click();
await page
  .getByRole("heading", {
    name: "Bennett Precision Manufacturing",
    exact: true,
  })
  .waitFor();
await page.screenshot({
  path: "/tmp/pnc-link-owner.png",
  fullPage: true,
  animations: "disabled",
});
assert.equal(await page.locator('input[name="topic"]').count(), 1);
assert.equal(
  await page
    .getByRole("button", { name: "Request advisor meeting" })
    .isDisabled(),
  true,
);
for (const [name, title] of [
  ["Discovery profile", "The full picture starts here."],
  ["Readiness & review", "Evidence before conclusions."],
  ["Transition options", "Choose the outcome before the structure."],
  ["Family & legacy", "Plan for the people behind the business."],
  ["Proceeds & wealth", "From business value to personal choices."],
  ["Specialist referrals", "The right team, with your permission."],
  ["Shared action plan", "Every next step has an owner."],
  ["AI assistant", "Support for your next conversation."],
  ["Case history", "A visible record of progress."],
  ["Planning resources", "A stronger plan starts with better questions."],
]) {
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  if (name === "Transition options")
    assert.equal(await page.locator(".path-card").count(), 7);
}
await page
  .getByRole("button", { name: "View as advisor", exact: true })
  .click();
await page.getByRole("link", { name: "Portfolio", exact: true }).click();
await page
  .getByRole("heading", {
    name: "A clearer view of every client.",
    exact: true,
  })
  .waitFor();
assert.equal(await page.locator("#portfolio-results tbody tr").count(), 4);
await page.screenshot({
  path: "/tmp/pnc-link-portfolio.png",
  fullPage: true,
  animations: "disabled",
});
await page
  .getByRole("link", { name: "Practice insights", exact: true })
  .click();
await page
  .getByRole("heading", { name: "Measure the journey, then test the impact." })
  .waitFor();
// The advisor sidebar has no per-client links; client pages open by route.
await page.evaluate(() => (location.hash = "#/readiness"));
assert.equal(
  await page
    .getByRole("button", { name: "Record advisor review" })
    .isDisabled(),
  true,
);
await page.screenshot({
  path: "/tmp/nexus-advisor.png",
  fullPage: true,
  animations: "disabled",
});
await page.setViewportSize({ width: 390, height: 844 });
// On narrow screens the sidebar is off-canvas; open it before following a link.
const navTo = async (name) => {
  const link = page.getByRole("link", { name, exact: true });
  if (!(await link.count())) {
    // Advisor client pages have no sidebar link; open them by route.
    const routes = { "Transition options": "pathways", "Family & legacy": "family", "AI assistant": "assistant", "Planning resources": "resources" };
    return page.evaluate((r) => (location.hash = `#/${r}`), routes[name]);
  }
  const menu = page.getByRole("button", { name: "Show sidebar" });
  if ((await menu.count()) && (await menu.first().isVisible())) {
    await menu.first().click();
    await page.waitForTimeout(350); // let the sidebar finish sliding in
  }
  await link.first().click();
};
await navTo("Transition options");
await page
  .getByRole("heading", { name: "Choose the outcome before the structure." })
  .waitFor();
assert.ok(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
  "mobile page overflows",
);
await page.screenshot({
  path: "/tmp/nexus-mobile.png",
  fullPage: true,
  animations: "disabled",
});
for (const [name, heading] of [
  ["Portfolio", "A clearer view of every client."],
  ["Family & legacy", "Plan for the people behind the business."],
  ["AI assistant", "A second set of eyes for your case."],
  ["Planning resources", "A stronger plan starts with better questions."],
]) {
  await navTo(name);
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `${name} overflows on mobile`,
  );
  const ids = await page
    .locator("[id]")
    .evaluateAll((elements) => elements.map((el) => el.id));
  assert.equal(ids.length, new Set(ids).size, `${name} has duplicate IDs`);
  if (name === "Family & legacy")
    await page.screenshot({
      path: "/tmp/pnc-link-family-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
}
await page.setViewportSize({ width: 1440, height: 1000 });
await navTo("Family & legacy");
await page
  .getByRole("heading", {
    name: "Plan for the people behind the business.",
    exact: true,
  })
  .waitFor();
await page.screenshot({
  path: "/tmp/pnc-link-family.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("link", { name: "Create your case", exact: true }).click();
await page
  .getByRole("heading", { name: "Start your next chapter.", exact: true })
  .waitFor();
assert.equal(await page.locator(".demo-bar").count(), 0);
assert.equal(
  await page.locator('input[name="password"]').getAttribute("minlength"),
  "12",
);
assert.deepEqual(errors, []);
console.log(
  "PASS: home, both sample workspaces, all owner case screens and resources, read-only actions, seven transition paths, mobile layout, and signup.",
);
await browser.close();
