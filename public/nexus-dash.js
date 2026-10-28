// Case dashboard in the PNC NEXUS visual style.
// Every figure comes from the recorded case and the transparent rules in domain.mjs;
// nothing here infers fit, suitability or match scores.
import {
  defaultScenario,
  proceeds,
  readiness,
  valuationSensitivity,
  paths,
  suggestedPaths,
  routingSuggestions,
  transitionJourney,
  nextSteps,
} from "./domain.mjs";

// Chart palette (validated: lightness band, CVD separation, contrast)
const C = {
  blue: "#1814F3",
  teal: "#0F9F8F",
  orange: "#E0662A",
  violet: "#9B5CF6",
  gray: "#C3CCE0",
  ink: "#343C6A",
  muted: "#718EBF",
  grid: "#EDF0F7",
};

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const M = (v) => {
  const a = Math.abs(v),
    sign = v < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
};
const scenarioOf = (d) => ({ ...defaultScenario, ...d.scenario });

const eyebrow = (t) => `<div class="ow-eyebrow">${t}</div>`;
const info = (tip) =>
  `<span class="ow-info" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="${C.muted}" stroke-width="1.5"/><path d="M8 7v4.5M8 4.6v.1" stroke="${C.muted}" stroke-width="1.6" stroke-linecap="round"/></svg></span>`;
const card = (title, sub, body, extra = "", cls = "") =>
  `<section class="ow-card ${cls}"><div class="ow-head"><div>${sub ? eyebrow(sub) : ""}<h3>${title}</h3></div>${extra}</div>${body}</section>`;

/* ---------------- Charts ---------------- */

function gauge(v) {
  const r = 34,
    cx = 42,
    cy = 40,
    a = Math.PI * (1 - Math.max(0.001, v) / 100);
  const x = cx + r * Math.cos(a),
    y = cy - r * Math.sin(a);
  return `<svg viewBox="0 0 84 46" width="66" height="36" aria-hidden="true"><path d="M8 40a34 34 0 0 1 68 0" fill="none" stroke="${C.grid}" stroke-width="8" stroke-linecap="round"/><path d="M8 40A34 34 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${C.blue}" stroke-width="8" stroke-linecap="round"/></svg>`;
}

function miniRange(lo, hi, mid) {
  const min = lo * 0.85,
    max = hi * 1.1 || 1,
    x = (v) => ((v - min) / (max - min)) * 100;
  return `<svg class="ow-mini" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="5" width="100" height="5" rx="2.5" fill="${C.grid}"/><rect x="${x(lo)}" y="5" width="${Math.max(1, x(hi) - x(lo))}" height="5" fill="${C.blue}" opacity=".35"/><rect x="${x(mid) - 0.6}" y="1" width="1.2" height="13" fill="${C.ink}"/></svg>`;
}

