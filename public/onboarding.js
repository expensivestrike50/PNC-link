// Duolingo-style onboarding, brought over from the original prototype (pnc_project/onboarding.js).
// Routes: #/welcome  #/start/reason  #/start/business  #/start/notes  #/start/building  #/start/done
// "New profile" creates a case; "Assessment" updates the current case's reason and notes.
// Rendering only: saving and navigation live in workspace.js.

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const OB_ROUTES = ["welcome", "start/reason", "start/business", "start/notes", "start/building", "start/done"];

// Each reason maps to a transition trigger the case already understands.
export const REASONS = [
  { id: "retirement", emo: "🏖️", t: "Retirement", d: "Stepping back on your own timeline." },
  { id: "family", emo: "🌳", t: "Family succession", d: "Passing leadership or ownership to family." },
  { id: "offer", emo: "✉️", t: "Unsolicited offer", d: "Someone asked to buy. Is it fair?" },
  { id: "liquidity", emo: "💰", t: "Liquidity need", d: "Taking some value off the table." },
  { id: "partner", emo: "🤝", t: "Partner change", d: "A co-owner is leaving or arriving." },
  { id: "growth", emo: "🚀", t: "Growth capital", d: "Funding the next chapter." },
  { id: "unsure", emo: "🧭", t: "Not sure yet", d: "Just want to understand the options." },
];
const ROLES = [
  ["🌅", "Exit fully", "Hand over and step away."],
  ["🪜", "Step back gradually", "Stay involved while others take over."],
  ["🧑‍✈️", "Continue leading", "Keep running it for now."],
  ["🤔", "Not sure yet", "Decide later with your advisor."],
];

const mascot = `<svg class="ob-mascot" viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".07"/>
  <rect x="18" y="22" width="84" height="82" rx="30" fill="#0069AA"/>
  <rect x="18" y="22" width="84" height="40" rx="20" fill="#3D95CF" opacity=".55"/>
  <circle cx="44" cy="58" r="14" fill="#fff"/><circle cx="76" cy="58" r="14" fill="#fff"/>
  <circle cx="47" cy="60" r="6.5" fill="#232323"/><circle cx="79" cy="60" r="6.5" fill="#232323"/>
  <circle cx="49" cy="57.5" r="2" fill="#fff"/><circle cx="81" cy="57.5" r="2" fill="#fff"/>
  <path d="M50 80q10 9 20 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <rect x="36" y="88" width="48" height="8" rx="4" fill="#F58025"/>
  <path d="M60 22V10" stroke="#0069AA" stroke-width="4" stroke-linecap="round"/>
  <circle cx="60" cy="9" r="6" fill="#F58025"/>
</svg>`;
const arrowLeft = `<svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true"><path d="M19 9H2m0 0 7.5-7.5M2 9l7.5 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const chevron = `<svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true"><path d="m2 2 6 6-6 6" stroke="#afafaf" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const lock = `<svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true"><rect x="1" y="6" width="11" height="7.5" rx="2" fill="#afafaf"/><path d="M3.5 6V4.2a3 3 0 0 1 6 0V6" stroke="#afafaf" stroke-width="1.8"/></svg>`;

// Progress steps differ by mode: a new profile asks about the business first.
const steps = (mode) => (mode === "new" ? ["start/reason", "start/business", "start/notes", "start/building"] : ["start/reason", "start/notes", "start/building"]);
function topBar(route, mode, { back = true, skip = false } = {}) {
  const list = steps(mode),
    i = list.indexOf(route),
    pct = route === "start/done" ? 100 : i < 0 ? 0 : Math.round(((i + 1) / (list.length + 1)) * 100);
  return `<div class="ob-top">
    <button type="button" class="ob-back ${back ? "" : "hidden"}" data-action="obBack" aria-label="Back">${arrowLeft}</button>
    <div class="ob-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-pct="${pct}"></i></div>
    <button type="button" class="ob-skip ${skip ? "" : "hidden"}" data-action="obSkip">SKIP</button>
  </div>`;
}
export const prevRoute = (route, mode) => {
  const order = ["welcome", ...steps(mode)],
    i = order.indexOf(route);
  return i > 0 ? order[i - 1] : "dashboard";
};
export const nextAfterReason = (mode) => (mode === "new" ? "start/business" : "start/notes");

