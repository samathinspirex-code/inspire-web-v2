// Turns the untouched design pages (../design-source) into the page templates the site serves (src/site/pages).
// Every change is a named, checked patch: if the design changes and a patch no longer matches, this script fails
// instead of silently producing a broken page.  Run: npm run prepare-design
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../design-source/website");
const OS_SRC = path.resolve(here, "../../design-source/lms/Inspire College OS.html");
const OUT = path.resolve(here, "../src/site/pages");
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")).assets;
fs.mkdirSync(OUT, { recursive: true });

function patch(name, html, from, to, { count = 1, all = false } = {}) {
  const parts = html.split(from);
  const found = parts.length - 1;
  if (all ? found < 1 : found !== count) throw new Error(`[${name}] expected ${all ? ">=1" : count} of ${JSON.stringify(from).slice(0, 90)}, found ${found}`);
  return parts.join(to);
}
function patchRe(name, html, re, to, min = 1) {
  const found = (html.match(re) || []).length;
  if (found < min) throw new Error(`[${name}] pattern ${re} matched ${found}`);
  return html.replace(re, to);
}
const assets = (h) => h.replace(/\/_blob\/([a-f0-9]{32})/g, (m, id) => (manifest[id] ? "/assets/" + manifest[id] : m));
const D = "window.IC_DATA&&window.IC_DATA";

// ---- shared patches for every DC page -------------------------------------------------------------
function common(name, h) {
  h = assets(h);
  // In-page navigation: the design posted to a parent frame; we navigate to real URLs instead.
  h = patch(name, h, "parent.postMessage({ic:'go',page:m[1],hash:(m[2]||'').slice(1)},'*');return;",
    "location.href=window.icRoute(m[1],(m[2]||'').slice(1));return;");
  // Links built by the page templates ("Program.dc.html#p-{{key}}") also get real URLs when rendered.
  h = patch(name, h, "el.setAttribute(n,v===true?'':String(v));",
    "if(n==='href'&&typeof v==='string'){var mm=v.match(/^([A-Za-z]+)\\.dc\\.html(?:#(.*))?$/);if(mm)v=window.icRoute(mm[1],mm[2]||'');}el.setAttribute(n,v===true?'':String(v));");
  // Every "portal" button opens the demo LMS (login, or dashboard when already signed in).
  h = h.replace(/href="LMS\.dc\.html"/g, 'href="/portal"');
  // Boot props (campaign, programme) come from the server.
  h = patchRe(name, h, /window\.__dcBoot\((\{[^<]*?\})\);<\/script><\/body><\/html>\s*$/, "window.__dcBoot(window.icBootProps($1));</script></body></html>");
  // Runtime hook (data, routes, tracking, theme) is injected right after <head> by the server.
  h = patch(name, h, "<head>", "<head><!--IC_HEAD-->");
  return h;
}

