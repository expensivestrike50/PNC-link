import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  newData,
  access,
  project,
  readiness,
  proceeds,
  defaultScenario,
  profileInput,
  scenarioInput,
  metrics,
} from "../shared/domain.mjs";
import { mutate } from "../shared/workflow.mjs";
const owner = { id: "owner", email: "owner@example.com", roles: [] },
  advisor = { id: "advisor", email: "advisor@example.com", roles: ["advisor"] },
  specialist = {
    id: "specialist",
    email: "specialist@example.com",
    roles: ["specialist"],
  };
function fixture() {
  const profile = profileInput({
    name: "Saira Malik",
    business: "Malik Toolworks",
    industry: "Manufacturing",
    trigger: "Family succession",
    timeline: 3,
    futureRole: "Step back gradually",
    revenue: 12000000,
    ebitda: 1500000,
    debt: 500000,
    ownership: 80,
    liquidity: 3000000,
    retained: 20,
    advisorEmail: advisor.email,
    shareWithAdvisor: true,
    priorities: "Private family detail",
    notes: "Private estate question",
  });
  return {
    id: "case-1",
    ownerId: owner.id,
    ownerEmail: owner.email,
    advisorEmail: advisor.email,
    revision: 1,
    data: newData(profile),
  };
}
function apply(row, user, op, payload, now) {
  row.data = mutate(row, user, op, payload, now).data;
  row.advisorEmail = row.data.profile.advisorEmail;
  row.revision++;
  return row;
}
function reviewed() {
  const row = fixture();
  for (const e of row.data.evidence.slice(0, 2)) {
    apply(row, owner, "evidence", { label: e.label, checked: true });
    apply(row, advisor, "evidence", { label: e.label, checked: true });
  }
  apply(row, advisor, "review", {
    note: "Reviewed ownership, finances and next steps.",
    qualified: true,
  });
  return row;
}
function referral(scope = "Business only") {
  const row = reviewed();
  apply(row, advisor, "referral", {
    team: "PNC Private Bank",
    recipient: specialist.email,
    scope,
    purpose: "Discuss wealth needs.",
  });
  return row;
}
test("client and server use the same financial and readiness model", () => {
  assert.equal(
    readFileSync(new URL("../public/domain.mjs", import.meta.url), "utf8"),
    readFileSync(new URL("../shared/domain.mjs", import.meta.url), "utf8"),
  );
});
test("access requires ownership, assigned advisor role, or approved named recipient", () => {
  const row = fixture();
  assert.equal(access(row, owner), "owner");
  assert.equal(access(row, advisor), "advisor");
  assert.equal(access(row, { ...advisor, roles: [] }), null);
  assert.equal(access(row, { ...advisor, email: "someone@example.com" }), null);
  assert.equal(access(row, specialist), null);
  assert.throws(() => project(row, specialist), /access/);
});
test("qualification requires verified evidence, not just availability", () => {
  const row = fixture();
  assert.throws(
    () =>
      apply(row, advisor, "review", { note: "Looks fine", qualified: true }),
    /two evidence/,
  );
  assert.throws(
    () =>
      apply(row, advisor, "evidence", {
        label: row.data.evidence[0].label,
        checked: true,
      }),
    /owner/,
  );
  apply(row, owner, "evidence", {
    label: row.data.evidence[0].label,
    checked: true,
  });
  assert.equal(readiness(row.data).score, 14);
  assert.equal(readiness(row.data).verified, 0);
});
test("handoff requires review, owner consent and named recipient acknowledgment", () => {
  const row = fixture();
  assert.throws(
    () =>
      apply(row, advisor, "referral", {
        team: "PNC Private Bank",
        recipient: specialist.email,
        purpose: "Review",
        scope: "Business only",
      }),
    /review/,
  );
  const r = referral();
  const id = r.data.referrals[0].id;
  assert.equal(access(r, specialist), null);
  assert.throws(
    () => apply(r, advisor, "referralStatus", { id, status: "Queued" }),
    /role/,
  );
  apply(
    r,
    owner,
    "referralStatus",
    { id, status: "Queued" },
    "2026-10-27T10:00:00Z",
  );
  assert.equal(access(r, specialist), "specialist");
  assert.throws(() =>
    apply(r, { ...specialist, email: "other@example.com" }, "referralStatus", {
      id,
      status: "Accepted",
    }),
  );
  apply(
    r,
    specialist,
    "referralStatus",
    { id, status: "Accepted" },
    "2026-10-27T12:00:00Z",
  );
  apply(r, specialist, "referralStatus", { id, status: "Completed" });
  assert.equal(r.data.referrals[0].status, "Completed");
  assert.equal(metrics([r]).hours, 2);
});
test("business-only specialist projection excludes family notes, finances model, actions, and audit", () => {
  const row = referral();
  apply(row, owner, "referralStatus", {
    id: row.data.referrals[0].id,
    status: "Queued",
  });
  const out = project(row, specialist);
  assert.equal(out.data.profile.business, "Malik Toolworks");
  for (const key of [
    "notes",
    "priorities",
    "liquidity",
    "advisorEmail",
    "name",
  ])
    assert.equal(out.data.profile[key], undefined);
  assert.equal(out.ownerEmail, undefined);
  assert.equal(out.data.scenario, undefined);
  assert.equal(out.data.actions, undefined);
  assert.equal(JSON.stringify(out).includes("Private family detail"), false);
});
test("personal profile snapshot is consented and stops access after completed referral withdrawal", () => {
  const row = referral("Business + personal");
  const id = row.data.referrals[0].id;
  apply(row, owner, "referralStatus", { id, status: "Queued" });
  assert.equal(
    project(row, specialist).data.profile.notes,
    "Private estate question",
  );
  apply(row, specialist, "referralStatus", { id, status: "Accepted" });
  apply(row, specialist, "referralStatus", { id, status: "Completed" });
  apply(row, owner, "referralStatus", { id, status: "Withdrawn" });
  assert.equal(access(row, specialist), null);
  assert.ok(row.data.referrals[0].completedAt);
});
test("editing discovery revokes prior advisor, invalidates review and existing referrals", () => {
  const row = referral();
  apply(row, owner, "referralStatus", {
    id: row.data.referrals[0].id,
    status: "Queued",
  });
  apply(row, owner, "profile", {
    ...row.data.profile,
    advisorEmail: "new-advisor@example.com",
  });
  assert.equal(access(row, advisor), null);
  assert.equal(access(row, specialist), null);
  assert.equal(row.data.review, null);
  assert.equal(row.data.qualified, false);
  assert.equal(row.data.referrals[0].status, "Withdrawn");
});
test("scenario edits invalidate review and reject values beyond the supported range", () => {
  const row = reviewed();
  apply(row, owner, "scenario", { ...defaultScenario, multiple: 6 });
  assert.equal(row.data.review, null);
  assert.throws(() =>
    scenarioInput({ ...defaultScenario, multiple: "broken" }),
  );
  assert.throws(() => scenarioInput({ ...defaultScenario, tax: 90 }));
  assert.throws(() => scenarioInput({ ...defaultScenario, multiple: "" }));
});
test("proceeds follow ownership and debt order and expose distribution and debt shortfalls", () => {
  const p = fixture().data.profile;
  const r = proceeds(p, { ...defaultScenario, family: 10000000 });
  assert.equal(r.ev, 7500000);
  assert.equal(r.share, 5360000);
  assert.equal(r.cash, -5980000);
  assert.equal(r.shortfall, 5980000);
  const negative = proceeds({ ...p, debt: 10000000 }, defaultScenario);
  assert.ok(negative.debtShortfall > 0);
  assert.equal(negative.share, 0);
  assert.equal(negative.cash, 0);
});
test("owners can book several meetings and cancel any open one", () => {
  const row = fixture();
  apply(row, owner, "meeting", { topic: "Discuss successor interest" }, "2026-10-01T10:00:00Z");
  apply(row, owner, "meeting", { topic: "Review liquidity" }, "2026-10-02T10:00:00Z");
  assert.equal(row.data.meeting.topic, "Review liquidity");
  assert.equal(row.data.meetingHistory[0].status, "Requested");
  assert.throws(() => apply(row, advisor, "meetingCancel", {}), /role/);
  apply(row, owner, "meetingCancel", { requestedAt: "2026-10-01T10:00:00Z" });
  assert.equal(row.data.meetingHistory[0].status, "Cancelled");
  apply(row, owner, "meetingCancel", {});
  assert.equal(row.data.meeting, null);
  assert.throws(() => apply(row, owner, "meetingCancel", {}), /no open meeting/i);
});
test("meeting requests can carry a proposed time from the advisor's hours", () => {
  const row = fixture();
  apply(row, owner, "meeting", { topic: "Review liquidity", at: "2026-10-05T14:00:00Z", minutes: 30 }, "2026-10-01T10:00:00Z");
  assert.equal(row.data.meeting.at, "2026-10-05T14:00:00.000Z");
  assert.equal(row.data.meeting.minutes, 30);
  assert.throws(
    () => apply(row, owner, "meeting", { topic: "Too late", at: "2026-09-01T09:00:00Z" }, "2026-10-01T10:00:00Z"),
    /future/,
  );
  apply(row, owner, "meeting", { topic: "No time yet" }, "2026-10-02T10:00:00Z");
  assert.equal(row.data.meeting.at, undefined);
});
test("meeting transitions and coordinated actions are role restricted", () => {
  const row = fixture();
  apply(row, owner, "meeting", { topic: "Discuss successor interest" });
  assert.throws(
    () => apply(row, advisor, "meetingStatus", { status: "Completed" }),
    /Acknowledge/,
  );
  assert.throws(
    () => apply(row, owner, "meetingStatus", { status: "Acknowledged" }),
    /role/,
  );
  apply(row, advisor, "meetingStatus", { status: "Acknowledged" });
  apply(row, advisor, "meetingStatus", { status: "Completed" });
  assert.throws(
    () => apply(row, owner, "action", { id: "wealth", status: "Completed" }),
    /advisor/,
  );
});
test("metrics distinguish zero from unknown and retain withdrawn handoff observations", () => {
  const row = fixture();
  let m = metrics([row]);
  assert.equal(m.assets, null);
  assert.equal(m.retention, null);
  assert.equal(m.acceptance, null);
  apply(row, advisor, "outcomes", {
    workMinutes: 45,
    closed: true,
    assetsCaptured: 0,
    retained: false,
  });
  m = metrics([row]);
  assert.equal(m.assets, 0);
  assert.equal(m.retention, 0);
  assert.equal(m.workMinutes, 45);
  assert.throws(
    () => apply(row, owner, "outcomes", { workMinutes: 20, closed: false }),
    /role/,
  );
});
test("advisor sharing requires explicit owner permission", () => {
  const row = fixture();
  assert.throws(
    () => profileInput({ ...row.data.profile, shareWithAdvisor: false }),
    /permission/,
  );
});