// ob: the in-progress answers; ctx: { firstName, business, readiness, advisorName, saving, error }
export function onboardingScreen(route, ob, ctx) {
  const mode = ob.mode ?? "assess";
  if (route === "welcome")
    return `<div class="ob-top"><a class="ob-logo" href="#/dashboard"><img src="./assets/pnc-link-logo.svg?v=2" alt="PNC-link dashboard"></a><a class="ob-skip ob-right" href="#/dashboard">CLOSE</a></div>
    <div class="ob-body ob-w900">
      <div class="ob-talk">${mascot}<div class="ob-bubble">Hi${ctx.firstName ? ` ${esc(ctx.firstName)}` : ""}! I'm your PNC-link guide. Let's understand where your business is today.</div></div>
      <div class="ob-centered"><span class="ob-eyebrow">Quick start · About 5 minutes</span></div>
      <h1 class="ob-h1 ob-mt10" tabindex="-1">Let's understand where you are.</h1>
      <p class="ob-lead">A few honest answers become a clear picture: how ready your business is, which paths could fit, and who at PNC can help. You stay in control of every answer.</p>
      <div class="ob-steps">
        <div class="ob-step"><div class="num n1">01</div><h3>Share what you know</h3><p>Short questions and cards. Skip anything.</p></div>
        <div class="ob-step"><div class="num n2">02</div><h3>See your picture</h3><p>Readiness, pathways and next steps on your dashboard.</p></div>
        <div class="ob-step"><div class="num n3">03</div><h3>Meet the right people</h3><p>Your advisor verifies and coordinates specialists.</p></div>
      </div>
      <div class="ob-foot">
        <button type="button" class="ob-btn" data-action="obStart" data-mode="new">New profile</button>
        ${ctx.business ? `<div class="ob-or">OR</div><button type="button" class="ob-resume" data-action="obStart" data-mode="assess"><span class="av" aria-hidden="true">🏭</span><span><span class="k">Assessment</span><br><span class="v">${esc(ctx.business)}</span></span>${chevron}</button>` : ""}
      </div>
    </div>`;
  if (route === "start/reason")
    return `${topBar(route, mode)}
    <div class="ob-body ob-w860">
      <h1 class="ob-h1" tabindex="-1">What brought you here?</h1>
      <p class="ob-hint">Pick the closest. You can change it later.</p>
      <div class="ob-options" role="group" aria-label="Reasons">${REASONS.map((r) => `<button type="button" class="ob-opt ${ob.reason === r.id ? "sel" : ""}" data-action="obReason" data-id="${r.id}" aria-pressed="${ob.reason === r.id}"><span class="emo" aria-hidden="true">${r.emo}</span><span class="t">${r.t}</span><span class="d">${r.d}</span></button>`).join("")}</div>
      <div class="ob-foot ob-wide"><button type="button" class="ob-btn" data-action="obNext" data-to="${nextAfterReason(mode)}" ${ob.reason ? "" : "disabled"}>Continue</button></div>
    </div>`;
  if (route === "start/business")
    return `${topBar(route, mode)}
    <div class="ob-body ob-w600">
      <div class="ob-talk">${mascot}<div class="ob-bubble">Tell me a little about the business.</div></div>
      <form class="ob-form" data-form="obBusiness">
        <label class="ob-label" for="ob-name">Your name</label><input class="ob-field" id="ob-name" name="name" required maxlength="200" value="${esc(ob.name)}" placeholder="e.g. Maria Lopez">
        <label class="ob-label" for="ob-business">Business name</label><input class="ob-field" id="ob-business" name="business" required maxlength="200" value="${esc(ob.business)}" placeholder="e.g. Lopez Family Bakery">
        <label class="ob-label" for="ob-industry">Industry</label><input class="ob-field" id="ob-industry" name="industry" required maxlength="200" value="${esc(ob.industry)}" placeholder="e.g. Food & beverage">
        <label class="ob-label" for="ob-years">When would you like to transition? <span>${esc(ob.timeline ?? 3)} years</span></label><input class="ob-range" id="ob-years" name="timeline" type="range" min="0" max="10" step="1" value="${esc(ob.timeline ?? 3)}">
        <div class="ob-label">Your role afterwards</div>
        <div class="ob-options ob-roles" role="radiogroup" aria-label="Your role afterwards">${ROLES.map(([emo, t, d]) => `<label class="ob-opt ${ob.futureRole === t ? "sel" : ""}"><input type="radio" name="futureRole" value="${t}" ${ob.futureRole === t ? "checked" : ""} required><span class="emo" aria-hidden="true">${emo}</span><span class="t">${t}</span><span class="d">${d}</span></label>`).join("")}</div>
        <div class="ob-foot ob-wide"><button type="submit" class="ob-btn">Continue</button></div>
      </form>
    </div>`;
  if (route === "start/notes")
    return `${topBar(route, mode, { skip: true })}
    <div class="ob-body ob-w600">
      <div class="ob-talk">${mascot}<div class="ob-bubble">Almost there! Anything else I should know?</div></div>
      <label class="ob-label" for="obNotes">Anything else on your mind? <span>(optional)</span></label>
      <textarea class="ob-field" id="obNotes" maxlength="2000" placeholder="e.g. My daughter runs operations, but I'm not sure she wants to own it.">${esc(ob.notes)}</textarea>
      <div class="ob-info ob-mt16"><span class="ico" aria-hidden="true">📁</span><div><b>Have documents?</b> Secure file upload is not connected in this prototype. Track what you have on the readiness checklist instead.</div></div>
      <div class="ob-foot ob-wide">
        <button type="button" class="ob-btn" data-action="obFinish">${mode === "new" ? "Create my profile" : "Start assessment"}</button>
        <div class="ob-note">${lock} ${ctx.localOnly ? "Saved in this browser only." : "Saved to your case."}</div>
      </div>
    </div>`;
  if (route === "start/building")
    return `${topBar(route, mode, { back: false })}
    <div class="ob-body"><div class="ob-center">
      ${mascot}
      <h1 class="ob-h1 ob-mt20" tabindex="-1">Building your picture…</h1>
      <div class="ob-checks">
        <div class="ob-check"><i></i>Reading your answers</div>
        <div class="ob-check"><i></i>Updating your transition profile</div>
        <div class="ob-check"><i></i>Scoring transition readiness</div>
        <div class="ob-check"><i></i>Matching pathways and PNC teams</div>
      </div>
      ${ctx.error ? `<p class="ob-err" role="alert">${esc(ctx.error)}</p><div class="ob-foot ob-wide"><button type="button" class="ob-btn" data-action="obNext" data-to="start/notes">Go back</button></div>` : ""}
    </div></div>`;
  const reason = REASONS.find((r) => r.id === ob.reason) ?? REASONS[6];
  return `<div class="ob-top"><div class="ob-bar"><i data-pct="100"></i></div></div>
    <div class="ob-body"><div class="ob-center">
      ${mascot}
      <h1 class="ob-h1 ob-mt20" tabindex="-1">Your picture is ready${ctx.firstName ? `, ${esc(ctx.firstName)}` : ""}!</h1>
      <p class="ob-lead">${esc(ctx.business || "Your business")} is set up with a starting view. Your advisor will verify it with you.</p>
      <div class="ob-stats">
        <div class="ob-stat s1"><div class="h">Reason</div><div class="v"><span aria-hidden="true">${reason.emo}</span> ${reason.t}</div></div>
        <div class="ob-stat s2"><div class="h">Readiness</div><div class="v"><span aria-hidden="true">📈</span> ${esc(ctx.readiness ?? 0)}%</div></div>
        <div class="ob-stat s3"><div class="h">Advisor</div><div class="v"><span aria-hidden="true">👥</span> ${esc(ctx.advisorName || "Not yet")}</div></div>
      </div>
      <div class="ob-foot ob-full"><a class="ob-btn" href="#/dashboard">Go to my dashboard</a></div>
    </div></div>`;
}