function niceStep(span) {
  const raw = span / 5,
    pow = 10 ** Math.floor(Math.log10(raw || 1)),
    n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

function valueField(p, s, sens, review) {
  const rows = [
    {
      l: "Hypothetical range",
      s: `${sens[0].multiple.toFixed(1)}–${sens[2].multiple.toFixed(1)}x EBITDA`,
      band: [sens[0].ev, sens[2].ev],
      mid: sens[1].ev,
      col: C.blue,
    },
    { l: "Your working scenario", s: `${s.multiple.toFixed(1)}x EBITDA`, pt: sens[1].ev, col: C.blue },
    review
      ? { l: "Advisor perspective", s: "Recorded by your advisor", band: [review.low, review.high], col: C.teal }
      : { l: "Advisor perspective", s: "Not recorded yet", none: true },
  ];
  const values = rows.flatMap((r) => r.band ?? (r.pt !== undefined ? [r.pt] : []));
  const step = niceStep(Math.max(...values) - Math.min(...values) || Math.max(...values) || 1);
  const lo = Math.max(0, Math.floor((Math.min(...values) * 0.9) / step) * step),
    hi = Math.ceil((Math.max(...values) * 1.08) / step) * step || step;
  const X0 = 170,
    X1 = 650,
    x = (v) => X0 + ((v - lo) / (hi - lo || 1)) * (X1 - X0);
  const H = 42 + rows.length * 58;
  let svg = `<svg viewBox="0 0 700 ${H + 24}" width="100%" role="img" aria-label="Enterprise value by scenario">`;
  for (let t = lo; t <= hi + step / 2; t += step) {
    svg += `<line x1="${x(t)}" x2="${x(t)}" y1="14" y2="${H}" stroke="${C.grid}"/><text x="${x(t)}" y="${H + 20}" font-size="12" fill="${C.muted}" text-anchor="middle">${M(t)}</text>`;
  }
  rows.forEach((r, i) => {
    const y = 44 + i * 58;
    svg += `<text x="0" y="${y - 2}" font-size="13" font-weight="600" fill="${C.ink}">${r.l}</text><text x="0" y="${y + 14}" font-size="11.5" fill="${C.muted}">${r.s}</text>`;
    if (r.none) {
      svg += `<line x1="${X0}" x2="${X1}" y1="${y}" y2="${y}" stroke="${C.gray}" stroke-dasharray="4 5"/>`;
    } else if (r.band) {
      const [a, b] = r.band;
      svg += `<rect x="${x(a)}" y="${y - 12}" width="${Math.max(4, x(b) - x(a))}" height="24" rx="4" fill="${r.col}" opacity=".16" data-tip="${r.l}: ${M(a)} – ${M(b)}"/>`;
      svg += `<rect x="${x(a)}" y="${y - 12}" width="4" height="24" rx="2" fill="${r.col}"/><rect x="${x(b) - 4}" y="${y - 12}" width="4" height="24" rx="2" fill="${r.col}"/>`;
      if (r.mid !== undefined)
        svg += `<rect x="${x(r.mid) - 1.5}" y="${y - 17}" width="3" height="34" rx="1.5" fill="${C.ink}" data-tip="Working ${M(r.mid)}"/>`;
      svg += `<text x="${x(a) - 8}" y="${y + 4}" font-size="12.5" font-weight="600" fill="${C.ink}" text-anchor="end">${M(a)}</text><text x="${x(b) + 8}" y="${y + 4}" font-size="12.5" font-weight="600" fill="${C.ink}">${M(b)}</text>`;
    } else {
      svg += `<line x1="${X0}" x2="${x(r.pt)}" y1="${y}" y2="${y}" stroke="${r.col}" stroke-width="2" opacity=".35"/><circle cx="${x(r.pt)}" cy="${y}" r="7" fill="${r.col}" stroke="#fff" stroke-width="2" data-tip="${r.l}: ${M(r.pt)} at ${r.s}"/><text x="${x(r.pt) + 14}" y="${y + 4}" font-size="12.5" font-weight="600" fill="${C.ink}">${M(r.pt)}</text>`;
    }
  });
  return svg + "</svg>";
}

const SHORT = {
  "Financial statements": "Financials",
  "Ownership and debt schedule": "Ownership & debt",
  "Successor / key-person plan": "Successor plan",
  "Family priorities": "Family priorities",
  "Tax and estate review": "Tax & estate",
  "Operating procedures": "Operations",
  "Transition timeline": "Timeline",
};
const LEVEL = ["Not confirmed", "Available", "Verified"];

function evidenceRadar(evidence) {
  const n = evidence.length,
    cx = 240,
    cy = 158,
    R = 112;
  const lvl = (e) => (e.verified ? 3 : e.reported ? 2 : 1);
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)];
  };
  let svg = `<svg viewBox="0 0 480 316" width="100%" role="img" aria-label="Evidence status across ${n} categories">`;
  [1 / 3, 2 / 3, 1].forEach((f) => {
    svg += `<polygon points="${evidence.map((_, i) => pt(i, f).join(",")).join(" ")}" fill="none" stroke="${C.grid}"/>`;
  });
  evidence.forEach((_, i) => {
    const [x2, y2] = pt(i, 1);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${C.grid}"/>`;
  });
  svg += `<polygon points="${evidence.map((e, i) => pt(i, lvl(e) / 3).join(",")).join(" ")}" fill="${C.blue}" fill-opacity=".14" stroke="${C.blue}" stroke-width="2" stroke-linejoin="round"/>`;
  evidence.forEach((e, i) => {
    const [x, y] = pt(i, lvl(e) / 3),
      col = e.verified ? C.teal : e.reported ? C.blue : C.gray;
    svg += `<circle cx="${x}" cy="${y}" r="5.5" fill="${col}" stroke="#fff" stroke-width="2"/><circle cx="${x}" cy="${y}" r="14" fill="transparent" data-tip="${esc(e.label)}: ${LEVEL[lvl(e) - 1]}"/>`;
    const [lx, ly] = pt(i, 1.17),
      anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    svg += `<text x="${lx}" y="${ly + 4}" font-size="13" fill="${C.muted}" text-anchor="${anchor}">${esc(SHORT[e.label] ?? e.label)}</text>`;
  });
  return svg + "</svg>";
}

