// Real UI + isolated API transport using the shared workflow rules.
// This verifies frontend contracts, not database persistence or live AI inference.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import {
  access,
  metrics,
  newData,
  profileInput,
  project,
} from "../shared/domain.mjs";
import { mutate } from "../shared/workflow.mjs";

const browser = await chromium.launch();
const errors = [],
  assistRequests = [],
  ownerPayloads = [];
const actors = {
  owner: {
    id: "planning-owner",
    email: "owner@example.com",
    name: "Sam Arden",
    roles: [],
  },
  advisor: {
    id: "planning-advisor",
    email: "advisor@example.com",
    name: "River Shaw",
    roles: ["advisor"],
  },
};
function seed(id, ownerId, business, industry) {
  const profile = profileInput({
    name: ownerId === actors.owner.id ? "Sam Arden" : "Lee Harbor",
    business,
    industry,
    trigger: "Family succession",
    futureRole: "Step back gradually",
    timeline: 3,
    revenue: 12000000,
    ebitda: 1500000,
    debt: 500000,
    ownership: 80,
    liquidity: 3000000,
    retained: 20,
    advisorEmail: actors.advisor.email,
    shareWithAdvisor: true,
    priorities: "Protect family continuity",
    employeePriorities: "Keep the team",
  });
  return {
    id,
    ownerId,
    ownerEmail:
      ownerId === actors.owner.id ? actors.owner.email : "other@example.com",
    advisorEmail: actors.advisor.email,
    revision: 1,
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-20T12:00:00Z",
    data: newData(profile),
  };
}
const alpha = seed(
  "planning-alpha",
  actors.owner.id,
  "Arden Family Tools",
  "Manufacturing",
);
const beta = seed(
  "planning-beta",
  "other-owner",
  "Harbor Services",
  "Professional services",
);
alpha.data.meeting = {
  topic: "Discuss successor readiness",
  status: "Requested",
  requestedAt: "2026-10-20T12:00:00Z",
};
alpha.data.management = {
  stage: "Discovery",
  nextContact: "2000-01-01",
  note: "ALPHA PRIVATE MANAGEMENT",
};
beta.data.management = {
  stage: "Preparation",
  nextContact: "",
  note: "BETA PRIVATE MANAGEMENT",
};
beta.data.review = {
  note: "Keep preparing the operating plan",
  at: "2026-10-20T12:00:00Z",
  by: actors.advisor.email,
};
const rows = [alpha, beta];
const events = new Map(rows.map((r) => [r.id, []]));
const chats = new Map([
  [
    `${actors.owner.id}:${alpha.id}`,
    [
      {
        question: "Owner alpha private question",
        answer: "Owner alpha private answer",
      },
    ],
  ],
  [
    `${actors.advisor.id}:${alpha.id}`,
    [
      {
        question: "Advisor alpha private question",
        answer: "Advisor alpha private answer",
      },
    ],
  ],
  [
    `${actors.advisor.id}:${beta.id}`,
    [
      {
        question: "Advisor beta private question",
        answer: "Advisor beta private answer",
      },
    ],
  ],
]);

