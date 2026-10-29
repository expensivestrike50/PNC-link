import { mutate } from "./workflow.mjs";
import { linkDashboard, linkDashboardEmpty, linkHistory, linkTransition, linkReadiness, linkPage, mountLinkDashboard, mountAdvisorCalendar, pathIcon, personAvatar, teamLogo } from "./link-dash.js?v=20261029040000";
import {
  newData,
  profileInput,
  project,
  defaultScenario,
  readiness,
  proceeds,
  suggestedPaths,
  paths,
  teams,
  metrics,
  successorOptions,
  familyReadinessOptions,
  estateStatusOptions,
  decisionPriorityOptions,
  caseStages,
  stakeholderRoles,
  stakeholderEngagementOptions,
  defaultFamilyPlan,
  familyBalance,
  valuationSensitivity,
  pathReasons,
  routingSuggestions,
  nextSteps,
  transitionJourney,
  portfolioPriority,
} from "./domain.mjs";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  v === null || v === undefined
    ? "Not recorded"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
const date = (v) =>
  v
    ? new Date(v).toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not yet";
const state = {
  user: null,
  guest: false,
  servicesAvailable: true,
  cases: [],
  selected: null,
  demo: false,
  demoRole: "owner",
  metrics: {},
  history: [],
  chat: [],
  callback: null,
  portfolioSearch: "",
  portfolioStage: "All stages",
  portfolioAttention: "All clients",
  portfolioSort: "Attention first",
  assistantDraft: "",
};
let flashTimer,
  renderVersion = 0,
  historyVersion = 0,
  lastRenderedKey = "";