function waterfall(p, r, s) {
  const others = Math.max(0, r.equity) - r.share;
  const steps = [
    ["Enterprise value", r.ev, "start"],
    ["Debt", -p.debt],
    ["Fees", -r.fees],
    ...(others > 0.5 ? [[`Other owners ${Math.round(100 - p.ownership)}%`, -others]] : []),
    ["Rollover", -r.rollover],
    ["Taxes", -r.tax],
    ["Family", -s.family],
    [r.cash < 0 ? "Shortfall" : "Available cash", r.cash, "end"],
  ];
  let run = 0;
  const spans = steps.map(([, v, kind]) => {
    if (kind === "start") return [0, (run = v)];
    if (kind === "end") return [0, v];
    const a = run;
    run += v;
    return [run, a];
  });
  // When debt exceeds value the owner share is zero; keep the walk anchored at zero.
  const top = Math.max(r.ev, ...spans.flat()) || 1,
    bottom = Math.min(0, ...spans.flat());
  const W = 700,
    T = 30,
    B = 236,
    bw = 54,
    gap = (W - 54 - steps.length * bw) / (steps.length - 1);
  const y = (v) => B - ((v - bottom) / (top - bottom)) * (B - T);
  let svg = `<svg viewBox="0 0 ${W} 290" width="100%" role="img" aria-label="Where the enterprise value goes">`;
  [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
    const v = bottom + f * (top - bottom);
    svg += `<line x1="54" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="48" y="${y(v) + 4}" font-size="11" fill="${C.muted}" text-anchor="end">${M(v)}</text>`;
  });
  steps.forEach(([label, v, kind], i) => {
    const x = 54 + i * (bw + gap),
      [a, b] = spans[i],
      lo = Math.min(a, b),
      hi = Math.max(a, b);
    const fill = kind === "start" ? C.blue : kind === "end" ? (v < 0 ? C.orange : C.teal) : C.gray;
    svg += `<rect x="${x}" y="${y(hi)}" width="${bw}" height="${Math.max(1.5, y(lo) - y(hi))}" rx="4" fill="${fill}" data-tip="${esc(label)}: ${M(v)}"/>`;
    if (i < steps.length - 1 && kind !== "end") {
      const level = kind === "start" ? b : a;
      svg += `<line x1="${x + bw}" x2="${x + bw + gap}" y1="${y(level)}" y2="${y(level)}" stroke="#B1B9CF" stroke-dasharray="3 3"/>`;
    }
    const txt = kind ? M(v) : Math.abs(v) < 500 ? "$0" : M(v);
    svg += `<text x="${x + bw / 2}" y="${y(hi) - 7}" font-size="12" font-weight="${kind ? 700 : 600}" fill="${kind === "end" ? (v < 0 ? "#B4511E" : "#0B7A6E") : C.ink}" text-anchor="middle">${txt}</text><text x="${x + bw / 2}" y="258" font-size="11" fill="${C.muted}" text-anchor="middle">${esc(label.split(" ")[0])}</text>${label.includes(" ") ? `<text x="${x + bw / 2}" y="272" font-size="11" fill="${C.muted}" text-anchor="middle">${esc(label.split(" ").slice(1).join(" "))}</text>` : ""}`;
  });
  svg += `<line x1="54" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#B1B9CF"/>`;
  return svg + "</svg>";
}

