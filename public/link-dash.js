// PNC-link Dashboard: a card-based summary of one case, in light and dark themes.
// Figures come from the recorded case and the transparent rules in domain.mjs.
import {
  defaultScenario,
  proceeds,
  readiness,
  paths,
  suggestedPaths,
  transitionJourney,
  nextSteps,
} from "./domain.mjs";

const THEME_KEY = "pnc-link-dash-theme";
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
const theme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

/* ---------------- Icons ---------------- */

const svg = (d, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" stroke="none"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" stroke="none"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" stroke="none"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" stroke="none"/>',
  overview: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 3 2 4-5"/>',
  portfolio: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.7-3.3 2.9-5 5.5-5s4.8 1.7 5.5 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 14.5c1.4.7 2.3 2.2 2.6 4.5"/>',
  proceeds: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M7 15h3"/>',
  readiness: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
  referrals: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M9 6V4.5h6V6M3 11.5h18"/>',
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
  up: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14"/>',
  down: '<path d="M12 5v11M7.5 11.5L12 16l4.5-4.5M5 19h14"/>',
  swap: '<path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5"/>',
  spark: '<path d="M12 3l2 6.2 6.2 2-6.2 2L12 19.5l-2-6.3-6.2-2 6.2-2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor"/>',
};
const markLogo = `<svg width="30" height="30" viewBox="0 0 96 96" aria-hidden="true"><g stroke-width="9" stroke-linecap="round"><path d="M48 43V23" stroke="currentColor"/><path d="M43 54 25 65M53 54 71 65" stroke="#00A3B1"/></g><circle cx="48" cy="18" r="11" fill="currentColor"/><circle cx="48" cy="50" r="9" fill="currentColor"/><circle cx="20" cy="70" r="11" fill="#00A3B1"/><circle cx="76" cy="70" r="11" fill="#00A3B1"/></svg>`;
const roundLink = (href, label, icon = I.arrow, cls = "") =>
  `<a class="ld-round ${cls}" href="${href}" aria-label="${esc(label)}">${svg(icon, 18)}</a>`;

/* ---------------- Charts ---------------- */

function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// Available cash and enterprise value across hypothetical multiples around the working one.
function multipleCurve(p, s) {
  const start = Math.max(1, Math.round(s.multiple) - 5),
    ms = Array.from({ length: 10 }, (_, i) => start + i),
    rows = ms.map((m) => ({ m, ...proceeds(p, { ...s, multiple: m }) })),
    work = proceeds(p, s);
  const W = 800,
    H = 190,
    T = 36,
    max = Math.max(...rows.map((r) => r.ev), 1),
    min = Math.min(0, ...rows.map((r) => r.cash));
  const x = (m) => 20 + ((m - start) / 9) * (W - 40),
    y = (v) => H - ((v - min) / (max - min)) * (H - T);
  const evPts = rows.map((r) => [x(r.m), y(r.ev)]),
    cashPts = rows.map((r) => [x(r.m), y(r.cash)]);
  const area = `${smooth(evPts)} L${x(start + 9)},${H} L${x(start)},${H} Z`;
  const wx = x(s.multiple),
    wy = y(work.cash),
    label = short(work.cash),
    lw = label.length * 8.6 + 26;
  return {
    svg: `<svg viewBox="0 0 ${W} ${H + 6}" width="100%" role="img" aria-label="Available cash and enterprise value by hypothetical multiple">
      <defs><linearGradient id="ldArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="ld-area-top"/><stop offset="1" class="ld-area-bot"/></linearGradient></defs>
      <path d="${area}" fill="url(#ldArea)"/>
      <path d="${smooth(cashPts)}" fill="none" class="ld-line" stroke-width="2"/>
      <line x1="${wx}" x2="${wx}" y1="${T - 2}" y2="${H}" class="ld-guide"/>
      <rect x="${wx - lw / 2}" y="2" width="${lw}" height="28" rx="14" class="ld-pin"/>
      <text x="${wx}" y="21" text-anchor="middle" class="ld-pin-t">${label}</text>
      <circle cx="${wx}" cy="${wy}" r="7" class="ld-dot"/>
    </svg>`,
    pills: ms
      .map((m) => `<span class="${Math.abs(m - s.multiple) < 0.5 ? "on" : ""}">${m}x</span>`)
      .join(""),
    work,
  };
}