function notice(message) {
  $("#notice").textContent = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ($("#notice").textContent = ""), 6000);
}
const guestUser = { id: "local-guest", email: "guest@example.test", name: "Guest workspace", roles: [] };
const guestKey = "pnc-link-guest-v1";
// Local test account for static hosting (no Netlify Identity). Only the password hash is kept.
const localAccounts = {
  "test@gmail.com": {
    hash: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
    user: { id: "local-test", email: "test@gmail.com", name: "Test User", roles: [] },
    key: "pnc-link-test-v1",
  },
};
const localSessionKey = "pnc-link-local-session";
let local = { user: guestUser, key: guestKey };
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let guestStore = { row: null, history: [] };
function guestApi(path, body) {
  if (path.includes("/assist")) throw Error("Sign in to use live AI. Your guest case stays in this browser.");
  if (path.includes("/history")) return { history: guestStore.history, chat: [] };
  if (!body) return { cases: guestStore.row ? [project(guestStore.row, local.user)] : [], metrics: {} };
  const next = structuredClone(guestStore);
  const now = new Date().toISOString();
  if (path.includes("/cases")) {
    const profile = profileInput({ ...body, advisorEmail: "", shareWithAdvisor: false });
    next.row = { id: "guest-case", ownerId: local.user.id, ownerEmail: local.user.email, advisorEmail: "", revision: 1, createdAt: now, updatedAt: now, data: newData(profile) };
    next.history.unshift({ label: "Created a local transition profile", createdAt: now });
  } else if (path.includes("/update") && next.row) {
    if (body.op === "profile") body.payload = { ...body.payload, advisorEmail: "", shareWithAdvisor: false };
    if (body.op === "referralStatus") throw Error("Sign in to coordinate with an advisor.");
    // Local workspaces have no assigned advisor; the advisor chosen in the calendar stands in
    // so a meeting request can be recorded in this browser.
    const target = body.op === "meeting" && !next.row.advisorEmail ? { ...next.row, advisorEmail: "advisor@example.test" } : next.row;
    const result = mutate(target, local.user, body.op, body.payload);
    next.row.data = result.data;
    next.row.revision++;
    next.row.updatedAt = now;
    next.history.unshift({ label: result.label, createdAt: now });
  } else throw Error("This action requires a connected account.");
  try { localStorage.setItem(local.key, JSON.stringify(next)); }
  catch { throw Error("Browser storage is unavailable. Enable storage to save your guest case."); }
  guestStore = next;
  return { case: project(next.row, local.user) };
}
// A local test account starts from an editable copy of the Bennett sample case.
function seedLocalCase(user) {
  const now = new Date().toISOString(),
    d = structuredClone(sample().data);
  delete d.management;
  d.profile = { ...d.profile, advisorEmail: "", shareWithAdvisor: false };
  d.referrals = [];
  return {
    row: { id: "local-case", ownerId: user.id, ownerEmail: user.email, advisorEmail: "", revision: 1, createdAt: now, updatedAt: now, data: d },
    history: [{ label: "Started from the Bennett sample case", createdAt: now }],
  };
}
async function openGuest(resume = false, account = null) {
  local = account ? { user: account.user, key: account.key } : { user: guestUser, key: guestKey };
  try {
    if (account) localStorage.setItem(localSessionKey, account.user.email);
    else localStorage.removeItem(localSessionKey);
  } catch { /* The workspace still opens for this visit. */ }
  try {
    const saved = JSON.parse(localStorage.getItem(local.key) || "null");
    guestStore = saved?.row?.ownerId === local.user.id && Array.isArray(saved.history) ? saved : { row: null, history: [] };
  } catch { guestStore = { row: null, history: [] }; }
  if (account && !guestStore.row) {
    guestStore = seedLocalCase(account.user);
    try { localStorage.setItem(local.key, JSON.stringify(guestStore)); } catch { /* Kept for this visit. */ }
  }
  state.guest = true;
  state.demo = false;
  state.user = local.user;
  state.selected = null;
  await loadCases();
  await loadHistory();
  if (!resume) location.hash = account ? "#/dashboard" : current() ? "#/overview" : "#/discovery";
  render();
}
async function api(path, body, retry = true) {
  if (state.guest && !state.demo && path.startsWith("/api/nexus/")) return guestApi(path, body);
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("The service is unavailable. Please try again.");
  }
  if (path === "/api/auth" && !body && data.refreshed && retry)
    return api(path, undefined, false);
  if (!r.ok) {
    if (r.status === 401 && path.startsWith("/api/nexus/") && retry) {
      const status = await api("/api/auth");
      if (status.user) return api(path, body, false);
    }
    if (r.status === 401) {
      state.user = null;
      state.cases = [];
      state.chat = [];
      state.history = [];
      location.hash = "#/signin";
    }
    throw Error(data.error || "The request could not complete.");
  }
  return data;
}
const route = () => location.hash.replace(/^#\/?/, "") || "home";
const current = () => state.cases.find((c) => c.id === state.selected);
const locked = () => (state.demo ? "disabled" : "");
const badge = (label, cls = "") =>
  `<span class="badge ${cls}">${esc(label)}</span>`;
const button = (label, action, cls = "secondary", extra = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const intro = (title, description, eyebrow = "Transition workspace") =>
  `<header class="page-intro"><div class="eyebrow">${eyebrow}</div><h1 tabindex="-1">${title}</h1><p>${description}</p></header>`;
const panel = (title, body, sub = "") =>
  `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${sub ? `<small>${sub}</small>` : ""}</div></div>${body}</section>`;
const stat = (title, value, note = "", accent = false) =>
  `<div class="stat ${accent ? "accent" : ""}"><span>${title}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`;
const empty = (title, description) =>
  `<div class="empty"><h3>${title}</h3><p>${description}</p></div>`;
const input = (key, label, value = "", type = "text", extra = "", hint = "") =>
  `<div class="field"><label for="field-${key}">${label}</label><input id="field-${key}" name="${key}" type="${type}" value="${esc(value)}" ${extra} ${hint ? `aria-describedby="hint-${key}"` : ""}>${hint ? `<small id="hint-${key}">${hint}</small>` : ""}</div>`;
const textarea = (key, label, value = "", extra = "") =>
  `<div class="field full"><label for="field-${key}">${label}</label><textarea id="field-${key}" name="${key}" ${extra.includes("maxlength") ? "" : 'maxlength="3000"'} ${extra}>${esc(value)}</textarea></div>`;
const select = (key, label, options, value, extra = "") =>
  `<div class="field"><label for="field-${key}">${label}</label><select id="field-${key}" name="${key}" ${extra}>${options.map((o) => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
const formEnd = (label) =>
  `<div class="form-footer"><button class="btn" ${locked()}>${label}</button><p class="form-error" role="alert"></p></div>`;
const formData = (f) => Object.fromEntries(new FormData(f));
const isAdvisor = () =>
  state.demo
    ? state.demoRole === "advisor"
    : (state.user?.roles ?? []).includes("advisor");
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
function sample() {
  const p = {
    name: "James D. Bennett",
    business: "Bennett Precision Manufacturing",
    industry: "Manufacturing",
    trigger: "Family succession",
    timeline: 3,
    futureRole: "Step back gradually",
    revenue: 38400000,
    ebitda: 5625000,
    debt: 4200000,
    ownership: 85,
    liquidity: 12000000,
    retained: 20,
    priorities:
      "Preserve the family legacy and confirm whether the next generation wants ownership.",
    employeePriorities: "Protect the team and retain key managers.",
    confidentiality: "No external disclosure without my approval.",
    notes:
      "Daughter leads operations; ownership interest still needs confirmation.",
    advisorEmail: "advisor@example.test",
    shareWithAdvisor: true,
    outreach: "Meeting only",
    successor: "Family successor interested",
    familyReadiness: "Needs discussion",
    estateStatus: "Not reviewed",
    decisionPriorities: [
      "Family continuity",
      "Employee continuity",
      "Liquidity",
    ],
  };
  const d = newData(p);
  d.scenario = { ...defaultScenario, family: 1500000 };
  const sampleAt = (h) => new Date(Date.parse("2026-10-26T09:00:00Z") + h * 36e5).toISOString();
  d.evidence = d.evidence.map((e, i) => ({
    ...e,
    reported: i < 4,
    verified: i < 2,
    ...(i < 4 ? { reportedAt: sampleAt(i < 2 ? 0.5 : 6) } : {}),
    ...(i < 2 ? { verifiedAt: sampleAt(24.5 + i * 0.1) } : {}),
  }));
  d.review = {
    at: "2026-10-27T10:00:00Z",
    by: "advisor@example.test",
    note: "Financials and ownership reviewed for this fictional demonstration. Confirm successor interest, document tax assumptions, and discuss family outcomes before selecting a path.",
  };
  d.qualified = true;
  d.management = {
    stage: "Preparation",
    nextContact: "2026-10-30",
    note: "Ask about successor willingness and a family meeting before considering external buyer research.",
  };
  d.pathDecision = {
    path: "Family transfer",
    reason:
      "Explore a phased transition to the next generation while protecting personal liquidity.",
  };
  d.stakeholders = [
    {
      id: "sample-daughter",
      name: "Morgan Bennett",
      relationship: "Daughter",
      role: "Active in business",
      engagement: "Owner will introduce",
      notes:
        "Leads operations. Confirm interest in ownership separately from management.",
    },
    {
      id: "sample-son",
      name: "Alex Bennett",
      relationship: "Son",
      role: "Outside business",
      engagement: "Not discussed",
      notes:
        "Discuss family expectations without assuming equal ownership is the right outcome.",
    },
  ];
  d.familyPlan = {
    ...defaultFamilyPlan,
    businessValue: 8000000,
    nonBusinessAssets: 2000000,
    availableLiquidity: 1200000,
    notes:
      "Illustrative owner stake and personal assets; discuss control and fairness with both children.",
  };

  d.referrals = [
    {
      id: "sample-referral",
      team: "PNC Private Bank",
      recipient: "specialist@example.test",
      purpose:
        "Review liquidity needs, family distributions and estate planning before the owner selects a transaction structure.",
      scope: "Business + personal",
      status: "Draft",
      createdAt: "2026-10-27T10:10:00Z",
    },
  ];
  return {
    id: "sample",
    ownerId: "sample-owner",
    ownerEmail: "owner@example.test",
    advisorEmail: p.advisorEmail,
    revision: 1,
    mode: state.demoRole,
    createdAt: "2026-10-26T09:00:00Z",
    updatedAt: "2026-10-27T10:10:00Z",
    data: d,
  };
}
function samplePortfolio() {
  const primary = sample();
  if (state.demoRole !== "advisor") {
    delete primary.data.management;
    return [primary];
  }
  const variants = [
    {
      id: "sample-rivera",
      name: "Elena Rivera",
      business: "Rivera Specialty Foods",
      industry: "Food & beverage",
      trigger: "Unsolicited offer",
      timeline: 1,
      futureRole: "Exit fully",
      successor: "External sale preferred",
      familyReadiness: "Aligned",
      estateStatus: "Review in progress",
      stage: "Discovery",
      meeting: true,
      priorities:
        "Compare the offer with other paths and fund the family's next chapter.",
      ebitda: 2100000,
    },
    {
      id: "sample-chen",
      name: "David Chen",
      business: "Chen Field Services",
      industry: "Business services",
      trigger: "Retirement",
      timeline: 2,
      futureRole: "Step back gradually",
      successor: "Management successor interested",
      familyReadiness: "Needs discussion",
      estateStatus: "Not reviewed",
      stage: "Specialist engagement",
      priorities:
        "Give the management team a path to ownership and protect employee continuity.",
      ebitda: 3200000,
    },
    {
      id: "sample-patel",
      name: "Anika Patel",
      business: "Patel Health Logistics",
      industry: "Logistics",
      trigger: "Liquidity need",
      timeline: 0,
      futureRole: "Exit fully",
      successor: "External sale preferred",
      familyReadiness: "Aligned",
      estateStatus: "Reviewed with professional",
      stage: "Post-transition",
      closed: true,
      priorities:
        "Coordinate family distributions and investment-policy discussions after closing.",
      ebitda: 1800000,
    },
  ];
  return [
    primary,
    ...variants.map((v) => {
      const p = {
        ...primary.data.profile,
        ...v,
        decisionPriorities: ["Liquidity", "Employee continuity"],
        notes: "Fictional sample for the advisor portfolio.",
      };
      const d = newData(p);
      d.management = {
        stage: v.stage,
        nextContact: v.closed ? "2026-11-05" : "2026-10-26",
        note: "Illustrative internal follow-up note.",
      };
      if (v.meeting)
        d.meeting = {
          topic: "Understand the unsolicited offer",
          status: "Requested",
          requestedAt: "2026-10-26T12:00:00Z",
        };
      if (v.closed) {
        d.outcomes = { closed: true, assetsCaptured: 4500000, retained: true };
        d.workMinutes = 90;
        d.review = {
          at: "2026-10-26T10:00:00Z",
          by: "advisor@example.test",
          note: "Fictional completed transaction. Follow up on personal income needs and family distributions.",
        };
        d.evidence = d.evidence.map((e) => ({
          ...e,
          reported: true,
          verified: true,
        }));
        d.pathDecision = {
          path: "Strategic sale",
          reason:
            "Fictional completed external sale; planning now focuses on life after closing.",
        };
      }
      return {
        ...primary,
        id: v.id,
        ownerId: v.id + "-owner",
        ownerEmail: v.id + "@example.test",
        data: d,
      };
    }),
  ];
}
async function loadCases() {
  if (state.demo) {
    state.cases = samplePortfolio();
    if (!current()) state.selected = "sample";
    state.metrics = metrics(state.cases);
    return;
  }
  const result = await api("/api/nexus/cases");
  state.cases = result.cases;
  state.metrics = result.metrics;
  if (!current()) state.selected = state.cases[0]?.id ?? null;
}
async function loadHistory() {
  const version = ++historyVersion,
    c = current();
  state.chat = [];
  state.history = [];
  state.assistantDraft = "";
  if (!c || c.mode === "specialist") return;
  if (state.demo) {
    // Illustrative sample history between the case's creation and its last update.
    const at = (h) => new Date(Date.parse(c.createdAt) + h * 36e5).toISOString();
    state.history = [
      {
        label: "Advisor proposed a Private Bank referral for owner approval",
        createdAt: c.updatedAt,
      },
      {
        label: "Advisor reviewed the opportunity",
        createdAt: c.data.review?.at ?? c.createdAt,
      },
      { label: "Advisor updated evidence verification", createdAt: at(24.6) },
      { label: "Advisor updated evidence verification", createdAt: at(24.5) },
      { label: "Owner recorded transition path discussion preference", createdAt: at(2.5) },
      { label: "Owner updated working proceeds assumptions", createdAt: at(2) },
      { label: "Owner updated family continuity assumptions", createdAt: at(1.3) },
      { label: "Owner updated family and trusted-advisor relationships", createdAt: at(1) },
      { label: "Owner updated evidence availability", createdAt: at(6) },
      { label: "Owner updated evidence availability", createdAt: at(0.5) },
      { label: "Owner created a discovery profile", createdAt: c.createdAt },
    ];
    return;
  }
  const data = await api(`/api/nexus/history?id=${encodeURIComponent(c.id)}`);
  if (version !== historyVersion || current()?.id !== c.id) return;
  state.history = data.history;
  state.chat = data.chat;
}
async function update(op, payload) {
  if (state.demo)
    throw Error("This sample is read-only. Sign in to create your own case.");
  const c = current();
  await api(`/api/nexus/update?id=${encodeURIComponent(c.id)}`, {
    revision: c.revision,
    op,
    payload,
  });
  await loadCases();
  await loadHistory();
  render();
  notice(state.guest ? "Saved in this browser." : "Saved to the shared case record.");
}
function publicHeader() {
  return `<header class="public-head"><a href="#/home"><img class="logo" src="./assets/pnc-link-logo.svg" alt="PNC-link home"></a><div class="row"><a class="btn secondary" href="#/signin">Sign in</a><a class="btn" href="#/guest">Get started</a></div></header>${state.servicesAvailable ? "" : '<div class="demo-bar">Connected services are unavailable. Enter the portal without signup to save a case in this browser, or explore the samples.</div>'}`;
}
function home() {
  const research =
    "https://pnc.mediaroom.com/2026-04-01-PNC-Private-Bank-Research-Reveals-Business-Owners-Increasingly-Want-Integrated-Financial-Advice-to-Help-Align-Business,-Personal-Goals";
  return `<div class="lp"><header class="lp-head"><div class="lp-wrap"><a class="lp-logo" href="#/home"><img class="logo" src="./assets/pnc-link-logo.svg" alt="PNC-link home"></a><div class="right"><a class="lp-link" href="#/signin">Sign in</a><a class="lp-btn fill sm" href="#/guest">Get started</a></div></div></header><main id="main"><section class="lp-hero"><div class="lp-wrap lp-hero-grid"><div class="lp-hero-copy"><h1 class="lp-h1" tabindex="-1">A thoughtful transition starts with a connected plan.</h1><p>Bring your business goals, family priorities, and advisory team together, from first questions to life beyond a sale.</p><div class="lp-hero-btns"><a class="lp-btn fill" href="#/guest">Start your transition profile</a>${button("Explore the sample", "demo", "lp-btn line")}</div><p class="lp-tagline">Owner-guided discovery. Advisor-reviewed decisions. AI support along the way.</p><a class="lp-more" href="#/resources">Explore the research behind PNC-link</a></div><figure class="lp-visual"><div class="lp-family"><img src="./assets/family.png" alt="Business owners considering their family's next chapter"></div><figcaption>Business owners considering their family's next chapter</figcaption></figure></div></section><section class="lp-more-than"><div class="lp-wrap"><div class="lp-sec-h"><h2>More than a transaction.</h2><p>A common understanding of what matters, who is helping, and what happens next.</p></div><div class="lp-cards"><article class="lp-card"><span class="lp-eyebrow">For business owners</span><h3>Know your options. Keep your voice.</h3><p>Explore transition paths, prepare your family, model liquidity, and control specialist sharing. Your AI assistant helps you prepare for a trusted human conversation.</p>${button("Explore the owner journey", "demo", "lp-more")}</article><article class="lp-card"><span class="lp-eyebrow">For relationship advisors</span><h3>See the whole relationship.</h3><p>Manage your client portfolio, surface cases that need attention, map family relationships, and coordinate the next step across PNC teams.</p>${button("Explore the advisor workspace", "demoAdvisor", "lp-more")}</article></div></div></section><section class="lp-research" id="lp-research"><div class="lp-wrap"><div class="lp-research-grid"><div class="lp-research-copy"><span class="lp-eyebrow">Why connected advice matters</span><h2>Business decisions are personal decisions.</h2><p>Most owners want advice that sees their business and their family as one picture. Far fewer have it today.</p><a class="lp-more" href="${research}" target="_blank" rel="noopener noreferrer">Read the PNC research</a></div><figure class="lp-gap" aria-label="89% of surveyed owners value integrated advice; 55% use one advisor for both"><figcaption>PNC 2026 owner research</figcaption><div class="lp-gap-row"><div class="lp-gap-head"><b>89%</b><span>value advice integrating business and personal needs</span></div><div class="lp-gap-track"><i class="w89"></i></div></div><div class="lp-gap-row"><div class="lp-gap-head"><b>55%</b><span>currently use one advisor for both</span></div><div class="lp-gap-track"><i class="w55"></i><em><span>34-pt gap</span></em></div></div><div class="lp-gap-axis"><span>0%</span><span>50%</span><span>100%</span></div></figure></div><small class="lp-research-note">300 U.S. private business owners and co-owners; surveyed Nov–Dec 2025. Research supports the problem, not this product’s effectiveness.</small></div></section><section class="lp-one"><div class="lp-wrap"><h2>One relationship.</h2><div class="lp-pills"><span>Business</span><i>+</i><span>Family</span><i>+</i><span>Personal wealth</span></div></div></section></main><footer class="lp-foot2"><div class="lp-wrap">PNC-link · Case competition concept · Not an official PNC service</div></footer></div>`;
}
function authPage(kind) {
  const signup = kind === "signup",
    recover = kind === "recover",
    callback = ["reset", "invite"].includes(kind);
  const side = `<aside class="au-side"><a class="lp-logo" href="#/home"><img class="logo" src="./assets/pnc-link-logo.svg" alt="PNC-link home"></a><div class="copy"><h2>${signup ? "Start your next chapter with a connected plan." : "Plan your next chapter with us."}</h2><p>Business goals, family priorities and your advisory team in one shared plan.</p><ul><li>Owner-guided discovery</li><li>Advisor-reviewed decisions</li><li>You approve every specialist handoff</li></ul></div><div class="fam"><img src="./assets/family.png" alt=""></div></aside>`;
  if (kind === "signin")
    return `<div class="au">${side}<div class="au-main"><main class="auth au-card au-min" id="main"><h1 class="sr-only" tabindex="-1">Sign in</h1><form data-form="auth" data-kind="signin">${input("email", "Email address", "", "email", 'required autocomplete="email"')}${input("password", "Password", "", "password", 'required maxlength="256" autocomplete="current-password"')}<button class="btn">Sign in</button><p class="form-error" role="alert"></p></form>${button("Skip signup — enter portal", "guest", "au-skip")}</main></div></div>`;
  return `<div class="au">${side}<div class="au-main">${state.servicesAvailable ? "" : '<div class="demo-bar">Connected services are unavailable. Enter the portal without signup to save a case in this browser, or explore the samples.</div>'}<main class="auth au-card" id="main"><a class="au-back" href="#/home">Back to home</a>${intro(callback ? "Set your password" : recover ? "Recover your account" : signup ? "Start your next chapter." : "Welcome back.", callback ? "Use at least 12 characters." : recover ? "Request a link to set a new password." : signup ? "Create an owner account. Your advisor and specialists use separately assigned roles." : "Open your owner or advisor workspace.")}${!callback && !recover ? `<div class="callout">${button("Skip signup — enter portal", "guest", "")}<p>No account needed. Save a personal case in this browser. Shared workflows and live AI require sign in.</p></div>` : ""}<form data-form="auth" data-kind="${kind}">${signup ? input("name", "Your name", "", "text", 'required maxlength="200" autocomplete="name"') : ""}${!callback ? input("email", "Email address", "", "email", 'required autocomplete="email"') : ""}${!recover ? input("password", callback ? "New password" : "Password", "", "password", `required ${signup || callback ? 'minlength="12"' : ""} maxlength="256" autocomplete="${signup || callback ? "new-password" : "current-password"}"`) : ""}<button class="btn">${callback ? "Save password" : recover ? "Send recovery email" : signup ? "Create account" : "Sign in"}</button><p class="form-error" role="alert"></p></form><p class="footer-note">${recover || callback ? '<a href="#/signin">Back to sign in</a>' : signup ? 'Already have an account? <a href="#/signin">Sign in</a>' : '<a href="#/recover">Forgot password?</a> · <a href="#/signup">Create an owner account</a>'}</p>${!signup && !callback && !recover ? `<div class="callout"><p>Advisors and specialists: use your invited account. Access is assigned by a site administrator and by the owner’s case permissions.</p></div>` : ""}</main></div></div>`;
}
function navItems(c) {
  if (c?.mode === "specialist")
    return [
      ["overview", "Referral inbox", "01"],
      ["referrals", "My referrals", "02"],
    ];
  return [
    ["dashboard", "Dashboard", "▦"],
    ...(isAdvisor() ? [["portfolio", "Client portfolio", "↗"]] : []),
    [
      "overview",
      c?.mode === "advisor" ? "Case overview" : "My transition",
      "01",
    ],
    ["discovery", "Discovery profile", "02"],
    ["readiness", "Readiness & review", "03"],
    ["pathways", "Transition options", "04"],
    ["family", "Family & legacy", "05"],
    ["proceeds", "Proceeds & wealth", "06"],
    ["referrals", "Specialist referrals", "07"],
    ["plan", "Shared action plan", "08"],
    ["assistant", "AI assistant", "✧"],
    ["history", "Case history", "09"],
    ...(isAdvisor() ? [["metrics", "Practice insights", "10"]] : []),
    ["resources", "Planning resources", "↗"],
  ];
}
const themeKey = "pnc-link-dash-theme";
const wsTheme = () => {
  try {
    return localStorage.getItem(themeKey) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};
const logoFor = (theme) =>
  theme === "light" ? "./assets/pnc-link-logo.svg" : "./assets/pnc-link-logo-light.svg";
function sideNav(r, c) {
  const theme = wsTheme();
  const mode =
    c?.mode ?? ((state.user?.roles ?? []).includes("advisor") ? "advisor" : "owner");
  return `<aside class="sidebar ws-side"><a class="brand-box" href="#/home"><img class="logo" src="${logoFor(theme)}" alt="PNC-link home"></a><button type="button" class="ws-collapse" data-ws-collapse aria-label="Hide sidebar" title="Hide sidebar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15.5 10l-2 2 2 2"/></svg></button><p class="side-label">${mode === "advisor" ? "Advisor workspace" : mode === "specialist" ? "Specialist workspace" : "Owner workspace"}</p><nav aria-label="Workspace">${navItems(c)
    .map(
      ([id, label]) =>
        `<a class="nav-link ${r === id ? "active" : ""}" ${r === id ? 'aria-current="page"' : ""} href="#/${id}"><span class="nav-icon i-${id}" aria-hidden="true"></span>${label}</a>`,
    )
    .join("")}</nav><div class="ws-promo"><div class="ws-promo-img"><img src="./assets/family.png" alt=""></div><div class="ws-promo-body"><b>Prepare smarter with PNC\u2011link AI</b><p>Explanations, meeting agendas and questions grounded in your case.</p><a class="ws-yellow" href="#/assistant">Ask PNC\u2011link AI</a></div></div><div class="ws-theme" role="group" aria-label="Theme"><button type="button" data-ws-theme="light" class="${theme === "light" ? "on" : ""}" aria-pressed="${theme === "light"}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>Light</button><button type="button" data-ws-theme="dark" class="${theme === "dark" ? "on" : ""}" aria-pressed="${theme === "dark"}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor"/></svg>Dark</button></div></aside><div class="ws-scrim" data-ws-close></div>`;
}
const menuButton = `<button type="button" class="ws-menu" data-ws-menu aria-label="Show sidebar" title="Show sidebar"><svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true"><path d="M1 1.5h18M1 8h18M1 14.5h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
// Case picker for anyone with more than one case; shown in both header styles.
const casePicker = () =>
  state.cases.length > 1
    ? `<label class="case-pick"><span class="eyebrow">Case</span><select id="caseSelect" aria-label="Select case">${state.cases.map((x) => `<option value="${esc(x.id)}" ${x.id === state.selected ? "selected" : ""}>${esc(x.data.profile.business)}</option>`).join("")}</select></label>`
    : "";
function shell(body, r) {
  const c = current(),
    mode =
      c?.mode ??
      ((state.user?.roles ?? []).includes("advisor") ? "advisor" : "owner"),
    items = navItems(c),
    title = items.find(([id]) => id === r)?.[1] ?? "Workspace",
    who = state.demo ? "Illustrative sample" : state.user?.name || state.user?.email || "",
    roleLabel = mode === "owner" ? "Business owner" : mode === "advisor" ? "Relationship advisor" : "Approved referral recipient",
    initials = who
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0].toUpperCase())
      .join(""),
    owner = state.demoRole === "owner";
  const viewSwitch = state.demo
    ? `<div class="view-switch" role="group" aria-label="Sample view"><button type="button" class="${owner ? "on" : ""}" ${owner ? 'aria-pressed="true" disabled' : 'data-action="demoSwitch" aria-label="View as owner"'}>Client</button><button type="button" class="${owner ? "" : "on"}" ${owner ? 'data-action="demoSwitch" aria-label="View as advisor"' : 'aria-pressed="true" disabled'}>Advisor</button></div>`
    : "";
  return `<div class="shell nx ${wsTheme()}">${sideNav(r, c)}<div class="content"><header class="topbar"><div class="topbar-title">${menuButton}<p class="page-title">${esc(title)}</p>${viewSwitch}</div><div class="row topbar-right">${casePicker()}${!state.demo ? button("Refresh", "refresh", "secondary small") : ""}<div class="acct"><button type="button" class="hdr-avatar" data-acct aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarImage(c?.data.profile.name, mode) || `<span>${esc(initials || "?")}</span>`}</button><div class="acct-menu" role="menu" hidden><div class="acct-who"><b>${esc(who)}</b><span>${roleLabel}</span></div><a href="#/discovery" role="menuitem">Discovery profile</a><a href="#/resources" role="menuitem">Planning resources</a>${!state.demo ? button("Sign out", "logout", "quiet danger", 'role="menuitem"') : '<a href="#/home" role="menuitem">Leave sample</a>'}</div></div></div></header>${state.guest && !state.demo && state.user?.id === "local-guest" ? `<div class="demo-bar">Guest workspace · saved only in this browser · no advisor sharing or live AI. <a href="#/signin">Sign in</a></div>` : ""}${state.demo ? `<div class="demo-bar"><span>Read-only sample · fictional clients · no requests are sent</span><a class="btn small" href="#/signup">Create your case</a></div>` : ""}<main class="main" id="main">${body}</main></div></div>`;
}
function noCase() {
  const advisor = (state.user?.roles ?? []).some((r) =>
    ["advisor", "specialist"].includes(r),
  );
  return `${intro(advisor ? "Your workspace is ready." : "Begin with what matters.", "A shared transition profile connects the owner’s priorities with the right people and next steps.")}<div class="two-col">${panel(advisor ? "No shared cases yet" : "Create your transition profile", `<p>${advisor ? "Owners can name your account email as their advisor and explicitly share their case. Specialist cases appear after owner approval of a referral addressed to your email." : "Start with your goals, business facts, family priorities, and preferred advisor. You can update the profile as your thinking develops."}</p><a class="btn" href="#/discovery">${advisor ? "Create my own owner case" : "Start discovery"}</a>`)}${panel("What happens next", '<ol class="info-list"><li>Owner records goals and evidence availability.</li><li>Assigned advisor reviews and verifies the case.</li><li>Owner approves each specialist and scope.</li><li>Named recipient acknowledges the referral.</li></ol>')}</div>`;
}
function contextAssistant(question, label = "Ask AI for help", plain = false) {
  return plain
    ? `<button type="button" class="ld-black" data-ask="${esc(question)}">${esc(label)}</button>`
    : `<button type="button" class="btn ai-button small" data-ask="${esc(question)}"><span aria-hidden="true">✧</span> ${esc(label)}</button>`;
}
function managementPanel(c) {
  if (c.mode !== "advisor") return "";
  const m = c.data.management ?? {
    stage: "Discovery",
    nextContact: "",
    note: "",
  };
  return panel(
    "Relationship follow-up",
    `<p class="privacy-note">Advisor only · these notes are excluded from the owner and specialist views.</p><form data-form="caseManagement" class="inline-form">${select("stage", "Relationship stage", caseStages, m.stage)}${input("nextContact", "Next contact date", m.nextContact, "date")}${textarea("note", "Internal relationship note", m.note, 'maxlength="2000"')}${formEnd("Save relationship follow-up")}</form>`,
  );
}
function portfolio() {
  const rows = state.cases.filter((c) => c.mode === "advisor");
  const priorities = rows.map((c) => ({
    c,
    attention: portfolioPriority(c, today()),
  }));
  const pending = priorities.filter(
    ({ attention }) => attention.level === "High",
  );
  return `${intro("A clearer view of every client.", "See who needs a conversation, understand why, and move from a signal to a coordinated next step.", "Advisor command center")}<div class="stats">${stat("Assigned clients", rows.length, "Shared with your advisor account", true)}${stat("Needs attention", pending.length, "Meetings, due actions or follow-up")}${stat("Awaiting review", rows.filter((c) => !c.data.review).length, "Owner discovery to review")}${stat("Open handoffs", rows.flatMap((c) => c.data.referrals).filter((r) => ["Draft", "Queued", "Accepted"].includes(r.status)).length, "Across assigned clients")}</div><section class="panel attention-panel"><div class="panel-head"><div><div class="eyebrow">Relationship signals</div><h2>Start with the conversations that matter.</h2><p>Signals use recorded dates, requests and family context. They do not predict an owner’s intent or authorize outreach.</p></div>${badge("Explainable workflow rules", "gray")}</div><div class="attention-grid">${
    pending
      .slice(0, 3)
      .map(
        ({ c, attention }) =>
          `<article class="attention-card"><div class="row between">${badge("Needs attention", "amber")}<small>${esc(c.data.profile.outreach || "On request")}</small></div><h3>${esc(c.data.profile.business)}</h3><p>${esc(attention.reasons.join(" · "))}</p>${button("Review client →", "openCase", "secondary small", `data-id="${esc(c.id)}"`)}</article>`,
      )
      .join("") ||
    empty(
      "No urgent signals recorded",
      "Set follow-up dates and review shared actions to keep the relationship moving.",
    )
  }</div></section><section class="panel section-gap"><div class="panel-head"><div><h2>Client portfolio</h2><small>Only cases explicitly shared with your advisor account appear here.</small></div></div><div class="portfolio-controls"><div class="field"><label for="portfolio-search">Search clients</label><input id="portfolio-search" type="search" value="${esc(state.portfolioSearch)}" placeholder="Owner, business or industry"></div><div class="field"><label for="portfolio-stage">Stage</label><select id="portfolio-stage">${["All stages", ...caseStages].map((x) => `<option ${state.portfolioStage === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div><div class="field"><label for="portfolio-attention">Attention</label><select id="portfolio-attention">${["All clients", "Needs attention", "Awaiting review"].map((x) => `<option ${state.portfolioAttention === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="field"><label for="portfolio-sort">Sort by</label><select id="portfolio-sort">${["Attention first", "Recently updated", "Business name"].map((x) => `<option ${state.portfolioSort === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div id="portfolio-results">${portfolioResults()}</div></section>`;
}
function portfolioResults() {
  const query = state.portfolioSearch.trim().toLowerCase();
  const rows = state.cases
    .filter((c) => c.mode === "advisor")
    .map((c) => ({ c, a: portfolioPriority(c, today()) }))
    .filter(({ c, a }) => {
      const p = c.data.profile;
      return (
        (!query ||
          [p.name, p.business, p.industry].some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(query),
          )) &&
        (state.portfolioStage === "All stages" ||
          a.stage === state.portfolioStage) &&
        (state.portfolioAttention === "All clients" ||
          (state.portfolioAttention === "Needs attention"
            ? a.level === "High"
            : !c.data.review))
      );
    });
  rows.sort((x, y) =>
    state.portfolioSort === "Business name"
      ? x.c.data.profile.business.localeCompare(y.c.data.profile.business)
      : state.portfolioSort === "Recently updated"
        ? Date.parse(y.c.updatedAt) - Date.parse(x.c.updatedAt)
        : (x.a.level === "High" ? 0 : 1) - (y.a.level === "High" ? 0 : 1) ||
          x.c.data.profile.business.localeCompare(y.c.data.profile.business),
  );
  return `<p class="result-count" role="status">${rows.length} client${rows.length === 1 ? "" : "s"} shown</p>${rows.length ? `<div class="table-wrap"><table class="client-table"><caption class="sr-only">Assigned client portfolio and next steps</caption><thead><tr><th>Client relationship</th><th>Stage & evidence</th><th>Needs a conversation</th><th>Next contact</th><th>Open case</th></tr></thead><tbody>${rows.map(({ c, a }) => `<tr><td><b>${esc(c.data.profile.business)}</b><small>${esc(c.data.profile.name)} · ${esc(c.data.profile.industry)}</small></td><td>${badge(a.stage, "gray")}<small>${readiness(c.data).verified}/${readiness(c.data).total} evidence categories verified</small></td><td>${badge(a.label, a.level === "High" ? "amber" : "")}<small>${esc(a.reasons[0] || c.data.profile.trigger)} · ${a.openActions} open actions</small></td><td>${esc(a.nextContact || "Not scheduled")}<small>${esc(c.data.profile.outreach || "On request")}</small></td><td>${button("Open client", "openCase", "secondary small", `data-id="${esc(c.id)}"`)} ${button("AI brief", "caseBrief", "quiet small", `data-id="${esc(c.id)}"`)}</td></tr>`).join("")}</tbody></table></div>` : empty("No clients match", "Clear search or choose another filter. New client cases appear when an owner explicitly shares them with your invited account.")}`;
}
function resources(framed = false) {
  const content = `${framed ? '<h2 class="sr-only">A stronger plan starts with better questions.</h2>' : intro("A stronger plan starts with better questions.", "Use PNC’s published research to frame conversations about business, family and personal wealth.", "Planning resources")}<div class="resource-grid"><article class="panel res-card"><span class="ld-ic y res-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16h16"/><path d="M7.5 14.5l3.5-4 3 2.5 4.5-6"/></svg></span><div class="eyebrow">Integrated advice · April 2026</div><h2>Bring the business and personal plan together.</h2><p>PNC’s owner research highlights demand for connected advice and barriers to succession planning. It informs the problem we address; customer interviews must still test this solution.</p><a class="btn secondary small" target="_blank" rel="noopener noreferrer" href="https://pnc.mediaroom.com/2026-04-01-PNC-Private-Bank-Research-Reveals-Business-Owners-Increasingly-Want-Integrated-Financial-Advice-to-Help-Align-Business,-Personal-Goals">Read the research ↗</a><small class="resource-note">Ipsos online survey of 300 U.S. private business owners/co-owners, Nov 19–Dec 10, 2025. Revenue cohorts: $10–50M and $50–125M.</small></article><article class="panel res-card"><span class="ld-ic b res-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/></svg></span><div class="eyebrow">Family continuity · November 2024</div><h2>Fairness, ownership and liquidity can differ.</h2><p>PNC’s estate equalization article explores differing family roles and illiquid business interests. Use it to prepare questions for estate and insurance specialists; no single allocation fits every family.</p><a class="btn secondary small" target="_blank" rel="noopener noreferrer" href="https://www.pnc.com/insights/wealth-management/business-continuity-and-succession-planning/estate-equalization-through-life-insurance.html">Explore estate equalization ↗</a></article><article class="panel res-card"><span class="ld-ic g res-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3 19c.6-3.5 2.8-5.3 5.5-5.3s4.9 1.8 5.5 5.3M14.6 14.4c.6-.3 1.2-.4 1.9-.4 2.3 0 3.9 1.5 4.5 4.6"/></svg></span><div class="eyebrow">PNC capabilities</div><h2>Connect existing expertise around the owner.</h2><p>PNC’s corporate profile describes banking, business advisory and asset-management services. PNC-link proposes a shared workflow across that ecosystem; the prototype does not connect to internal PNC systems.</p><a class="btn secondary small" target="_blank" rel="noopener noreferrer" href="https://www.pnc.com/en/about-pnc/media/facts-about-pnc.html">View Facts About PNC ↗</a></article></div><section class="panel section-gap"><h2>Questions to take into your next meeting</h2><ul class="info-list"><li>Who wants to operate the business, and who wants an ownership interest?</li><li>How do liquidity, legacy, employee continuity and retained control rank for you?</li><li>What information would you want reviewed before choosing a path?</li><li>How should personal wealth and family conversations begin before a transition?</li></ul>${state.user || state.demo ? contextAssistant("Help me prepare questions for a family business transition, using my recorded priorities and PNC's estate equalization resource.", "Prepare questions with AI") : '<a class="btn" href="#/guest">Start your transition profile</a>'}</section>`;
  return content;
}
// Small inline charts for My transition (no inline styles: CSP).
function progressRing(done, total, label = `${done}/${total}`, sub = "steps") {
  const r = 46,
    c = 2 * Math.PI * r,
    f = total ? done / total : 0;
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" class="mt-ring-track" stroke-width="12"/><circle cx="60" cy="60" r="${r}" fill="none" class="mt-ring-fill" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="${sub ? 58 : 66}" text-anchor="middle" class="mt-ring-num">${label}</text>${sub ? `<text x="60" y="78" text-anchor="middle" class="mt-ring-sub">${sub}</text>` : ""}</svg>`;
}
function horizonBar(years) {
  const y0 = Number(years) || 0,
    max = Math.max(5, Math.ceil(y0)),
    pct = (Math.min(y0, max) / max) * 100;
  const labels = Array.from({ length: max + 1 }, (_, y) => `<span>${y === 0 ? "Today" : `${y}y`}</span>`).join("");
  return `<div class="mt-track"><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="4" class="mt-ring-track-fill"/><rect width="${pct.toFixed(1)}" height="8" rx="4" class="mt-bar"/></svg><span class="mt-pin" data-left="${pct.toFixed(1)}"></span></div><div class="mt-axis-row">${labels}</div>`;
}
// Owners and advisors see My transition in the dashboard frame (see render); this covers
// the no-case and specialist views.
function overview(c) {
  if (!c) return noCase();
  return `${intro("Your specialist inbox", "Review the approved purpose and information scope before acknowledging the handoff.")}${referrals(c)}`;
}
// Readiness & review pieces for the dashboard frame (checkbox names and statuses unchanged).
function readinessParts(c) {
  const d = c.data;
  return {
    rows: d.evidence.map((e) => ({
      label: e.label,
      state: e.verified ? "verified" : e.reported ? "available" : "none",
      status: e.verified ? "Advisor verified" : e.reported ? "Available; verification pending" : "Not yet confirmed",
      available: `<label class="rd-sw"><input type="checkbox" data-evidence="${esc(e.label)}" ${e.reported ? "checked" : ""} ${c.mode !== "owner" || state.demo ? "disabled" : ""}><i aria-hidden="true"></i>Available</label>`,
      verified: `<label class="rd-sw"><input type="checkbox" data-evidence="${esc(e.label)}" ${e.verified ? "checked" : ""} ${c.mode !== "advisor" || !e.reported || state.demo ? "disabled" : ""}><i aria-hidden="true"></i>Verified</label>`,
    })),
    review:
      c.mode === "advisor"
        ? `<form data-form="review" class="inline-form">${textarea("note", "Findings and recommended next steps", d.review?.note ?? "", "required")}<label class="check"><input type="checkbox" name="qualified" ${d.qualified ? "checked" : ""}><span>Qualify this opportunity for specialist discovery. I have reviewed the goals and verified at least two evidence categories.</span></label>${formEnd("Record advisor review")}</form>`
        : d.review
          ? `<p class="review-note">${esc(d.review.note)}</p><small>${date(d.review.at)} · ${esc(d.review.by)}</small>`
          : empty("Review pending", "Your assigned advisor records findings and qualification here."),
    reviewBadge: badge(d.review ? "Recorded" : "Pending", d.review ? "" : "amber"),
  };
}
// Your next conversation: booked meetings (latest first) with cancel, then the request form.
function meetingPanel(c) {
  const d = c.data,
    owner = c.mode === "owner",
    all = [...(d.meeting ? [d.meeting] : []), ...(d.meetingHistory ?? [])];
  const form = owner
    ? `<form data-form="meeting" class="inline-form">${input("topic", "Meeting topic", "Discuss my transition priorities", "text", 'required maxlength="500"')}${formEnd(all.length ? "Request another meeting" : "Request advisor meeting")}</form>`
    : "";
  const ack =
    c.mode === "advisor" && d.meeting && !["Completed", "Cancelled"].includes(d.meeting.status)
      ? button(d.meeting.status === "Requested" ? "Acknowledge request" : "Mark meeting completed", "meetingStatus", "", `data-status="${d.meeting.status === "Requested" ? "Acknowledged" : "Completed"}" ${locked()}`)
      : "";
  if (!all.length)
    return `<div class="ld-meet-empty">${empty("Align on the next step", "Discuss the transition trigger, missing evidence, and owner outcomes before selecting a path.")}${form}</div>`;
  const rows = all
    .map((m) => {
      const [what, who, when] = String(m.topic).split(" · "),
        open = !["Completed", "Cancelled"].includes(m.status);
      return `<li class="ld-bk ${m.status.toLowerCase()}"><div><b>${esc(who || what)}</b><small>${esc(when || `Requested ${date(m.requestedAt)}`)}</small>${who ? `<small>${esc(what)}</small>` : ""}</div><span class="ld-bk-side">${badge(m.status, m.status === "Cancelled" ? "gray" : "")}${owner && open && !state.demo ? `<button type="button" class="ld-cancel" data-action="meetingCancel" data-at="${esc(m.requestedAt)}">Cancel</button>` : ""}</span></li>`;
    })
    .join("");
  return `<div class="ld-meet-list"><small class="ld-eyebrow">Booked meetings</small><ul class="ld-bks">${rows}</ul>${ack}${form}</div>`;
}
// Content pieces for My transition, rendered in the dashboard frame by link-dash.js.
function transitionParts(c) {
  const d = c.data,
    p = d.profile,
    journey = transitionJourney(d),
    done = journey.filter((j) => j.status === "Complete").length;
  return {
    badges: `${badge(d.review ? "Advisor reviewed" : "Awaiting advisor review", d.review ? "" : "amber")}${badge(d.qualified ? "Qualified opportunity" : "Discovery in progress", "gray")}${badge(`Revision ${c.revision}`, "gray")}`,
    assistant: `<button type="button" class="ld-black" data-ask="${esc(c.mode === "advisor" ? "Prepare a concise advisor meeting brief: owner goals, family dynamics, missing evidence, open decisions and three next actions. Separate known facts from questions." : "Help me understand my next three steps using my business goals and family priorities.")}">Prepare my next conversation</button>`,
    brief: `<button type="button" class="ld-black" data-action="downloadBrief">Download meeting brief</button>`,
    meeting: meetingPanel(c),
    management: managementPanel(c),
    liquidity: money(p.liquidity),
    retainedRing: progressRing(Number(p.retained) || 0, 100, `${esc(p.retained)}%`, ""),
    horizon: horizonBar(p.timeline),
    journeyRing: progressRing(done, journey.length),
  };
}
// Profile photo: James D. Bennett (sample and test case) has a portrait; the sample advisor
// keeps the demo photo; everyone else gets initials.
const JD_NAME = "James D. Bennett";
function avatarImage(name, mode) {
  if (mode === "owner" && name === JD_NAME) return '<img src="./assets/jd-avatar.jpg" alt="">';
  if (state.demo) return '<img src="./assets/icons/hdr-avatar.png" alt="">';
  return "";
}
// Avatar button with the account menu, used in the dashboard-style header.
function accountMenu(name, mode) {
  const who = state.demo ? "Illustrative sample" : state.user?.name || state.user?.email || "",
    roleLabel = mode === "owner" ? "Business owner" : mode === "advisor" ? "Relationship advisor" : "Approved referral recipient",
    letters = String(name ?? "")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0].toUpperCase())
      .join("");
  return `<div class="acct"><button type="button" class="ld-avatar" data-acct aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarImage(name, mode) || `<span>${esc(letters || "?")}</span>`}</button><div class="acct-menu" role="menu" hidden><div class="acct-who"><b>${esc(who)}</b><span>${roleLabel}</span></div><a href="#/discovery" role="menuitem">Discovery profile</a><a href="#/resources" role="menuitem">Planning resources</a>${!state.demo ? button("Sign out", "logout", "quiet danger", 'role="menuitem"') : '<a href="#/home" role="menuitem">Leave sample</a>'}</div></div>`;
}
function discovery(c) {
  const p = c?.data.profile ?? {
      name: state.user?.name ?? "",
      business: "",
      industry: "",
      trigger: "Not sure yet",
      timeline: 3,
      futureRole: "Not sure yet",
      revenue: "",
      ebitda: "",
      debt: 0,
      ownership: 100,
      liquidity: 0,
      retained: 0,
      outreach: "On request",
    },
    editable = !c || c.mode === "owner",
    disabled = !editable || state.demo ? "disabled" : "";
  const card = (icon, tone, title, sub, body, cls = "") =>
    `<section class="dv-card ${cls}"><div class="dv-head"><span class="dv-ic ${tone}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span><div><h2>${title}</h2><small>${sub}</small></div></div><div class="dv-body">${body}</div></section>`;
  const ic = {
    owner: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    advisor: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M9 6V4.5h6V6M3 11.5h18"/>',
    money: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M7 15h3"/>',
    people: '<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3 19c.6-3.5 2.8-5.3 5.5-5.3s4.9 1.8 5.5 5.3M14.6 14.4c.6-.3 1.2-.4 1.9-.4 2.3 0 3.9 1.5 4.5 4.6"/>',
    words: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  };
  return `${intro("The full picture starts here.", "Capture the business facts and personal priorities that shape a transition. Your answers feed the shared assessment and proceeds model.")}<form data-form="profile" class="dv"><fieldset ${disabled} class="profile-fields dv-fields">
    <div class="dv-row three">
      ${card(ic.owner, "y", "Owner &amp; business", "Who and what this plan is for", `${input("name", "Owner name", p.name, "text", 'required maxlength="200"')}${input("business", "Business name", p.business, "text", 'required maxlength="200"')}${input("industry", "Industry", p.industry, "text", 'required maxlength="200"')}`)}
      ${card(ic.goal, "b", "Transition goals", "Why now, when, and your role after", `${select("trigger", "What brings you here?", ["Not sure yet", "Retirement", "Family succession", "Unsolicited offer", "Liquidity need", "Partner change", "Growth capital"], p.trigger)}${input("timeline", "Years until preferred transition", p.timeline, "number", 'required min="0" max="30" step="0.5"')}${select("futureRole", "Your desired future role", ["Not sure yet", "Exit fully", "Step back gradually", "Continue leading"], p.futureRole)}`)}
      ${card(ic.advisor, "g", "Advisor &amp; engagement", "How and with whom you work", `${select("outreach", "Preferred engagement", ["On request", "Email with permission", "Meeting only"], p.outreach)}${input("advisorEmail", "Assigned advisor email (optional)", p.advisorEmail, "email", 'maxlength="254"', "Use your advisor’s invited account email. Only that account with the advisor role can open the full case.")}`)}
    </div>
    <div class="dv-row two">
      ${card(ic.money, "p", "Business and liquidity", "Figures feed the proceeds model", `<div class="dv-grid">${input("revenue", "Annual revenue ($)", p.revenue, "number", 'required min="0" max="1000000000000" step="1"')}${input("ebitda", "Annual EBITDA ($)", p.ebitda, "number", 'required min="0" max="1000000000000" step="1"', "Use a consistent annual period. The simple multiple model supports nonnegative EBITDA only.")}${input("debt", "Outstanding business debt ($)", p.debt, "number", 'required min="0" max="1000000000000" step="1"')}${input("ownership", "Your current ownership (%)", p.ownership, "number", 'required min="0.01" max="100" step="0.01"')}${input("liquidity", "Desired personal liquidity ($)", p.liquidity, "number", 'required min="0" max="1000000000000" step="1"')}${input("retained", "Desired retained ownership after transition (%)", p.retained, "number", 'required min="0" max="100" step="1"')}</div>`)}
      ${card(ic.people, "l", "People, legacy, and trust", "Successors, family and estate", `<div class="dv-grid">${select("successor", "Successor readiness", successorOptions, p.successor ?? successorOptions[0])}${select("familyReadiness", "Family alignment", familyReadinessOptions, p.familyReadiness ?? familyReadinessOptions[0])}${select("estateStatus", "Estate and succession review", estateStatusOptions, p.estateStatus ?? estateStatusOptions[0])}</div><fieldset class="priority-choices field full"><legend>What matters most in this decision?</legend><div class="row">${decisionPriorityOptions.map((x) => `<label class="check"><input type="checkbox" name="decisionPriorities" value="${esc(x)}" ${(p.decisionPriorities ?? []).includes(x) ? "checked" : ""}>${esc(x)}</label>`).join("")}</div></fieldset>`)}
    </div>
    <div class="dv-row two">
      ${card(ic.words, "y", "Priorities in your words", "Family, legacy and your team", `${textarea("priorities", "Family and legacy priorities", p.priorities, 'maxlength="1000"')}${textarea("employeePriorities", "Employee and management priorities", p.employeePriorities, 'maxlength="1000"')}`)}
      ${card(ic.lock, "b", "Confidentiality and notes", "What stays private, and open questions", `${textarea("confidentiality", "Confidentiality requirements", p.confidentiality, 'maxlength="1000"')}${textarea("notes", "Other context and open questions", p.notes)}`)}
    </div>
    <div class="dv-save"><label class="check field full"><input name="shareWithAdvisor" type="checkbox" ${p.shareWithAdvisor ? "checked" : ""}><span>I allow the named advisor to access this full case, including family and personal planning context. Changing or removing the advisor revokes their access. Specialist sharing requires separate approval.</span></label>${editable ? formEnd(c ? "Save discovery profile" : state.guest ? "Create local case" : "Create shared case") : '<p class="footer-note">The owner maintains discovery answers. Record your findings in Readiness &amp; review.</p>'}</div>
  </fieldset></form>`;
}
function readinessPage(c) {
  const d = c.data,
    r = readiness(d);
  return `${intro("Evidence before conclusions.", "Track what is available, what the advisor has verified, and what still needs a conversation. No files are uploaded here.")}<div class="stats">${stat("Owner-reported availability", `${r.score}%`, `${r.reported}/${r.total} categories`, true)}${stat("Advisor verification", `${r.verifiedScore}%`, `${r.verified}/${r.total} categories`)}${stat("Review", d.review ? "Recorded" : "Pending", "Human findings and next steps")}${stat("Opportunity", d.qualified ? "Qualified" : "Discovery", "Advisor determination")}</div><div class="two-col">${panel("Readiness evidence", `<div class="checklist">${d.evidence.map((e) => `<div class="check-row"><div><b>${esc(e.label)}</b><small>${e.verified ? "Advisor verified" : e.reported ? "Available; verification pending" : "Not yet confirmed"}</small></div><div class="row"><label class="check"><input type="checkbox" data-evidence="${esc(e.label)}" ${e.reported ? "checked" : ""} ${c.mode !== "owner" || state.demo ? "disabled" : ""}> Available</label><label class="check"><input type="checkbox" data-evidence="${esc(e.label)}" ${e.verified ? "checked" : ""} ${c.mode !== "advisor" || !e.reported || state.demo ? "disabled" : ""}> Verified</label></div></div>`).join("")}</div><p class="footer-note">The checklist measures evidence completeness, not financial health or readiness to sell. Advisor verification is a recorded review, not an automated document check.</p>`)}<div class="stack">${panel("Advisor review", c.mode === "advisor" ? `<form data-form="review" class="inline-form">${textarea("note", "Findings and recommended next steps", d.review?.note ?? "", "required")}<label class="check"><input type="checkbox" name="qualified" ${d.qualified ? "checked" : ""}><span>Qualify this opportunity for specialist discovery. I have reviewed the goals and verified at least two evidence categories.</span></label>${formEnd("Record advisor review")}</form>` : d.review ? `<p class="review-note">${esc(d.review.note)}</p><small>${date(d.review.at)} · ${esc(d.review.by)}</small>` : empty("Review pending", "Your assigned advisor records findings and qualification here."))}${panel("Keep professional judgment central", "<p>Formal valuations, buyer selection, financing, tax, legal matters, and final recommendations remain with qualified professionals. AI can help identify questions; it cannot approve this case.</p>")}</div></div>`;
}
// Shared pieces for workspace pages in the dashboard frame: KPI tiles and simple bar charts.
const kpis = (items) =>
  `<div class="ld-kpis rd-kpis">${items
    .map(([label, value, note]) => `<div class="ld-card ld-kpi"><small>${label}</small><b class="${String(value).replace(/<[^>]+>/g, "").length > 12 ? "kp-txt" : ""}">${value}</b><span>${note}</span></div>`)
    .join("")}</div>`;
const shortMoney = (v) => {
  const a = Math.abs(v),
    sign = v < 0 ? "−" : "";
  return a >= 1e6 ? `${sign}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${sign}$${Math.round(a / 1e3)}K` : `${sign}$${Math.round(a)}`;
};
// Horizontal bars on one scale; rows are [class, label, value, shown value].
const barRows = (rows, max) =>
  `<div class="hs-bars">${rows
    .map(([cls, label, v, shown]) => `<div class="hs-bar wide"><span>${label}</span><div class="rd-fn-track">${v > 0 ? `<i class="${cls}" data-w="${Math.min(100, (v / (max || 1)) * 100).toFixed(1)}"></i>` : ""}</div><b>${shown ?? v}</b></div>`)
    .join("")}</div>`;

// General characteristics on a 1–3 scale, read from each path's description in domain.mjs.
const PATH_TRAITS = {
  "Strategic sale": [3, 1, 2, 1],
  "PE with rollover": [2, 2, 2, 3],
  "Family transfer": [1, 3, 1, 2],
  "Management transfer": [1, 1, 1, 2],
  ESOP: [2, 2, 1, 2],
  "Partial recapitalization": [2, 2, 2, 3],
  "Prepare / delayed exit": [1, 3, 1, 3],
};
const TRAIT_COLS = ["Cash at close", "Control you keep", "Speed to close", "Your ongoing role"];
const TRAIT_WORDS = ["Low", "Medium", "High"];
function pathMatrix(suggested, chosen) {
  return `<div class="pm" role="table" aria-label="Transition paths compared"><div class="pm-row pm-head" role="row"><span role="columnheader">Path</span>${TRAIT_COLS.map((c) => `<span role="columnheader">${c}</span>`).join("")}</div>${paths
    .map((p) => {
      const t = PATH_TRAITS[p.name] ?? [0, 0, 0, 0],
        tag = chosen === p.name ? '<em class="pm-tag on">Your direction</em>' : suggested.includes(p.name) ? '<em class="pm-tag">Discuss</em>' : "";
      return `<div class="pm-row ${chosen === p.name ? "chosen" : ""}" role="row"><span role="rowheader"><span class="pm-ic">${pathIcon(p.name)}</span><b>${esc(p.name)}</b>${tag}</span>${t
        .map((v, i) => `<span role="cell" class="pm-cell" aria-label="${TRAIT_COLS[i]}: ${TRAIT_WORDS[v - 1] ?? "Varies"}"><i class="pm-pips l${v}"><i></i><i></i><i></i></i><small>${TRAIT_WORDS[v - 1] ?? "Varies"}</small></span>`)
        .join("")}</div>`;
    })
    .join("")}</div>`;
}

// Enterprise value down to available cash, one step per deduction.
function proceedsWaterfall(p, s, r) {
  const others = Math.max(0, Math.max(0, r.equity) - r.share),
    steps = [
      ["Enterprise value", r.ev, "total"],
      ["Debt", -p.debt, "neg"],
      ["Fees", -r.fees, "neg"],
      ["Other owners", -others, "neg"],
      ["Rollover", -r.rollover, "roll"],
      ["Tax", -r.tax, "neg"],
      ["Family", -s.family, "fam"],
      [r.cash < 0 ? "Shortfall" : "Available cash", r.cash, r.cash < 0 ? "short" : "cash"],
    ],
    W = 1000,
    H = 250,
    top = 24,
    base = 210,
    max = Math.max(r.ev, 1),
    y = (v) => base - (Math.max(0, v) / max) * (base - top),
    bw = (W - 40) / steps.length;
  let run = 0,
    g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="wf-axis"/>`;
  steps.forEach(([label, v, kind], i) => {
    const x = 20 + i * bw + bw * 0.15,
      w = bw * 0.7;
    let a, b;
    if (kind === "total") (a = 0), (b = v), (run = v);
    else if (kind === "cash" || kind === "short") (a = 0), (b = Math.max(0, v));
    else (a = run + v), (b = run), (run = a);
    const y1 = y(Math.max(a, b)),
      h = Math.max(2, y(Math.min(a, b)) - y1);
    g += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5" class="wf-${kind}"><title>${label}: ${money(v)}</title></rect>`;
    if (i < steps.length - 1 && kind !== "cash") g += `<line x1="${(x + w).toFixed(1)}" x2="${(x + bw).toFixed(1)}" y1="${y(run).toFixed(1)}" y2="${y(run).toFixed(1)}" class="wf-link"/>`;
    g += `<text x="${(x + w / 2).toFixed(1)}" y="${(y1 - 7).toFixed(1)}" text-anchor="middle" class="wf-val">${v === 0 ? "$0" : shortMoney(v)}</text><text x="${(x + w / 2).toFixed(1)}" y="${base + 20}" text-anchor="middle" class="wf-lbl">${label}</text>`;
  });
  if (p.liquidity > 0 && p.liquidity <= max) g += `<line x1="0" x2="${W}" y1="${y(p.liquidity).toFixed(1)}" y2="${y(p.liquidity).toFixed(1)}" class="wf-goal"/><text x="${(20 + bw).toFixed(1)}" y="${(y(p.liquidity) - 6).toFixed(1)}" class="wf-goal-l">Liquidity goal ${shortMoney(p.liquidity)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Enterprise value ${money(r.ev)} reduced to ${money(r.cash)} available cash">${g}</svg>`;
}