function comparison(p, s) {
  const rows = valuationSensitivity(p, s).map((v) => ({
    name: v.label === "Working" ? "Your working scenario" : `${v.label} multiple`,
    mine: v.label === "Working",
    multiple: v.multiple,
    ev: v.ev,
    cash: Math.max(0, v.cash),
    tax: v.tax,
    roll: v.rollover,
    raw: v.cash,
  }));
  const max = Math.max(...rows.map((r) => r.ev)) || 1;
  const seg = (w, cls, tip) => (w > 0 ? `<i class="${cls}" data-w="${((w / max) * 100).toFixed(2)}" data-tip="${tip}"></i>` : "");
  return `<div class="ow-legend"><span><i class="c-cash"></i>Available cash</span><span><i class="c-tax"></i>Taxes</span><span><i class="c-roll"></i>Rollover</span><span><i class="c-other"></i>Debt, fees, other owners &amp; family</span></div>
    <div class="ow-stack">${rows
      .map((r) => {
        const other = Math.max(0, r.ev - r.cash - r.tax - r.roll);
        return `<div class="row${r.mine ? " mine" : ""}"><div class="lbl"><span>${r.name}<small>${r.multiple.toFixed(1)}x · EV ${M(r.ev)}</small></span></div><div class="bar">${seg(r.cash, "c-cash", `Available cash ${M(r.cash)}`)}${seg(r.tax, "c-tax", `Taxes ${M(r.tax)}`)}${seg(r.roll, "c-roll", `Rollover ${M(r.roll)}`)}${seg(other, "c-other", `Debt, fees, other owners & family ${M(other)}`)}</div><b class="${r.raw < 0 ? "neg" : ""}">${M(r.raw)}</b></div>`;
      })
      .join("")}</div>
    <table class="ow-table" hidden><caption class="sr-only">Proceeds by hypothetical multiple</caption><thead><tr><th>Scenario</th><th>Multiple</th><th>EV</th><th>Rollover</th><th>Taxes</th><th>Cash</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.name}</td><td>${r.multiple.toFixed(1)}x</td><td>${M(r.ev)}</td><td>${M(r.roll)}</td><td>${M(r.tax)}</td><td><b>${M(r.raw)}</b></td></tr>`)
      .join("")}</tbody></table>`;
}

// Placement reflects each path's general liquidity and control characteristics, not suitability.
const PATH_POS = {
  "Strategic sale": [0.88, 0.12],
  "PE with rollover": [0.72, 0.58],
  "Family transfer": [0.33, 0.8],
  "Management transfer": [0.38, 0.3],
  ESOP: [0.55, 0.38],
  "Partial recapitalization": [0.6, 0.64],
  "Prepare / delayed exit": [0.08, 0.72],
};

function pathsPanel(d) {
  const suggested = suggestedPaths(d.profile),
    chosen = d.pathDecision?.path;
  const status = (name) => (name === chosen ? "chosen" : suggested.includes(name) ? "suggested" : "alt");
  const X0 = 44,
    X1 = 396,
    Y0 = 16,
    Y1 = 214;
  const px = (v) => X0 + v * (X1 - X0),
    py = (v) => Y1 - v * (Y1 - Y0);
  let svg = `<svg viewBox="0 0 410 252" width="100%" role="img" aria-label="Transition paths by typical liquidity and retained control">
    <rect x="${X0}" y="${Y0}" width="${(X1 - X0) / 2}" height="${(Y1 - Y0) / 2}" fill="#F3F1FF"/>
    <rect x="${(X0 + X1) / 2}" y="${(Y0 + Y1) / 2}" width="${(X1 - X0) / 2}" height="${(Y1 - Y0) / 2}" fill="#EAF7F5"/>
    <text x="${X0 + 10}" y="${Y0 + 18}" font-size="11.5" font-weight="600" fill="#8B7FD9">KEEP &amp; BUILD</text>
    <text x="${X1 - 10}" y="${(Y0 + Y1) / 2 + 18}" font-size="11.5" font-weight="600" fill="#3F9C92" text-anchor="end">SELL &amp; EXIT</text>
    <line x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}" stroke="#B1B9CF"/><line x1="${X0}" x2="${X0}" y1="${Y0}" y2="${Y1}" stroke="#B1B9CF"/>
    <line x1="${(X0 + X1) / 2}" x2="${(X0 + X1) / 2}" y1="${Y0}" y2="${Y1}" stroke="#DFE5EE" stroke-dasharray="4 4"/><line x1="${X0}" x2="${X1}" y1="${(Y0 + Y1) / 2}" y2="${(Y0 + Y1) / 2}" stroke="#DFE5EE" stroke-dasharray="4 4"/>
    <text x="${X1}" y="${Y1 + 20}" font-size="12" fill="${C.muted}" text-anchor="end">Typical liquidity</text><text x="${X0}" y="${Y1 + 20}" font-size="12" fill="${C.muted}">Low</text>
    <text transform="translate(${X0 - 14} ${Y0}) rotate(-90)" font-size="12" fill="${C.muted}" text-anchor="end">Control retained</text>`;
  paths.forEach((path, i) => {
    const [lx, cy] = PATH_POS[path.name] ?? [0.5, 0.5],
      x = px(lx),
      y = py(cy),
      st = status(path.name);
    const fill = st === "chosen" ? "#111" : st === "suggested" ? C.blue : "#fff",
      stroke = st === "alt" ? "#B1B9CF" : fill,
      text = st === "alt" ? C.ink : "#fff";
    svg += `<circle cx="${x}" cy="${y}" r="13" fill="${fill}" stroke="${stroke}" stroke-width="2" data-tip="${esc(path.name)}: liquidity ${esc(path.liquidity)}, control ${esc(path.control)}"/><text x="${x}" y="${y + 4.5}" font-size="12" font-weight="700" fill="${text}" text-anchor="middle" pointer-events="none">${i + 1}</text>`;
  });
  svg += "</svg>";
  const chip = (st) =>
    st === "chosen" ? '<span class="ow-chip dark">Working</span>' : st === "suggested" ? '<span class="ow-chip blue">Discuss</span>' : '<span class="ow-chip">Alternative</span>';
  const matrix = `<div class="ow-pmx"><div class="h"><span>Path</span><span>Liquidity</span><span>Control</span><span></span></div>${paths
    .map((path, i) => {
      const st = status(path.name);
      return `<div class="r" data-tip="${esc(path.people)} Timing: ${esc(path.timing)}."><span class="n"><em class="${st}">${i + 1}</em>${esc(path.name)}</span><span class="v">${esc(path.liquidity)}</span><span class="v">${esc(path.control)}</span>${chip(st)}</div>`;
    })
    .join("")}</div>`;
  return `<div class="ow-chart">${svg}</div>${matrix}`;
}

// Monochrome line-icon marks for each PNC team
const TEAM_ICON = {
  "Harris Williams": '<path d="M12 31l7-7 5 4 9-10"/><path d="M27 18h6v6"/>',
  "PNC Private Bank": '<path d="M11 18l11-6 11 6"/><path d="M14 19v10M19.5 19v10M24.5 19v10M30 19v10"/><path d="M11 32h22"/>',
  "Business Credit": '<rect x="11" y="14" width="22" height="16" rx="3"/><path d="M11 19.5h22M15 25.5h5"/>',
  "Financial Sponsor Coverage": '<rect x="11" y="17" width="22" height="15" rx="3"/><path d="M18 17v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M11 23.5h22"/>',
  "Succession Planning": '<circle cx="22" cy="14.5" r="3"/><circle cx="15" cy="27" r="3"/><circle cx="29" cy="27" r="3"/><path d="M22 17.5v4M22 21.5l-6 3M22 21.5l6 3"/>',
};
const teamLogo = (team) =>
  `<svg class="ow-logo" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><rect width="44" height="44" rx="12" fill="#111"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TEAM_ICON[team] ?? ""}</g></svg>`;

function ring(n, total, col, label) {
  const r = 26,
    c = 2 * Math.PI * r;
  return `<div class="ow-ring"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" fill="none" stroke="${C.grid}" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * n) / total} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="${C.ink}">${n}/${total}</text></svg><span>${label}</span></div>`;
}