function relationshipMap(d) {
  const people = (d.stakeholders ?? []).slice(0, 6),
    cx = 178,
    cy = 82;
  let g = "";
  people.forEach((person, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / Math.max(people.length, 1),
      px = cx + Math.cos(a) * 118,
      py = cy + Math.sin(a) * 52;
    g += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" class="ld-map-road"/>`;
    g += `<g><circle cx="${px}" cy="${py}" r="17" class="ld-map-node c${i % 4}"/><text x="${px}" y="${py + 4.5}" text-anchor="middle" class="ld-map-t">${esc(initials(person.name))}</text><title>${esc(person.name)} · ${esc(person.relationship)}</title></g>`;
  });
  return `<svg viewBox="0 0 356 164" width="100%" role="img" aria-label="Relationship map with ${people.length} people">
    <rect width="356" height="164" class="ld-map-bg"/>
    <path d="M0 118 C80 104 120 140 210 122 S320 96 356 110" class="ld-map-river"/>
    <path d="M60 0V164M0 40H356M250 0V164M0 140H356" class="ld-map-street"/>
    <rect x="270" y="52" width="40" height="26" rx="5" class="ld-map-park"/><rect x="20" y="64" width="26" height="40" rx="5" class="ld-map-park"/>
    ${g}
    <circle cx="${cx}" cy="${cy}" r="22" class="ld-map-me"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" class="ld-map-me-t">${esc(initials(d.profile.name))}</text>
  </svg>`;
}

function sidebar(isAdvisor, owner, mode) {
  const nav = [
    ["dashboard", "Dashboard", I.dashboard],
    ...(isAdvisor ? [["portfolio", "Client portfolio", I.portfolio]] : []),
    ["overview", owner ? "My transition" : "Case overview", I.overview],
    ["proceeds", "Proceeds", I.proceeds],
    ["readiness", "Readiness", I.readiness],
    ["referrals", "Referrals", I.referrals],
    ["history", "History", I.history],
    ["discovery", "Settings", I.settings],
  ];
  return `  <aside class="ld-side">
    <a class="ld-brand" href="#/home">${markLogo}<span>PNC-link</span></a>
    <nav aria-label="Dashboard">${nav
      .map(([id, label, ic]) => `<a class="ld-nav ${id === "dashboard" ? "on" : ""}" href="#/${id}" ${id === "dashboard" ? 'aria-current="page"' : ""}>${svg(ic)}<span>${label}</span></a>`)
      .join("")}</nav>
    <div class="ld-promo">
      <div class="ld-promo-img"><img src="./assets/family.png" alt=""></div>
      <div class="ld-promo-body"><b>Prepare smarter with PNC‑link AI</b><p>Explanations, meeting agendas and questions grounded in your case.</p><a class="ld-yellow" href="#/assistant">Ask PNC‑link AI</a></div>
    </div>
    <div class="ld-theme" role="group" aria-label="Theme"><button type="button" data-ld-theme="light" class="${mode === "light" ? "on" : ""}">${svg(I.sun, 16)}Light</button><button type="button" data-ld-theme="dark" class="${mode === "dark" ? "on" : ""}">${svg(I.moon, 16)}Dark</button></div>
  </aside>`;
}

/* ---------------- Page ---------------- */

const EVIDENCE_LETTER = ["F", "O", "S", "P", "T", "R", "L"];

export function linkDashboard({ c, user, demo, demoRole, history, isAdvisor }) {
  const d = c.data,
    p = d.profile,
    s = { ...defaultScenario, ...d.scenario },
    r = proceeds(p, s),
    rd = readiness(d),
    journey = transitionJourney(d),
    steps = nextSteps(d, c.mode),
    suggested = suggestedPaths(p),
    chosen = d.pathDecision?.path,
    curve = multipleCurve(p, s),
    owner = c.mode === "owner",
    name = owner ? p.name : demo ? "Relationship advisor" : user?.name || user?.email || "Advisor",
    coverage = p.liquidity ? Math.min(100, (Math.max(0, r.cash) / p.liquidity) * 100) : 100,
    diff = r.cash - p.liquidity,
    mode = theme();

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

  const avatar = demo
    ? '<img src="./assets/icons/hdr-avatar.png" alt="">'
    : `<span>${esc(initials(name) || "?")}</span>`;
  const viewSwitch = demo
    ? `<div class="ld-switch" role="group" aria-label="Sample view"><button type="button" class="${demoRole === "owner" ? "on" : ""}" ${demoRole === "owner" ? 'aria-pressed="true" disabled' : 'data-action="demoSwitch"'}>Client</button><button type="button" class="${demoRole === "owner" ? "" : "on"}" ${demoRole === "owner" ? 'data-action="demoSwitch"' : 'aria-pressed="true" disabled'}>Advisor</button></div>`
    : "";

  return `<div class="ld ${mode}" data-ld>
${sidebar(isAdvisor, owner, mode)}

  <div class="ld-body">
    <header class="ld-head ld-card">
      <div class="ld-avatar">${avatar}</div>
      <div><small>Welcome back!</small><h1 tabindex="-1">${esc(name)}</h1></div>
      <div class="ld-head-r">${viewSwitch}${demo ? '<span class="ld-sample">Read-only sample</span>' : ""}
        <a class="ld-round" href="#/plan" aria-label="Shared action plan">${svg(I.bell, 20)}${(d.actions ?? []).some((a) => a.status !== "Completed") ? '<i class="ld-ping"></i>' : ""}</a>
        <a class="ld-round" href="#/discovery" aria-label="Discovery profile settings">${svg(I.settings, 20)}</a>
      </div>
    </header>

    <div class="ld-grid">
      <div class="ld-col">
        <div class="ld-tools">
          <a class="ld-pill" href="#/family">${svg(I.plus, 18)}Add relationship</a>
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

        <section class="ld-card ld-pad ld-chart">
          <div class="ld-ch"><h2>Proceeds by multiple</h2><div class="ld-row">${roundLink("#/pathways", "Compare paths", I.sliders)}${roundLink("#/proceeds", "Open proceeds and wealth")}</div></div>
          ${curve.svg}
          <div class="ld-months">${curve.pills}</div>
          <p class="ld-foot"><b>${usd(curve.work.cash)}</b><span>Estimated cash at your ${s.multiple.toFixed(1)}x working multiple. Enterprise value ${short(curve.work.ev)}.</span></p>
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
              .map((x, i) => `<a class="ld-inv c${i}" href="#/pathways"><span class="ld-letter">${esc(x.name[0])}</span><span class="nm"><b>${esc(x.name)}</b><small>${x.name === chosen ? "Working direction" : suggested.includes(x.name) ? "Discuss with advisor" : "Alternative"}</small></span><span class="val"><b>${esc(x.liquidity)}</b><small>Liquidity</small></span></a>`)
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
    </div>
  </div>
</div>`;
}