async function open(role) {
  const user = actors[role],
    context = await browser.newContext();
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    try {
      const body = req.method() === "POST" ? req.postDataJSON() : {};
      let out;
      if (url.pathname === "/api/auth") out = { user };
      else if (url.pathname.endsWith("/cases") && req.method() === "GET") {
        const allowed = rows.filter((r) => access(r, user));
        out = {
          cases: allowed.map((r) => project(r, user)),
          metrics: metrics(
            allowed.filter((r) => access(r, user) === "advisor"),
          ),
        };
        if (role === "owner") ownerPayloads.push(structuredClone(out));
      } else {
        const row = rows.find((r) => r.id === url.searchParams.get("id"));
        if (!row || !access(row, user))
          throw Object.assign(new Error("Case unavailable"), { status: 403 });
        const key = `${user.id}:${row.id}`;
        if (url.pathname.endsWith("/history"))
          out = { history: events.get(row.id), chat: chats.get(key) ?? [] };
        else if (url.pathname.endsWith("/update")) {
          assert.equal(
            body.revision,
            row.revision,
            "UI must save against the selected case revision",
          );
          const result = mutate(row, user, body.op, body.payload);
          row.data = result.data;
          row.advisorEmail = row.data.profile.advisorEmail;
          row.revision++;
          row.updatedAt = new Date().toISOString();
          events
            .get(row.id)
            .unshift({ label: result.label, createdAt: row.updatedAt });
          out = { case: access(row, user) ? project(row, user) : null };
        } else if (url.pathname.endsWith("/assist")) {
          assert.ok(["owner", "advisor"].includes(access(row, user)));
          assert.equal(
            body.consent,
            true,
            "Each AI request needs explicit consent",
          );
          assistRequests.push({
            actor: user.id,
            id: row.id,
            question: body.question,
          });
          const answer = `Prepared discussion questions for ${row.data.profile.business}. Confirm successor interest with your advisor.`;
          chats.set(key, [
            ...(chats.get(key) ?? []),
            { question: body.question, answer },
          ]);
          out = { answer };
        } else throw Error(`Unexpected API request: ${url.pathname}`);
      }
      await route.fulfill({ json: out });
    } catch (error) {
      await route.fulfill({
        status: error.status ?? 400,
        json: { error: error.message },
      });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8889");
  return page;
}

// The advisor sidebar has no per-client links, so client pages fall back to their route.
const ROUTES = {
  "Case overview": "overview",
  "My transition": "overview",
  "Discovery profile": "discovery",
  "Readiness & review": "readiness",
  "Transition options": "pathways",
  "Family & legacy": "family",
  "Proceeds & wealth": "proceeds",
  "Specialist referrals": "referrals",
  "Shared action plan": "plan",
  "AI assistant": "assistant",
  "Case history": "history",
};
async function nav(page, name) {
  const link = page.getByRole("link", { name, exact: true });
  if (await link.count()) await link.first().click();
  else await page.evaluate((r) => (location.hash = `#/${r}`), ROUTES[name]);
}
async function save(page, formName, buttonName) {
  const form = page.locator(`form[data-form="${formName}"]`);
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/nexus/history") &&
        r.request().method() === "GET",
    ),
    form
      .getByRole("button", {
        name: buttonName,
        exact: true,
        includeHidden: true,
      })
      .click(),
  ]);
  await expect(
    page
      .locator(`form[data-form="${formName}"]`)
      .getByRole("button", {
        name: buttonName,
        exact: true,
        includeHidden: true,
      }),
  ).toBeEnabled();
  await expect(
    page.locator(`form[data-form="${formName}"] .form-error`),
  ).toHaveText("");
}
async function refresh(page) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/nexus/history")),
    page.getByRole("button", { name: "Refresh", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
}

try {
  const advisor = await open("advisor");
  // Sign in lands on the dashboard; the portfolio is one click away.
  await advisor.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(
    advisor.getByRole("heading", {
      name: "A clearer view of every client.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(advisor.locator("#portfolio-results tbody tr")).toHaveCount(2);
  await advisor.getByLabel("Search clients", { exact: true }).fill("Harbor");
  await expect(advisor.locator("#portfolio-results tbody tr")).toHaveCount(1);
  await expect(advisor.locator("#portfolio-results")).toContainText(
    "Harbor Services",
  );
  await advisor.getByLabel("Search clients", { exact: true }).fill("");
  await advisor
    .getByLabel("Stage", { exact: true })
    .selectOption("Preparation");
  await expect(advisor.locator("#portfolio-results tbody tr")).toHaveCount(1);
  await expect(advisor.locator("#portfolio-results")).toContainText(
    "Harbor Services",
  );
  await advisor.getByLabel("Stage", { exact: true }).selectOption("All stages");
  await advisor
    .getByLabel("Attention", { exact: true })
    .selectOption("Needs attention");
  await expect(advisor.locator("#portfolio-results tbody tr")).toHaveCount(1);
  await expect(advisor.locator("#portfolio-results")).toContainText(
    "Arden Family Tools",
  );
  await advisor
    .getByLabel("Attention", { exact: true })
    .selectOption("Awaiting review");
  await expect(advisor.locator("#portfolio-results tbody tr")).toHaveCount(1);
  await advisor
    .getByLabel("Attention", { exact: true })
    .selectOption("All clients");
  await advisor
    .getByLabel("Sort by", { exact: true })
    .selectOption("Business name");
  await expect(
    advisor.locator("#portfolio-results tbody tr").first(),
  ).toContainText("Arden Family Tools");
  await advisor
    .locator("#portfolio-results tbody tr")
    .filter({ hasText: "Arden Family Tools" })
    .getByRole("button", { name: /^Open /, exact: false })
    .click();
  await expect(
    advisor.getByRole("heading", { name: "Arden Family Tools", exact: true }),
  ).toBeVisible();

  await advisor
    .getByLabel("Relationship stage", { exact: true })
    .selectOption("Specialist engagement");
  await advisor
    .getByLabel("Next contact date", { exact: true })
    .fill("2030-11-20");
  await advisor
    .getByLabel("Internal relationship note", { exact: true })
    .fill("REVIEW PRIVATE MANAGEMENT ALPHA");
  await save(advisor, "caseManagement", "Save relationship follow-up");
  assert.equal(alpha.data.management.stage, "Specialist engagement");
  assert.equal(alpha.data.management.note, "REVIEW PRIVATE MANAGEMENT ALPHA");

  await advisor
    .getByRole("button", { name: "Prepare my next conversation", exact: true })
    .click();
  await expect(
    advisor.getByLabel("Your question", { exact: true }),
  ).toHaveValue(/Prepare a concise advisor meeting brief/);
  await expect(advisor.locator(".chat-thread")).toContainText(
    "Advisor alpha private answer",
  );
  await expect(advisor.locator(".chat-thread")).not.toContainText(
    "Owner alpha private answer",
  );
  await expect(advisor.locator(".chat-thread")).not.toContainText(
    "Advisor beta private answer",
  );
  assert.equal(
    assistRequests.length,
    0,
    "Contextual AI button only drafts a question",
  );
  await advisor
    .getByRole("button", { name: "Ask PNC-link AI", exact: true })
    .click();
  assert.equal(assistRequests.length, 0, "Required consent prevents a request");
  await advisor
    .getByLabel("I agree to share this case", { exact: false })
    .check();
  await advisor
    .getByRole("button", { name: "Ask PNC-link AI", exact: true })
    .click();
  await expect(advisor.locator(".chat-thread")).toContainText(
    "Prepared discussion questions for Arden Family Tools",
  );
  assert.equal(assistRequests[0].id, alpha.id);
  assert.equal(assistRequests[0].actor, actors.advisor.id);
  await advisor
    .getByLabel("Select case", { exact: true })
    .selectOption(beta.id);
  await expect(advisor.locator(".assistant-context")).toContainText(
    "Harbor Services",
  );
  await expect(advisor.locator(".chat-thread")).toContainText(
    "Advisor beta private answer",
  );
  await expect(advisor.locator(".chat-thread")).not.toContainText(
    "Advisor alpha private answer",
  );
  await expect(
    advisor.getByLabel("Your question", { exact: true }),
  ).toHaveValue("");
  assert.equal(
    assistRequests.length,
    1,
    "Switching clients never sends an AI request",
  );
  await advisor
    .getByLabel("Your question", { exact: true })
    .fill("Unsent Harbor draft");
  await advisor
    .getByLabel("Select case", { exact: true })
    .selectOption(alpha.id);
  await expect(advisor.locator(".assistant-context")).toContainText(
    "Arden Family Tools",
  );
  await expect(
    advisor.getByLabel("Your question", { exact: true }),
  ).toHaveValue("");

  const owner = await open("owner");
  await owner.getByRole("link", { name: "My transition", exact: true }).click();
  await expect(
    owner.getByRole("heading", { name: "Arden Family Tools", exact: true }),
  ).toBeVisible();
  await expect(
    owner.getByRole("link", { name: "Portfolio", exact: true }),
  ).toHaveCount(0);
  await expect(
    owner.getByLabel("Internal relationship note", { exact: true }),
  ).toHaveCount(0);
  await expect(owner.locator("body")).not.toContainText(
    "REVIEW PRIVATE MANAGEMENT ALPHA",
  );
  await expect(owner.locator("body")).not.toContainText("Harbor Services");
  await owner.evaluate(() => {
    location.hash = "#/portfolio";
  });
  await expect(
    owner.getByRole("heading", { name: "Advisor workspace", exact: true }),
  ).toBeVisible();
  await expect(owner.locator(".client-table")).toHaveCount(0);

  await nav(owner, "Discovery profile");
  await owner
    .getByLabel("Successor readiness", { exact: true })
    .selectOption("Family successor interested");
  await owner
    .getByLabel("Family alignment", { exact: true })
    .selectOption("Needs discussion");
  await owner
    .getByLabel("Estate and succession review", { exact: true })
    .selectOption("Review in progress");
  await owner.getByRole("checkbox", { name: "Legacy", exact: true }).check();
  await owner
    .getByRole("checkbox", { name: "Family continuity", exact: true })
    .check();
  await save(owner, "profile", "Save discovery profile");
  assert.deepEqual(alpha.data.profile.decisionPriorities, [
    "Family continuity",
    "Legacy",
  ]);
  assert.equal(alpha.data.profile.successor, "Family successor interested");

  await nav(owner, "Family & legacy");
  await owner.locator(".relationship-add > summary").click();
  const relationship = owner.locator('form[data-form="stakeholder"]');
  await relationship
    .getByLabel("Person’s name", { exact: true })
    .fill("Morgan <Arden> & Family");
  await relationship
    .getByLabel("Relationship to owner", { exact: true })
    .fill("Child");
  await relationship
    .getByLabel("Business participation", { exact: true })
    .selectOption("Active in business");
  await relationship
    .getByLabel("Discussion preference", { exact: true })
    .selectOption("Owner will introduce");
  await relationship
    .getByLabel("Relationship context and open questions", { exact: true })
    .fill("Confirm ownership interest separately from operating role.");
  await save(owner, "stakeholder", "Save relationship");
  await expect(owner.locator(".relationship-card")).toHaveCount(1);
  await expect(owner.locator(".relationship-card h3")).toHaveText(
    "Morgan <Arden> & Family",
  );
  assert.equal(
    await owner.locator(".relationship-card h3 arden").count(),
    0,
    "Relationship names must render as text",
  );
  await owner
    .locator(".relationship-card")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await relationship
    .getByLabel("Person’s name", { exact: true })
    .fill("Morgan Arden");
  await relationship
    .getByLabel("Business participation", { exact: true })
    .selectOption("Outside business");
  await save(owner, "stakeholder", "Save relationship");
  await expect(owner.locator(".relationship-card")).toHaveCount(1);
  await expect(owner.locator(".relationship-card")).toContainText(
    "Outside business",
  );
  assert.equal(
    alpha.data.stakeholders.length,
    1,
    "Editing preserves the relationship ID",
  );
  await owner
    .locator(".relationship-card")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(owner.locator(".relationship-card")).toHaveCount(0);
  assert.equal(alpha.data.stakeholders.length, 0);

  const family = owner.locator('form[data-form="familyPlan"]');
  for (const [key, value] of Object.entries({
    businessValue: "8000000",
    nonBusinessAssets: "2000000",
    liabilities: "0",
    availableLiquidity: "1000000",
    beneficiaries: "2",
    businessRecipients: "1",
    insuranceBenefit: "0",
    notes: "Owner stake only; discuss fairness and liquidity separately.",
  }))
    await family.locator(`[name="${key}"]`).fill(value);
  await save(owner, "familyPlan", "Save family assumptions");
  assert.equal(alpha.data.familyPlan.businessValue, 8000000);
  await expect(
    owner.locator(".money-row").filter({ hasText: "Current liquidity gap" }),
  ).toContainText("$4,000,000");

  await nav(owner, "Transition options");
  await owner
    .getByLabel("Path to discuss", { exact: true })
    .selectOption("Family transfer");
  await owner
    .getByLabel("Why this direction and what remains uncertain", {
      exact: true,
    })
    .fill(
      "Protect family continuity while confirming successor willingness and funding.",
    );
  await save(owner, "pathDecision", "Save working direction");
  assert.equal(alpha.data.pathDecision.path, "Family transfer");
  await owner.reload();
  await expect(
    owner.getByLabel("Path to discuss", { exact: true }),
  ).toHaveValue("Family transfer");
  await expect(
    owner.getByLabel("Why this direction and what remains uncertain", {
      exact: true,
    }),
  ).toHaveValue(
    "Protect family continuity while confirming successor willingness and funding.",
  );

  await refresh(advisor);
  await nav(advisor, "Family & legacy");
  await advisor
    .getByLabel("Family review findings and professional questions", {
      exact: true,
    })
    .fill(
      "Discuss control and fairness with an estate professional before allocations.",
    );
  await save(advisor, "familyReview", "Record family review");
  assert.match(alpha.data.familyReview.note, /estate professional/);
  await nav(advisor, "Proceeds & wealth");
  await advisor
    .getByLabel("Lower enterprise value ($)", { exact: true })
    .fill("6000000");
  await advisor
    .getByLabel("Upper enterprise value ($)", { exact: true })
    .fill("10000000");
  await advisor
    .getByLabel("Valuation basis, source date and limitations", { exact: true })
    .fill(
      "Working discussion range recorded October 27, 2026; owner supplied EBITDA, no licensed comparable research.",
    );
  await save(
    advisor,
    "valuationReview",
    "Record preliminary value perspective",
  );
  assert.equal(alpha.data.valuationReview.low, 6000000);
  await expect(advisor.locator(".value-range")).toHaveText(
    "$6,000,000 – $10,000,000",
  );

  await refresh(owner);
  await nav(owner, "Family & legacy");
  await expect(owner.locator(".review-note")).toContainText(
    "Discuss control and fairness with an estate professional before allocations.",
  );
  await nav(owner, "Proceeds & wealth");
  await expect(owner.locator(".value-range")).toHaveText(
    "$6,000,000 – $10,000,000",
  );
  await expect(owner.locator('form[data-form="valuationReview"]')).toHaveCount(
    0,
  );
  await expect(owner.locator("body")).not.toContainText(
    "REVIEW PRIVATE MANAGEMENT ALPHA",
  );
  for (const payload of ownerPayloads) {
    assert.equal(payload.cases.length, 1);
    assert.equal(payload.cases[0].data.management, undefined);
    assert.equal(JSON.stringify(payload).includes("Harbor Services"), false);
    assert.equal(JSON.stringify(payload).includes("PRIVATE MANAGEMENT"), false);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two-client advisor portfolio filters and follow-up; private case/chat switching; owner-only discovery, relationships, family assumptions and preferred path; human family/value review; consented contextual AI contract. No database or provider inference exercised.",
  );
} finally {
  await browser.close();
}