function slider(k, label, val, min, max, step, unit) {
  const fmt = unit === "x" ? `${Number(val).toFixed(1)}x` : `${val}%`;
  return `<div class="ow-sl"><div class="l"><label for="ow-${k}">${label}</label><b data-out="${k}">${fmt}</b></div><input id="ow-${k}" type="range" name="${k}" min="${min}" max="${max}" step="${step}" value="${val}" data-k="${k}" data-unit="${unit}"></div>`;
}

/* ---------------- Dashboard ---------------- */

const JOURNEY_SHORT = ["Goals", "Review", "Paths", "Team", "Wealth"];

export function dashboard(c, { canSave }) {
  const d = c.data,
    p = d.profile,
    s = scenarioOf(d),
    r = proceeds(p, s),
    rd = readiness(d),
    sens = valuationSensitivity(p, s),
    journey = transitionJourney(d),
    step = nextSteps(d, c.mode)[0],
    margin = p.revenue ? ((p.ebitda / p.revenue) * 100).toFixed(1) : "0.0",
    teams = routingSuggestions(d);

  return `<div class="nx-dash">
  <div class="ow-kpis">
    <div class="ow-kpi"><span class="k">Working enterprise value</span><b data-live="ev">${M(r.ev)}</b><small data-live="evrange">${M(sens[0].ev)} – ${M(sens[2].ev)}</small><span data-live="mini">${miniRange(sens[0].ev, sens[2].ev, r.ev)}</span></div>
    <div class="ow-kpi gauge"><div><span class="k">Evidence available</span><b>${rd.score}<em>%</em></b><small>${rd.verified} of ${rd.total} verified</small></div>${gauge(rd.score)}</div>
    <div class="ow-kpi"><span class="k">Revenue</span><b>${M(p.revenue)}</b><small>EBITDA ${M(p.ebitda)} · ${margin}%</small></div>
    <div class="ow-kpi"><span class="k">Estimated cash proceeds</span><b class="${r.cash < 0 ? "neg" : "teal"}" data-live="cash">${M(r.cash)}</b><small>Liquidity goal ${M(p.liquidity)}</small></div>
    <div class="ow-kpi"><span class="k">Preferred horizon</span><b>${esc(p.timeline)} <em>yrs</em></b><small>Debt ${M(p.debt)}</small></div>
  </div>

  <div class="ow-grid ow-r1">
    ${card("Valuation range", "Enterprise value by scenario", `<div class="ow-chart" data-live="field">${valueField(p, s, sens, d.valuationReview)}</div>`, `<div class="ow-head-r"><span class="ow-badge">Hypothetical</span>${info("Enterprise value = EBITDA × your hypothetical multiple, shown at ±1x. It does not use comparable transactions or market data and is not a certified valuation. The advisor perspective appears once your advisor records one.")}</div>`)}
    ${card("Evidence readiness", "Seven evidence categories", `<div class="ow-chart">${evidenceRadar(d.evidence ?? [])}</div><div class="ow-legend center"><span><i class="c-verified"></i>Verified</span><span><i class="c-available"></i>Available</span><span><i class="c-none"></i>Not confirmed</span></div>`, `<div class="ow-score">${rd.verified}<small>/${rd.total} verified</small></div>`)}
  </div>

  <div class="ow-grid ow-r2">
    ${card(
      "Post-transition proceeds",
      "Scenario editor",
      `<form data-form="scenario" class="ow-scenario">
        <div class="ow-controls">
          ${slider("multiple", "Multiple", s.multiple, 1, 15, 0.1, "x")}
          ${slider("fees", "Fees", s.fees, 0, 20, 0.5, "%")}
          ${slider("tax", "Tax rate", s.tax, 0, 60, 1, "%")}
          ${slider("rollover", "Rollover", s.rollover, 0, 100, 1, "%")}
          <div class="ow-sl"><div class="l"><label for="ow-family">Family payout</label></div><div class="ow-money"><span>$</span><input id="ow-family" type="text" inputmode="numeric" data-k="family" value="${Number(s.family).toLocaleString("en-US")}"></div><input type="hidden" name="family" value="${Number(s.family)}"></div>
        </div>
        <div class="ow-chart" data-live="water">${waterfall(p, r, s)}</div>
        <div class="ow-save">${
          canSave
            ? `<button class="ow-btn solid">Save scenario</button><small>Saving clears the advisor review and withdraws referrals for renewed approval.</small><p class="form-error" role="alert"></p>`
            : `<small>What-if only. ${c.mode === "owner" ? "The sample is read-only." : "The owner saves the working scenario."}</small>`
        }</div>
      </form>`,
      `<div class="ow-head-r"><button type="button" class="ow-link" data-ow-reset>Reset</button>${info("Fees and debt reduce enterprise value before your ownership share. Tax applies to the cash portion of your share as if fully taxable; rollover is assumed tax-deferred. Actual structure and tax basis can change results.")}</div>`,
    )}
    ${card("Transition paths", "Options, not a verdict", pathsPanel(d), info("Positions show each path's general liquidity and control characteristics. Highlighted paths follow simple rules from your recorded goals; no fit score is inferred."))}
  </div>

  <div class="ow-grid ow-r3">
    ${card("Scenario comparison", "Where the value goes", `<div data-live="cmp">${comparison(p, s)}</div>`, `<div class="ow-head-r"><button type="button" class="ow-link" data-ow-table>Table view</button>${info("Sensitivity cases at ±1x your working multiple. Ownership, fees, tax, rollover, family distribution and debt stay constant. Rollover equity is not cash.")}</div>`)}
    ${card(
      "PNC teams to discuss",
      "Based on your recorded goals",
      `<div class="ow-teams2">${teams
        .map((t) => `<div class="ow-tm" tabindex="0" data-tip="${esc(t.reason)}">${teamLogo(t.team)}<div class="nm"><b>${esc(t.team)}</b><em>${esc(t.scope)}</em><small>${esc(t.reason)}</small></div></div>`)
        .join("")}</div>`,
      info("Discussion prompts from transparent rules. They do not create referrals or confirm eligibility; your advisor proposes each referral and you approve the scope."),
    )}
  </div>

  <div class="ow-grid ow-r4">
    <section class="ow-next">
      ${eyebrow(c.mode === "advisor" ? "Next action to review" : "Recommended next step")}
      <h3>${esc(step?.title ?? "Keep your profile current")}</h3>
      <p>${esc(step?.detail ?? "Update discovery as your thinking develops.")}</p>
      <div class="btns"><a class="ow-btn white" href="#/${esc(step?.route ?? "discovery")}">Open</a><a class="ow-btn glass" href="#/plan">Shared plan</a></div>
    </section>
    ${card(
      "Verification",
      "Advisor review",
      `<div class="ow-rings">${ring(rd.reported, rd.total, C.blue, "Available")}${ring(rd.verified, rd.total, C.teal, "Verified")}</div><div class="ow-steps">${journey
        .map((j, i) => `<a href="#/${esc(j.route)}" class="${j.status === "Complete" ? "done" : j.status === "Current" ? "on" : ""}" data-tip="${esc(j.label)} · ${esc(j.status)}" aria-label="${esc(j.label)}: ${esc(j.status)}">${JOURNEY_SHORT[i] ?? esc(j.label)}</a>`)
        .join("")}</div>`,
      info("Evidence completeness, not a prediction of transaction success. Advisor verification is a recorded review, not an automated document check."),
    )}
    ${card(
      "Information gaps",
      "Still to verify",
      rd.gaps.length
        ? `<div class="ow-gaps2">${rd.gaps
            .map((g) => {
              const e = (d.evidence ?? []).find((x) => x.label === g);
              return `<div class="g"><i class="${e?.reported ? "blue" : "red"}"></i>${esc(g)}<small>${e?.reported ? "Available" : "Not confirmed"}</small></div>`;
            })
            .join("")}</div>`
        : "<p>All evidence categories are verified.</p>",
      `<span class="ow-badge">${rd.gaps.length} open</span>`,
    )}
  </div>
</div>`;
}