const REFERRAL_STEPS = [
  ["Proposed", "createdAt"],
  ["Owner approved", "approvedAt"],
  ["Specialist accepted", "acceptedAt"],
  ["Handoff completed", "completedAt"],
];
function referralSteps(r) {
  const stopped = ["Withdrawn", "Declined"].includes(r.status),
    reached = { Draft: 1, Queued: 2, Accepted: 3, Completed: 4 }[r.status] ?? REFERRAL_STEPS.filter(([, k]) => r[k]).length;
  return `<ol class="rf-steps ${stopped ? "stopped" : ""}" aria-label="Handoff progress: ${esc(r.status)}">${REFERRAL_STEPS.map(([label, k], i) => `<li class="${i < reached ? "done" : ""} ${i === reached && !stopped ? "next" : ""}"><i></i><b>${label}</b><small>${r[k] ? date(r[k]) : i === reached && !stopped ? "Next step" : ""}</small></li>`).join("")}${stopped ? `<li class="halt"><i></i><b>Access stopped</b><small>${r.status === "Withdrawn" ? "Owner withdrew" : "Specialist declined"}</small></li>` : ""}</ol>`;
}

function pathways(c) {
  const d = c.data,
    suggested = suggestedPaths(d.profile),
    decision = d.pathDecision;
  const priorities = d.profile.decisionPriorities ?? [];
  return `<h2 class="sr-only">Choose the outcome before the structure.</h2>${kpis([
    ["Working direction", esc(decision?.path || "Options open"), decision?.path ? "Owner preference, subject to review" : "No direction recorded yet"],
    ["Paths to discuss", `${suggested.length}<em>/${paths.length}</em>`, "Matched to your recorded goals"],
    ["Top priority", esc(priorities[0] || "Not ranked"), priorities.length > 1 ? `Then ${esc(priorities.slice(1, 3).join(", "))}` : "From your discovery profile"],
    ["Desired role", esc(d.profile.futureRole || "Not recorded"), "After the transition"],
  ])}<section class="panel"><div class="panel-head"><div><h2>Paths at a glance</h2><small>General characteristics of each path, not a fit score for your business. Highlighted paths follow simple rules based on your recorded goals; no buyer interest is inferred.</small></div></div>${pathMatrix(suggested, decision?.path)}</section><div class="two-col section-gap">${panel("Your working direction", c.mode === "owner" ? `<form data-form="pathDecision" class="inline-form"><div class="field"><label for="field-path">Path to discuss</label><select name="path" id="field-path"><option value="">Keep my options open</option>${paths.map((p) => `<option ${decision?.path === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>${textarea("reason", "Why this direction and what remains uncertain", decision?.reason ?? "", 'maxlength="2000"')}${formEnd("Save working direction")}</form>` : `<h3>${esc(decision?.path || "Options remain open")}</h3><p>${esc(decision?.reason || "The owner has not recorded a preferred direction.")}</p>`, "An owner preference, subject to advisor and specialist review.")}${panel("Prepare the decision conversation", `<p>Your priorities: ${esc((d.profile.decisionPriorities ?? []).join(", ") || "Not ranked yet")}. Your desired role: ${esc(d.profile.futureRole)}.</p>${contextAssistant("Compare the transition paths against my recorded decision priorities, successor readiness and preferred role. Explain tradeoffs and unanswered questions, without recommending a transaction.", "Compare my options with AI")}<p class="footer-note">Saving or changing a direction clears the case review and withdraws existing referrals for renewed owner approval.</p>`)}</div><div class="path-grid section-gap">${paths
    .map((p) => {
      const reasons = pathReasons(d.profile, p.name);
      return `<article class="path-card ${suggested.includes(p.name) ? "suggested" : ""}"><span class="ld-path-ic c${paths.indexOf(p) % 4}">${pathIcon(p.name)}</span>${badge(decision?.path === p.name ? "Your working direction" : suggested.includes(p.name) ? "Discuss based on your goals" : "Alternative to explore", suggested.includes(p.name) ? "" : "gray")}<h2>${p.name}</h2><p>${p.people}</p>${reasons.length ? `<p class="path-reason"><strong>Why discuss it</strong><br>${esc(reasons.join(" "))}</p>` : ""}<dl class="definition"><dt>Liquidity</dt><dd>${p.liquidity}</dd><dt>Control</dt><dd>${p.control}</dd><dt>Future role</dt><dd>${p.role}</dd><dt>Timing</dt><dd>${p.timing}</dd><dt>Certainty</dt><dd>${p.certainty}</dd><dt>Potential team</dt><dd>${p.team}</dd></dl></article>`;
    })
    .join(
      "",
    )}</div><p class="footer-note">Confidentiality and disclosure requirements apply to every path. Buyer selection and outreach require professional review and owner permission. ESOP feasibility requires specialist and fiduciary advice.</p>`;
}
function familyPage(c) {
  const d = c.data,
    plan = { ...defaultFamilyPlan, ...d.familyPlan },
    b = familyBalance(plan),
    editable = c.mode === "owner",
    people = d.stakeholders ?? [];
  return `<h2 class="sr-only">Plan for the people behind the business.</h2>${kpis([
    ["Successor readiness", esc(d.profile.successor ?? "Not discussed"), "Owner-reported"],
    ["Family alignment", esc(d.profile.familyReadiness ?? "Not discussed"), "A discussion status, not a diagnosis"],
    ["Estate review", esc(d.profile.estateStatus ?? "Not reviewed"), "Update in Discovery"],
    ["Relationships mapped", people.length, "No access or outreach is granted"],
  ])}<section class="panel"><div class="panel-head"><div><h2>Your family and trusted advisors</h2><p>Map who may be part of the next chapter. Listing a person does not invite them, share their information with specialists, or give anyone account access.</p></div>${contextAssistant("Help me prepare a family meeting agenda. Distinguish operating roles, ownership expectations, fairness and who is ready to participate.", "Prepare a family conversation", true)}</div><div class="relationship-map"><div class="relationship-center">${personAvatar(d.profile.name, "lg")}<div><b>${esc(d.profile.name)}</b><small>Business owner · ${esc(d.profile.business)}</small></div></div><div class="relationship-grid">${people.map((person) => `<article class="relationship-card"><div class="row between"><span class="rc-who">${personAvatar(person.name)}<h3>${esc(person.name)}</h3></span>${editable ? button("Edit", "editStakeholder", "quiet small", `data-id="${esc(person.id)}" ${locked()}`) : ""}</div><small>${esc(person.relationship)}</small><p>${esc(person.role)}</p>${badge(person.engagement, person.engagement === "Not discussed" ? "gray" : "")}<p class="relationship-notes">${esc(person.notes)}</p>${editable ? button("Remove", "removeStakeholder", "quiet small", `data-id="${esc(person.id)}" ${locked()}`) : ""}</article>`).join("") || empty("Who should be part of the conversation?", "Start with successors, family members outside the business and trusted advisors. Record willingness rather than assuming participation.")}</div></div>${editable ? `<details class="relationship-add"><summary>Add a relationship</summary><form data-form="stakeholder" class="inline-form" id="stakeholder-form"><input type="hidden" name="id" value=""><div class="form-grid">${input("name", "Person’s name", "", "text", 'required maxlength="200"')}${input("relationship", "Relationship to owner", "", "text", 'required maxlength="200"')}${select("role", "Business participation", stakeholderRoles, stakeholderRoles[0])}${select("engagement", "Discussion preference", stakeholderEngagementOptions, stakeholderEngagementOptions[0])}${textarea("notes", "Relationship context and open questions", "", 'maxlength="1500"').replaceAll("field-notes", "stakeholder-notes")}</div><p class="footer-note">This records the owner’s understanding. It is not verified consent from this person or permission for a bank to contact them.</p>${formEnd("Save relationship")}</form></details>` : ""}</section><div class="two-col section-gap"><section class="panel"><div class="eyebrow">An illustration to discuss</div><h2>Business ownership and family liquidity</h2><p>Explore equal-value shares as one conversation starter. These figures are independent of your sale proceeds scenario. Use the value of <strong>your business interest</strong>, not the full company value unless you own it all.</p><form data-form="familyPlan"><fieldset ${!editable || state.demo ? "disabled" : ""}><div class="form-grid">${input("businessValue", "Your business interest value ($)", plan.businessValue, "number", 'required min="0" max="1000000000000" step="1"')}${input("nonBusinessAssets", "Other personal assets ($)", plan.nonBusinessAssets, "number", 'required min="0" max="1000000000000" step="1"')}${input("liabilities", "Personal liabilities ($)", plan.liabilities, "number", 'required min="0" max="1000000000000" step="1"')}${input("availableLiquidity", "Liquid portion of other assets ($)", plan.availableLiquidity, "number", 'required min="0" max="1000000000000" step="1"', "Included in other personal assets above; not additional assets.")}${input("beneficiaries", "Number of beneficiaries", plan.beneficiaries, "number", 'required min="1" max="100" step="1"')}${input("businessRecipients", "Beneficiaries receiving the business interest", plan.businessRecipients, "number", 'required min="1" max="100" step="1"')}${input("insuranceBenefit", "Hypothetical future insurance death benefit ($)", plan.insuranceBenefit, "number", 'required min="0" max="1000000000000" step="1"', "A separate future illustration. Not current cash, a quote or recommended coverage.")}${textarea("notes", "Family plan assumptions and questions", plan.notes)}</div></fieldset>${editable ? formEnd("Save family assumptions") : ""}</form><p class="footer-note">Changing family assumptions or relationship entries clears the case review and withdraws existing referrals for renewed approval.</p></section><div class="stack">${panel(
    "An equal-value illustration",
    d.familyPlan
      ? `<p class="chart-cap">Can assets outside the business give the other beneficiaries an equal share?</p>${barRows(
          [
            ["n", "Target for others", b.nonBusinessTarget, shortMoney(b.nonBusinessTarget)],
            ["a", "Other assets", b.nonBusinessAvailable, shortMoney(b.nonBusinessAvailable)],
            ["v", "Liquid now", b.liquidAvailable, shortMoney(b.liquidAvailable)],
          ],
          Math.max(b.nonBusinessTarget, b.nonBusinessAvailable, b.liquidAvailable),
        )}<p class="chart-cap">${b.equalizationGap > 0 ? `Asset gap ${money(b.equalizationGap)} · liquidity gap ${money(b.liquidityGap)}.` : b.liquidityGap > 0 ? `Assets cover the target; liquidity gap ${money(b.liquidityGap)}.` : "Assets and current liquidity cover the target."}</p><div class="money-rows">${[
          ["Net assets in this illustration", b.netEstate],
          ["Equal-value share per beneficiary", b.equalShare],
          [
            "Target for beneficiaries outside the business",
            b.nonBusinessTarget,
          ],
          ["Other assets after liabilities", b.nonBusinessAvailable],
          ["Asset gap against that target", b.equalizationGap],
          ["Current liquid resources after liabilities", b.liquidAvailable],
          ["Current liquidity gap", b.liquidityGap],
        ]
          .map(
            ([label, v]) =>
              `<div class="money-row"><span>${label}</span><strong>${money(v)}</strong></div>`,
          )
          .join(
            "",
          )}</div>${plan.insuranceBenefit > 0 ? `<div class="callout"><p>If the hypothetical death benefit were available at a future death, the gap against the <em>unchanged current target</em> would be ${money(b.illustrativeBenefitGap)}. This excludes premiums, underwriting, policy terms, estate treatment, timing and any change to the target itself.</p></div>` : ""}<p class="footer-note">Personal liabilities are conservatively deducted from non-business assets and liquidity. No estate taxes or costs are modeled. If liabilities exceed total assets, this illustration floors net assets at zero; seek professional review.</p>`
      : empty(
          "Start with your own assumptions",
          "Save the owner's stake value and other assets to see the illustration. Missing information is not a zero-value assessment.",
        ),
  )}${panel("Advisor review of family assumptions", c.mode === "advisor" ? `<form data-form="familyReview" class="inline-form">${textarea("note", "Family review findings and professional questions", d.familyReview?.note ?? "", 'required maxlength="3000"')}${formEnd("Record family review")}</form>` : d.familyReview ? `<p class="review-note">${esc(d.familyReview.note)}</p><small>Recorded ${date(d.familyReview.at)}</small>` : empty("Review pending", "Your advisor can document assumptions, control questions and estate-specialist conversations."))}${panel("Fairness needs a human conversation", '<p>Equal shares are only one option. Consider control, work, risk, family expectations and the owner’s own needs. Discuss estate planning and any insurance with qualified professionals.</p><a class="text-link" href="https://www.pnc.com/insights/wealth-management/business-continuity-and-succession-planning/estate-equalization-through-life-insurance.html" target="_blank" rel="noopener noreferrer">PNC: estate equalization and family continuity</a>')}</div></div>`;
}
function valuationPanel(c) {
  const v = c.data.valuationReview;
  return panel(
    "Advisor’s preliminary value perspective",
    `${v ? `<p class="value-range">${money(v.low)} – ${money(v.high)}</p><p>${esc(v.basis)}</p><small>Recorded ${date(v.at)}. A discussion perspective, not a certified appraisal.</small>` : empty("No preliminary range recorded", "The working multiple above is hypothetical. Your advisor can record a range with a dated source, basis and limitations.")}${c.mode === "advisor" ? `<form data-form="valuationReview" class="inline-form section-gap"><div class="form-grid">${input("low", "Lower enterprise value ($)", v?.low ?? "", "number", 'required min="0" max="1000000000000" step="1"')}${input("high", "Upper enterprise value ($)", v?.high ?? "", "number", 'required min="0" max="1000000000000" step="1"')}${textarea("basis", "Valuation basis, source date and limitations", v?.basis ?? "", 'required maxlength="3000"')}</div>${formEnd("Record preliminary value perspective")}</form>` : ""}<p class="footer-note">No licensed comparable data or live market feed is connected. Recording a range does not verify its underlying evidence. Discovery and scenario changes clear it for review.</p>`,
  );
}
// Stacked bar of where enterprise value goes (widths set through the CSSOM: CSP).
function proceedsBar(p, s, r) {
  const ev = Math.max(r.ev, 1),
    cash = Math.max(0, r.cash),
    other = Math.max(0, r.ev - cash - r.tax - r.rollover - s.family),
    seg = (v, cls, label) => (v > 0 ? `<i class="${cls}" data-w="${((v / ev) * 100).toFixed(2)}" title="${label}: ${money(v)}"></i>` : "");
  return `<div class="pv-bar" role="img" aria-label="Enterprise value split into cash, taxes, rollover, family distribution, debt and fees">${seg(cash, "cash", "Available cash")}${seg(r.tax, "tax", "Taxes")}${seg(r.rollover, "roll", "Rollover")}${seg(s.family, "fam", "Family distribution")}${seg(other, "other", "Debt, fees and other owners")}</div><div class="ld-legend pv-legend"><span><i class="cash"></i>Cash</span><span><i class="tax"></i>Taxes</span><span><i class="roll"></i>Rollover</span><span><i class="fam"></i>Family</span><span><i class="other"></i>Debt, fees &amp; other owners</span></div>`;
}
function proceedsPage(c) {
  const d = c.data,
    p = d.profile,
    s = d.scenario,
    r = proceeds(p, s),
    readOnly = c.mode !== "owner" || state.demo;
  const sens = valuationSensitivity(p, s),
    sensMax = Math.max(p.liquidity, ...sens.map((v) => v.cash), 1);
  return `<h2 class="sr-only">From business value to personal choices.</h2>${kpis([
    ["Enterprise value", shortMoney(r.ev), `${s.multiple}× EBITDA, a working assumption`],
    [r.cash < 0 ? "Cash shortfall" : "Available cash", shortMoney(r.cash), "After debt, fees, tax, rollover and family"],
    ["Liquidity goal", `${p.liquidity ? Math.round((Math.max(0, r.cash) / p.liquidity) * 100) : 0}<em>%</em>`, `of ${shortMoney(p.liquidity)} covered`],
    ["Kept as cash", `${r.ev ? Math.round((Math.max(0, r.cash) / r.ev) * 100) : 0}<em>%</em>`, "of enterprise value"],
  ])}<section class="panel"><div class="panel-head"><div><h2>From enterprise value to available cash</h2><small>Each bar is one deduction in your working scenario. Hover a bar for the exact amount.</small></div></div><div class="wf">${proceedsWaterfall(p, s, r)}</div></section><div class="two-col section-gap"><section class="panel"><h2>Working proceeds scenario</h2><p>Illustrative enterprise value: EBITDA × your hypothetical multiple. This model does not use comparable transactions or private-market data.</p><form data-form="scenario"><fieldset ${readOnly ? "disabled" : ""}><div class="form-grid">${input("multiple", "Hypothetical EBITDA multiple", s.multiple, "number", 'required min="1" max="15" step="0.1"')}${input("fees", "Transaction fees (% of enterprise value)", s.fees, "number", 'required min="0" max="20" step="0.1"')}${input("tax", "Illustrative tax rate (%)", s.tax, "number", 'required min="0" max="60" step="0.1"')}${input("rollover", "Owner equity rolled over (%)", s.rollover, "number", 'required min="0" max="100" step="1"')}${input("family", "Family cash distribution ($)", s.family, "number", 'required min="0" max="1000000000000" step="1"')}</div></fieldset>${c.mode === "owner" ? formEnd("Save & recalculate") : ""}</form><p class="footer-note">Fees and debt reduce enterprise value before applying your ownership share. Tax applies to the cash portion of positive owner equity as if it were fully taxable gain; rollover is assumed tax-deferred. Actual tax basis, structure, preferences, and timing can materially change results. A family transfer or ESOP requires its own financing and tax analysis.</p></section><div class="stack">${panel(
    "Where the value goes",
    `<div class="money-rows">${[
      ["Enterprise value", r.ev],
      ["Less debt", -p.debt],
      ["Less fees", -r.fees],
      ["Owner equity share", r.share],
      ["Less retained / rollover equity", -r.rollover],
      ["Less illustrative tax", -r.tax],
      ["Less family distribution", -s.family],
    ]
      .map(
        ([l, v]) =>
          `<div class="money-row"><span>${l}</span><strong>${money(v)}</strong></div>`,
      )
      .join(
        "",
      )}<div class="money-row total ${r.cash < 0 ? "negative" : ""}"><span>${r.cash < 0 ? "Cash shortfall" : "Available cash"}</span><strong>${money(r.cash)}</strong></div></div>${r.shortfall || r.debtShortfall ? `<div class="callout amber"><p>${r.debtShortfall ? `Enterprise value does not cover debt and fees: ${money(r.debtShortfall)} shortfall. ` : ""}${r.shortfall ? `Family distributions exceed modeled cash by ${money(r.shortfall)}. Revisit assumptions before planning distributions.` : ""}</p></div>` : ""}<p class="footer-note">Your stated liquidity goal: ${money(p.liquidity)}. ${r.cash >= p.liquidity ? "The hypothetical cash meets this goal." : "The hypothetical cash falls below this goal."} Rollover equity is not available cash; its future value is uncertain.</p>`,
  )}${panel("Connect proceeds to life after closing", '<p>Record spending needs, estate reviews, family distributions, and investment-policy conversations as named actions. A Private Bank referral requires separate approval of personal information sharing.</p><a class="btn secondary small" href="#/plan">Open wealth-planning actions</a>')}</div></div><section class="panel compare-panel section-gap"><div class="panel-head"><div><h2>Compare your own assumptions</h2><small>Available cash at a lower, working and higher multiple, against your liquidity goal. Sensitivity cases, not estimates for different buyer types; everything else stays constant.</small></div></div>${barRows(
    [...sens.map((v) => [v.cash >= p.liquidity ? "v" : "y", `${v.multiple.toFixed(1)}× · ${esc(v.label)}`, Math.max(0, v.cash), shortMoney(v.cash)]), ["n", "Liquidity goal", p.liquidity, shortMoney(p.liquidity)]],
    sensMax,
  )}<p class="chart-cap">${sens.filter((v) => v.cash >= p.liquidity).length} of ${sens.length} cases meet the goal. Enterprise value: ${sens.map((v) => `${v.multiple.toFixed(1)}× ${shortMoney(v.ev)}`).join(" · ")}.</p></section>${valuationPanel(c)}`;
}
function referrals(c) {
  const d = c.data;
  const routes =
    c.mode === "specialist"
      ? ""
      : `<section class="panel routing-panel section-gap"><h2>Teams to discuss with your advisor</h2><p>These prompts use your stated goals and working direction. They do not create referrals or confirm eligibility.</p><div class="routing-grid">${routingSuggestions(
          d,
        )
          .map(
            (r) =>
              `<article>${teamLogo(r.team)}<h3>${esc(r.team)}</h3><p>${esc(r.reason)}</p><small>Suggested discussion scope: ${esc(r.scope)}</small></article>`,
          )
          .join("")}</div></section>`;
  const n = (...st) => d.referrals.filter((r) => st.includes(r.status)).length;
  return `<h2 class="sr-only">The right team, with your permission.</h2>${kpis([
    ["Specialist handoffs", d.referrals.length, "Proposed for this case"],
    [c.mode === "owner" ? "Awaiting your approval" : "Awaiting owner approval", n("Draft"), "The owner approves scope"],
    ["Active", n("Queued", "Accepted"), "Approved or accepted"],
    ["Closed", n("Completed"), n("Withdrawn", "Declined") ? `${n("Withdrawn", "Declined")} withdrawn or declined` : "Handoffs closed out"],
  ])}<div class="two-col">${panel(c.mode === "specialist" ? "Referrals addressed to you" : "Specialist handoffs", d.referrals.length ? d.referrals.map((r) => `<article class="referral"><div class="row between"><span class="rc-who">${teamLogo(r.team)}<h3>${esc(r.team)}</h3></span>${badge(r.status, ["Draft", "Queued"].includes(r.status) ? "amber" : "")}</div><small>Recipient: ${esc(r.recipient)}<br>Information scope: ${esc(r.scope)}</small><p>${esc(r.purpose)}</p>${referralSteps(r)}<div class="row">${c.mode === "owner" && r.status === "Draft" ? button("Approve & queue referral", "referralStatus", "", `data-id="${r.id}" data-status="Queued" ${locked()}`) : ""}${c.mode === "owner" && ["Draft", "Queued", "Accepted", "Completed"].includes(r.status) ? button("Withdraw access", "referralStatus", "danger small", `data-id="${r.id}" data-status="Withdrawn" ${locked()}`) : ""}${c.mode === "specialist" && r.status === "Queued" ? button("Accept handoff", "referralStatus", "", `data-id="${r.id}" data-status="Accepted" ${locked()}`) + button("Decline", "referralStatus", "secondary", `data-id="${r.id}" data-status="Declined" ${locked()}`) : ""}${c.mode === "specialist" && r.status === "Accepted" ? button("Mark completed", "referralStatus", "", `data-id="${r.id}" data-status="Completed" ${locked()}`) : ""}</div></article>`).join("") : empty("No specialist referrals yet", "A reviewed case can be routed to the appropriate team. Approval creates an in-app handoff; no email is sent."))}<div class="stack">${
    c.mode === "advisor"
      ? panel(
          "Propose a referral",
          `<form data-form="referral" class="inline-form">${select("team", "Specialist team", teams, teams[0])}${input("recipient", "Recipient account email", "", "email", 'required maxlength="254"', "Use the invited specialist’s account email. They must have the specialist or advisor role.")}${select("scope", "Requested information scope", ["Business only", "Business + personal"], "Business only")}${textarea("purpose", "Purpose and engagement rationale", "", 'required maxlength="1500"')}${formEnd("Send for owner approval")}</form>`,
        )
      : c.mode === "specialist"
        ? panel(
            "Approved case context",
            `<dl class="definition">${Object.entries(d.profile)
              .filter(
                ([k]) => !["advisorEmail", "shareWithAdvisor"].includes(k),
              )
              .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
              .join("")}</dl>`,
          )
        : panel(
            "What you approve",
            "<p><strong>Business only</strong> shares business name, industry, transition trigger, timeline, revenue, EBITDA, debt, current ownership, desired role, and confidentiality requirements.</p><p><strong>Business + personal</strong> also shares the discovery profile’s owner identity, family and employee priorities, liquidity goals, desired retained ownership, notes, engagement preference, and assigned advisor email.</p><p>Specialists see the purpose and scope of their own approved referrals. They do not see your scenario editor, shared plan, case history, or AI conversation.</p>",
          )
  }${panel("Permission stays with the owner", "<p>Withdraw a referral to stop further access, including after completion. Updating discovery or scenario assumptions withdraws existing referrals automatically. Information previously viewed cannot be recalled. Recipients see a snapshot of the profile approved at handoff; they do not receive later profile edits.</p><p>Handoffs are tracked in the application. They do not guarantee engagement, financing, buyer interest, or a professional recommendation.</p>")}</div></div>${routes}`;
}
function plan(c) {
  const d = c.data;
  const by = (st) => d.actions.filter((a) => a.status === st).length,
    total = d.actions.length,
    done = by("Completed"),
    owners = [...new Set(d.actions.map((a) => a.assignee))].map((o) => [o, d.actions.filter((a) => a.assignee === o).length]);
  return `<h2 class="sr-only">Every next step has an owner.</h2>${kpis([
    ["Shared actions", total, `${owners.length} responsible ${owners.length === 1 ? "party" : "parties"}`],
    ["Open", by("Open"), "Not started"],
    ["In progress", by("In progress"), "Under way"],
    ["Completed", `${total ? Math.round((done / total) * 100) : 0}<em>%</em>`, `${done} of ${total} done`],
  ])}<div class="two-col pl-top"><section class="panel"><div class="panel-head"><div><h2>Progress</h2><small>Share of actions by status</small></div></div><div class="pl-stack" role="img" aria-label="${by("Completed")} completed, ${by("In progress")} in progress, ${by("Open")} open">${[["v", "Completed"], ["a", "In progress"], ["n", "Open"]].map(([k, st]) => (by(st) ? `<i class="${k}" data-w="${((by(st) / (total || 1)) * 100).toFixed(1)}"></i>` : "")).join("")}</div><div class="ld-legend rd-legend pl-legend"><span><i class="v"></i>${by("Completed")} completed</span><span><i class="a"></i>${by("In progress")} in progress</span><span><i class="n"></i>${by("Open")} open</span></div></section><section class="panel"><div class="panel-head"><div><h2>Who owns the work</h2><small>Actions per responsible person or team</small></div></div>${barRows(owners.map(([o, k]) => ["t", esc(o), k]), Math.max(1, ...owners.map(([, k]) => k)))}</section></div><div class="two-col section-gap">${panel("Shared action plan", d.actions.map((a) => `<article class="action st-${a.status.toLowerCase().replace(" ", "-")}"><div><div class="eyebrow">${esc(a.kind)}</div><h3>${esc(a.title)}</h3><small>${esc(a.assignee)}${a.due ? ` · Due ${esc(a.due)}` : ""}</small></div><label class="field"><span class="muted">Status</span><select data-task="${a.id}" ${state.demo || (c.mode !== "advisor" && a.assignee !== "Owner") ? "disabled" : ""}>${["Open", "In progress", "Completed"].map((x) => `<option ${x === a.status ? "selected" : ""}>${x}</option>`).join("")}</select></label></article>`).join(""))}<div class="stack">${c.mode === "advisor" ? panel("Assign a next step", `<form data-form="addAction" class="inline-form">${input("title", "Action", "", "text", 'required maxlength="500"')}${input("assignee", "Responsible person / team", "", "text", 'required maxlength="200"')}${input("due", "Due date (optional)", "", "date")}${formEnd("Add shared action")}</form>`) : panel("Life beyond the transaction", "<p>Ask your advisor to assign specific actions for income needs, investment policy, estate documents, taxes, and family distributions. Mark your own family-continuity action as work progresses.</p>")}${c.mode === "advisor" ? panel("Observed outcomes", `<p>Record actual results only. Blank values remain unknown. These records support measurement; they do not establish that PNC-link caused the outcome.</p><form data-form="outcomes" class="inline-form">${input("workMinutes", "Advisor minutes recorded (cumulative)", d.workMinutes, "number", 'required min="0" max="100000" step="1"')}<label class="check"><input type="checkbox" name="closed" ${d.outcomes.closed ? "checked" : ""}><span>Transaction has closed</span></label>${input("assetsCaptured", "Post-sale assets captured ($; optional)", d.outcomes.assetsCaptured ?? "", "number", 'min="0" max="1000000000000" step="1"')}${select("retained", "Client relationship retained?", ["Not recorded", "Yes", "No"], d.outcomes.retained === null ? "Not recorded" : d.outcomes.retained ? "Yes" : "No")}${formEnd("Save observed outcomes")}</form>`) : ""}</div></div>`;
}
function assistant(c) {
  const advisor = c.mode === "advisor",
    d = c.data;
  const prompts = advisor
    ? [
        "Prepare a client meeting brief: trigger, goals, preferred path, family dynamics, evidence gaps and three next actions. Separate facts from unanswered questions.",
        "Which specialist conversations are worth reviewing and why? State the appropriate information scope and permission steps.",
        "Identify gaps between the owner's business transition and personal wealth plan. Suggest shared actions for my review.",
        "Review the recorded family relationships and discussion preferences. What should I confirm before involving the next generation?",
      ]
    : [
        "Summarize the missing information and my next three questions.",
        "Compare transition options against my priorities, successor readiness and desired future role.",
        "Help me understand the family liquidity illustration and questions to ask an estate specialist.",
        "Explain my proceeds assumptions and what a tax and wealth advisor should review.",
      ];
  return `<h2 class="sr-only">${advisor ? "A second set of eyes for your case." : "Support for your next conversation."}</h2><div class="assistant-context"><span class="ai-symbol" aria-hidden="true">✧</span><div><strong>Working with ${esc(d.profile.business)}</strong><small>${esc(d.profile.trigger)} · ${esc(d.pathDecision?.path || "Options open")} · ${readiness(d).verified}/${readiness(d).total} evidence categories verified</small></div>${badge("Private to your account", "gray")}</div><div class="chat-layout"><section class="panel"><div class="chat-thread" id="thread" role="log" aria-label="Private AI conversation" aria-live="polite">${state.chat.length ? state.chat.map((m) => `<div class="chat-message question"><b>You</b>${esc(m.question)}</div><div class="chat-message"><b>PNC-link AI · suggestion</b>${esc(m.answer)}</div>`).join("") : empty(advisor ? "Prepare for the next client conversation." : "Start with your most important question.", "Choose a conversation starter or ask a question grounded in this case.")}</div>${state.demo ? `<div class="callout amber"><p>The sample does not run AI or save conversations. Sign in and create a case to use assistance grounded in your own profile.</p>${state.assistantDraft ? `<p><strong>Prepared question</strong><br>${esc(state.assistantDraft)}</p>` : ""}</div>` : `<form data-form="assist" class="inline-form"><div class="field"><label for="question">Your question</label><textarea name="question" id="question" required maxlength="2000" placeholder="What would you like to understand or prepare?">${esc(state.assistantDraft)}</textarea></div><label class="check"><input type="checkbox" name="consent" required><span>I agree to share this case’s discovery answers, evidence summary, proceeds scenario, family plan, stakeholder roles and notes, preferred path, recorded value perspective, advisor findings, actions and referral purposes${advisor ? ", including my internal relationship notes" : ""} with the AI service for this request. Direct name and email fields are omitted; free text may identify people. My question, response and up to four prior private turns are used for context. Conversations are saved privately to my account.</span></label>${formEnd("Ask PNC-link AI")}</form>`}</section><aside class="chat-aside"><div class="eyebrow">${advisor ? "Advisor preparation" : "Conversation starters"}</div>${prompts.map((x) => `<button class="prompt-button" data-prompt="${esc(x)}">${esc(x)} <span aria-hidden="true">↗</span></button>`).join("")}<div class="assistant-evidence"><h3>Grounded in your case</h3><ul class="info-list"><li>Owner-reported business and family priorities</li><li>Verified evidence counts and advisor findings</li><li>Saved assumptions and open next steps</li><li>Selected published PNC resources</li></ul><a href="#/resources">Review the source resources →</a></div><p class="footer-note">AI can be wrong. It has no live market data or document access and cannot change your case, send referrals, certify value or give tax, legal, insurance or investment recommendations. Review suggestions with your advisor. Limit: 20 requests per account per hour.</p></aside></div>`;
}
function historyPage() {
  return linkHistory(state.history);
}
function metricsPage() {
  const m = state.metrics;
  return `${intro("Measure the journey, then test the impact.", "These observations cover cases assigned to you. Faster engagement, higher capacity, asset capture, and retention remain hypotheses until validated against a baseline.")}<div class="stats">${stat("Shared cases", m.cases ?? 0, "Assigned to your account", true)}${stat("Qualified opportunities", m.qualified ?? 0, "Reviewed + ≥2 categories verified")}${stat("Referral acceptance", m.acceptance === null ? "Not yet" : `${m.acceptance}%`, `${m.accepted ?? 0} accepted / ${m.sent ?? 0} ever queued`)}${stat("Time to acceptance", m.hours === null ? "Not yet" : `${m.hours} hrs`, "Mean: owner approval → acceptance")}${stat("Recorded advisor effort", `${m.workMinutes ?? 0} min`, "Cumulative observed time; not savings")}${stat("Post-sale assets captured", money(m.assets), `${m.outcomeCount ?? 0} recorded outcomes`)}${stat("Client retention", m.retention === null ? "Not recorded" : `${m.retention}%`, "Among closed cases with known status")}${stat("Closed transactions", m.closed ?? 0, "Advisor-reported outcomes")}</div><div class="callout"><p>Unknown outcomes are excluded from assets and retention calculations. Queued referrals later withdrawn remain in the referral denominator. These are workflow observations, not audited PNC performance or evidence of causal uplift.</p></div>${panel("Validation conversations", '<ul class="info-list"><li>What uncertainty has delayed the owner’s next decision?</li><li>Whom do they trust first, and where does coordination break down?</li><li>Which outcomes matter beyond price?</li><li>What would they share with AI, and when would outreach feel intrusive?</li><li>When do they choose who manages post-sale proceeds?</li></ul><p class="footer-note">Capture interview findings as advisor review notes and distinguish direct experience from stated preference and inference.</p>')}`;
}
function downloadBrief(c) {
  if (!c || c.mode === "specialist") return;
  const d = c.data,
    p = d.profile;
  const lines = [
    "PNC-link | Meeting preparation brief",
    p.business,
    `Owner: ${p.name}`,
    `Prepared: ${today()}`,
    "",
    `Trigger: ${p.trigger} | Horizon: ${p.timeline} years | Desired role: ${p.futureRole}`,
    `Priorities: ${(p.decisionPriorities ?? []).join(", ") || "Not recorded"}`,
    `Family: ${p.priorities || "Not recorded"}`,
    `Employees: ${p.employeePriorities || "Not recorded"}`,
    `Successor: ${p.successor || "Not discussed"}`,
    `Discussion preference: ${p.outreach}`,
    "",
    `Working direction: ${d.pathDecision?.path || "Options open"}`,
    d.pathDecision?.reason || "",
    `Evidence: ${readiness(d).reported} available / ${readiness(d).verified} verified / ${readiness(d).total} categories`,
    "",
    "ADVISOR REVIEW",
    d.review?.note || "Pending",
    "",
    "NEXT STEPS",
    ...nextSteps(d, c.mode).map((x) => `${x.title}: ${x.detail}`),
    "",
    "OPEN SHARED ACTIONS",
    ...d.actions
      .filter((x) => x.status !== "Completed")
      .map((x) => `${x.title} | ${x.assignee} | ${x.due || "No due date"}`),
    "",
    "Planning support only. Owner-reported information and hypothetical financial assumptions require professional review. This brief is a local download; no messages or referrals are sent.",
  ];
  const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "pnc-link-meeting-brief.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice("Meeting brief downloaded. It contains private case information.");
}
// Pages shown in the dashboard frame (header card, black/light theme, sidebar).
const FRAMED = ["pathways", "family", "proceeds", "referrals", "plan", "assistant", "history", "resources"];
function framedPage(r, c) {
  return {
    pathways: () => pathways(c),
    family: () => familyPage(c),
    proceeds: () => proceedsPage(c),
    referrals: () => referrals(c),
    plan: () => plan(c),
    assistant: () => assistant(c),
    history: historyPage,
    resources: () => resources(true),
  }[r]();
}
function render() {
  renderVersion++;
  const r = route(),
    c = current();
  let html;
  if (r === "home") html = home();
  else if (["signin", "signup", "recover", "reset", "invite"].includes(r))
    html = authPage(r);
  else if (r === "resources" && !state.user && !state.demo)
    html = `${publicHeader()}<main id="main" class="main public-resources">${resources()}</main>`;
  else if (!state.user && !state.demo) {
    location.hash = "#/signin";
    return;
  } else if (r === "overview" && c && c.mode !== "specialist") {
    html = linkTransition({
      side: sideNav(r, c),
      menu: menuButton,
      account: accountMenu(c.mode === "owner" ? c.data.profile.name : state.user?.name || "Advisor", c.mode),
      theme: wsTheme(),
      c,
      user: state.user,
      demo: state.demo,
      demoRole: state.demoRole,
      note: casePicker(),
      parts: transitionParts(c),
    });
  } else if (r === "readiness" && c && c.mode !== "specialist") {
    html = linkReadiness({
      side: sideNav(r, c),
      menu: menuButton,
      account: accountMenu(c.mode === "owner" ? c.data.profile.name : state.user?.name || "Advisor", c.mode),
      theme: wsTheme(),
      c,
      user: state.user,
      demo: state.demo,
      demoRole: state.demoRole,
      note: casePicker(),
      parts: readinessParts(c),
    });
  } else if (FRAMED.includes(r) && c && c.mode !== "specialist") {
    html = linkPage({
      side: sideNav(r, c),
      menu: menuButton,
      account: accountMenu(c.mode === "owner" ? c.data.profile.name : state.user?.name || "Advisor", c.mode),
      theme: wsTheme(),
      c,
      user: state.user,
      demo: state.demo,
      demoRole: state.demoRole,
      note: casePicker(),
      route: r,
      body: framedPage(r, c),
    });
  } else if (r === "dashboard" && !c) {
    html = linkDashboardEmpty({
      side: sideNav(r, c),
      menu: menuButton,
      account: accountMenu(state.user?.id === "local-guest" ? "Guest" : state.user?.name || state.user?.email, "owner"),
      theme: wsTheme(),
      user: state.user,
      guest: state.user?.id === "local-guest",
      isAdvisor: isAdvisor(),
    });
  } else if (r === "dashboard" && c.mode !== "specialist") {
    html = linkDashboard({
      side: sideNav(r, c),
      menu: menuButton,
      account: accountMenu(c.mode === "owner" ? c.data.profile.name : state.user?.name || "Advisor", c.mode),
      theme: wsTheme(),
      c,
      user: state.user,
      demo: state.demo,
      demoRole: state.demoRole,
      note: casePicker(),
      history: state.history,
      isAdvisor: isAdvisor(),
    });
  } else {
    let body;
    if (["portfolio", "metrics"].includes(r) && !isAdvisor())
      body = `${intro("Advisor workspace", "This page is available to invited advisors. Your owner case remains available in My transition.")}<a class="btn" href="#/overview">Open my transition</a>`;
    else if (
      !c &&
      !["discovery", "metrics", "portfolio", "resources"].includes(r)
    )
      body = noCase();
    else if (c?.mode === "specialist" && !["overview", "referrals"].includes(r))
      body = overview(c);
    else {
      const pages = {
        portfolio,
        resources,
        overview: () => overview(c),
        discovery: () => discovery(c),
        readiness: () => readinessPage(c),
        pathways: () => pathways(c),
        family: () => familyPage(c),
        proceeds: () => proceedsPage(c),
        referrals: () => referrals(c),
        plan: () => plan(c),
        assistant: () => assistant(c),
        history: historyPage,
        metrics: () => metricsPage(),
      };
      body = pages[r]
        ? pages[r]()
        : `${intro("This page is unavailable.", "Return to your workspace to continue.")}<a class="btn" href="#/overview">Open workspace</a>`;
    }
    html = shell(body, r);
  }
  app.innerHTML = html;
  const renderedKey = `${state.demo}:${state.demoRole}:${r}:${state.selected}`;
  if (renderedKey !== lastRenderedKey) {
    window.scrollTo({ top: 0, behavior: "instant" });
    lastRenderedKey = renderedKey;
  }
  document.title = `${r === "home" ? "Business transitions" : r.charAt(0).toUpperCase() + r.slice(1)} · PNC-link`;
  document.querySelector("h1")?.focus({ preventScroll: true });
  if (r === "dashboard" || r === "readiness" || FRAMED.includes(r)) mountLinkDashboard();
  if (r === "overview") mountAdvisorCalendar();
  app.querySelectorAll(".mt-pin[data-left]").forEach((el) => (el.style.left = `${el.dataset.left}%`));
  if (r === "assistant") $("#thread")?.scrollTo(0, $("#thread").scrollHeight);
}
app.addEventListener("submit", async (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const data = formData(f),
    kind = f.dataset.form,
    btn = f.querySelector('button[type="submit"],button:not([type])'),
    err = f.querySelector(".form-error"),
    original = btn?.textContent;
  if (err) err.textContent = "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = kind === "assist" ? "Thinking…" : "Saving…";
  }
  try {
    if (kind === "auth") {
      const authKind = f.dataset.kind;
      const account =
        authKind === "signin" && localAccounts[String(data.email ?? "").trim().toLowerCase()];
      if (account) {
        if ((await sha256(data.password ?? "")) !== account.hash)
          throw Error("Email or password is incorrect.");
        await openGuest(false, account);
        return;
      }
      const result = await api("/api/auth", {
        ...data,
        action: {
          signin: "login",
          signup: "signup",
          recover: "recover",
          reset: "reset",
          invite: "invite",
        }[authKind],
        token: state.callback?.token,
      });
      if (result.user) {
        state.user = result.user;
        state.guest = false;
        state.demo = false;
        state.cases = [];
        state.selected = null;
        state.callback = null;
        await loadCases();
        await loadHistory();
        location.hash = isAdvisor() ? "#/portfolio" : "#/overview";
      } else if (result.message) {
        notice(result.message);
        if (err) err.textContent = result.message;
      }
    } else if (kind === "profile") {
      data.shareWithAdvisor = f.elements.shareWithAdvisor.checked;
      data.decisionPriorities = new FormData(f).getAll("decisionPriorities");
      if (current()) await update("profile", data);
      else {
        if (state.demo) throw Error("The sample is read-only.");
        const result = await api("/api/nexus/cases", data);
        state.selected = result.case.id;
        await loadCases();
        await loadHistory();
        location.hash = "#/overview";
        notice(state.guest ? "Your local transition case is ready." : "Your shared transition case is ready.");
      }
    } else if (kind === "review")
      await update("review", {
        ...data,
        qualified: f.elements.qualified.checked,
      });
    else if (kind === "outcomes")
      await update("outcomes", {
        ...data,
        closed: f.elements.closed.checked,
        retained:
          data.retained === "Not recorded" ? null : data.retained === "Yes",
      });
    else if (kind === "assist") {
      const c = current(),
        id = c.id,
        result = await api(`/api/nexus/assist?id=${encodeURIComponent(id)}`, {
          question: data.question,
          consent: f.elements.consent.checked,
        });
      if (current()?.id === id && route() === "assistant") {
        state.chat.push({ question: data.question, answer: result.answer });
        state.assistantDraft = "";
        render();
      }
    } else if (kind === "meeting") {
      const who = f.dataset.advisor,
        when = f.dataset.when;
      await update(kind, data);
      notice(
        who && when
          ? `Meeting with ${who} on ${when} has been sent to ${who}.`
          : `Meeting request has been sent to ${who || "your advisor"}.`,
      );
    } else await update(kind, data);
  } catch (error) {
    if (err && err.isConnected) err.textContent = error.message;
    else notice(error.message);
  } finally {
    if (btn?.isConnected) {
      btn.disabled = state.demo;
      btn.textContent = original;
    }
  }
});
document.addEventListener("click", (e) => {
  const acct = e.target.closest("[data-acct]"),
    menu = $(".acct-menu");
  if (!menu) return;
  const open = acct ? menu.hidden : false;
  if (!acct && menu.contains(e.target) && !e.target.closest("a,button")) return;
  menu.hidden = !open;
  $("[data-acct]").setAttribute("aria-expanded", String(open));
});
// Sidebar: hide/show on wide screens (remembered), slide-out panel on tablets and phones
const sideKey = "pnc-link-side";
const sideHidden = () => {
  try {
    return localStorage.getItem(sideKey) === "hidden";
  } catch {
    return false;
  }
};
const setSideHidden = (hidden) => {
  document.body.classList.toggle("ws-collapsed", hidden);
  try {
    localStorage.setItem(sideKey, hidden ? "hidden" : "shown");
  } catch {
    /* The sidebar still toggles for this visit. */
  }
};
document.body.classList.toggle("ws-collapsed", sideHidden());
document.addEventListener("click", (e) => {
  const wide = innerWidth > 960;
  if (e.target.closest("[data-ws-menu]")) {
    if (wide) setSideHidden(false);
    else document.body.classList.add("ws-open");
  } else if (e.target.closest("[data-ws-collapse]")) {
    if (wide) setSideHidden(true);
    else document.body.classList.remove("ws-open");
  } else if (e.target.closest("[data-ws-close], .ws-side .nav-link, .ws-side .ws-yellow"))
    document.body.classList.remove("ws-open");
});
document.addEventListener("click", (e) => {
  const pick = e.target.closest("[data-ws-theme]");
  if (!pick) return;
  const theme = pick.dataset.wsTheme;
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    /* The theme still switches for this visit. */
  }
  document.querySelectorAll(".shell.nx, .ld").forEach((el) => {
    el.classList.toggle("dark", theme === "dark");
    el.classList.toggle("light", theme === "light");
  });
  document.querySelectorAll("[data-ws-theme]").forEach((b) => {
    b.classList.toggle("on", b === pick);
    b.setAttribute("aria-pressed", String(b === pick));
  });
  const logo = $(".ws-side .brand-box img");
  if (logo) logo.src = logoFor(theme);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("ws-open");
  if (e.key === "Escape" && $(".acct-menu") && !$(".acct-menu").hidden) {
    $(".acct-menu").hidden = true;
    $("[data-acct]").setAttribute("aria-expanded", "false");
    $("[data-acct]").focus();
  }
});
app.addEventListener("click", async (e) => {
  const ask = e.target.closest("[data-ask]");
  if (ask) {
    if (!current() || current().mode === "specialist") {
      notice("Open an owner or assigned advisor case first.");
      return;
    }
    state.assistantDraft = ask.dataset.ask;
    if (route() === "assistant") render();
    else location.hash = "#/assistant";
    return;
  }
  const prompt = e.target.closest("[data-prompt]");
  if (prompt) {
    if ($("#question")) {
      $("#question").value = prompt.dataset.prompt;
      state.assistantDraft = prompt.dataset.prompt;
      $("#question").focus();
    } else notice("Sign in and create a case to use AI assistance.");
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  try {
    if (action === "guest") { await openGuest(); return; }
    if (action === "demo" || action === "demoAdvisor") {
      state.demo = true;
      state.demoRole = action === "demoAdvisor" ? "advisor" : "owner";
      state.selected = "sample";
      await loadCases();
      await loadHistory();
      location.hash =
        state.demoRole === "advisor" ? "#/portfolio" : "#/overview";
      render();
    } else if (action === "demoSwitch") {
      state.demoRole = state.demoRole === "owner" ? "advisor" : "owner";
      await loadCases();
      await loadHistory();
      render();
      if (route() !== "dashboard")
        location.hash =
          state.demoRole === "advisor" ? "#/portfolio" : "#/overview";
    } else if (action === "openCase" || action === "caseBrief") {
      if (
        !state.cases.some((c) => c.id === b.dataset.id && c.mode === "advisor")
      )
        throw Error("This client is unavailable.");
      state.selected = b.dataset.id;
      state.chat = [];
      state.history = [];
      state.assistantDraft = "";
      render();
      await loadHistory();
      if (current()?.id !== b.dataset.id) return;
      if (action === "caseBrief")
        state.assistantDraft =
          "Prepare an advisor meeting brief for this client: goals, family context, evidence gaps, transition alternatives and three proposed next actions. State what is known versus assumed.";
      location.hash = action === "caseBrief" ? "#/assistant" : "#/overview";
      render();
    } else if (action === "removeStakeholder") {
      await update("removeStakeholder", { id: b.dataset.id });
    } else if (action === "editStakeholder") {
      const person = current().data.stakeholders.find(
          (p) => p.id === b.dataset.id,
        ),
        form = $("#stakeholder-form");
      if (!person || !form || state.demo) return;
      form.closest("details").open = true;
      for (const key of [
        "id",
        "name",
        "relationship",
        "role",
        "engagement",
        "notes",
      ])
        form.elements[key].value = person[key] ?? "";
      form.elements.name.focus();
    } else if (action === "downloadBrief") {
      downloadBrief(current());
    } else if (action === "logout") {
      if (!state.guest) await api("/api/auth", { action: "logout" });
      try { localStorage.removeItem(localSessionKey); } catch { /* Nothing to clear. */ }
      state.guest = false;
      state.user = null;
      state.demo = false;
      state.cases = [];
      state.chat = [];
      state.history = [];
      state.selected = null;
      location.hash = "#/home";
    } else if (action === "refresh") {
      b.disabled = true;
      await loadCases();
      await loadHistory();
      render();
      notice("Workspace refreshed.");
    } else if (action === "referralStatus") {
      b.disabled = true;
      await update("referralStatus", {
        id: b.dataset.id,
        status: b.dataset.status,
      });
    } else if (action === "meetingCancel") {
      const c = current(),
        m = [c?.data.meeting, ...(c?.data.meetingHistory ?? [])].find((x) => x?.requestedAt === b.dataset.at),
        [, who, when] = String(m?.topic ?? "").split(" · ");
      b.disabled = true;
      await update("meetingCancel", { requestedAt: b.dataset.at });
      notice(who && when ? `Your meeting with ${who} on ${when} has been cancelled.` : "Your meeting request has been cancelled.");
    } else if (action === "meetingStatus") {
      b.disabled = true;
      await update("meetingStatus", { status: b.dataset.status });
    }
  } catch (error) {
    notice(error.message);
    b.disabled = false;
  }
});
app.addEventListener("input", (e) => {
  if (e.target.id === "question") state.assistantDraft = e.target.value;
  if (e.target.id === "portfolio-search") {
    state.portfolioSearch = e.target.value;
    $("#portfolio-results").innerHTML = portfolioResults();
  }
});
app.addEventListener("change", async (e) => {
  const el = e.target;
  try {
    if (
      ["portfolio-stage", "portfolio-attention", "portfolio-sort"].includes(
        el.id,
      )
    ) {
      state[
        {
          "portfolio-stage": "portfolioStage",
          "portfolio-attention": "portfolioAttention",
          "portfolio-sort": "portfolioSort",
        }[el.id]
      ] = el.value;
      $("#portfolio-results").innerHTML = portfolioResults();
    } else if (el.id === "caseSelect") {
      state.selected = el.value;
      state.chat = [];
      state.history = [];
      state.assistantDraft = "";
      render();
      await loadHistory();
      render();
    } else if (el.dataset.evidence) {
      el.disabled = true;
      await update("evidence", {
        label: el.dataset.evidence,
        checked: el.checked,
      });
    } else if (el.dataset.task) {
      el.disabled = true;
      await update("action", { id: el.dataset.task, status: el.value });
    }
  } catch (error) {
    notice(error.message);
    if (el.type === "checkbox") el.checked = !el.checked;
    el.disabled = false;
  }
});
window.addEventListener("hashchange", async () => {
  if (route() === "guest") { await openGuest(); return; }
  if (["sample-owner", "sample-advisor"].includes(route())) {
    await openSample(route() === "sample-advisor" ? "advisor" : "owner");
    return;
  }
  if (["signin", "signup"].includes(route()) && state.demo) {
    state.demo = false;
    state.cases = [];
    state.selected = null;
    state.chat = [];
    state.history = [];
  }
  render();
});
async function openSample(role) {
  state.demo = true;
  state.demoRole = role;
  state.selected = "sample";
  await loadCases();
  await loadHistory();
  history.replaceState(
    null,
    "",
    location.pathname + (role === "advisor" ? "#/portfolio" : "#/overview"),
  );
  render();
}
async function init() {
  if (!["home", "guest", "signin", "signup", "recover", "reset", "invite", "resources", "sample-owner", "sample-advisor"].includes(route()) && !location.hash.includes("_token=")) {
    try {
      const account = localAccounts[localStorage.getItem(localSessionKey)];
      if (account) { await openGuest(true, account); return; }
      if (localStorage.getItem(guestKey)) { await openGuest(true); return; }
    } catch { /* Continue with connected sign in. */ }
  }
  if (route() === "guest") { await openGuest(); return; }
  if (["sample-owner", "sample-advisor"].includes(route())) {
    await openSample(route() === "sample-advisor" ? "advisor" : "owner");
    return;
  }
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has("confirmation_token")) {
      const token = params.get("confirmation_token");
      history.replaceState(null, "", location.pathname + "#/signin");
      const result = await api("/api/auth", { action: "confirm", token });
      state.user = result.user;
    } else if (params.has("recovery_token") || params.has("invite_token")) {
      const invite = params.has("invite_token");
      state.callback = {
        token: params.get(invite ? "invite_token" : "recovery_token"),
      };
      history.replaceState(
        null,
        "",
        location.pathname + (invite ? "#/invite" : "#/reset"),
      );
      render();
      return;
    } else state.user = (await api("/api/auth")).user;
    if (state.user) {
      await loadCases();
      await loadHistory();
      if (["home", "signin"].includes(route()))
        history.replaceState(
          null,
          "",
          location.pathname + (isAdvisor() ? "#/portfolio" : "#/overview"),
        );
    }
    render();
  } catch (error) {
    if (
      !state.user &&
      ["home", "resources", "signin", "signup", "recover"].includes(route()) &&
      !/(?:confirmation|recovery|invite)_token=/.test(location.hash)
    ) {
      state.servicesAvailable = false;
      render();
      return;
    }
    app.innerHTML = `${publicHeader()}<main class="error-page" id="main">${intro("Your workspace could not open.", "Please retry. Your case is saved on the server; this screen does not imply a lost record.")}<p class="form-error">${esc(error.message)}</p><a class="btn" href="/">Try again</a> ${button("View read-only sample", "demo", "secondary")}</main>`;
  }
}
setInterval(async () => {
  if (state.user && !state.demo && !state.guest) {
    try {
      const result = await api("/api/auth");
      if (!result.user) {
        state.user = null;
        state.cases = [];
        state.chat = [];
        state.history = [];
        location.hash = "#/signin";
      }
    } catch {
      /* Show service failures on the next explicit request. */
    }
  }
}, 600000);
init();
