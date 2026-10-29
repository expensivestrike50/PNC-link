// Browser/API contract test with an isolated transport; it does not connect to a database or AI provider.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import {
  profileInput,
  newData,
  project,
  metrics,
  access,
} from "../shared/domain.mjs";
import { mutate } from "../shared/workflow.mjs";
const browser = await chromium.launch();
let row = null;
const events = [],
  errors = [];
const actors = {
  owner: {
    id: "owner",
    email: "owner@example.com",
    name: "Saira Malik",
    roles: [],
  },
  advisor: {
    id: "advisor",
    email: "advisor@example.com",
    name: "Rafael Costa",
    roles: ["advisor"],
  },
  specialist: {
    id: "specialist",
    email: "specialist@example.com",
    name: "Mina Shah",
    roles: ["specialist"],
  },
};
async function open(role) {
  const ctx = await browser.newContext();
  await ctx.route("**/api/**", async (route) => {
    try {
      const req = route.request(),
        url = new URL(req.url()),
        p = req.method() === "POST" ? req.postDataJSON() : {},
        user = actors[role];
      let out;
      if (url.pathname === "/api/auth") out = { user };
      else if (url.pathname.endsWith("/history"))
        out = { history: events, chat: [] };
      else if (url.pathname.endsWith("/cases") && req.method() === "GET")
        out = {
          cases: row && access(row, user) ? [project(row, user)] : [],
          metrics: metrics(row && role === "advisor" ? [row] : []),
        };
      else if (url.pathname.endsWith("/cases")) {
        const profile = profileInput(p);
        row = {
          id: "contract-case",
          ownerId: user.id,
          ownerEmail: user.email,
          advisorEmail: profile.advisorEmail,
          revision: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: newData(profile),
        };
        out = { case: project(row, user) };
      } else if (url.pathname.endsWith("/update")) {
        assert.equal(p.revision, row.revision);
        const result = mutate(row, user, p.op, p.payload);
        row.data = result.data;
        row.revision++;
        events.unshift({
          label: result.label,
          createdAt: new Date().toISOString(),
        });
        out = { case: access(row, user) ? project(row, user) : null };
      } else if (url.pathname.endsWith("/assist"))
        out = {
          answer:
            "Review the successor’s willingness with your advisor before comparing family transfer financing.",
        };
      else throw Error("Unexpected API path");
      await route.fulfill({ json: out });
    } catch (e) {
      await route.fulfill({
        status: e.status ?? 400,
        json: { error: e.message },
      });
    }
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8889");
  return page;
}
const owner = await open("owner");
await owner.getByRole("link", { name: "Start your transition profile", exact: true }).click();
for (const [name, value] of [
  ["Owner name", "Saira Malik"],
  ["Business name", "Malik <Tools> & Family"],
  ["Industry", "Manufacturing"],
  ["Years until preferred transition", "3"],
  ["Annual revenue ($)", "12000000"],
  ["Annual EBITDA ($)", "1500000"],
  ["Outstanding business debt ($)", "500000"],
  ["Your current ownership (%)", "80"],
  ["Desired personal liquidity ($)", "3000000"],
  ["Desired retained ownership after transition (%)", "20"],
  ["Assigned advisor email (optional)", "advisor@example.com"],
  ["Family and legacy priorities", "Preserve family ownership"],
  ["Employee and management priorities", "Keep the team"],
])
  await owner.getByLabel(name, { exact: true }).fill(value);
await owner
  .getByLabel("What brings you here?", { exact: true })
  .selectOption("Family succession");
await owner
  .getByLabel("Your desired future role", { exact: true })
  .selectOption("Step back gradually");
await owner.getByLabel("I allow the named advisor", { exact: false }).check();
await owner
  .getByRole("button", { name: "Create shared case", exact: true })
  .click();
await owner
  .getByRole("heading", { name: "Malik <Tools> & Family", exact: true })
  .waitFor();
assert.ok(row);
assert.equal(await owner.locator("h1 img").count(), 0);
await owner
  .getByRole("link", { name: "Readiness & review", exact: true })
  .click();
for (const label of ["Financial statements", "Ownership and debt schedule"]) {
  await owner
    .locator(".check-row")
    .filter({ hasText: label })
    .getByRole("checkbox", { name: "Available", exact: true })
    .check();
  await owner
    .getByText("Saved to the shared case record.", { exact: true })
    .waitFor();
  await owner
    .locator(".check-row")
    .filter({ hasText: label })
    .getByRole("checkbox", { name: "Available", exact: true })
    .waitFor();
}
const advisor = await open("advisor");
// Sign in lands on the dashboard; the portfolio is one click away.
await advisor.getByRole("link", { name: "Portfolio", exact: true }).click();
await advisor
  .getByRole("heading", {
    name: "A clearer view of every client.",
    exact: true,
  })
  .waitFor();
await advisor
  .locator("#portfolio-results")
  .getByRole("button", { name: /^Open /, exact: false })
  .click();
await advisor
  .getByRole("heading", { name: "Malik <Tools> & Family", exact: true })
  .waitFor();
await advisor
  .getByRole("link", { name: "Readiness & review", exact: true })
  .click();
for (const label of ["Financial statements", "Ownership and debt schedule"]) {
  await advisor
    .locator(".check-row")
    .filter({ hasText: label })
    .getByRole("checkbox", { name: "Verified", exact: true })
    .check();
  await advisor.waitForFunction(
    () =>
      !document.querySelector("[data-evidence]:checked:not(:disabled)")
        ?.disabled,
  );
  await advisor
    .locator(".check-row")
    .filter({ hasText: label })
    .getByText("Advisor verified", { exact: true })
    .waitFor();
}
await advisor
  .getByLabel("Findings and recommended next steps", { exact: true })
  .fill("Verify successor interest and estate assumptions.");
await advisor.getByLabel("Qualify this opportunity", { exact: false }).check();
await advisor
  .getByRole("button", { name: "Record advisor review", exact: true })
  .click();
await advisor
  .getByRole("button", { name: "Record advisor review", exact: true })
  .waitFor();
await advisor.getByText("Qualified", { exact: true }).waitFor();
await advisor
  .getByRole("link", { name: "Specialist referrals", exact: true })
  .click();
await advisor
  .getByLabel("Specialist team", { exact: true })
  .selectOption("PNC Private Bank");
await advisor
  .getByLabel("Recipient account email", { exact: true })
  .fill("specialist@example.com");
await advisor
  .getByLabel("Purpose and engagement rationale", { exact: true })
  .fill("Review liquidity needs before a sale.");
await advisor
  .getByRole("button", { name: "Send for owner approval", exact: true })
  .click();
await advisor.getByText("Draft", { exact: true }).waitFor();
await owner.getByRole("button", { name: "Refresh", exact: true }).click();
await owner
  .getByRole("link", { name: "Specialist referrals", exact: true })
  .click();
await owner
  .getByRole("button", { name: "Approve & queue referral", exact: true })
  .click();
await owner.getByText("Queued", { exact: true }).waitFor();
const specialist = await open("specialist");
await specialist
  .getByRole("button", { name: "Accept handoff", exact: true })
  .click();
await specialist.getByText("Accepted", { exact: true }).waitFor();
assert.equal(
  await specialist
    .getByText("Preserve family ownership", { exact: true })
    .count(),
  0,
);
await specialist
  .getByRole("button", { name: "Mark completed", exact: true })
  .click();
await specialist.getByText("Completed", { exact: true }).waitFor();
await owner.getByRole("button", { name: "Refresh", exact: true }).click();
await owner.getByText("Completed", { exact: true }).waitFor();
await owner
  .getByRole("button", { name: "Withdraw access", exact: true })
  .click();
await owner.getByText("Withdrawn", { exact: true }).waitFor();
assert.equal(access(row, actors.specialist), null);
await owner.getByRole("link", { name: "AI assistant", exact: true }).click();
await owner
  .getByLabel("Your question", { exact: true })
  .fill("What should I ask my advisor?");
await owner.getByLabel("I agree to share this case", { exact: false }).check();
await owner
  .getByRole("button", { name: "Ask PNC-link AI", exact: true })
  .click();
await owner
  .locator(".chat-message")
  .filter({
    hasText:
      "Review the successor’s willingness with your advisor before comparing family transfer financing.",
  })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  "PASS: isolated UI contract for owner discovery → shared advisor verification → qualified review → owner-approved referral → named recipient acceptance/completion → access withdrawal, plus consented AI rendering.",
);
await browser.close();
