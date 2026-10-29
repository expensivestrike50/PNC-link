import {
  fail,
  text,
  email,
  number,
  teams,
  profileInput,
  scenarioInput,
  readiness,
  access,
  paths,
  caseStages,
  familyPlanInput,
  dateInput,
  stakeholderRoles,
  stakeholderEngagementOptions,
} from "./domain.mjs";
export function mutate(row, user, op, payload, now = new Date().toISOString()) {
  const mode = access(row, user),
    d = structuredClone(row.data),
    p = payload ?? {};
  let label = "";
  const requireMode = (m) => {
    if (mode !== m) fail("This action is not available for your role.", 403);
  };
  const invalidate = () => {
    d.review = null;
    d.qualified = false;
    d.valuationReview = null;
    d.referrals = d.referrals.map((r) =>
      ["Draft", "Queued", "Accepted", "Completed"].includes(r.status)
        ? { ...r, status: "Withdrawn", withdrawnAt: now }
        : r,
    );
  };
  if (op === "profile") {
    requireMode("owner");
    d.profile = profileInput(p);
    if (d.profile.advisorEmail === row.ownerEmail)
      fail("Choose a different account as your advisor.");
    invalidate();
    d.familyReview = null;
    label = "Owner updated discovery and advisor sharing permission";
  } else if (op === "scenario") {
    requireMode("owner");
    d.scenario = scenarioInput(p);
    invalidate();
    label = "Owner updated working proceeds assumptions";
  } else if (op === "familyPlan") {
    requireMode("owner");
    const plan = familyPlanInput(p);
    if (JSON.stringify(plan) !== JSON.stringify(d.familyPlan)) {
      d.familyPlan = plan;
      d.familyReview = null;
      invalidate();
    }
    label = "Owner updated family continuity assumptions";
  } else if (op === "familyReview") {
    requireMode("advisor");
    if (!d.familyPlan)
      fail("The owner must first save family planning assumptions.");
    const note = text(p.note ?? "", 3000);
    if (!note)
      fail(
        "Record family review findings and questions for qualified professionals.",
      );
    d.familyReview = { at: now, by: user.email, note };
    label = "Advisor reviewed family continuity assumptions";
  } else if (op === "pathDecision") {
    requireMode("owner");
    const path = text(p.path ?? "", 100),
      reason = text(p.reason ?? "", 2000);
    if (path && !paths.some((item) => item.name === path))
      fail("Choose a supported transition path.");
    if (path && !reason) fail("Explain why you want to discuss this path.");
    if (
      path !== (d.pathDecision?.path ?? "") ||
      reason !== (d.pathDecision?.reason ?? "")
    ) {
      d.pathDecision = path ? { path, reason, at: now } : null;
      invalidate();
    }
    label = "Owner recorded transition path discussion preference";
  } else if (op === "valuationReview") {
    requireMode("advisor");
    const basis = text(p.basis ?? "", 3000);
    if (!basis)
      fail("Describe the valuation basis, source date and limitations.");
    const low = number(p.low, 0, 1e12, "Lower business value"),
      high = number(p.high, low, 1e12, "Upper business value");
    d.valuationReview = { basis, low, high, at: now, by: user.email };
    label = "Advisor recorded a preliminary business value perspective";
  } else if (op === "caseManagement") {
    requireMode("advisor");
    if (!caseStages.includes(p.stage)) fail("Choose a supported case stage.");
    d.management = {
      stage: p.stage,
      nextContact: dateInput(p.nextContact, "follow-up date"),
      note: text(p.note ?? "", 3000),
    };
    label = "Advisor updated internal case coordination";
  } else if (op === "stakeholder") {
    requireMode("owner");
    const people = d.stakeholders ?? [];
    const id = p.id ? text(p.id, 100) : crypto.randomUUID();
    const existing = people.findIndex((person) => person.id === id);
    if (p.id && existing < 0) fail("Relationship entry not found.", 404);
    if (existing < 0 && people.length >= 12)
      fail("A case can include at most 12 relationship entries.");
    const name = text(p.name ?? "", 200),
      relationship = text(p.relationship ?? "", 200);
    if (!name || !relationship)
      fail("Enter the person's name and relationship.");
    if (
      !stakeholderRoles.includes(p.role) ||
      !stakeholderEngagementOptions.includes(p.engagement)
    )
      fail("Choose supported participation and discussion preferences.");
    const person = {
      id,
      name,
      relationship,
      role: p.role,
      engagement: p.engagement,
      notes: text(p.notes ?? "", 1500),
    };
    d.stakeholders = [...people];
    if (existing >= 0) d.stakeholders[existing] = person;
    else d.stakeholders.push(person);
    d.familyReview = null;
    invalidate();
    label = "Owner updated family and trusted-advisor relationships";
  } else if (op === "removeStakeholder") {
    requireMode("owner");
    const id = text(p.id ?? "", 100);
    if (!(d.stakeholders ?? []).some((person) => person.id === id))
      fail("Relationship entry not found.", 404);
    d.stakeholders = d.stakeholders.filter((person) => person.id !== id);
    d.familyReview = null;
    invalidate();
    label = "Owner removed a family or trusted-advisor relationship";
  } else if (op === "evidence") {
    if (!["owner", "advisor"].includes(mode)) fail("Not permitted.", 403);
    const e = d.evidence.find((e) => e.label === p.label);
    if (!e) fail("Unknown checklist item.");
    if (mode === "owner") {
      e.reported = p.checked === true;
      e.verified = false;
      // Timestamps feed the readiness-over-time chart.
      if (e.reported) e.reportedAt = now;
      else delete e.reportedAt;
      delete e.verifiedAt;
      invalidate();
    } else {
      if (p.checked && !e.reported)
        fail("The owner must first confirm that this evidence is available.");
      e.verified = p.checked === true;
      if (e.verified) e.verifiedAt = now;
      else delete e.verifiedAt;
      d.review = null;
      d.qualified = false;
    }
    label =
      mode === "owner"
        ? "Owner updated evidence availability"
        : "Advisor updated evidence verification";
  } else if (op === "review") {
    requireMode("advisor");
    const note = text(p.note ?? "", 3000);
    if (!note) fail("Add review findings and next steps.");
    if (p.qualified === true && readiness(d).verified < 2)
      fail(
        "Verify at least two evidence categories before qualifying the opportunity.",
      );
    d.review = { at: now, by: user.email, note };
    d.qualified = p.qualified === true;
    label = d.qualified
      ? "Advisor reviewed and qualified the opportunity"
      : "Advisor recorded discovery review";
  } else if (op === "meeting") {
    requireMode("owner");
    const topic = text(p.topic ?? "", 500);
    if (!topic) fail("Enter a meeting topic.");
    if (!row.advisorEmail)
      fail("Add your advisor and sharing permission first.");
    if (d.meeting) d.meetingHistory = [d.meeting, ...(d.meetingHistory ?? [])].slice(0, 20);
    d.meeting = { topic, status: "Requested", requestedAt: now };
    label = "Owner requested an advisor meeting";
  } else if (op === "meetingCancel") {
    requireMode("owner");
    // Cancel the latest request or an earlier open one, identified by its request time.
    const at = p.requestedAt ?? d.meeting?.requestedAt;
    const open = (m) => m && m.requestedAt === at && !["Completed", "Cancelled"].includes(m.status);
    if (open(d.meeting)) {
      d.meetingHistory = [
        { ...d.meeting, status: "Cancelled", cancelledAt: now },
        ...(d.meetingHistory ?? []),
      ].slice(0, 20);
      d.meeting = null;
    } else {
      const past = (d.meetingHistory ?? []).find(open);
      if (!past) fail("There is no open meeting request to cancel.");
      past.status = "Cancelled";
      past.cancelledAt = now;
    }
    label = "Owner cancelled the meeting request";
  } else if (op === "meetingStatus") {
    requireMode("advisor");
    if (!d.meeting) fail("No meeting request exists.");
    if (!["Acknowledged", "Completed"].includes(p.status))
      fail("Invalid meeting status.");
    if (p.status === "Completed" && d.meeting.status !== "Acknowledged")
      fail("Acknowledge the meeting first.");
    if (p.status === "Acknowledged" && d.meeting.status !== "Requested")
      fail("Meeting is already acknowledged.");
    d.meeting.status = p.status;
    label = `Advisor ${p.status.toLowerCase()} the meeting request`;
  } else if (op === "referral") {
    requireMode("advisor");
    if (d.referrals.length >= 100)
      fail("This case has reached its referral limit.");
    if (!d.review)
      fail("Record an advisor review before proposing a referral.");
    if (!teams.includes(p.team)) fail("Choose a supported specialist team.");
    const recipient = email(p.recipient);
    if ([row.ownerEmail, row.advisorEmail].includes(recipient))
      fail("Choose a separate specialist recipient.");
    const purpose = text(p.purpose ?? "", 1500);
    if (!purpose)
      fail("Explain the referral purpose and engagement rationale.");
    if (!["Business only", "Business + personal"].includes(p.scope))
      fail("Choose the information scope.");
    if (
      d.referrals.some(
        (r) =>
          r.recipient === recipient &&
          r.team === p.team &&
          !["Withdrawn", "Declined", "Completed"].includes(r.status),
      )
    )
      fail("An open referral to this recipient already exists.");
    d.referrals.push({
      id: crypto.randomUUID(),
      team: p.team,
      recipient,
      purpose,
      scope: p.scope,
      status: "Draft",
      createdAt: now,
    });
    label = "Advisor proposed a specialist referral for owner approval";
  } else if (op === "referralStatus") {
    const r = d.referrals.find((r) => r.id === p.id);
    if (!r) fail("Referral not found.", 404);
    if (p.status === "Queued") {
      requireMode("owner");
      if (r.status !== "Draft" || !d.review)
        fail("Only a reviewed draft referral can be approved.");
      r.approvedAt = now;
      r.queuedAt = now;
      r.approvedBy = user.id;
      r.approvedProfile =
        r.scope === "Business + personal"
          ? structuredClone(d.profile)
          : Object.fromEntries(
              [
                "business",
                "industry",
                "trigger",
                "timeline",
                "revenue",
                "ebitda",
                "debt",
                "ownership",
                "futureRole",
                "confidentiality",
              ].map((k) => [k, d.profile[k]]),
            );
    } else if (p.status === "Withdrawn") {
      requireMode("owner");
      if (!["Draft", "Queued", "Accepted", "Completed"].includes(r.status))
        fail("This referral is already closed.");
      r.withdrawnAt = now;
    } else if (["Accepted", "Declined"].includes(p.status)) {
      requireMode("specialist");
      if (r.recipient !== user.email.toLowerCase() || r.status !== "Queued")
        fail("Only the named recipient can respond to a queued referral.", 403);
      if (p.status === "Accepted") r.acceptedAt = now;
    } else if (p.status === "Completed") {
      requireMode("specialist");
      if (r.recipient !== user.email.toLowerCase() || r.status !== "Accepted")
        fail("Accept the referral before completing it.");
      r.completedAt = now;
    } else fail("Invalid referral transition.");
    r.status = p.status;
    label = `Specialist referral ${p.status.toLowerCase()}`;
  } else if (op === "action") {
    if (!["owner", "advisor"].includes(mode)) fail("Not permitted.", 403);
    const a = d.actions.find((a) => a.id === p.id);
    if (!a) fail("Action not found.");
    if (!["Open", "In progress", "Completed"].includes(p.status))
      fail("Invalid action status.");
    if (mode === "owner" && a.assignee !== "Owner")
      fail("Only the advisor can complete coordinated team actions.", 403);
    a.status = p.status;
    label = "Shared action status updated";
  } else if (op === "addAction") {
    requireMode("advisor");
    const title = text(p.title ?? "", 500),
      assignee = text(p.assignee ?? "", 200),
      due = text(p.due ?? "", 10);
    if (!title || !assignee) fail("Enter an action and assignee.");
    if (d.actions.length >= 100)
      fail("This case has reached its action limit.");
    dateInput(due, "due date");
    d.actions.push({
      id: crypto.randomUUID(),
      title,
      assignee,
      due,
      kind: "Transition planning",
      status: "Open",
    });
    label = "Advisor assigned a shared next step";
  } else if (op === "outcomes") {
    requireMode("advisor");
    d.workMinutes = number(
      p.workMinutes,
      0,
      100000,
      "Recorded advisor minutes",
    );
    const closed = p.closed === true;
    d.outcomes = {
      closed,
      assetsCaptured:
        closed && p.assetsCaptured !== "" && p.assetsCaptured !== null
          ? number(p.assetsCaptured, 0, 1e12, "Assets captured")
          : null,
      retained: closed && typeof p.retained === "boolean" ? p.retained : null,
    };
    label = "Advisor recorded observed effort and transaction outcomes";
  } else fail("Unknown action.");
  return { data: d, label };
}