// Inline styles are blocked by the site's security policy, so sizes and animation are set here.
export function mountOnboarding(root, route, onBuilt) {
  root.querySelectorAll("[data-pct]").forEach((el) => requestAnimationFrame(() => (el.style.width = `${el.dataset.pct}%`)));
  const years = root.querySelector("#ob-years");
  years?.addEventListener("input", () => (years.previousElementSibling.querySelector("span").textContent = `${years.value} years`));
  root.querySelectorAll(".ob-roles input").forEach((r) =>
    r.addEventListener("change", () => root.querySelectorAll(".ob-roles .ob-opt").forEach((o) => o.classList.toggle("sel", o.contains(r) && r.checked))),
  );
  if (route === "start/building") {
    const checks = [...root.querySelectorAll(".ob-check")];
    checks.forEach((c, i) => setTimeout(() => c.classList.add("on"), 500 + i * 550));
    setTimeout(onBuilt, 500 + checks.length * 550 + 400);
  }
  if (route === "start/done") {
    const box = document.createElement("div"),
      colors = ["#0069AA", "#F58025", "#3D95CF", "#FBB57C"];
    box.className = "ob-confetti";
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.style.left = `${Math.random() * 100}vw`;
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      p.style.animationDelay = `${Math.random() * 0.5}s`;
      box.appendChild(p);
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 4500);
  }
}
