// PNC-link Dashboard: a card-based summary of one case, in light and dark themes.
// Figures come from the recorded case and the transparent rules in domain.mjs.
import {
  defaultScenario,
  proceeds,
  readiness,
  valuationSensitivity,
  paths,
  suggestedPaths,
  transitionJourney,
  nextSteps,
} from "./domain.mjs";

// The advisor shown in the sample and the test login, matching the booking calendar.
export const ADVISOR_NAME = "Priya Shah";
export const ADVISOR_PHOTO = "./assets/people/priya.jpg";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const usd = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const short = (v) => {
  const a = Math.abs(v),
    s = v < 0 ? "−" : "";
  return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}K` : `${s}$${Math.round(a)}`;
};
const day = (v) =>
  new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const initials = (name) =>
  String(name ?? "")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");

/* ---------------- Icons ---------------- */

const svg = (d, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  bell: '<path d="M18 8.5a6 6 0 1 0-12 0c0 7-3 8.5-3 8.5h18s-3-1.5-3-8.5"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  sliders: '<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="9" r="1.8" fill="currentColor"/><circle cx="12" cy="15" r="1.8" fill="currentColor"/><circle cx="18" cy="8" r="1.8" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  arrow: '<path d="M7 17L17 7M9 7h8v8"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.5 14.5l3.5-4 3 2.5 4.5-6"/>',
  split: '<path d="M6 20v-5a4 4 0 0 1 4-4h8M6 4v16M15 7.5l3.5 3.5-3.5 3.5"/>',
  team: '<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3 19c.6-3.5 2.8-5.3 5.5-5.3s4.9 1.8 5.5 5.3M14.6 14.4c.6-.3 1.2-.4 1.9-.4 2.3 0 3.9 1.5 4.5 4.6"/>',
  wallet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M7 15h3"/>',
  up: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14"/>',
  down: '<path d="M12 5v11M7.5 11.5L12 16l4.5-4.5M5 19h14"/>',
  swap: '<path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5"/>',
  spark: '<path d="M12 3l2 6.2 6.2 2-6.2 2L12 19.5l-2-6.3-6.2-2 6.2-2z"/>',
};
// Line icons for the seven transition paths
const PATH_ICONS = {
  "Strategic sale": '<path d="M2.5 11.5l4-4 3 1.5 3-1.5 4 2 5 2"/><path d="M6.5 7.5l5.5 5.5a1.6 1.6 0 0 0 2.3-2.3"/><path d="M10 15l1.5 1.5a1.6 1.6 0 0 0 2.3-2.3M13 17.5a1.6 1.6 0 0 0 2.3-2.3l-1-1M2.5 11.5l3 3M21.5 11.5l-3.5 3.5-2.5-2.5"/>',
  "PE with rollover": '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8.5 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M14.8 12.3a3.3 3.3 0 1 0 .7 3.2M15.5 10.8v1.8h-1.8"/>',
  "Family transfer": '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M12 17.5s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z"/>',
  "Management transfer": '<circle cx="7.5" cy="8" r="2.8"/><circle cx="16.5" cy="8" r="2.8"/><path d="M2.5 19c.5-3 2.4-4.6 5-4.6s4.5 1.6 5 4.6M14 15c.8-.4 1.6-.6 2.5-.6 2.6 0 4.5 1.6 5 4.6"/><path d="M10.5 5h3M12.5 3.8l1.2 1.2-1.2 1.2"/>',
  ESOP: '<circle cx="12" cy="6.5" r="2.5"/><circle cx="5.5" cy="9.5" r="2.2"/><circle cx="18.5" cy="9.5" r="2.2"/><path d="M8 19.5c.4-3 1.9-4.6 4-4.6s3.6 1.6 4 4.6M2 18.5c.3-2.4 1.6-3.7 3.5-3.7 1 0 1.8.3 2.4 1M22 18.5c-.3-2.4-1.6-3.7-3.5-3.7-1 0-1.8.3-2.4 1"/>',
  "Partial recapitalization": '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 2.5A7.5 7.5 0 0 1 21.5 9H15z"/>',
  "Prepare / delayed exit": '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3c0 4.5 4.5 5.5 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 5.5-4.5 9s4.5 4.5 4.5 9"/><path d="M9.5 18.5h5"/>',
};
const markLogo = `<svg width="30" height="30" viewBox="0 0 96 96" aria-hidden="true"><g stroke-width="9" stroke-linecap="round"><path d="M48 43V23" stroke="currentColor"/><path d="M43 54 25 65M53 54 71 65" stroke="#F58025"/></g><circle cx="48" cy="18" r="11" fill="currentColor"/><circle cx="48" cy="50" r="9" fill="currentColor"/><circle cx="20" cy="70" r="11" fill="#F58025"/><circle cx="76" cy="70" r="11" fill="#F58025"/></svg>`;
const roundLink = (href, label, icon = I.arrow, cls = "") =>
  `<a class="ld-round ${cls}" href="${href}" aria-label="${esc(label)}">${svg(icon, 18)}</a>`;

/* ---------------- Charts ---------------- */

function niceStep(span) {
  const raw = span / 5,
    pow = 10 ** Math.floor(Math.log10(raw || 1)),
    n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

// Enterprise value by scenario: hypothetical ±1x range, working point, advisor range.
function valueField(sens, s, review) {
  const rows = [
    { l: "Prediction range", sub: `${sens[0].multiple.toFixed(1)}–${sens[2].multiple.toFixed(1)}x EBITDA`, band: [sens[0].ev, sens[2].ev], mid: sens[1].ev },
    { l: "Your working scenario", sub: `${s.multiple.toFixed(1)}x EBITDA`, pt: sens[1].ev },
    review
      ? { l: "Advisor perspective", sub: "Recorded by your advisor", band: [review.low, review.high], adv: true }
      : { l: "Advisor perspective", sub: "Not recorded yet", none: true },
  ];
  const values = rows.flatMap((r) => r.band ?? (r.pt !== undefined ? [r.pt] : []));
  const step = niceStep(Math.max(...values) - Math.min(...values) || Math.max(...values) || 1);
  const lo = Math.max(0, Math.floor((Math.min(...values) * 0.9) / step) * step),
    hi = Math.ceil((Math.max(...values) * 1.08) / step) * step || step;
  const X0 = 190,
    X1 = 660,
    x = (v) => X0 + ((v - lo) / (hi - lo || 1)) * (X1 - X0),
    H = 30 + rows.length * 62;
  let g = "";
  for (let t = lo; t <= hi + step / 2; t += step)
    g += `<line x1="${x(t)}" x2="${x(t)}" y1="10" y2="${H}" class="vf-grid"/><text x="${x(t)}" y="${H + 22}" text-anchor="middle" class="vf-tick">${short(t)}</text>`;
  rows.forEach((r, i) => {
    const y = 40 + i * 62;
    g += `<text x="0" y="${y - 3}" class="vf-name">${r.l}</text><text x="0" y="${y + 15}" class="vf-sub">${r.sub}</text>`;
    if (r.none) g += `<line x1="${X0}" x2="${X1}" y1="${y}" y2="${y}" class="vf-none"/>`;
    else if (r.band) {
      const [a, b] = r.band,
        k = r.adv ? "adv" : "band";
      g += `<rect x="${x(a)}" y="${y - 13}" width="${Math.max(4, x(b) - x(a))}" height="26" rx="5" class="vf-${k}"><title>${r.l}: ${short(a)} – ${short(b)}</title></rect><rect x="${x(a)}" y="${y - 13}" width="4" height="26" rx="2" class="vf-${k}-end"/><rect x="${x(b) - 4}" y="${y - 13}" width="4" height="26" rx="2" class="vf-${k}-end"/>`;
      if (r.mid !== undefined) g += `<rect x="${x(r.mid) - 1.5}" y="${y - 18}" width="3" height="36" rx="1.5" class="vf-mid"/>`;
      g += `<text x="${x(a) - 9}" y="${y + 5}" text-anchor="end" class="vf-val">${short(a)}</text><text x="${x(b) + 9}" y="${y + 5}" class="vf-val">${short(b)}</text>`;
    } else
      g += `<line x1="${X0}" x2="${x(r.pt)}" y1="${y}" y2="${y}" class="vf-stem"/><circle cx="${x(r.pt)}" cy="${y}" r="8" class="vf-pt"><title>${r.l}: ${short(r.pt)}</title></circle><text x="${x(r.pt) + 15}" y="${y + 5}" class="vf-val">${short(r.pt)}</text>`;
  });
  return `<svg viewBox="0 0 700 ${H + 30}" width="100%" role="img" aria-label="Enterprise value by scenario">${g}</svg>`;
}

const EV_SHORT = {
  "Financial statements": "Financials",
  "Ownership and debt schedule": "Ownership & debt",
  "Successor / key-person plan": "Successor plan",
  "Family priorities": "Family priorities",
  "Tax and estate review": "Tax & estate",
  "Operating procedures": "Operations",
  "Transition timeline": "Timeline",
};
const EV_LEVEL = ["Not confirmed", "Available", "Verified"];

// Evidence status per category on three levels (not a score).
function evidenceRadar(evidence, large = false) {
  const n = evidence.length || 1,
    W = large ? 640 : 500,
    H = large ? 400 : 320,
    cx = W / 2,
    cy = H / 2,
    R = large ? 150 : 112,
    lvl = (e) => (e.verified ? 3 : e.reported ? 2 : 1),
    pt = (i, f) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)];
    };
  let g = "";
  [1 / 3, 2 / 3, 1].forEach((f) => (g += `<polygon points="${evidence.map((_, i) => pt(i, f).join(",")).join(" ")}" class="rd-ring"/>`));
  evidence.forEach((_, i) => {
    const [x2, y2] = pt(i, 1);
    g += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" class="rd-ring"/>`;
  });
  g += `<polygon points="${evidence.map((e, i) => pt(i, lvl(e) / 3).join(",")).join(" ")}" class="rd-area"/>`;
  evidence.forEach((e, i) => {
    const [x, y] = pt(i, lvl(e) / 3),
      [lx, ly] = pt(i, 1.2),
      anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    g += `<circle cx="${x}" cy="${y}" r="6" class="rd-dot ${["n", "a", "v"][lvl(e) - 1]}"><title>${esc(e.label)}: ${EV_LEVEL[lvl(e) - 1]}</title></circle><text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" class="rd-label">${esc(EV_SHORT[e.label] ?? e.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evidence status across ${n} categories">${g}</svg>`;
}

// Plain-language description of each evidence category, shown behind the row's info button.
const EV_INFO = {
  "Financial statements": "Recent financials for the business: usually the last three years of income statements, balance sheets and tax returns, plus year-to-date figures.",
  "Ownership and debt schedule": "Who owns what share of the business and what it owes: loans, lines of credit, leases and any personal guarantees.",
  "Successor / key-person plan": "Who could lead the business after you, and which people it depends on today. A written plan or an informal list both count.",
  "Family priorities": "What matters to your family in this decision, such as who joins the business, fairness between heirs and income needs.",
  "Tax and estate review": "A recent look at your will, trusts or estate plan and how a transition could be taxed, usually with your CPA or attorney.",
  "Operating procedures": "How the business runs day to day without you: written processes, key customer and supplier relationships, and systems access.",
  "Transition timeline": "When you would like to step back, and dates that matter, such as a target retirement age, a lease end or a loan maturity.",
};

function evidenceHelp(label, owner, id) {
  return `<div class="rd-help" id="${id}" hidden><p>${esc(EV_INFO[label] ?? "")}</p><dl><div><dt>Available</dt><dd>${owner ? "You confirm you have this and can bring it to a meeting. You switch this on; nothing is uploaded." : "The owner confirms they have this and can bring it to a meeting. Only the owner switches this on."}</dd></div><div><dt>Verified</dt><dd>${owner ? "Your advisor has reviewed it with you. Only your advisor can switch this on, after you mark it available." : "You have reviewed it with the owner. You can switch this on once the owner marks it available."}</dd></div></dl></div>`;
}


function gauge(v) {
  const a = Math.PI * (1 - Math.max(0.001, v) / 100),
    x = 42 + 34 * Math.cos(a),
    y = 40 - 34 * Math.sin(a);
  return `<svg viewBox="0 0 84 46" width="72" height="40" aria-hidden="true"><path d="M8 40a34 34 0 0 1 68 0" class="g-track"/><path d="M8 40A34 34 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="g-fill"/></svg>`;
}

function miniRange(lo, hi, mid) {
  const min = lo * 0.85,
    max = hi * 1.1 || 1,
    x = (v) => ((v - min) / (max - min)) * 100;
  return `<svg class="ld-mini" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="5" width="100" height="5" rx="2.5" class="mr-track"/><rect x="${x(lo)}" y="5" width="${Math.max(1, x(hi) - x(lo))}" height="5" class="mr-band"/><rect x="${x(mid) - 0.6}" y="1" width="1.2" height="13" class="mr-mid"/></svg>`;
}

// Portraits for the sample family; anyone else is shown with initials.
const PHOTOS = {
  "James D. Bennett": "./assets/jd-avatar.jpg",
  "Morgan Bennett": "./assets/people/morgan.jpg",
  "Alex Bennett": "./assets/people/alex.jpg",
};

function mapNode(id, x, y, r, name, cls) {
  const photo = PHOTOS[name];
  const face = photo
    ? `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><image href="${photo}" x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><circle cx="${x}" cy="${y}" r="${r}" class="ld-map-ring ${cls}"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" class="ld-map-node ${cls}"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" class="ld-map-t">${esc(initials(name))}</text>`;
  return face + `<text x="${x}" y="${y + r + 13}" text-anchor="middle" class="ld-map-name">${esc(String(name ?? "").split(" ")[0])}</text>`;
}

function relationshipMap(d) {
  const people = (d.stakeholders ?? []).slice(0, 6),
    cx = 178,
    cy = 74;
  let roads = "",
    nodes = "";
  people.forEach((person, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / Math.max(people.length, 1),
      px = cx + Math.cos(a) * 118,
      py = cy + Math.sin(a) * 46;
    roads += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" class="ld-map-road"/>`;
    nodes += `<g>${mapNode(`ldp${i}`, px, py, 21, person.name, `c${i % 4}`)}<title>${esc(person.name)} · ${esc(person.relationship)}</title></g>`;
  });
  return `<svg viewBox="0 0 356 164" width="100%" role="img" aria-label="Relationship map with ${people.length} people">
    <rect width="356" height="164" class="ld-map-bg"/>
    <path d="M0 118 C80 104 120 140 210 122 S320 96 356 110" class="ld-map-river"/>
    <path d="M60 0V164M0 40H356M250 0V164M0 140H356" class="ld-map-street"/>
    <rect x="270" y="52" width="40" height="26" rx="5" class="ld-map-park"/><rect x="20" y="64" width="26" height="40" rx="5" class="ld-map-park"/>
    ${roads}${nodes}
    <g>${mapNode("ldme", cx, cy, 27, d.profile.name, "me")}<title>${esc(d.profile.name)} · Business owner</title></g>
  </svg>`;
}

/* ---------------- Frame ---------------- */

// Header card shared by the Dashboard and My transition.
function head({ menu, account, name, greeting = "Welcome back!", demo, demoRole, ping = false, note = "", settings = "#/discovery" }) {
  const owner = demoRole === "owner";
  const viewSwitch = demo
    ? `<div class="ld-switch" role="group" aria-label="Sample view"><button type="button" class="${owner ? "on" : ""}" ${owner ? 'aria-pressed="true" disabled' : 'data-action="demoSwitch" aria-label="View as owner"'}>Client</button><button type="button" class="${owner ? "" : "on"}" ${owner ? 'data-action="demoSwitch" aria-label="View as advisor"' : 'aria-pressed="true" disabled'}>Advisor</button></div>`
    : "";
  return `<header class="ld-head ld-card">
      ${menu}${account}
      <div><small>${greeting}</small><h1 tabindex="-1">${esc(name)}</h1></div>
      <div class="ld-head-r">${viewSwitch}${demo ? '<span class="ld-sample">Read-only sample</span><a class="ld-pill ld-pill-sm" href="#/signup">Create your case</a>' : `${note}<button type="button" class="ld-pill ld-pill-sm" data-action="refresh">Refresh</button>`}
        <a class="ld-round" href="#/plan" aria-label="Open shared action plan">${svg(I.bell, 20)}${ping ? '<i class="ld-ping"></i>' : ""}</a>
        <a class="ld-round" href="${settings}" aria-label="${settings === "#/settings" ? "Settings and data" : "Discovery profile settings"}">${svg(I.settings, 20)}</a>
      </div>
    </header>`;
}

/* ---------------- Page ---------------- */

const EVIDENCE_LETTER = ["F", "O", "S", "P", "T", "R", "L"];

export function linkDashboard({ side, menu, account, theme, c, user, demo, demoRole, history, note = "", settings = "#/discovery" }) {
  const d = c.data,
    p = d.profile,
    s = { ...defaultScenario, ...d.scenario },
    r = proceeds(p, s),
    rd = readiness(d),
    journey = transitionJourney(d),
    steps = nextSteps(d, c.mode),
    suggested = suggestedPaths(p),
    chosen = d.pathDecision?.path,
    sens = valuationSensitivity(p, s),
    owner = c.mode === "owner",
    name = owner ? p.name : demo ? ADVISOR_NAME : user?.name || user?.email || "Advisor",
    coverage = p.liquidity ? Math.min(100, (Math.max(0, r.cash) / p.liquidity) * 100) : 100,
    diff = r.cash - p.liquidity;

  const tiles = [
    [I.target, "y", journey[0]],
    [I.chart, "b", journey[1]],
    [I.split, "g", journey[2]],
    [I.team, "p", journey[3]],
  ];
  const pathRows = [
    ...paths.filter((x) => x.name === chosen),
    ...paths.filter((x) => x.name !== chosen && suggested.includes(x.name)),
    ...paths.filter((x) => x.name !== chosen && !suggested.includes(x.name)),
  ].slice(0, 4);
  const ev = d.evidence ?? [];
  const shownEv = ev.slice(0, 5);

  return `<div class="ld nx ${theme}" data-ld>
${side}

  <div class="ld-body">
    ${head({ menu, account, name, demo, demoRole, note, settings, ping: (d.actions ?? []).some((a) => a.status !== "Completed") })}

    <div class="ld-kpis">
      <div class="ld-card ld-kpi"><small>Working enterprise value</small><b>${short(r.ev)}</b><span>${short(sens[0].ev)} – ${short(sens[2].ev)}</span>${miniRange(sens[0].ev, sens[2].ev, r.ev)}</div>
      <div class="ld-card ld-kpi gauge"><div><small>Evidence available</small><b>${rd.score}<em>%</em></b><span>${rd.verified} of ${rd.total} verified</span></div>${gauge(rd.score)}</div>
      <div class="ld-card ld-kpi"><small>Revenue</small><b>${short(p.revenue)}</b><span>EBITDA ${short(p.ebitda)} · ${p.revenue ? ((p.ebitda / p.revenue) * 100).toFixed(1) : "0.0"}%</span></div>
      <div class="ld-card ld-kpi"><small>Estimated cash proceeds</small><b class="${r.cash < 0 ? "neg" : "good"}">${short(r.cash)}</b><span>Liquidity goal ${short(p.liquidity)}</span></div>
      <div class="ld-card ld-kpi"><small>Preferred horizon</small><b>${esc(p.timeline)} <em>yrs</em></b><span>Debt ${short(p.debt)}</span></div>
    </div>

    <div class="ld-grid ld-fill">
      <div class="ld-col">
        <div class="ld-tools">
          ${owner && !demo ? `<button type="button" class="ld-pill ld-pill-main" data-action="obOpen" data-mode="new">${svg(I.plus, 18)}New profile</button><button type="button" class="ld-pill" data-action="obOpen" data-mode="assess">${svg(I.target, 18)}Assessment</button>` : `<a class="ld-pill" href="#/family">${svg(I.plus, 18)}Add relationship</a>`}
          <a class="ld-pill" href="#/history">${svg(I.calendar, 18)}Updated ${day(c.updatedAt)}${svg(I.chevron, 16)}</a>
          <span class="ld-grow"></span>
          ${roundLink("#/pathways", "Compare transition options", I.sliders)}
          ${roundLink("#/resources", "Planning resources", I.search)}
        </div>

        <div class="ld-tiles">${tiles
          .map(([ic, col, j]) => `<a class="ld-card ld-tile" href="#/${esc(j.route)}"><span class="ld-ic ${col}">${svg(ic, 20)}</span><b>${esc(j.label)}</b><small>${esc(j.status)}</small></a>`)
          .join("")}</div>

        <div class="ld-two">
          <section class="ld-card ld-pad">
            <div class="ld-ch"><div><h2>Relationship map</h2><small>You mapped ${(d.stakeholders ?? []).length} ${(d.stakeholders ?? []).length === 1 ? "person" : "people"}</small></div>${roundLink("#/family", "Open family and legacy")}</div>
            <div class="ld-map">${relationshipMap(d)}</div>
          </section>
          <section class="ld-card ld-pad">
            <div class="ld-ch"><div><h2>Evidence readiness</h2><small>${rd.reported} of ${rd.total} available · ${rd.verified} verified</small></div>${roundLink("#/readiness", "Open readiness and review")}</div>
            <div class="ld-slider" role="img" aria-label="${rd.score}% of evidence available"><i data-w="${rd.score}"></i><b data-left="${rd.score}"></b></div>
            <div class="ld-letters">${shownEv
              .map((e, i) => `<span class="${e.verified ? "v" : e.reported ? "a" : "n"} c${i % 5}" title="${esc(e.label)}: ${e.verified ? "verified" : e.reported ? "available" : "not confirmed"}">${EVIDENCE_LETTER[i]}</span>`)
              .join("")}${ev.length > shownEv.length ? `<span class="more">+${ev.length - shownEv.length}</span>` : ""}</div>
          </section>
        </div>

        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><small class="ld-eyebrow">Enterprise value by scenario</small><h2>Valuation range</h2></div><div class="ld-row"><span class="ld-tag">Prediction</span>${roundLink("#/proceeds", "Open proceeds and wealth")}</div></div>
          <div class="ld-vf">${valueField(sens, s, d.valuationReview)}</div>
          <p class="ld-foot"><b>${usd(r.cash)}</b><span>Estimated cash at your ${s.multiple.toFixed(1)}x working multiple. Not a certified valuation.</span></p>
        </section>
        <section class="ld-card ld-pad">
          <div class="ld-ch"><h2>Case history</h2>${roundLink("#/history", "Open case history")}</div>
          ${
            history.length
              ? `<ul class="ld-hist">${history
                  .slice(0, 4)
                  .map((e) => `<li><span class="ld-dotic">${svg(I.history, 16)}</span><span class="t">${esc(e.label)}</span><small>${day(e.createdAt)}</small></li>`)
                  .join("")}</ul>`
              : `<p class="ld-empty">${esc(steps[0]?.title ?? "Changes to this case will appear here.")}</p>`
          }
        </section>
      </div>

      <div class="ld-col">
        <div class="ld-two">
          <a class="ld-cc yellow" href="#/discovery">
            <span class="ld-cc-brand">${markLogo}PNC-link</span>
            <small>Business</small><b>${esc(p.business)}</b>
            <span class="ld-cc-row"><span><small>Owner</small>${esc(p.name)}</span><span><small>Horizon</small>${esc(p.timeline)} yrs</span></span>
          </a>
          <a class="ld-cc black" href="#/pathways">
            <span class="ld-cc-brand">${markLogo}PNC-link</span>
            <small>Working direction</small><b>${esc(chosen || "Options open")}</b>
            <span class="ld-cc-row"><span><small>Advisor</small>${esc(p.advisorEmail || "Not assigned")}</span><span><small>Stage</small>${esc(d.management?.stage || journey.find((j) => j.status === "Current")?.label.split(" ")[0] || "Planning")}</span></span>
          </a>
        </div>

        <div class="ld-two">
          <section class="ld-card ld-pad">
            <div class="ld-ch"><h2>Transition paths</h2>${roundLink("#/pathways", "Open transition options")}</div>
            <div class="ld-invest">${pathRows
              .map((x, i) => `<a class="ld-inv c${i}" href="#/pathways"><span class="ld-letter">${svg(PATH_ICONS[x.name] ?? I.split, 24)}</span><span class="nm"><b>${esc(x.name)}</b><small>${x.name === chosen ? "Working direction" : suggested.includes(x.name) ? "Discuss with advisor" : "Alternative"}</small></span><span class="val"><b>${esc(x.liquidity)}</b><small>Liquidity</small></span></a>`)
              .join("")}</div>
          </section>
          <section class="ld-card ld-pad">
            <div class="ld-ch"><small>Estimated cash proceeds</small>${roundLink("#/proceeds", "Open proceeds and wealth", I.arrow, "solid")}</div>
            <p class="ld-big ${r.cash < 0 ? "neg" : ""}">${usd(r.cash)}</p>
            <div class="ld-acts">
              <a class="ld-act y" href="#/proceeds" aria-label="Edit proceeds scenario">${svg(I.up, 18)}</a>
              <button type="button" class="ld-act b" data-action="downloadBrief" aria-label="Download meeting brief">${svg(I.down, 18)}</button>
              <a class="ld-act g" href="#/pathways" aria-label="Compare transition options">${svg(I.swap, 18)}</a>
              <a class="ld-act p" href="#/assistant" aria-label="Ask PNC-link AI">${svg(I.spark, 18)}</a>
            </div>
            <small class="ld-label">Liquidity goal coverage</small>
            <div class="ld-slider" role="img" aria-label="${Math.round(coverage)}% of the liquidity goal"><i data-w="${coverage.toFixed(1)}"></i><b data-left="${coverage.toFixed(1)}"></b></div>
            <p class="ld-foot"><b>${usd(p.liquidity)}</b><span>${diff >= 0 ? `Cash is ${short(diff)} above your goal` : `Cash is ${short(-diff)} below your goal`}</span></p>
            <div class="ld-cur"><span class="tag">EV</span><b>${usd(r.ev)}</b><small>${svg(I.arrow, 12)}${s.multiple.toFixed(1)}x</small></div>
            <div class="ld-cur"><span class="tag">TAX</span><b>${usd(r.tax)}</b><small>${svg(I.arrow, 12)}${s.tax}%</small></div>
          </section>
        </div>

        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><small class="ld-eyebrow">Seven evidence categories</small><h2>Evidence by category</h2></div><div class="ld-score">${rd.verified}<small>/${rd.total} verified</small></div></div>
          <div class="ld-radar">${evidenceRadar(d.evidence ?? [])}</div>
          <div class="ld-legend"><span><i class="v"></i>Verified</span><span><i class="a"></i>Available</span><span><i class="n"></i>Not confirmed</span></div>
        </section>
      </div>
    </div>
  </div>
</div>`;
}

// Signed in (or guest) without a case yet: same frame, with a way to start.
export function linkDashboardEmpty({ side, menu, account, theme, user, guest }) {
  const staff = (user?.roles ?? []).some((r) => ["advisor", "specialist"].includes(r)),
    name = guest ? "Guest" : user?.name || user?.email || "there";
  const steps = [
    [I.target, "y", "Record your goals and business facts", "discovery"],
    [I.chart, "b", "Your advisor reviews and verifies", "readiness"],
    [I.split, "g", "Compare transition paths", "pathways"],
    [I.team, "p", "Approve each specialist handoff", "referrals"],
  ];
  return `<div class="ld nx ${theme}" data-ld>
${side}
  <div class="ld-body">
    ${head({ menu, account, name, greeting: guest ? "Welcome!" : "Welcome back!", note: guest ? '<span class="ld-sample">Saved only in this browser</span>' : "" })}
    <section class="ld-start">
      <div class="ld-start-copy">
        <span class="ld-cc-brand">${markLogo}PNC-link</span>
        <h2>${staff ? "No shared cases yet." : "Your dashboard fills in from your transition profile."}</h2>
        <p>${
          staff
            ? "Cases appear here when an owner names your account email and shares their case, or approves a referral addressed to you."
            : "Add your business facts, goals and family priorities. Valuation range, proceeds, evidence and transition paths appear here as soon as you save."
        }</p>
        <div class="ld-start-btns"><a class="ld-yellow" href="#/discovery">${staff ? "Create my own owner case" : "Start your transition profile"}</a><button type="button" class="ld-ghost" data-action="demo">Explore demo</button></div>
      </div>
    </section>
    <div class="ld-tiles">${steps
      .map(([ic, col, label, route], i) => `<a class="ld-card ld-tile" href="#/${route}"><span class="ld-ic ${col}">${svg(ic, 20)}</span><b>${label}</b><small>Step ${i + 1}</small></a>`)
      .join("")}</div>
  </div>
</div>`;
}

// My transition in the dashboard frame. Content pieces (forms, badges, AI and brief
// buttons) come from workspace.js so their behaviour is unchanged.
export function linkTransition({ side, menu, account, theme, c, user, demo, demoRole, parts, note = "", settings = "#/discovery" }) {
  const d = c.data,
    p = d.profile,
    journey = transitionJourney(d),
    current = journey.find((j) => j.status === "Current"),
    steps = nextSteps(d, c.mode).slice(0, 4),
    owner = c.mode === "owner",
    name = owner ? p.name : demo ? ADVISOR_NAME : user?.name || user?.email || "Advisor",
    icons = [I.target, I.chart, I.split, I.team, I.wallet],
    tones = ["y", "b", "g", "p", "l"];
  return `<div class="ld nx ${theme}" data-ld>
${side}
  <div class="ld-body">
    ${head({ menu, account, name, demo, demoRole, note, settings, ping: (d.actions ?? []).some((a) => a.status !== "Completed") })}
    <div class="ld-grid ld-fill">
      <div class="ld-col">
        <div class="ld-tools">
          <a class="ld-pill" href="#/discovery">${svg(I.plus, 18)}${owner ? "Update discovery" : "View discovery"}</a>
          <a class="ld-pill" href="#/history">${svg(I.calendar, 18)}Updated ${day(c.updatedAt)}${svg(I.chevron, 16)}</a>
          <span class="ld-grow"></span>
          ${roundLink("#/pathways", "Compare transition options", I.sliders)}
          ${roundLink("#/resources", "Planning resources", I.search)}
        </div>
        <nav class="ld-tiles five" aria-label="Journey progress">${journey
          .map(
            (j, i) =>
              `<a class="ld-card ld-tile ${j.status.toLowerCase()}" href="#/${esc(j.route)}" ${j.status === "Current" ? 'aria-current="step"' : ""}><span class="ld-ic ${tones[i]}">${svg(icons[i], 20)}</span><b>${esc(j.label)}</b><small>0${i + 1} · ${esc(j.status)}</small></a>`,
          )
          .join("")}</nav>
        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><h2>${owner ? "Your next steps" : "Next best actions to review"}</h2><small>Based on recorded facts and transparent workflow rules. Review before acting.</small></div>${roundLink("#/plan", "Open shared action plan")}</div>
          <div class="ld-invest">${steps
            .map(
              (st, i) =>
                `<a class="ld-inv c${i % 4}" href="#/${esc(st.route)}"><span class="ld-letter">${i + 1}</span><span class="nm"><b>${esc(st.title)}</b><small>${esc(st.detail)}</small></span></a>`,
            )
            .join("")}</div>
          <div class="ld-btns">${parts.assistant}${parts.brief}</div>
        </section>
      </div>

      <div class="ld-col">
        <div class="ld-two">
          <section class="ld-cc yellow">
            <span class="ld-cc-brand">${markLogo}PNC-link</span>
            <small>${owner ? "Owner journey" : "Advisor case"} · ${esc(p.industry)}</small>
            <h2 class="ld-cc-title">${esc(p.business)}</h2>
            <p class="ld-cc-desc">A common record of your goals, evidence, decisions, and the people helping you move forward.</p>
            <div class="ld-cc-badges">${parts.badges}</div>
          </section>
          <section class="ld-cc black ld-cc-progress">
            <span class="ld-cc-brand">${markLogo}Journey progress</span>
            <div class="ld-cc-ring">${parts.journeyRing}</div>
            <span class="ld-cc-row"><span><small>Current step</small>${esc(current?.label ?? "Complete")}</span></span>
          </section>
        </div>
        <div class="ld-two">
          <section class="ld-card ld-pad">
            <div class="ld-ch"><h2>What matters to the owner</h2>${roundLink("#/discovery", owner ? "Update discovery" : "View discovery")}</div>
            <div class="ld-facts">
              <div class="ld-fact"><span class="ld-ic y">${svg(I.target, 18)}</span><span><small>Transition trigger</small><b>${esc(p.trigger)}</b></span></div>
              <div class="ld-fact"><span class="ld-ic b">${svg(I.calendar, 18)}</span><span><small>Horizon</small><b>${esc(p.timeline)}-year horizon</b></span></div>
              <div class="ld-fact"><span class="ld-ic g">${svg(I.split, 18)}</span><span><small>Future role</small><b>${esc(p.futureRole)}</b></span></div>
            </div>
            <div class="ld-note y"><span class="ld-note-h">${svg(PATH_ICONS["Family transfer"], 16)}Family and legacy</span><p class="review-note">${esc(p.priorities || "Family and legacy priorities have not been recorded.")}</p></div>
            <div class="ld-note b"><span class="ld-note-h">${svg(I.team, 16)}Employee priorities</span><p>${esc(p.employeePriorities || "Not yet recorded")}</p></div>
          </section>
          <section class="ld-card ld-pad">
            <div class="ld-ch"><small>Liquidity goal</small>${roundLink("#/proceeds", "Open proceeds and wealth", I.arrow, "solid")}</div>
            <p class="ld-big">${parts.liquidity}</p>
            <div class="ld-ret">${parts.retainedRing}<small>Desired retained ownership</small></div>
            <div class="mt-horizon"><small>${esc(p.timeline)}-year horizon</small>${parts.horizon}</div>
          </section>
        </div>
        ${parts.management}
      </div>
    </div>
    <div class="ld-sched" data-sched>
        <section class="ld-card ld-pad ld-meet">
          <div class="ld-ch"><h2>Your next conversation</h2></div>
          <div class="ld-adv">
            <small class="ld-eyebrow">Meet with</small>
            <button type="button" class="ld-adv-row ld-adv-current" data-adv-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="Choose an advisor">${advisorRow(ADVISORS[0])}${svg('<path d="M6 9l6 6 6-6"/>', 18)}</button>
            <div class="ld-adv-menu" role="listbox" aria-label="Advisors" hidden>${ADVISORS.map(
              (a, i) => `<button type="button" class="ld-adv-row ${i === 0 ? "on" : ""}" role="option" aria-selected="${i === 0}" data-adv="${i}">${advisorRow(a)}</button>`,
            ).join("")}</div>
          </div>
          <div class="ld-meet-body">${parts.meeting}</div>
        </section>
        <section class="ld-card ld-pad ld-cal" data-cal>
          <div class="ld-ch"><div class="ld-cal-who"><img data-cal-photo src="${ADVISORS[0].photo}" alt=""><div><small class="ld-eyebrow">Advisor calendar</small><h2 data-cal-name>${ADVISORS[0].name}</h2><small data-cal-hours>${ADVISORS[0].hours}</small></div></div><div class="ld-cal-nav"><button type="button" class="ld-round" data-cal-step="-1" aria-label="Previous month">${svg('<path d="M15 6l-6 6 6 6"/>', 18)}</button><button type="button" class="ld-round" data-cal-step="1" aria-label="Next month">${svg('<path d="M9 6l6 6-6 6"/>', 18)}</button></div></div>
          <p class="ld-cal-title" data-cal-title></p>
          <div class="ld-cal-grid" data-cal-grid role="grid" aria-label="Advisor calendar"></div>
          <div class="ld-cal-key"><span><i class="open"></i>Open times</span><span><i class="full"></i>Fully booked</span><span><i class="off"></i>Not working</span></div>
          <small class="ld-cal-note">Illustrative availability · Eastern Time</small>
        </section>
        <section class="ld-card ld-pad ld-slots">
          <div class="ld-ch"><div><small class="ld-eyebrow">Times</small><h2 data-slot-day>Select a day</h2></div></div>
          <div class="ld-slot-list" data-slot-list></div>
          <p class="ld-slot-note" data-slot-note>Choosing a time adds it to your meeting request. Your advisor confirms the time.</p>
        </section>
    </div>
  </div>
</div>`;
}

// Small pieces reused by the framed workspace pages.
export const pathIcon = (name) => svg(PATH_ICONS[name] ?? I.split, 22);
export const personAvatar = (name, cls = "") =>
  PHOTOS[name]
    ? `<img class="ld-person ${cls}" src="${PHOTOS[name]}" alt="">`
    : `<span class="ld-person ${cls}">${esc(initials(name))}</span>`;
const TEAM_ICON = {
  "Harris Williams": '<path d="M12 31l7-7 5 4 9-10"/><path d="M27 18h6v6"/>',
  "PNC Private Bank": '<path d="M11 18l11-6 11 6"/><path d="M14 19v10M19.5 19v10M24.5 19v10M30 19v10"/><path d="M11 32h22"/>',
  "Business Credit": '<rect x="11" y="14" width="22" height="16" rx="3"/><path d="M11 19.5h22M15 25.5h5"/>',
  "Financial Sponsor Coverage": '<rect x="11" y="17" width="22" height="15" rx="3"/><path d="M18 17v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M11 23.5h22"/>',
  "Succession Planning": '<circle cx="22" cy="14.5" r="3"/><circle cx="15" cy="27" r="3"/><circle cx="29" cy="27" r="3"/><path d="M22 17.5v4M22 21.5l-6 3M22 21.5l6 3"/>',
};
export const teamLogo = (team) =>
  `<svg class="ld-team" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><rect width="44" height="44" rx="12" fill="#111"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TEAM_ICON[team] ?? TEAM_ICON["PNC Private Bank"]}</g></svg>`;

// Any workspace page in the dashboard frame: shared header, page body below.
/* ---------------- Case history ---------------- */

const HS_ACTORS = [
  ["owner", "Owner"],
  ["advisor", "Advisor"],
  ["specialist", "Specialist"],
  ["shared", "Shared / system"],
];
// Topics are read from the recorded labels in workflow.mjs; order matters (family before review).
const HS_TOPICS = [
  ["Family", /family|relationship/i],
  ["Discovery", /discovery|profile|sharing permission|sample case/i],
  ["Evidence", /evidence/i],
  ["Review", /review|qualif|opportunity/i],
  ["Value & proceeds", /proceeds|value perspective/i],
  ["Transition path", /path/i],
  ["Meetings", /meeting/i],
  ["Referrals", /referral/i],
  ["Actions", /action|next step|coordination|outcomes/i],
];
const DAY_MS = 864e5;
const HS_ROUTE = {
  Family: "#/family",
  Discovery: "#/discovery",
  Evidence: "#/readiness",
  Review: "#/readiness",
  "Value & proceeds": "#/proceeds",
  "Transition path": "#/pathways",
  Meetings: "#/overview",
  Referrals: "#/referrals",
  Actions: "#/plan",
};
const hsActor = (label) => {
  const w = String(label).split(" ")[0].toLowerCase();
  return ["owner", "advisor", "specialist"].includes(w) ? w : "shared";
};
const hsTopic = (label) => HS_TOPICS.find(([, re]) => re.test(label))?.[0] ?? "Other";
const ago = (ms) => {
  const d = Math.floor(ms / DAY_MS);
  if (d >= 1) return `${d} day${d === 1 ? "" : "s"} ago`;
  const h = Math.floor(ms / 36e5);
  return h >= 1 ? `${h} hour${h === 1 ? "" : "s"} ago` : "Just now";
};
const span = (ms) => {
  const d = ms / DAY_MS;
  return d >= 1 ? `${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}` : `${Math.max(1, Math.round(ms / 36e5))} hours`;
};

// One lane per actor on a shared time axis, ending at today. Close dots stack so none hide.
function historyLanes(ev, now) {
  const lanes = HS_ACTORS.filter(([k]) => k !== "shared" || ev.some((e) => e.actor === k)),
    t0 = Math.min(...ev.map((e) => e.t)),
    pad = Math.max((now - t0) * 0.04, 36e5),
    lo = t0 - pad,
    hi = now + pad,
    X0 = 120,
    X1 = 980,
    x = (t) => X0 + ((t - lo) / (hi - lo)) * (X1 - X0),
    LH = 64,
    top = 30,
    H = top + lanes.length * LH;
  let g = "";
  lanes.forEach(([k, l], i) => {
    const y = top + LH / 2 + i * LH;
    g += `<text x="0" y="${y + 5}" class="hs-lane-l">${l}</text><line x1="${X0}" x2="${X1}" y1="${y}" y2="${y}" class="hs-lane"/>`;
    let prev = -1e9,
      stack = 0;
    ev.filter((e) => e.actor === k).forEach((e) => {
      const cx = x(e.t);
      stack = cx - prev < 14 ? stack + 1 : 0;
      prev = cx;
      const dy = stack ? (stack % 2 ? -1 : 1) * Math.ceil(stack / 2) * 11 : 0;
      g += `<circle cx="${cx.toFixed(1)}" cy="${y + Math.max(-26, Math.min(26, dy))}" r="6" class="hs-dot ${k}"><title>${esc(e.label)} · ${day(e.t)}</title></circle>`;
    });
  });
  // Midnight ticks, thinned to at most eight labels.
  const start = new Date(lo);
  start.setHours(24, 0, 0, 0);
  const n = Math.max(1, Math.ceil((hi - start) / DAY_MS)),
    step = Math.ceil(n / 8);
  for (let t = start.getTime(); t <= hi; t += step * DAY_MS)
    g += `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${top}" y2="${H}" class="hs-vline"/><text x="${x(t).toFixed(1)}" y="${H + 18}" text-anchor="middle" class="hs-tick">${new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`;
  g += `<line x1="${x(now).toFixed(1)}" x2="${x(now).toFixed(1)}" y1="${top - 6}" y2="${H}" class="hs-now"/><text x="${x(now).toFixed(1)}" y="${top - 12}" text-anchor="middle" class="hs-tick hs-today">Today</text>`;
  return `<svg viewBox="0 0 1000 ${H + 26}" width="100%" role="img" aria-label="${ev.length} recorded updates by owner, advisor and specialist over time">${g}</svg>`;
}

function hsBars(rows, total) {
  return `<div class="hs-bars">${rows
    .map(([cls, label, n]) => `<div class="hs-bar"><span>${label}</span><div class="rd-fn-track">${n ? `<i class="${cls}" data-w="${((n / (total || 1)) * 100).toFixed(1)}"></i>` : ""}</div><b>${n}</b></div>`)
    .join("")}</div>`;
}

export function linkHistory(history, now = Date.now()) {
  const ev = (history ?? [])
    .map((e) => ({ label: e.label, t: Date.parse(e.createdAt), actor: hsActor(e.label), topic: hsTopic(e.label) }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);
  if (!ev.length)
    return `<section class="ld-card ld-pad"><div class="ld-ch"><h2>Case history</h2></div><p class="hs-empty">No changes recorded yet. Updates to discovery, evidence, family, proceeds, meetings and referrals appear here automatically.</p></section>`;
  const first = ev[0],
    last = ev[ev.length - 1],
    count = (k) => ev.filter((e) => e.actor === k).length,
    lastBy = (k) => [...ev].reverse().find((e) => e.actor === k),
    byDay = ev.reduce((m, e) => m.set(day(e.t), (m.get(day(e.t)) ?? 0) + 1), new Map()),
    busiest = [...byDay].sort((a, b) => b[1] - a[1])[0],
    gaps = ev.slice(1).map((e, i) => ({ ms: e.t - ev[i].t, from: ev[i], to: e })),
    gap = gaps.sort((a, b) => b.ms - a.ms)[0],
    age = now - first.t,
    weeks = age / (7 * DAY_MS),
    topics = HS_TOPICS.map(([t]) => [t, ev.filter((e) => e.topic === t).length])
      .concat([["Other", ev.filter((e) => e.topic === "Other").length]])
      .filter(([, n]) => n)
      .sort((a, b) => b[1] - a[1]),
    actors = HS_ACTORS.map(([k, l]) => [k, l, count(k)]).filter(([k, , n]) => n || k !== "shared"),
    lead = [...actors].sort((a, b) => b[2] - a[2])[0],
    insight = [
      ["Case open", `${span(age)} since ${day(first.t)}`],
      ["Pace", weeks >= 1 ? `${(ev.length / weeks).toFixed(1)} updates per week` : `${ev.length} updates in the first week`],
      ["Busiest day", `${busiest[0]} · ${busiest[1]} update${busiest[1] === 1 ? "" : "s"}`],
      ["Most active", `${lead[1]} · ${lead[2]} of ${ev.length} updates`],
      ["Longest quiet gap", gap ? `${span(gap.ms)} before “${esc(gap.to.label)}”` : "Only one update so far"],
      ["Last owner update", lastBy("owner") ? ago(now - lastBy("owner").t) : "None yet"],
      ["Last advisor update", lastBy("advisor") ? ago(now - lastBy("advisor").t) : "None yet"],
    ];
  return `<h2 class="sr-only">A visible record of progress.</h2>
    <div class="ld-kpis rd-kpis">
      <div class="ld-card ld-kpi"><small>Recorded updates</small><b>${ev.length}</b><span>Across ${topics.length} topic${topics.length === 1 ? "" : "s"}</span></div>
      <div class="ld-card ld-kpi"><small>Case open</small><b>${Math.max(1, Math.ceil(age / DAY_MS))}<em> days</em></b><span>Since ${day(first.t)}</span></div>
      <div class="ld-card ld-kpi"><small>Last activity</small><b class="hs-kpi-sm">${ago(now - last.t)}</b><span>${esc(HS_ACTORS.find(([k]) => k === last.actor)[1])} · ${esc(last.topic)}</span></div>
      <div class="ld-card ld-kpi"><small>Owner · advisor</small><b>${count("owner")}<em> · </em>${count("advisor")}</b><span>Updates by each side</span></div>
    </div>
    <section class="ld-card ld-pad">
      <div class="ld-ch"><div><h2>Activity over time</h2><small>Each dot is one recorded update. Hover a dot for details.</small></div><div class="ld-legend hs-legend">${actors.map(([k, l]) => `<span><i class="${k}"></i>${l}</span>`).join("")}</div></div>
      <div class="hs-lanes">${historyLanes(ev, now)}</div>
    </section>
    <div class="ld-grid hs-grid">
      <section class="ld-card ld-pad"><div class="ld-ch"><div><h2>Who is moving the case</h2><small>Share of recorded updates</small></div></div>${hsBars(actors.map(([k, l, n]) => [k, l, n]), ev.length)}
        <div class="ld-ch hs-sub"><div><h2>What changed</h2><small>Updates by topic</small></div></div>${hsBars(topics.map(([t, n]) => ["t", esc(t), n]), ev.length)}</section>
      <section class="ld-card ld-pad"><div class="ld-ch"><div><h2>Analysis</h2><small>Calculated from the recorded history</small></div></div>
        <dl class="hs-facts">${insight.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <p class="hs-note">Counts reflect recorded changes, not effort or progress quality. AI conversations stay private and are not included.</p></section>
    </div>
    <section class="ld-card ld-pad hs-table-card">
      <div class="ld-ch"><div><h2>Timeline</h2><small>Newest first</small></div></div>
      <div class="hs-tabs" role="tablist" aria-label="Filter updates">${[["all", "All updates"], ...actors.filter(([, , n]) => n).map(([k, l]) => [k, l])]
        .map(([k, l], i) => `<button type="button" role="tab" class="hs-tab" data-hs-tab="${k}" aria-selected="${i === 0}">${esc(l)}<em>${k === "all" ? ev.length : count(k)}</em></button>`)
        .join("")}</div>
      <div class="hs-table-wrap"><table class="hs-table"><caption class="sr-only">Recorded case updates, newest first</caption><thead><tr><th>Update</th><th>Who</th><th>Topic</th><th>Date</th><th>Details</th></tr></thead><tbody>${[...ev]
        .reverse()
        .map((e) => {
          const who = HS_ACTORS.find(([k]) => k === e.actor)[1],
            route = HS_ROUTE[e.topic];
          return `<tr data-actor="${e.actor}"><td><span class="hs-upd"><i class="hs-arrow ${e.actor}" aria-hidden="true">${e.actor === "owner" ? "↑" : e.actor === "shared" ? "•" : "↓"}</i>${esc(e.label)}</span></td><td>${esc(who)}</td><td><span class="hs-topic ${e.actor}">${esc(e.topic)}</span></td><td class="hs-when">${new Date(e.t).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}, ${new Date(e.t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td><td>${route ? `<a class="hs-view" href="${route}">View</a>` : ""}</td></tr>`;
        })
        .join("")}</tbody></table></div>
    </section>`;
}

/* ---------------- Advisor dashboard (same building blocks as the owner's) ---------------- */

// `a` is the portfolio summary prepared by workspace.js; this only lays it out.
export function linkAdvisorDashboard({ side, menu, account, theme, user, demo, demoRole, settings = "#/settings", a }) {
  const name = demo ? ADVISOR_NAME : user?.name || ADVISOR_NAME,
    when = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    tiles = [
      [I.target, "y", "Review discovery", a.pendingReviews, "#/portfolio", "awaiting review"],
      [I.chart, "b", "Verify evidence", a.toVerify, "#/portfolio", "categories to verify"],
      [I.calendar, "g", "Confirm meetings", a.requested, "#/calendar", "requests waiting"],
      [I.team, "p", "Coordinate handoffs", a.drafts, "#/inbox", "awaiting owner approval"],
    ];
  return `<div class="ld nx ${theme}" data-ld>
${side}
  <div class="ld-body">
    ${head({ menu, account, name, demo, demoRole, settings, ping: a.inbox > 0 })}

    <div class="ld-kpis">
      <div class="ld-card ld-kpi"><small>Book value (working)</small><b>${short(a.bookValue)}</b><span>${a.clients} clients · ${short(a.minEv)} – ${short(a.maxEv)}</span>${miniRange(a.minEv, a.maxEv, a.bookValue / Math.max(1, a.clients))}</div>
      <div class="ld-card ld-kpi gauge"><div><small>Evidence verified</small><b>${a.verifiedPct}<em>%</em></b><span>Across all clients</span></div>${gauge(a.verifiedPct)}</div>
      <div class="ld-card ld-kpi"><small>Clients</small><b>${a.clients}</b><span>${a.attention} need attention</span></div>
      <div class="ld-card ld-kpi"><small>Meetings this week</small><b class="good">${a.thisWeek}</b><span>${a.requested} awaiting confirmation</span></div>
      <div class="ld-card ld-kpi"><small>Inbox</small><b>${a.inbox}</b><span>${a.urgent} need a response now</span></div>
    </div>

    <div class="ld-grid ld-fill">
      <div class="ld-col">
        <div class="ld-tools">
          <a class="ld-pill" href="#/plan">${svg(I.plus, 18)}Assign an action</a>
          <a class="ld-pill" href="#/inbox">${svg(I.calendar, 18)}${a.inbox} inbox items${svg(I.chevron, 16)}</a>
          <span class="ld-grow"></span>
          ${roundLink("#/calendar", "Open calendar", I.calendar)}
          ${roundLink("#/portfolio", "Search the portfolio", I.search)}
        </div>

        <div class="ld-tiles">${tiles
          .map(([ic, col, label, n, href, sub]) => `<a class="ld-card ld-tile" href="${href}"><span class="ld-ic ${col}">${svg(ic, 20)}</span><b>${label}</b><small>${n ? `${n} ${sub}` : "All clear"}</small></a>`)
          .join("")}</div>

        <div class="ld-two">
          <section class="ld-card ld-pad">
            <div class="ld-ch"><div><h2>Pipeline</h2><small>Clients by stage</small></div>${roundLink("#/portfolio", "Open portfolio")}</div>
            <div class="ad-pipe">${a.stages.map(([st, n]) => `<div><span>${esc(st)}</span><div class="ld-slider sm" role="img" aria-label="${n} of ${a.clients} clients"><i data-w="${((n / Math.max(1, a.clients)) * 100).toFixed(1)}"></i></div><b>${n}</b></div>`).join("")}</div>
          </section>
          <section class="ld-card ld-pad">
            <div class="ld-ch"><div><h2>Evidence by client</h2><small>${a.verifiedPct}% verified overall</small></div>${roundLink("#/portfolio", "Open portfolio")}</div>
            <div class="ld-slider" role="img" aria-label="${a.verifiedPct}% of evidence verified"><i data-w="${a.verifiedPct}"></i><b data-left="${a.verifiedPct}"></b></div>
            <div class="ld-letters">${a.byClient.map((x, i) => `<span class="${x.verified >= 5 ? "v" : x.verified ? "a" : "n"} c${i % 5}" title="${esc(x.business)}: ${x.verified} of 7 verified">${esc(x.initials)}</span>`).join("")}</div>
          </section>
        </div>

        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><small class="ld-eyebrow">Working value by client</small><h2>Book of business</h2></div><div class="ld-row"><span class="ld-tag">Prediction</span>${roundLink("#/portfolio", "Open portfolio")}</div></div>
          <ul class="ad-book">${a.byClient.map((x) => `<li><span><b>${esc(x.business)}</b><small>${esc(x.name)} · ${esc(x.stage)}</small></span>${miniRange(x.lo, x.hi, x.ev)}<b class="v">${short(x.ev)}</b></li>`).join("")}</ul>
          <p class="ld-foot"><b>${short(a.bookValue)}</b><span>Sum of working enterprise values at each client's own multiple. Not a valuation.</span></p>
        </section>
        <section class="ld-card ld-pad">
          <div class="ld-ch"><h2>Upcoming meetings</h2>${roundLink("#/calendar", "Open calendar")}</div>
          ${a.meetings.length ? `<ul class="ld-hist">${a.meetings.slice(0, 4).map((m) => `<li><span class="ld-dotic">${svg(I.calendar, 16)}</span><span class="t">${esc(m.business)} · ${m.status}</span><small>${m.at ? when(m.at) : "Time to be agreed"}</small></li>`).join("")}</ul>` : '<p class="ld-empty">No meetings booked.</p>'}
        </section>
      </div>

      <div class="ld-col">
        <div class="ld-two">
          <a class="ld-cc yellow" href="#/settings">
            <span class="ld-cc-brand">${markLogo}PNC-link</span>
            <small>Relationship advisor</small><b>${esc(name)}</b>
            <span class="ld-cc-row"><span><small>Clients</small>${a.clients}</span><span><small>Hours</small>${esc(a.hours)}</span></span>
          </a>
          <a class="ld-cc black" href="#/calendar">
            <span class="ld-cc-brand">${markLogo}PNC-link</span>
            <small>Next meeting</small><b>${esc(a.next ? a.next.business : "Nothing booked")}</b>
            <span class="ld-cc-row"><span><small>When</small>${esc(a.next?.at ? when(a.next.at) : "—")}</span><span><small>Status</small>${esc(a.next?.status ?? "—")}</span></span>
          </a>
        </div>

        <div class="ld-two">
          <section class="ld-card ld-pad">
            <div class="ld-ch"><h2>Clients</h2>${roundLink("#/portfolio", "Open portfolio")}</div>
            <div class="ld-invest">${a.byClient
              .slice(0, 4)
              .map((x, i) => `<button type="button" class="ld-inv c${i}" data-action="openCase" data-id="${esc(x.id)}" aria-label="Open ${esc(x.business)}"><span class="ld-letter">${esc(x.initials)}</span><span class="nm"><b>${esc(x.business)}</b><small>${esc(x.attention)}</small></span><span class="val"><b>${esc(x.stage)}</b><small>Stage</small></span></button>`)
              .join("")}</div>
          </section>
          <section class="ld-card ld-pad">
            <div class="ld-ch"><small>Open shared actions</small>${roundLink("#/plan", "Open shared action plan", I.arrow, "solid")}</div>
            <p class="ld-big">${a.openActions}</p>
            <div class="ld-acts">
              <a class="ld-act y" href="#/plan" aria-label="Shared action plan">${svg(I.plus, 18)}</a>
              <a class="ld-act b" href="#/calendar" aria-label="Calendar">${svg(I.calendar, 18)}</a>
              <a class="ld-act g" href="#/inbox" aria-label="Inbox">${svg(I.swap, 18)}</a>
              <a class="ld-act p" href="#/assistant" aria-label="Ask PNC-link AI">${svg(I.spark, 18)}</a>
            </div>
            <p class="ld-foot"><span>${a.overdue ? `${a.overdue} overdue across the book.` : "Nothing overdue."}</span></p>
          </section>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

export function linkPage({ side, menu, account, theme, c, user, demo, demoRole, route, body, note = "", settings = "#/discovery" }) {
  const owner = c.mode === "owner",
    name = owner ? c.data.profile.name : demo ? ADVISOR_NAME : user?.name || user?.email || "Advisor";
  return `<div class="ld nx ${theme}" data-ld>
${side}
  <div class="ld-body">
    ${head({ menu, account, name, demo, demoRole, note, settings, ping: (c.data.actions ?? []).some((a) => a.status !== "Completed") })}
    <main class="ld-page ld-page-${route}" id="main">${body}</main>
  </div>
</div>`;
}

// Readiness & review in the dashboard frame.
const EV_ICON = {
  "Financial statements": '<path d="M4 4v16h16"/><path d="M7.5 14.5l3.5-4 3 2.5 4.5-6"/>',
  "Ownership and debt schedule": '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 2.5A7.5 7.5 0 0 1 21.5 9H15z"/>',
  "Successor / key-person plan": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  "Family priorities": '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M12 17.5s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z"/>',
  "Tax and estate review": '<path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3v4.5H19M9 12h7M9 15.5h7M9 9h3"/>',
  "Operating procedures": '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  "Transition timeline": '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
};
export function linkReadiness({ side, menu, account, theme, c, user, demo, demoRole, parts, note = "", settings = "#/discovery" }) {
  const d = c.data,
    p = d.profile,
    rd = readiness(d),
    owner = c.mode === "owner",
    name = owner ? p.name : demo ? ADVISOR_NAME : user?.name || user?.email || "Advisor",
    tones = ["y", "b", "g", "p", "l"];
  return `<div class="ld nx ${theme}" data-ld>
${side}
  <div class="ld-body">
    ${head({ menu, account, name, demo, demoRole, note, settings, ping: (d.actions ?? []).some((a) => a.status !== "Completed") })}
    <h2 class="sr-only">Evidence before conclusions.</h2>
    <div class="ld-kpis rd-kpis">
      <div class="ld-card ld-kpi gauge"><div><small>Owner-reported availability</small><b>${rd.score}<em>%</em></b><span>${rd.reported}/${rd.total} categories</span></div>${gauge(rd.score)}</div>
      <div class="ld-card ld-kpi gauge"><div><small>Advisor verification</small><b>${rd.verifiedScore}<em>%</em></b><span>${rd.verified}/${rd.total} categories</span></div>${gauge(rd.verifiedScore)}</div>
      <div class="ld-card ld-kpi"><small>Review</small><b>${d.review ? "Recorded" : "Pending"}</b><span>Human findings and next steps</span></div>
      <div class="ld-card ld-kpi"><small>Opportunity</small><b>${d.qualified ? "Qualified" : "Discovery"}</b><span>Advisor determination</span></div>
    </div>
    <div class="ld-grid ld-fill rd-grid">
      <div class="ld-col">
        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><h2>Readiness evidence</h2><small>${owner ? "Mark what is available; your advisor verifies it." : "Verify categories the owner marked available."} Select <span class="rd-i-inline" aria-hidden="true">i</span> to see what each item covers.</small></div>${roundLink("#/discovery", "Open discovery profile")}</div>
          <div class="checklist rd-list">${parts.rows
            .map(
              (r, i) =>
                `<div class="check-row rd-row ${r.state}"><span class="ld-ic ${tones[i % 5]}">${svg(EV_ICON[r.label] ?? I.target, 18)}</span><div class="rd-txt"><b>${esc(r.label)}<button type="button" class="rd-i" data-rd-info="rd-help-${i}" aria-expanded="false" aria-controls="rd-help-${i}" aria-label="What ${esc(r.label)} means">i</button></b><small>${r.status}</small></div><div class="rd-sws">${r.available}${r.verified}</div>${evidenceHelp(r.label, owner, `rd-help-${i}`)}</div>`,
            )
            .join("")}</div>
          <p class="ld-foot rd-note"><span>The checklist measures evidence completeness, not financial health or readiness to sell. Advisor verification is a recorded review, not an automated document check.</span></p>
        </section>
        <section class="ld-cc black rd-judge">
          <span class="ld-cc-brand">${markLogo}Keep professional judgment central</span>
          <p>Formal valuations, buyer selection, financing, tax, legal matters, and final recommendations remain with qualified professionals. AI can help identify questions; it cannot approve this case.</p>
        </section>
      </div>
      <div class="ld-col">
        <section class="ld-card ld-pad">
          <div class="ld-ch"><div><small class="ld-eyebrow">Seven evidence categories</small><h2>Evidence status</h2></div><div class="ld-score">${rd.verified}<small>/${rd.total} verified</small></div></div>
          <div class="ld-radar rd-radar">${evidenceRadar(d.evidence ?? [], true)}</div>
          <div class="ld-legend"><span><i class="v"></i>Verified</span><span><i class="a"></i>Available</span><span><i class="n"></i>Not confirmed</span></div>
        </section>
        <section class="ld-card ld-pad">
          <div class="ld-ch"><h2>Advisor review</h2>${parts.reviewBadge}</div>
          ${parts.review}
        </section>
      </div>
    </div>
  </div>
</div>`;
}

export function mountLinkDashboard() {
  const root = document.querySelector("[data-ld]");
  if (!root) return;
  // CSP blocks inline style attributes, so sizes are set through the CSSOM.
  root.querySelectorAll("[data-w]").forEach((el) => (el.style.width = `${el.dataset.w}%`));
  // Schedule grid: hour rows are 64px; events and slots are placed by start hour and length.
  root.querySelectorAll("[data-rows]").forEach((el) => (el.style.height = `${el.dataset.rows * 64}px`));
  root.querySelectorAll("[data-top]").forEach((el) => {
    el.style.top = `${el.dataset.top * 64}px`;
    el.style.height = `${el.dataset.h * 64}px`;
  });
  // Keep the knob inside the track at 0% and 100%.
  root.querySelectorAll("[data-left]").forEach((el) => (el.style.left = `clamp(20px, ${el.dataset.left}%, calc(100% - 20px))`));
  // Case history tabs filter the timeline by who made the change.
  root.querySelectorAll("[data-hs-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      root.querySelectorAll("[data-hs-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      root.querySelectorAll(".hs-table tbody tr").forEach((tr) => (tr.hidden = tab.dataset.hsTab !== "all" && tr.dataset.actor !== tab.dataset.hsTab));
    }),
  );
  // Evidence info buttons open one explanation at a time.
  root.querySelectorAll("[data-rd-info]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      root.querySelectorAll("[data-rd-info]").forEach((b) => {
        b.setAttribute("aria-expanded", "false");
        document.getElementById(b.dataset.rdInfo).hidden = true;
      });
      btn.setAttribute("aria-expanded", String(open));
      document.getElementById(btn.dataset.rdInfo).hidden = !open;
    }),
  );
}

/* ---------------- Advisor calendar (My transition) ---------------- */

const advisorRow = (a) =>
  `<img src="${a.photo}" alt=""><span><b>${a.name}</b><small>${a.role}</small><em>${a.about}</em></span>`;
const chevron = svg('<path d="M6 9l6 6 6-6"/>', 18);

// Fictional advisors, each with their own working days, meeting times and bookings
// (illustrative availability, not a live calendar).
const ADVISORS = [
  {
    name: ADVISOR_NAME,
    role: "Relationship advisor",
    about: "Coordinates your transition plan and brings in the right specialists.",
    photo: ADVISOR_PHOTO,
    days: [1, 2, 3, 4, 5],
    times: ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"],
    hours: "Mon–Fri · 9:00 AM–4:30 PM",
    seed: 3,
  },
  {
    name: "Daniel Reyes",
    role: "Private Bank wealth advisor",
    about: "Liquidity, estate and family distributions before and after a sale.",
    photo: "./assets/people/daniel.jpg",
    days: [2, 3, 4],
    times: ["10:00 AM", "11:30 AM", "2:00 PM", "3:30 PM"],
    hours: "Tue–Thu · 10:00 AM–4:00 PM",
    seed: 7,
  },
  {
    name: "Marcus Hill",
    role: "Succession planning specialist",
    about: "Successor readiness, governance and family business continuity.",
    photo: "./assets/people/marcus.jpg",
    days: [1, 3, 5],
    times: ["8:30 AM", "12:00 PM", "4:30 PM"],
    hours: "Mon, Wed, Fri · 8:30 AM–5:00 PM",
    seed: 11,
  },
];

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Every meeting time on a working day, marked booked or open, within the next six weeks.
function scheduleFor(date, today, a) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 42);
  if (date < start || date > end || !a.days.includes(date.getDay())) return null;
  const seed = date.getDate() * 7 + date.getMonth() * 13 + a.seed;
  const fullyBooked = seed % 6 === 0;
  return a.times.map((t, i) => ({ t, booked: fullyBooked || (seed + i * a.seed) % 3 === 0 }));
}
const openTimes = (date, today, a) => (scheduleFor(date, today, a) ?? []).filter((x) => !x.booked);

export function mountAdvisorCalendar() {
  const root = document.querySelector("[data-sched]");
  if (!root) return;
  const cal = root.querySelector("[data-cal]"),
    today = new Date(),
    grid = cal.querySelector("[data-cal-grid]"),
    title = cal.querySelector("[data-cal-title]"),
    list = root.querySelector("[data-slot-list]"),
    dayLabel = root.querySelector("[data-slot-day]"),
    note = root.querySelector("[data-slot-note]"),
    toggle = root.querySelector("[data-adv-toggle]"),
    menu = root.querySelector(".ld-adv-menu"),
    form = root.querySelector('form[data-form="meeting"]'),
    topic = form?.querySelector('input[name="topic"]'),
    baseTopic = topic ? topic.value.split(" · ")[0] : "";
  let adv = 0,
    month = new Date(today.getFullYear(), today.getMonth(), 1),
    picked = null,
    pickedTime = "";
  const advisor = () => ADVISORS[adv];
  const remember = (when = "") => {
    if (!form) return;
    form.dataset.advisor = advisor().name;
    form.dataset.when = when;
  };
  remember();
  const fmtDay = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Start on the advisor's first day with open times.
  const firstOpen = () => {
    picked = null;
    pickedTime = "";
    for (let i = 1; i <= 42 && !picked; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (openTimes(d, today, advisor()).length) picked = d;
    }
    if (picked) month = new Date(picked.getFullYear(), picked.getMonth(), 1);
  };
  const drawSlots = () => {
    if (!picked) {
      dayLabel.textContent = "Select a day";
      list.innerHTML = "";
      return;
    }
    dayLabel.textContent = fmtDay(picked);
    list.innerHTML = (scheduleFor(picked, today, advisor()) ?? [])
      .map((x) =>
        x.booked
          ? `<button type="button" class="ld-slot booked" disabled>${x.t}<small>Booked</small></button>`
          : `<button type="button" class="ld-slot ${x.t === pickedTime ? "on" : ""}" data-slot="${x.t}">${x.t}</button>`,
      )
      .join("");
  };
  const drawMonth = () => {
    title.textContent = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const first = month.getDay(),
      days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    let html = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="ld-cal-h">${d}</span>`).join("");
    for (let i = 0; i < first; i++) html += "<span></span>";
    for (let n = 1; n <= days; n++) {
      const d = new Date(month.getFullYear(), month.getMonth(), n),
        sched = scheduleFor(d, today, advisor()),
        open = sched && sched.some((x) => !x.booked),
        on = picked && dayKey(d) === dayKey(picked),
        isToday = dayKey(d) === dayKey(today);
      html += open
        ? `<button type="button" class="ld-day open ${on ? "on" : ""}" data-day="${n}" aria-label="${fmtDay(d)}, times available" ${on ? 'aria-pressed="true"' : ""}>${n}</button>`
        : `<span class="ld-day ${sched ? "full" : ""} ${isToday ? "today" : ""}" ${sched ? `title="${fmtDay(d)}: fully booked"` : ""}>${n}</span>`;
    }
    grid.innerHTML = html;
    const min = new Date(today.getFullYear(), today.getMonth(), 1),
      max = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    cal.querySelector('[data-cal-step="-1"]').disabled = month <= min;
    cal.querySelector('[data-cal-step="1"]').disabled = month >= max;
  };
  const showAdvisor = () => {
    const a = advisor();
    cal.querySelector("[data-cal-photo]").src = a.photo;
    cal.querySelector("[data-cal-name]").textContent = a.name;
    cal.querySelector("[data-cal-hours]").textContent = a.hours;
    toggle.innerHTML = `${advisorRow(a)}${chevron}`;
  };
  const setMenu = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !e.target.closest(".ld-adv")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setMenu(false);
      toggle.focus();
    }
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-adv-toggle]")) {
      setMenu(menu.hidden);
      return;
    }
    const who = e.target.closest("[data-adv]");
    if (who) {
      adv = Number(who.dataset.adv);
      root.querySelectorAll("[data-adv]").forEach((b) => {
        b.classList.toggle("on", b === who);
        b.setAttribute("aria-selected", String(b === who));
      });
      setMenu(false);
      showAdvisor();
      firstOpen();
      drawMonth();
      drawSlots();
      if (topic) topic.value = baseTopic;
      remember();
      note.textContent = `Showing ${advisor().name}'s calendar. Choosing a time adds it to your meeting request.`;
      return;
    }
    const step = e.target.closest("[data-cal-step]");
    if (step && !step.disabled) {
      month = new Date(month.getFullYear(), month.getMonth() + Number(step.dataset.calStep), 1);
      drawMonth();
      return;
    }
    const day = e.target.closest("[data-day]");
    if (day) {
      picked = new Date(month.getFullYear(), month.getMonth(), Number(day.dataset.day));
      pickedTime = "";
      drawMonth();
      drawSlots();
      return;
    }
    const slot = e.target.closest("[data-slot]");
    if (slot) {
      pickedTime = slot.dataset.slot;
      drawSlots();
      const date = picked.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        when = `${date}, ${pickedTime} ET`;
      remember(`${date} at ${pickedTime} ET`);
      if (topic) {
        topic.value = `${baseTopic} · ${advisor().name} · ${when}`;
        note.textContent = `${advisor().name}, ${when} added to your meeting request. Send it with Request advisor meeting.`;
      } else note.textContent = `${advisor().name}, ${when} selected. A meeting request is already on record; your advisor confirms the time.`;
    }
  });
  firstOpen();
  drawMonth();
  drawSlots();
}