// Form wrappers used class "stack", which the home page (and the colour-theme layer) style as a purple
// gradient card. Rename the form version so the two can never collide. (Fixes the sign-up form overlap.)
function formStack(name, h) {
  h = patchRe(name, h, /\.stack([{ ,:])/g, ".form-stack$1");
  h = patchRe(name, h, /class="stack"/g, 'class="form-stack"');
  return h;
}

// Course data, fee plans and campaigns become CMS data (design values stay as the fallback).
function catalogue(name, h) {
  h = patch(name, h, "const IC_CAT = {", `const IC_CAT = (${D}.cat)||{`);
  h = patch(name, h, "const IC_CAMP = {", `const IC_CAMP = (${D}.camp)||{`);
  h = patch(name, h, "const IC_CPDFEE = {", `const IC_CPDFEE = (${D}.cpdfee)||{`);
  h = patch(name, h, "function icPlans(c) {\n", `function icPlans(c) {\n  if (${D}.feePlans&&window.IC_DATA.feePlans[c.p]) return window.IC_DATA.feePlans[c.p];\n`);
  // Enrol drawer "pay": create a real order; card payments continue to PayHere.
  h = patch(name, h, "setTimeout(() => { const ref = 'IC-' + Math.random().toString(36).slice(2, 8).toUpperCase(); ",
    "window.icCreateOrder({ course_key: key, plan: pi, addons: add, free: free, method: (self.state.x.method || 0) === 0 ? 'payhere' : 'bank_transfer', name: nm, phone: ph, email: (self.state.x.email || '') }).then(r => { if (r.checkout) { window.icPayHere(r.checkout); return; } const ref = r.reference; ");
  h = patch(name, h, "icSave(null); }, 1400);", "icSave(null); }).catch(e => set({ busy: false, err: e.message }));");
  // WhatsApp numbers are CMS settings.
  h = h.replace(/wa\.me\/94711993331/g, "wa.me/__IC_WA_MAIN__").replace(/wa\.me\/94743762393/g, "wa.me/__IC_WA_ADVISOR__");
  return h;
}

const pages = {};
for (const f of ["Main", "Program", "Demo", "Aptitude", "Enrol", "LMS", "Live"]) {
  pages[f] = fs.readFileSync(path.join(SRC, f + ".html"), "utf8");
}

// ---- Main (home) ----------------------------------------------------------------------------------
{
  let h = common("Main", pages.Main);
  h = patch("Main", h, '<a class="btn p" href="/portal">Take a tour of the portal</a>', '<a class="btn p" href="/brain">Take a tour of the portal</a>');
  h = catalogue("Main", h);
  // Visionary leaders: separate cards with a fixed-frame profile photo and a short description (CMS fields).
  h = patch("Main", h, "const leaders = L.map((l, i) => ({ name: l[0], role: l[1], ini: l[2], hue: hues[i] }));",
    "const leaders = L.map((l, i) => ({ name: l[0], role: l[1], ini: l[2], hue: hues[i], photo: l[3] || '', hasPhoto: !!l[3], noPhoto: !l[3], bio: l[4] || '', pos: l[5] || 'center 20%' }));");
  h = patch("Main", h,
    '<div class="lead-c"><span class="av {{l.hue}}">{{l.ini}}</span><span><b>{{l.name}}</b><small>{{l.role}}</small></span></div>',
    '<article class="ldr"><div class="ldr-ph"><template data-sc="if" value="{{l.hasPhoto}}"><img src="{{l.photo}}" alt="{{l.name}}" loading="lazy" style="object-position:{{l.pos}}"></template><template data-sc="if" value="{{l.noPhoto}}"><span class="av {{l.hue}}">{{l.ini}}</span></template></div><div class="ldr-b"><b>{{l.name}}</b><small>{{l.role}}</small><template data-sc="if" value="{{l.bio}}"><p>{{l.bio}}</p></template></div></article>');
  // Student stories: hovering a card expands it and plays its video inline (muted; click for sound).
  // The page re-renders often and resets attributes, so sound on/off lives in the page state (stSound);
  // runtime.js only plays/pauses the expanded card's <video> and applies data-sound.
  h = patch("Main", h, "pick: () => this.setState({ story: i }) }));",
    "video: x[4] || '', hasVideo: !!x[4], sound: (i === s.story && s.stSound) ? '1' : '0', soundOn: !!x[4] && i === s.story && !!s.stSound, soundOff: !!x[4] && i === s.story && !s.stSound, playIcon: !(x[4] && i === s.story), " +
    "pick: () => { if (s.story !== i) this.setState({ story: i, stSound: false }); }, " +
    "tap: () => { if (s.story === i && x[4]) this.setState({ stSound: !s.stSound }); else this.setState({ story: i, stSound: false }); } }));");
  h = patch("Main", h, '<button type="button" class="{{s.cls}}" onClick="{{s.pick}}" aria-pressed="{{s.on}}"',
    '<button type="button" class="{{s.cls}}" onClick="{{s.tap}}" onMouseEnter="{{s.pick}}" onFocus="{{s.pick}}" aria-pressed="{{s.on}}"');
  h = patch("Main", h,
    '<span class="st-img" style="background-image:url({{s.img}});background-position:{{s.pos}} 30%" aria-hidden="true"></span>',
    '<span class="st-img" style="background-image:url({{s.img}});background-position:{{s.pos}} 30%" aria-hidden="true"></span><template data-sc="if" value="{{s.hasVideo}}"><video class="st-vid" src="{{s.video}}" data-sound="{{s.sound}}" muted loop playsinline preload="none" aria-hidden="true"></video></template>');
  h = patch("Main", h,
    '<span class="st-pl" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></span>',
    '<span class="st-pl" aria-hidden="true"><template data-sc="if" value="{{s.playIcon}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></template>' +
    '<template data-sc="if" value="{{s.soundOff}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg></template>' +
    '<template data-sc="if" value="{{s.soundOn}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg></template></span>');
  // Programme finder result shows the matched course's own banner (current site), falling back to the design photo.
  h = patch("Main", h, "const fd = RD[fkey];",
    "const fd = IC_CAT[fkey] ? [IC_CAT[fkey].n, IC_CAT[fkey].d, String(IC_CAT[fkey].f || '').replace(/^from /, ''), RD[fkey] ? RD[fkey][3] : ''] : RD[fkey];");
  h = patch("Main", h, "img: FIMG[fi]", "img: (IC_CAT[fkey] && IC_CAT[fkey].i) || FIMG[fi]");
  h = patch("Main", h, "const P = [\n      { name: 'HND-Level", `const P = (${D}.cards)||[\n      { name: 'HND-Level`);
  h = patch("Main", h, "const S = [['Nidarshana", `const S = (${D}.stories)||[['Nidarshana`);
  h = patch("Main", h, "const L = [['Steven", `const L = (${D}.leaders)||[['Steven`);
  h = patch("Main", h, "const FQ = [\n", `const FQ = (${D}.faq)||[\n`);
  h = patch("Main", h, "const FQP = [\n", `const FQP = (${D}.faqp)||[\n`);
  pages.Main = h;
}

// ---- Program (catalogue + programme detail + enrol quests) ----------------------------------------
{
  let h = common("Program", pages.Program);
  h = formStack("Program", h);
  h = catalogue("Program", h);
  // Programme details from the CMS, finished with the design's level templates (H, F, PGx, TU, C).
  h = patch("Program", h, "    const P = {\n      'hnd-se': H(", "    const P = window.icDetails({ H, F, PGx, TU, C }, {\n      'hnd-se': H(");
  h = patch("Program", h, "\n    };\n    const IMGS = {", "\n    });\n    const IMGS = {");
  h = patch("Program", h, "    const IMGS = {", `    const IMGS = (${D}.imgs)||{`);
  // Quest plan amounts follow the CMS fee plans too.
  h = patch("Program", h, "    if (raw.plan === 'hnd') PL = [", "    if (window.icQuestPlans && window.icQuestPlans(raw.plan)) PL = window.icQuestPlans(raw.plan);\n    else if (raw.plan === 'hnd') PL = [");
  // Landing pages (/hnd-courses, /short-courses...) open the catalogue on a level.
  h = patch("Program", h, "id: hid, lvl: null,", `id: hid, lvl: (${D}.lvl)||null,`);
  // Final quest step: create the order (PayHere / bank transfer) for real.
  h = patch("Program", h, "this.setState({ step: 6, err: '', toast: null }); },", "this.setState({ step: 6, err: '', toast: null }); window.icQuestOrder(this, curKey, raw.plan); },");
  pages.Program = h;
}

// ---- Demo (free demo sign-up -> demo LMS) ---------------------------------------------------------
{
  let h = common("Demo", pages.Demo);
  h = formStack("Demo", h);
  h = patch("Demo", h, "this.setState({ reg: true, step: 'login', err: '', pw2: '' }); },",
    "this.setState({ err: 'Creating your demo account…' }); window.icDemo('signup', { name: s.name, email: s.email, phone: s.phone, interest: s.interest, password: s.pw }).catch(e => this.setState({ err: e.message })); },");
  h = patch("Demo", h, "this.setState({ step: 'class', err: '', toastLogin: true, reg: true }); },",
    "this.setState({ err: 'Signing you in…' }); window.icDemo('login', { email: s.email, password: s.pw2 }).catch(e => this.setState({ err: e.message })); },");
  // Forgot password: the same login form switches to "Reset password" (email + new password). Existing demo account →
  // password set and signed in; no account → sent to the registration form with the email kept.
  h = patch("Demo", h, "login: () => { if (!okEmail(s.email) || !s.pw2) {",
    "resetMode: !!s.rs, notReset: !s.rs, pwLabel: s.rs ? 'New password' : 'Password', pwAuto: s.rs ? 'new-password' : 'current-password', " +
    "loginBtn: s.rs ? 'Set new password and log in' : 'Log in to my demo class', resetLink: s.rs ? 'Back to log in' : 'Forgot password?', " +
    "toggleReset: () => this.setState({ rs: !s.rs, err: '', pw2: '' }), " +
    "loginOrReset: () => { if (!s.rs) return this.renderVals().login(); if (!okEmail(s.email)) { this.setState({ err: 'Enter the email of your demo account.' }); return; } " +
    "if ((s.pw2 || '').length < 6) { this.setState({ err: 'Choose a new password of at least 6 characters.' }); return; } this.setState({ err: 'Setting your new password…' }); " +
    "window.icDemo('reset', { email: s.email, password: s.pw2 }).catch(e => this.setState(e.status === 404 ? { rs: false, step: 'reg', pw: '', pw2: '', err: e.message } : { err: e.message })); }, " +
    "login: () => { if (!okEmail(s.email) || !s.pw2) {");
  h = patch("Demo", h, '<h2>Log in</h2>\n    <p class="sub">Use the email and password you just created.</p>',
    '<template data-sc="if" value="{{notReset}}"><h2>Log in</h2><p class="sub">Use the email and password of your demo account.</p></template>' +
    '<template data-sc="if" value="{{resetMode}}"><h2>Reset password</h2><p class="sub">Enter your demo account email and choose a new password.</p></template>');
  h = patch("Demo", h, '<label class="l">Password<input type="password" value="{{pw2}}" onInput="{{setPw2}}" autocomplete="current-password"></label>',
    '<label class="l">{{pwLabel}}<input type="password" value="{{pw2}}" onInput="{{setPw2}}" autocomplete="{{pwAuto}}"></label>');
  h = patch("Demo", h, '<button class="btn k" type="button" onClick="{{login}}">Log in to my demo class</button>',
    '<button class="btn k" type="button" onClick="{{loginOrReset}}">{{loginBtn}}</button><p class="switch"><button type="button" onClick="{{toggleReset}}">{{resetLink}}</button></p>');
  h = patch("Demo", h, "if (s.reg && s.pw2 !== s.pw) { this.setState({ err: 'That password doesn’t match. Try again.' }); return; } ", "");
  h = patch("Demo", h, "Design preview: nothing is saved. On the live site this creates an Inspire Brain demo account.",
    "This creates a sample Inspire Brain account filled with demo data. It is deleted automatically after 24 hours.");
  pages.Demo = h;
}

// ---- Enrol (used as /admissions) ------------------------------------------------------------------
{
  let h = common("Enrol", pages.Enrol);
  h = formStack("Enrol", h);
  h = patch("Enrol", h, "this.setState({ step: 5, err: '', ref: 'IC-2026-' + r }); },",
    "this.setState({ step: 5, err: '', ref: 'IC-2026-' + r }); window.icLead('admissions', { name: s.name, email: s.email, phone: s.phone, course_key: (C[s.course] || [])[0] || '', data: { who: s.who, plan: s.plan, method: s.method, scholarship: s.sch, referral: s.refCode, ref: 'IC-2026-' + r } }); },");
  // The "Talk to an advisor" plan option opens WhatsApp (current number) instead of only being selected.
  h = patch("Enrol", h, "pick: () => this.setState({ plan: i }) }));",
    "pick: () => { if (p.t === 'Talk to an advisor') window.open('https://wa.me/__IC_WA_MAIN__?text=' + encodeURIComponent('Hi Inspire College, I have a few questions about ' + ((course && course.n) || 'your courses') + ' before I enrol.'), '_blank', 'noopener'); this.setState({ plan: i }); } }));");
  pages.Enrol = h;
}

// ---- Aptitude, LMS tour ---------------------------------------------------------------------------
pages.Aptitude = common("Aptitude", pages.Aptitude);
// Match results use the live course name / duration / price (CMS) instead of the design's fixed text.
pages.Aptitude = patch("Aptitude", pages.Aptitude, "progs: r.progs.map(p => ({ n: p[0], d: p[1], f: p[2], href:",
  "progs: r.progs.map(p => ({ ...window.icMatchProg(p), href:");
pages.LMS = common("LMS", pages.LMS);

// ---- Live Campus: real demo activity pinned to the top of the design's feed -----------------------
{
  let h = common("Live", pages.Live);
  h = patch("Live", h, "    const feed = ago.map(",
    "    const feed = (window.icLiveFeed ? window.icLiveFeed() : []).slice(0, 3).map(f => ({ i: f[0], c: f[1], t: f[2], p: f[3], w: 'live' })).concat(ago.map(");
  h = patch("Live", h, "p: f[3], w }; });", "p: f[3], w }; })).slice(0, 7);");
  h = patch("Live", h, '<a href="Main.dc.html#features">Student life</a>', "");   // removed from the top menu
  h = h.replace(/href="Main\.dc\.html#features"/g, 'href="/brain"');
  pages.Live = h;
}

for (const [k, v] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, k + ".html"), v);
console.log("Prepared:", Object.keys(pages).join(", "));