// Signed in (or guest) without a case yet: same frame, with a way to start.
export function linkDashboardEmpty({ user, guest, isAdvisor }) {
  const mode = theme(),
    staff = (user?.roles ?? []).some((r) => ["advisor", "specialist"].includes(r)),
    name = guest ? "Guest" : user?.name || user?.email || "there";
  const steps = [
    [I.target, "y", "Record your goals and business facts", "discovery"],
    [I.chart, "b", "Your advisor reviews and verifies", "readiness"],
    [I.split, "g", "Compare transition paths", "pathways"],
    [I.team, "p", "Approve each specialist handoff", "referrals"],
  ];
  return `<div class="ld ${mode}" data-ld>
${sidebar(isAdvisor, !staff, mode)}
  <div class="ld-body">
    <header class="ld-head ld-card">
      <div class="ld-avatar"><span>${esc(initials(name) || "?")}</span></div>
      <div><small>Welcome${guest ? "" : " back"}!</small><h1 tabindex="-1">${esc(name)}</h1></div>
      <div class="ld-head-r">${guest ? '<span class="ld-sample">Saved only in this browser</span>' : ""}<a class="ld-round" href="#/discovery" aria-label="Discovery profile">${svg(I.settings, 20)}</a></div>
    </header>
    <section class="ld-start">
      <div class="ld-start-copy">
        <span class="ld-cc-brand">${markLogo}PNC-link</span>
        <h2>${staff ? "No shared cases yet." : "Your dashboard fills in from your transition profile."}</h2>
        <p>${
          staff
            ? "Cases appear here when an owner names your account email and shares their case, or approves a referral addressed to you."
            : "Add your business facts, goals and family priorities. Valuation range, proceeds, evidence and transition paths appear here as soon as you save."
        }</p>
        <div class="ld-start-btns"><a class="ld-yellow" href="#/discovery">${staff ? "Create my own owner case" : "Start your transition profile"}</a><button type="button" class="ld-ghost" data-action="demo">Explore the sample</button></div>
      </div>
    </section>
    <div class="ld-tiles">${steps
      .map(([ic, col, label, route], i) => `<a class="ld-card ld-tile" href="#/${route}"><span class="ld-ic ${col}">${svg(ic, 20)}</span><b>${label}</b><small>Step ${i + 1}</small></a>`)
      .join("")}</div>
  </div>
</div>`;
}

export function mountLinkDashboard() {
  const root = document.querySelector("[data-ld]");
  if (!root) return;
  // CSP blocks inline style attributes, so sizes are set through the CSSOM.
  root.querySelectorAll("[data-w]").forEach((el) => (el.style.width = `${el.dataset.w}%`));
  // Keep the knob inside the track at 0% and 100%.
  root.querySelectorAll("[data-left]").forEach((el) => (el.style.left = `clamp(20px, ${el.dataset.left}%, calc(100% - 20px))`));
  root.querySelectorAll("[data-ld-theme]").forEach((b) =>
    b.addEventListener("click", () => {
      const mode = b.dataset.ldTheme;
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {
        /* Theme still switches for this visit. */
      }
      root.classList.toggle("dark", mode === "dark");
      root.classList.toggle("light", mode === "light");
      root.querySelectorAll("[data-ld-theme]").forEach((x) => x.classList.toggle("on", x === b));
    }),
  );
}