/* ---------------- Behaviour ---------------- */

let tipEl;
function bindTooltips() {
  if (tipEl) return;
  tipEl = document.createElement("div");
  tipEl.className = "ow-tip";
  tipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(tipEl);
  const show = (t, x, y) => {
    tipEl.textContent = t.getAttribute("data-tip");
    tipEl.style.opacity = 1;
    const w = tipEl.offsetWidth,
      h = tipEl.offsetHeight;
    let left = x + 14,
      top = y - h - 12;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 18;
    tipEl.style.transform = `translate(${left}px, ${top}px)`;
  };
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest?.(".nx-dash [data-tip]");
    if (!t) tipEl.style.opacity = 0;
    else show(t, e.clientX, e.clientY);
  });
  document.addEventListener("focusin", (e) => {
    const t = e.target.closest?.(".nx-dash [data-tip]");
    if (!t) return (tipEl.style.opacity = 0);
    const b = t.getBoundingClientRect();
    show(t, b.left + b.width / 2, b.top);
  });
}

// CSP blocks inline style attributes, so sizes are applied through the CSSOM.
const applyWidths = (root) =>
  root.querySelectorAll("[data-w]").forEach((el) => (el.style.width = `${el.dataset.w}%`));
const paintSlider = (el) =>
  el.style.setProperty("--p", `${((el.value - el.min) / (el.max - el.min)) * 100}%`);