// ---- Demo LMS: "Inspire College OS" student portal --------------------------------------------------
if (fs.existsSync(OS_SRC)) {
  let h = fs.readFileSync(OS_SRC, "utf8");
  const n = "OS";
  h = patch(n, h, "<title>Inspire College OS</title>", "<title>Inspire Brain · Demo</title><!--IC_HEAD-->");
  // Only the student portal exists in the demo.
  h = patch(n, h, "const V={command:vCommand,", "for(const k of Object.keys(PORTALS))if(k!=='student')delete PORTALS[k];\nPORTALS.student.nav.forEach(g=>{g[1]=g[1].filter(n=>n[0]!=='player');});\nPORTALS.student.nav.push(['LIVE',[['livecampus','Live Campus','bolt']]]);\nconst V={livecampus:()=>{S.view='student';S.portal='student';try{history.replaceState(null,'','/portal')}catch(e){}save();setTimeout(()=>{location.href='/portal/live-campus'},0);return '<div class=\"wrap\"><p>Opening Live Campus…</p></div>';},command:vCommand,");
  // State is loaded from / saved to the demo account on the server (not just this browser).
  h = patch(n, h, "function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}", "function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}window.icDemoSave&&window.icDemoSave(S);}");
  h = patch(n, h, "function restore(){try{const r=localStorage.getItem(KEY);if(r){const o=JSON.parse(r);S=Object.assign(defaults(),o);}}catch(e){}}",
    "function restore(){S=window.icDemoRestore?window.icDemoRestore(defaults()):defaults();if(S.view==='livecampus'){S.view='student';S.portal='student';}}");
  // Live Campus is a separate page: never reopen it from a saved screen or a leftover #livecampus (that looped back).
  h = patch(n, h, "const h0=(location.hash||'').slice(1);if(V[h0]){", "const h0=(location.hash||'').slice(1);if(V[h0]&&h0!=='livecampus'){");
  h = patch(n, h, "ACT.doReset=()=>{try{localStorage.removeItem(KEY)}catch(e){}S=defaults();", "ACT.doReset=()=>{try{localStorage.removeItem(KEY)}catch(e){}S=window.icDemoPersonalise?window.icDemoPersonalise(defaults()):defaults();");
  h = patch(n, h, "ACT.signOut=()=>{S.authed=false;S.lgStep='welcome';render(false);};", "ACT.signOut=()=>{window.icDemoSignOut();};");
  // Login screen: email + password for the demo account (instead of the design's one-time code).
  h = patch(n, h, "function vLogin(){const st=S.lgStep||'welcome';let panel='';", "function vLogin(){const st='welcome';let panel='';if(window.icDemoLoginPanel)return window.icDemoLoginPanel(ASSET);");
  // Sidebar like the current LMS: icon + "inspire.college" wordmark at the top, profile card at the bottom
  // (the design's portal switcher at the top is removed — the demo only has the student portal).
  h = patch(n, h, '<div class="logo"><b>inspire</b><span>college</span><span style="font-size:11px;font-weight:600;color:var(--muted);margin-left:6px;letter-spacing:.04em">OS</span></div>',
    '${window.icDemoBrand?window.icDemoBrand():\'<div class="logo"><b>inspire</b><span>college</span></div>\'}');
  h = patchRe(n, h, / <div class="portal"><button class="portal-btn"[\s\S]*?:''\}<\/div>\n/, "");
  h = patch(n, h, '<button class="reset" data-act="resetDemo">Reset demo data</button></div>`;',
    '<button class="reset" data-act="resetDemo">Reset demo data</button>${window.icDemoUserCard?window.icDemoUserCard():\'\'}</div>`;');
  // My Classes: cards with Awarding body → School → Programme → Study mode filters (classes managed in the website CMS).
  h = patch(n, h, "function vMyClasses(){", "function vMyClasses(){if(S.portal==='student'&&window.icDemoClassesView)return window.icDemoClassesView();");
  // Personal name instead of the sample student's.
  h = h.replace(/Nethmi Senaratne/g, "__IC_FULL__").replace(/\bNethmi\b/g, "__IC_FIRST__");
  fs.writeFileSync(path.join(OUT, "Portal.html"), h);
  console.log("Prepared: Portal");
} else {
  console.warn("Skipped Portal: copy the OS design to", OS_SRC);
}