export function mountDashboard(c) {
  const root = document.querySelector(".nx-dash");
  if (!root) return;
  bindTooltips();
  applyWidths(root);
  const p = c.data.profile,
    saved = scenarioOf(c.data),
    s = { ...saved };
  const live = (k) => root.querySelector(`[data-live="${k}"]`);
  const redraw = () => {
    const r = proceeds(p, s),
      sens = valuationSensitivity(p, s);
    live("water").innerHTML = waterfall(p, r, s);
    live("field").innerHTML = valueField(p, s, sens, c.data.valuationReview);
    const tableShown = !live("cmp").querySelector(".ow-table").hidden;
    live("cmp").innerHTML = comparison(p, s);
    applyWidths(live("cmp"));
    if (tableShown) toggleTable(true);
    live("ev").textContent = M(r.ev);
    live("evrange").textContent = `${M(sens[0].ev)} – ${M(sens[2].ev)}`;
    live("mini").innerHTML = miniRange(sens[0].ev, sens[2].ev, r.ev);
    live("cash").textContent = M(r.cash);
    live("cash").className = r.cash < 0 ? "neg" : "teal";
  };
  const toggleTable = (show) => {
    const cmp = live("cmp");
    cmp.querySelector(".ow-table").hidden = !show;
    cmp.querySelector(".ow-stack").hidden = show;
    cmp.querySelector(".ow-legend").hidden = show;
    root.querySelector("[data-ow-table]").textContent = show ? "Chart view" : "Table view";
  };
  const setAll = () => {
    root.querySelectorAll('input[type="range"]').forEach((el) => {
      el.value = s[el.dataset.k];
      root.querySelector(`[data-out="${el.dataset.k}"]`).textContent =
        el.dataset.unit === "x" ? `${Number(s[el.dataset.k]).toFixed(1)}x` : `${s[el.dataset.k]}%`;
      paintSlider(el);
    });
    root.querySelector("#ow-family").value = Number(s.family).toLocaleString("en-US");
    root.querySelector('input[name="family"]').value = s.family;
  };
  root.querySelectorAll('input[type="range"]').forEach((el) => {
    paintSlider(el);
    el.addEventListener("input", () => {
      s[el.dataset.k] = Number(el.value);
      root.querySelector(`[data-out="${el.dataset.k}"]`).textContent =
        el.dataset.unit === "x" ? `${s[el.dataset.k].toFixed(1)}x` : `${s[el.dataset.k]}%`;
      paintSlider(el);
      redraw();
    });
  });
  const fam = root.querySelector("#ow-family");
  fam.addEventListener("input", () => {
    s.family = Number(fam.value.replace(/[^0-9]/g, "")) || 0;
    root.querySelector('input[name="family"]').value = s.family;
    redraw();
  });
  fam.addEventListener("blur", () => (fam.value = Number(s.family).toLocaleString("en-US")));
  root.querySelector("[data-ow-reset]").addEventListener("click", () => {
    Object.assign(s, saved);
    setAll();
    redraw();
  });
  root.querySelector("[data-ow-table]").addEventListener("click", () =>
    toggleTable(live("cmp").querySelector(".ow-table").hidden),
  );
}