// ---- Tracking layer + colour theme from the design's outer shell ------------------------------------
{
  const shell = fs.readFileSync(path.resolve(here, "../../design-source/inspire-college-website.original.html"), "utf8").replace(/\r\n/g, "\n");
  const n = "shell";
  const a = shell.indexOf("/* ===== Inspire tracking layer");
  const b = shell.indexOf("</script>", a);
  let tracking = shell.slice(a, b);
  tracking = patch(n, tracking, "var IC_CONFIG = { gtm: '', ga4: '', metaPixel: '', tiktokPixel: '', googleAdsId: '', googleAdsPurchaseLabel: '', googleAdsLeadLabel: '' };",
    "var IC_CONFIG = Object.assign({ gtm: '', ga4: '', metaPixel: '', tiktokPixel: '', googleAdsId: '', googleAdsPurchaseLabel: '', googleAdsLeadLabel: '' }, (window.IC_DATA && window.IC_DATA.tracking) || {});");
  tracking = patch(n, tracking, "  document.body.appendChild(b);", "  if (document.body) document.body.appendChild(b); else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(b); });");
  tracking = patch(n, tracking, "  document.head.appendChild(st);", "  (document.head || document.documentElement).appendChild(st);");
  const t0 = shell.indexOf("var IC_PAL = {", shell.indexOf("var BLOB="));  // the copy in the shell, not the one inside PAGES
  const t1 = shell.indexOf("frame.addEventListener('load'", t0);
  const theme = "(function(){\n" + shell.slice(t0, t1) + "\nwindow.__icTheme={css:icThemeCss,load:icThemeLoad,apply:icThemeApply};\n})();\n";
  if (t0 < 0 || t1 < 0) throw new Error("[shell] theme code not found");
  fs.writeFileSync(path.resolve(here, "../src/site/tracking.js"), "/* generated by scripts/prepare-design.mjs */\n" + tracking + "\n" + theme);
  console.log("Prepared: tracking.js");
}
