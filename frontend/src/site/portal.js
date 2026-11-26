/* Demo LMS runtime for the "Inspire College OS" student portal. Injected into <head> after window.__DEMO.
   Loads the portal state from the demo account, saves changes back, and handles login / sign-out. */
(function () {
  "use strict";
  var DEMO = window.__DEMO || {};
  var user = DEMO.user || { name: "Student", email: "" };
  var first = (user.name || "Student").split(" ")[0];

  window.icDemoPersonalise = function (s) {
    s.profile = Object.assign({}, s.profile || {}, { full: user.name, pref: first, phone: user.phone || (s.profile && s.profile.phone) || "", about: user.interest ? "Interested in " + user.interest + "." : (s.profile && s.profile.about) || "" });
    s.portal = "student"; s.view = "student"; s.authed = true; s.seenVibe = 1; s.lgEmail = user.email;
    return s;
  };

  window.icDemoRestore = function (def) {
    var s;
    if (DEMO.login) { s = def; s.portal = "student"; s.authed = false; return s; }
    if (DEMO.state && typeof DEMO.state === "object") {
      s = Object.assign(def, DEMO.state);
      s.portal = "student"; s.authed = true;
    } else {
      s = window.icDemoPersonalise(def); // first visit: sample data, personalised
      window.__icDemoFirstSave = true;
    }
    var h = (location.hash || "").slice(1);
    if (h) s.view = h;
    return s;
  };

  var timer = null, pending = null, failed = 0;
  function flush() {
    timer = null;
    if (!pending) return;
    var body = JSON.stringify({ state: pending }); pending = null;
    fetch("/api/demo/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: body, credentials: "same-origin", keepalive: body.length < 60000 })
      .then(function (r) {
        if (r.status === 401) { location.href = "/portal/login?expired=1"; return; }
        failed = r.ok ? 0 : failed + 1;
      }).catch(function () { failed++; });
  }
  window.icDemoSave = function (S) {
    if (DEMO.login || !S || !S.authed) return;
    pending = S;
    if (!timer) timer = setTimeout(flush, window.__icDemoFirstSave ? 50 : 1200);
    window.__icDemoFirstSave = false;
  };
  window.addEventListener("pagehide", flush);

  window.icDemoSignOut = function () {
    flush();
    fetch("/api/demo/logout", { method: "POST", credentials: "same-origin" }).finally(function () { location.href = "/portal/login"; });
  };

  // ---- Login screen (same look as the design, email + password for the demo account) -------------
  // [tone, size, left%, top%, dx, dy, duration s, delay s] — copied from LMS-UI/src/components/LoginScene.jsx
  var LX_ORBS = [
    ["plum", 150, 2, 34, 22, -30, 13, -2], ["olive", 210, 66, 3, -18, 26, 15, -6], ["crimson", 170, 35, -7, 16, 22, 12, -4],
    ["violet", 110, 12, 10, 24, 18, 10, -1], ["crimson", 90, 4, 68, 18, -20, 11, -7], ["olive", 130, 88, 44, -22, -18, 14, -3],
    ["plum", 190, 72, 74, -16, -26, 16, -9], ["violet", 76, 60, 90, 14, -24, 9, -5],
  ];
  // Styles copied from LMS-UI/src/styles.css (.login-art / .login-orb / .login-student).
  var LX_CSS = "<style>" +
    ".lx-art{background:radial-gradient(circle at 28% 18%,#7E2BC9 0%,#4A1A8C 38%,#2A0E5A 68%,#1A0B38 100%)}" +
    ".lx-art::after{z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(18,10,36,0) 55%,rgba(18,10,36,.55))!important}" +
    ".lx-orbs{position:absolute;inset:0}" +
    ".lx-orb{position:absolute;width:var(--orb-size);height:var(--orb-size);border-radius:50%;box-shadow:inset -10px -14px 28px rgba(20,4,48,.45),0 18px 40px rgba(18,10,36,.35);animation:lx-orb-drift 12s ease-in-out infinite alternate;will-change:transform}" +
    ".lx-orb::after{content:'';position:absolute;left:20%;top:14%;width:34%;height:22%;border-radius:50%;background:rgba(255,255,255,.55);transform:rotate(-24deg)}" +
    ".lx-orb.violet{background:radial-gradient(circle at 32% 28%,#D9B8FF 0%,#9B5CF0 34%,#5B21B6 72%,#32106E 100%)}" +
    ".lx-orb.crimson{background:radial-gradient(circle at 32% 28%,#FFB3C7 0%,#D6336C 36%,#8A1248 74%,#4C0A2C 100%)}" +
    ".lx-orb.plum{background:radial-gradient(circle at 32% 28%,#E0A8F0 0%,#8E2DA8 36%,#4E1470 74%,#2A0A44 100%)}" +
    ".lx-orb.olive{background:radial-gradient(circle at 32% 28%,#E9EDB0 0%,#A8AD6A 36%,#62683F 74%,#33381F 100%)}" +
    ".lx-student{position:absolute;z-index:2;left:50%;top:50%;width:min(62%,420px);height:auto;border-radius:32px;box-shadow:0 40px 80px rgba(0,0,0,.45);transform:translate(-50%,-50%) rotate(-2deg);animation:lx-float 6s ease-in-out infinite}" +
    ".lx-art .tagline{z-index:3}" +
    "@keyframes lx-orb-drift{to{transform:translate3d(var(--orb-dx),var(--orb-dy),0) scale(1.06)}}" +
    "@keyframes lx-float{0%,100%{transform:translate(-50%,-50%) rotate(-2deg)}50%{transform:translate(-50%,-54%) rotate(2deg)}}" +
    "@media(max-width:860px){.lx-student{width:min(46%,240px)}}" +
    "@media(prefers-reduced-motion:reduce){.lx-orb,.lx-student{animation:none}}" +
    "</style>";

  // ---- Look of the current LMS: sidebar logo (icon + "inspire.college" wordmark) and the profile card at the bottom ----
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  var LMS_CSS = "<style>" +
    ".ic-brand{display:flex;align-items:center;gap:10px;padding:4px 6px 14px;text-decoration:none}" +
    ".ic-brand img{width:36px;height:36px;border-radius:10px;flex:none;display:block}" +
    ".ic-brand .wm{display:block;width:150px;height:25px;background:linear-gradient(90deg,var(--ic-logo-a,#B794FF) 0 49.1%,var(--ic-logo-b,#A39BBE) 49.1% 100%);" +
    "-webkit-mask:url(/assets/lms/inspire-college-logo.png) left center/contain no-repeat;mask:url(/assets/lms/inspire-college-logo.png) left center/contain no-repeat}" +
    // Wordmark colours from the current LMS: light purple/grey on dark, deep purple/grey on light (portal uses html[data-theme] or auto).
    "html[data-theme=light] .ic-brand .wm{--ic-logo-a:#4E008E;--ic-logo-b:#8f8f9a}" +
    "@media (prefers-color-scheme: light){html:not([data-theme=dark]) .ic-brand .wm{--ic-logo-a:#4E008E;--ic-logo-b:#8f8f9a}}" +
    ".ic-user{position:relative;margin-top:12px}.ic-user summary{list-style:none;display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;cursor:pointer;border:1px solid var(--line)}" +
    ".ic-user summary::-webkit-details-marker{display:none}.ic-user summary:hover{background:var(--soft,rgba(127,127,127,.08))}" +
    ".ic-user .av{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:700;color:#fff;background:linear-gradient(135deg,#a855f7,#7c3aed)}" +
    ".ic-user b{display:block;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ic-user small{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ic-user .menu{position:absolute;left:0;right:0;bottom:calc(100% + 6px);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.25);z-index:20}" +
    ".ic-user .menu button{width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:10px 12px;border-radius:10px;cursor:pointer}" +
    ".ic-user .menu button:hover{background:var(--soft,rgba(127,127,127,.1))}" +
    "</style>";
  window.icDemoBrand = function () {
    return LMS_CSS + '<a class="ic-brand" href="/portal" aria-label="Inspire College demo LMS home"><img src="/assets/lms/icon-192.png" alt=""><span class="wm" aria-hidden="true"></span></a>';
  };
  window.icDemoUserCard = function () {
    var u = DEMO.user || {}, name = u.name || "Student";
    return '<details class="ic-user"><summary><span class="av">' + esc(name.charAt(0).toUpperCase()) + '</span><span style="flex:1;min-width:0"><b>' + esc(name) +
      '</b><small>' + esc(u.email || "Demo student") + '</small></span><span aria-hidden="true" style="color:var(--muted)">⌄</span></summary>' +
      '<div class="menu"><button type="button" data-view="profile">My profile</button><button type="button" data-act="signOut">Sign out</button></div></details>';
  };

  // ---- My Classes (student): cards + Awarding body → School → Programme → Study mode filters, like the current LMS ----
  var CLASSES = Array.isArray(DEMO.classes) ? DEMO.classes : [];
  var cf = { ab: "", school: "", prog: "", mode: "" }, cpage = 0, PER = 6;
  var CL_CSS = "<style>" +
    ".dc-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0 20px}" +
    ".dc-filters label{display:grid;gap:8px;font-weight:600;font-size:14px}" +
    ".dc-filters select{min-height:50px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:inherit;font:inherit;padding:0 14px}" +
    ".dc-filters select:disabled{opacity:.6}" +
    ".dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:18px}" +
    ".dc-card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:20px;background:var(--card);padding:12px;gap:10px}" +
    ".dc-img{aspect-ratio:29/15;border-radius:14px;background:var(--soft,#2a2140) center/cover no-repeat}" +
    ".dc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 6px 0}" +
    ".dc-chip{font-size:12px;font-weight:700;padding:4px 9px;border-radius:8px;background:rgba(168,85,247,.16);color:#c4a2ff}" +
    ".dc-st{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px}" +
    ".dc-st.Active{background:rgba(34,197,94,.15);color:#4ade80}.dc-st.Planned{background:rgba(168,85,247,.16);color:#c4a2ff}.dc-st.Completed{background:rgba(148,163,184,.18);color:#94a3b8}" +
    ".dc-card h3{margin:0;padding:0 6px;font-size:21px;letter-spacing:-.01em}" +
    ".dc-path{padding:0 6px;color:#c4a2ff;font-size:14px;line-height:1.5}" +
    ".dc-meta{display:grid;grid-template-columns:1.7fr 1fr 1fr;gap:8px;padding:0 6px}" +
    ".dc-meta div{border-radius:12px;background:var(--soft,rgba(127,127,127,.08));padding:8px;text-align:center}" +
    ".dc-meta small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.dc-meta b{font-size:13.5px}" +
    ".dc-open{align-self:flex-start;margin:2px 6px 4px;border:0;background:none;color:#c4a2ff;font:inherit;font-weight:650;cursor:pointer;padding:0}" +
    ".dc-pager{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:22px}" +
    ".dc-pager button{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:inherit;cursor:pointer}.dc-pager button:disabled{opacity:.35;cursor:default}" +
    "@media(max-width:900px){.dc-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.dc-filters{grid-template-columns:1fr}}" +
    "</style>";
  function uniq(list, key) { var o = []; list.forEach(function (c) { if (c[key] && o.indexOf(c[key]) < 0) o.push(c[key]); }); return o.sort(); }
  function fmtD(s) { if (!s) return ""; var d = new Date(s + "T00:00:00"); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  function filtered() {
    return CLASSES.filter(function (c) {
      return (!cf.ab || c.awarding_body === cf.ab) && (!cf.school || c.school === cf.school) && (!cf.prog || c.programme === cf.prog) && (!cf.mode || c.study_mode === cf.mode);
    });
  }
  function sel(key, label, placeholder, options, enabled) {
    return '<label>' + label + '<select data-dcf="' + key + '"' + (enabled ? "" : " disabled") + '><option value="">' + esc(placeholder) + "</option>" +
      options.map(function (o) { return '<option value="' + esc(o) + '"' + (cf[key] === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></label>";
  }
  function classesBody() {
    var a = CLASSES, b = a.filter(function (c) { return !cf.ab || c.awarding_body === cf.ab; }),
      s = b.filter(function (c) { return !cf.school || c.school === cf.school; }), p = s.filter(function (c) { return !cf.prog || c.programme === cf.prog; });
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
    if (cpage >= pages) cpage = pages - 1;
    var cards = list.slice(cpage * PER, cpage * PER + PER).map(function (c) {
      var short = c.study_mode === "Part Time" ? "PT" : "FT";
      var path = [short + "-" + c.code, c.code, c.intake, c.title].filter(Boolean).map(esc).join(" → ");
      return '<article class="dc-card"><div class="dc-img" style="background-image:url(\'' + esc(c.image) + '\')" role="img" aria-label="' + esc(c.title) + '"></div>' +
        '<div class="dc-top"><span class="dc-chip">' + esc(c.code) + '</span><span class="dc-st ' + esc(c.status) + '">' + esc(c.status) + "</span></div>" +
        "<h3>" + esc(c.title) + '</h3><div class="dc-path">' + path + "</div>" +
        '<div class="dc-meta"><div><small>Dates</small><b>' + esc(fmtD(c.start_date)) + (c.end_date ? " – " + esc(fmtD(c.end_date)) : "") + "</b></div>" +
        "<div><small>Mode</small><b>" + esc(c.study_mode) + "</b></div><div><small>Lecturers</small><b>" + (c.lecturers || []).length + "</b></div></div>" +
        '<button class="dc-open" type="button" data-dcopen="' + esc(c.id) + '">Open class →</button></article>';
    }).join("");
    return '<div class="dc-filters">' +
      sel("ab", "1 · Awarding body", "Select awarding body", uniq(a, "awarding_body"), true) +
      sel("school", "2 · School", cf.ab ? "All schools" : "Select awarding body first", uniq(b, "school"), !!cf.ab) +
      sel("prog", "3 · Programme", cf.school ? "All programmes" : "Select school first", uniq(s, "programme"), !!cf.school) +
      sel("mode", "4 · Study mode", cf.prog ? "All study modes" : "Select programme first", uniq(p, "study_mode"), !!cf.prog) + "</div>" +
      (cards ? '<div class="dc-grid">' + cards + "</div>" : '<p style="color:var(--muted)">' + (CLASSES.length ? "No classes match these filters yet." : "You have no classes yet. They appear here once your college adds them.") + "</p>") +
      '<div class="dc-pager"><button type="button" data-dcp="-1" aria-label="Previous page"' + (cpage ? "" : " disabled") + '>←</button><b>' + (cpage + 1) + " / " + pages +
      '</b><button type="button" data-dcp="1" aria-label="Next page"' + (cpage < pages - 1 ? "" : " disabled") + ">→</button></div>";
  }
  // ---- Class page (after "Open class"), like the current LMS: banner, sticky bar with ← and tabs,
  // Details (overview + summary card) and Course Content (outline on the left, viewer on the right). ----
  var openId = null, ctab = "details", citem = null;
  var DONE_KEY = "icdc-done-" + ((DEMO.user && DEMO.user.email) || "x");
  function doneSet() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "{}"); } catch (e) { return {}; } }
  function markDone(id) { var d = doneSet(); d[id] = 1; try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {} }
  var ICON = { video: "▶", pdf: "PDF", pptx: "PPTX", text: "T", link: "↗", assignment: "A", quiz: "Q" };
  var TLABEL = { video: "Video", pdf: "PDF material", pptx: "PowerPoint slides", text: "Text lesson", link: "External link", assignment: "Assignment", quiz: "Quiz" };
  var CP_CSS = "<style>" +
    ".cw{--pp:#9B6BFF;--pp-soft:rgba(155,107,255,.14)}" +
    ".cw-banner{position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;min-height:150px;padding:24px;border-radius:14px;margin:0 0 6px;color:#fff;background:linear-gradient(135deg,#3d0067,#6800a7 60%,#9738c0) center/cover}" +
    ".cw-banner.img{background-image:linear-gradient(90deg,rgba(27,5,40,.92),rgba(71,8,105,.72)),var(--cw-img)}" +
    ".cw-banner .eb{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.86)}" +
    ".cw-banner strong{font-size:clamp(1.2rem,2.5vw,1.75rem)}.cw-banner small{color:rgba(255,255,255,.86);font-size:13px}" +
    ".cw-bar{position:sticky;top:0;z-index:8;display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:14px;min-height:56px;padding:0 4px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 96%,transparent);backdrop-filter:blur(12px)}" +
    ".cw-back{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:none;color:inherit;cursor:pointer;font-size:16px}.cw-back:hover{color:var(--pp);border-color:var(--pp)}" +
    ".cw-bar strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-bar strong span{font-size:13px;font-weight:500;color:var(--muted)}" +
    ".cw-tabs{display:flex;gap:24px;align-self:stretch;overflow-x:auto}" +
    ".cw-tabs button{position:relative;border:0;background:none;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;padding:0}" +
    ".cw-tabs button:hover,.cw-tabs button.on{color:var(--pp)}" +
    ".cw-tabs button::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px 2px 0 0;background:var(--pp);opacity:0;transform:scaleX(.4);transition:all .18s}.cw-tabs button.on::after{opacity:1;transform:scaleX(1)}" +
    ".cw-details{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:64px;padding:42px 0 8px}" +
    ".cw-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--muted)}" +
    ".cw-pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}.cw-pill.Active{background:rgba(34,197,94,.15);color:#4ade80}.cw-pill.Planned{background:var(--pp-soft);color:var(--pp)}.cw-pill.Completed{background:rgba(148,163,184,.18);color:#94a3b8}" +
    ".cw-details h1{font-size:clamp(30px,3.4vw,44px);line-height:1.08;letter-spacing:-.025em;margin:14px 0}" +
    ".cw-copy p{line-height:1.7;color:var(--muted);white-space:pre-wrap}" +
    ".cw-take{margin-top:28px;padding-top:22px;border-top:1px solid var(--line)}.cw-take ul{padding-left:20px;line-height:1.9}" +
    ".cw-sum{position:sticky;top:76px;align-self:start;border:1px solid var(--line);border-radius:14px;padding:22px;background:var(--card);box-shadow:0 14px 36px rgba(35,16,48,.08)}" +
    ".cw-art{position:relative;height:142px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#3d0067,#6800a7 60%,#9738c0) center/cover;display:flex;align-items:flex-end;padding:14px;color:#fff;font-weight:800}" +
    ".cw-btn{display:flex;justify-content:center;align-items:center;width:100%;min-height:40px;margin:16px 0;border:0;border-radius:8px;background:#6A1BE0;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".cw-btn.sec{background:none;border:1px solid var(--line);color:inherit;width:auto;padding:0 16px;display:inline-flex}" +
    ".cw-sum h4{margin:14px 0 6px;font-size:13px}.cw-sum dl{margin:0}.cw-sum dl div{display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid var(--line)}" +
    ".cw-lect{display:flex;align-items:center;gap:10px;padding:6px 0}.cw-lect i{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;color:#fff;background:linear-gradient(135deg,#a855f7,#7c3aed)}" +
    ".cw-learn{display:grid;grid-template-columns:clamp(300px,31vw,480px) minmax(0,1fr);min-height:620px;border:1px solid var(--line);background:var(--card);margin-top:26px}" +
    ".cw-outline{max-height:780px;overflow-y:auto;border-right:1px solid var(--line)}" +
    ".cw-about{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:62px;padding:0 22px;border:0;border-bottom:1px solid var(--line);background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer}.cw-about:hover{color:var(--pp);background:var(--pp-soft)}" +
    ".cw-sec{padding:18px 16px;border-bottom:1px solid var(--line)}" +
    ".cw-sec-t{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center}.cw-sec-t .n{color:var(--pp);font-size:13px;font-weight:700}.cw-sec-t b{font-size:12.5px}.cw-sec-t small{display:block;font-size:10px;color:var(--muted)}" +
    ".cw-it{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;width:100%;margin-top:8px;padding:12px 14px;border:1px solid transparent;border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}" +
    ".cw-it:hover,.cw-it.on{border-color:var(--line);background:var(--soft,rgba(127,127,127,.06))}.cw-it.on{box-shadow:inset 3px 0 var(--pp)}" +
    ".cw-it b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-it small{font-size:11px;color:var(--muted)}" +
    ".cw-ic{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-size:9px;font-weight:900;color:var(--pp);background:var(--pp-soft)}" +
    ".cw-ic.video{color:#fff;background:#6A1BE0;font-size:12px}.cw-ic.pdf{color:#ff7b8a;background:rgba(196,62,77,.18)}.cw-ic.link{color:#7cb8f5;background:rgba(37,110,181,.2)}.cw-ic.pptx,.cw-ic.assignment,.cw-ic.quiz{color:#f2b04c;background:rgba(184,107,8,.2)}" +
    ".cw-done{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#16845B;color:#fff;font-size:12px}" +
    ".cw-viewer{padding:30px 38px;min-width:0}.cw-lesson{max-width:1080px;margin:0 auto}" +
    ".cw-media{position:relative;aspect-ratio:16/9;border:1px solid var(--line);border-radius:2px;background:#0F0A14;overflow:hidden}.cw-media iframe,.cw-media video{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    ".cw-media.doc{aspect-ratio:auto;height:680px;background:var(--card)}" +
    ".cw-textl{padding:36px;font-size:16px;line-height:1.8;white-space:pre-wrap;border:1px solid var(--line);border-radius:10px}" +
    ".cw-res{display:grid;justify-items:center;gap:12px;padding:56px 20px;border:1px solid var(--line);border-radius:10px;text-align:center}.cw-res .cw-ic{width:64px;height:64px;font-size:16px;border-radius:16px}" +
    ".cw-label{display:flex;gap:8px;align-items:center;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--pp);margin-top:22px}" +
    ".cw-label .req{background:rgba(184,107,8,.2);color:#f2b04c;padding:2px 8px;border-radius:999px;letter-spacing:0}.cw-label .ok{background:rgba(22,132,91,.2);color:#4ade80;padding:2px 8px;border-radius:999px;letter-spacing:0}" +
    ".cw-lesson h2{font-size:26px;margin:8px 0}.cw-lesson .desc{color:var(--muted);line-height:1.7;white-space:pre-wrap}" +
    ".cw-empty{display:grid;justify-items:center;align-content:center;gap:10px;min-height:420px;color:var(--muted)}.cw-empty i{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-style:normal;background:#6A1BE0;color:#fff}" +
    ".cw-panel{padding:36px 0 8px}.cw-panel .box{border:1px dashed var(--line);border-radius:14px;padding:34px;text-align:center;color:var(--muted)}" +
    "@media(max-width:1000px){.cw-details,.cw-learn{grid-template-columns:1fr}.cw-outline{border-right:0;border-bottom:1px solid var(--line);max-height:none}.cw-bar{grid-template-columns:auto 1fr}.cw-tabs{grid-column:1/-1}}" +
    "</style>";
  function allItems(c) { var o = []; (c.sections || []).forEach(function (s) { (s.items || []).forEach(function (i) { o.push(i); }); }); return o; }
  function embed(u) {
    u = String(u || "");
    var m = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i);
    if (m) return '<iframe src="https://player.vimeo.com/video/' + m[1] + "?dnt=1&title=0&byline=0&portrait=0" + (m[2] ? "&h=" + m[2] : "") + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    if (m) return '<iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    if (/\.(mp4|webm)(\?|$)/i.test(u)) return '<video src="' + esc(u) + '" controls playsinline preload="metadata"></video>';
    return "";
  }
  function viewer(c) {
    var it = allItems(c).filter(function (i) { return String(i.id) === String(citem); })[0];
    if (!it) return '<div class="cw-empty"><i>▶</i><b>Select a learning item</b><span>Choose a lesson from the course outline.</span></div>';
    var media = "", t = it.item_type, done = !!doneSet()[it.id];
    if (t === "video") media = embed(it.resource_url) ? '<div class="cw-media">' + embed(it.resource_url) + "</div>" : '<div class="cw-res"><span class="cw-ic video">▶</span><b>Video coming soon</b></div>';
    else if (t === "pdf" && it.resource_url) media = '<div class="cw-media doc"><iframe src="' + esc(it.resource_url) + '#toolbar=0" title="' + esc(it.title) + '"></iframe></div>';
    else if (t === "pptx" && it.resource_url) media = '<div class="cw-media doc"><iframe src="https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(it.resource_url) + '" title="' + esc(it.title) + '"></iframe></div>';
    else if (t === "text") media = '<div class="cw-textl">' + esc(it.text_content) + "</div>";
    else media = '<div class="cw-res"><span class="cw-ic ' + esc(t) + '">' + (ICON[t] || "•") + "</span><b>" + esc(TLABEL[t] || "Resource") + "</b>" +
      (it.resource_url ? '<a class="cw-btn" style="width:auto;padding:0 18px" href="' + esc(it.resource_url) + '" target="_blank" rel="noopener">Open resource ↗</a>' : "<small>Details below.</small>") + "</div>";
    return '<div class="cw-lesson">' + media + '<div class="cw-label">' + esc(TLABEL[t] || t) + (it.is_required ? '<span class="req">Required</span>' : "") + (done ? '<span class="ok">Completed</span>' : "") + "</div>" +
      "<h2>" + esc(it.title) + "</h2>" + (it.description ? '<div class="desc">' + esc(it.description) + "</div>" : "") +
      (done ? "" : '<p><button class="cw-btn sec" type="button" data-cwdone="' + it.id + '">Mark as complete</button></p>') + "</div>";
  }
  function classPage(c) {
    var items = allItems(c), done = doneSet();
    var count = function (t) { return items.filter(function (i) { return i.item_type === t; }).length; };
    var dates = (c.start_date ? fmtD(c.start_date) : "") + (c.end_date ? " – " + fmtD(c.end_date) : "");
    var tabs = [["details", "Details"], ["content", "Course Content"], ["recordings", "Recordings"], ["assignments", "Assignments"], ["discussions", "Discussions"]];
    var head = '<div class="cw-banner' + (c.image ? ' img" style="--cw-img:url(\'' + esc(c.image) + '\')' : "") + '"><span class="eb">' + esc(c.programme || c.school) + " · " + esc(c.study_mode) + "</span>" +
      "<strong>" + esc(c.title) + "</strong><small>" + esc(c.code) + (c.intake ? " · " + esc(c.intake) + " intake" : "") + "</small><small>" + esc(dates) + "</small></div>" +
      '<div class="cw-bar"><button class="cw-back" type="button" data-cwback aria-label="Back to My Classes">←</button><strong>' + esc(c.title) + " <span>· Batch: " + esc(c.code) + "</span></strong>" +
      '<nav class="cw-tabs">' + tabs.map(function (t) { return '<button type="button" data-cwtab="' + t[0] + '" class="' + (ctab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</nav></div>";
    var body;
    if (ctab === "details") {
      body = '<div class="cw-details"><div class="cw-copy"><div class="cw-meta"><span class="cw-pill ' + esc(c.status) + '">' + esc(c.status) + "</span>" + esc(c.code) + (c.programme ? " · " + esc(c.programme) : "") + "</div>" +
        "<h1>" + esc(c.title) + "</h1>" + (c.description ? "<p>" + esc(c.description) + "</p>" : '<p>Welcome to ' + esc(c.title) + ". Open Course Content to start learning.</p>") +
        ((c.takeaways || []).length ? '<div class="cw-take"><h2>Takeaways from this course</h2><ul>' + c.takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>" : "") + "</div>" +
        '<aside class="cw-sum"><div class="cw-art"' + (c.image ? ' style="background-image:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.6)),url(\'' + esc(c.image) + '\')"' : "") + ">" + esc(c.code) + "</div>" +
        '<button class="cw-btn" type="button" data-cwtab="content">View course content →</button><h4>This course includes</h4><dl>' +
        [["Course sections", (c.sections || []).length], ["Videos", count("video")], ["PDF materials", count("pdf") + count("pptx")], ["Activities", count("assignment") + count("quiz") + count("text") + count("link")]]
          .map(function (r) { return "<div><dt>" + r[0] + "</dt><dd style=\"margin:0\"><b>" + r[1] + "</b></dd></div>"; }).join("") + "</dl>" +
        ((c.lecturers || []).length ? "<h4>Your lecturer" + (c.lecturers.length > 1 ? "s" : "") + "</h4>" + c.lecturers.map(function (l) { return '<div class="cw-lect"><i>' + esc(l.charAt(0)) + "</i><span><b style=\"font-size:13px\">" + esc(l) + '</b><br><small style="color:var(--muted)">Lecturer</small></span></div>'; }).join("") : "") +
        "</aside></div>";
    } else if (ctab === "content") {
      var outline = '<button class="cw-about" type="button" data-cwtab="details">About this course <span>›</span></button>' + (c.sections || []).map(function (s, i) {
        return '<div class="cw-sec"><div class="cw-sec-t"><span class="n">' + String(i + 1).padStart(2, "0") + "</span><span><b>" + esc(s.title) + "</b><small>" + s.items.length + " item" + (s.items.length === 1 ? "" : "s") + "</small></span><span style=\"color:var(--muted)\">›</span></div>" +
          s.items.map(function (it) {
            return '<button type="button" class="cw-it' + (String(citem) === String(it.id) ? " on" : "") + '" data-cwitem="' + it.id + '"><span class="cw-ic ' + esc(it.item_type) + '">' + (ICON[it.item_type] || "•") + "</span>" +
              "<span style=\"min-width:0\"><b>" + esc(it.title) + "</b><small>" + esc(TLABEL[it.item_type] || "") + (it.duration_minutes ? " · " + it.duration_minutes + " min" : "") + (done[it.id] ? " · Completed" : "") + "</small></span>" +
              (done[it.id] ? '<span class="cw-done">✓</span>' : "<span></span>") + "</button>";
          }).join("") + "</div>";
      }).join("");
      if (!(c.sections || []).length) outline += '<div class="cw-sec" style="color:var(--muted)">No content has been added to this class yet.</div>';
      body = '<div class="cw-learn"><aside class="cw-outline">' + outline + '</aside><main class="cw-viewer">' + viewer(c) + "</main></div>";
    } else {
      var msg = { recordings: "Class recordings appear here after each live session.", assignments: "Assignments for this class will appear here.", discussions: "Discussions with your lecturer and classmates will appear here." }[ctab];
      body = '<div class="cw-panel"><div class="box">' + esc(msg) + "</div></div>";
    }
    return '<div class="wrap fade cw">' + CP_CSS + head + body + "</div>";
  }
  function currentClass() { return CLASSES.filter(function (c) { return String(c.id) === String(openId); })[0]; }
  function redrawPage() { var el = document.getElementById("dcRoot"); if (el) el.innerHTML = rootHtml(); window.scrollTo(0, 0); }
  function rootHtml() { var c = openId && currentClass(); return c ? classPage(c) : '<div class="wrap fade">' + classesList() + "</div>"; }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-dcopen],[data-cwback],[data-cwtab],[data-cwitem],[data-cwdone]");
    if (!t || !document.getElementById("dcRoot")) return;
    e.preventDefault(); e.stopPropagation();
    if (t.hasAttribute("data-dcopen")) { openId = t.getAttribute("data-dcopen"); ctab = "details"; citem = null; }
    else if (t.hasAttribute("data-cwback")) { openId = null; }
    else if (t.hasAttribute("data-cwtab")) {
      ctab = t.getAttribute("data-cwtab");
      if (ctab === "content" && !citem) { var c = currentClass(), f = c && allItems(c)[0]; citem = f ? f.id : null; }
    }
    else if (t.hasAttribute("data-cwitem")) { citem = t.getAttribute("data-cwitem"); }
    else if (t.hasAttribute("data-cwdone")) { markDone(t.getAttribute("data-cwdone")); }
    redrawPage();
  }, true);

  function classesList() {
    return CL_CSS + '<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c4a2ff">Student portal</p>' +
      '<h1 style="margin:6px 0 6px">My Classes</h1><p style="margin:0;color:var(--muted)">Open your classes, learning materials, assignments and discussions.</p>' +
      '<div id="dcBody">' + classesBody() + "</div>";
  }

  window.icDemoClassesView = function () {
    if (openId && currentClass()) return '<div id="dcRoot">' + classPage(currentClass()) + "</div>";
    return '<div id="dcRoot"><div class="wrap fade">' + classesList() + "</div></div>";
  };
  function redraw() { var el = document.getElementById("dcBody"); if (el) el.innerHTML = classesBody(); }
  document.addEventListener("change", function (e) {
    var k = e.target && e.target.getAttribute && e.target.getAttribute("data-dcf");
    if (!k) return;
    cf[k] = e.target.value;
    var order = ["ab", "school", "prog", "mode"];
    for (var i = order.indexOf(k) + 1; i < order.length; i++) cf[order[i]] = "";   // a new choice resets the steps after it
    cpage = 0; redraw();
  }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-dcp]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    cpage += Number(b.getAttribute("data-dcp")); redraw();
  }, true);

  window.icDemoLoginPanel = function (ASSET) {
    var expired = /expired=1/.test(location.search);
    // Same scene as the current LMS login (LMS-UI LoginScene): drifting glossy orbs + the floating student picture.
    var orbs = LX_ORBS.map(function (o) {
      return '<i class="lx-orb ' + o[0] + '" style="--orb-size:' + o[1] + 'px;--orb-dx:' + o[4] + 'px;--orb-dy:' + o[5] + 'px;left:' + o[2] + '%;top:' + o[3] + '%;animation-duration:' + o[6] + 's;animation-delay:' + o[7] + 's"></i>';
    }).join("");
    var art = '<div class="art lx-art">' + LX_CSS + '<div class="lx-orbs" aria-hidden="true">' + orbs + '</div>' +
      '<img class="lx-student" src="/assets/lms/login-student.webp" alt="A student studying on a laptop, floating among glossy shapes"><div class="tagline"><b>Learn. Level up.<br><span class="hl">Get coffee.</span></b></div></div>';
    var panel = '<div class="brand"><b>inspire</b><span>college</span></div>' +
      '<div><h1 id="lgTitle">Hey, welcome back.</h1><p id="lgSub" style="margin-top:10px">' + (expired ? "Your session ended. Log in again to continue." : "Log in to your Inspire Brain demo account.") + '</p></div>' +
      '<div class="stickers"><span class="sticker" style="background:#C6F432;color:#1A2300">12-day streaks</span><span class="sticker" style="background:#FF4FA3;color:#fff">Free coffee</span><span class="sticker" style="background:#7CC8FF;color:#06243D">AI study buddy</span></div>' +
      '<form id="demoLoginForm" style="display:flex;flex-direction:column;gap:14px" novalidate>' +
      '<div class="field"><label for="lgEmail">Email</label><input class="lin" id="lgEmail" name="email" type="email" autocomplete="username" placeholder="you@example.com" required></div>' +
      '<div class="field"><label for="lgPw" id="lgPwLabel">Password</label><input class="lin" id="lgPw" name="password" type="password" autocomplete="current-password" required></div>' +
      '<button type="button" id="lgForgot" style="align-self:flex-start;background:none;border:0;padding:0;color:#C6F432;font:inherit;font-size:13px;font-weight:600;cursor:pointer">Forgot password?</button>' +
      '<p class="tiny" id="lgErr" role="alert" style="min-height:1em;color:#FFB4D6"></p>' +
      '<button class="go" id="lgGo" type="submit">Log in</button></form>' +
      '<div class="or">or</div><a class="alt" href="/free-demo" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Create a free demo account</a>' +
      '<p class="tiny">Demo accounts are filled with sample data and deleted 24 hours after sign-up.</p>';
    return '<div class="login" role="dialog" aria-label="Student sign in">' + art + '<div class="panel">' + panel + "</div></div>";
  };

  // Forgot password (demo accounts): the same form switches to "Reset password" (email + new password).
  // Existing demo account → new password set and signed in; no account → error, then the registration page.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#lgForgot");
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var f = document.getElementById("demoLoginForm"), reset = f.getAttribute("data-mode") !== "reset";
    f.setAttribute("data-mode", reset ? "reset" : "login");
    document.getElementById("lgTitle").textContent = reset ? "Reset your password" : "Hey, welcome back.";
    document.getElementById("lgSub").textContent = reset ? "Enter your demo account email and choose a new password." : "Log in to your Inspire Brain demo account.";
    document.getElementById("lgPwLabel").textContent = reset ? "New password" : "Password";
    document.getElementById("lgGo").textContent = reset ? "Set new password and log in" : "Log in";
    f.password.value = ""; f.password.setAttribute("autocomplete", reset ? "new-password" : "current-password");
    b.textContent = reset ? "Back to log in" : "Forgot password?";
    document.getElementById("lgErr").textContent = "";
  }, true);

  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || f.id !== "demoLoginForm") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var err = document.getElementById("lgErr");
    var email = f.email.value.trim(), password = f.password.value;
    if (f.getAttribute("data-mode") === "reset") {
      if (!email) { err.textContent = "Enter the email of your demo account."; return; }
      if (password.length < 6) { err.textContent = "Choose a new password of at least 6 characters."; return; }
      err.textContent = "Setting your new password…";
      fetch("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: password }), credentials: "same-origin" })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var x = new Error(j.detail || "Could not reset the password"); x.status = r.status; throw x; } }); })
        .then(function () { location.href = "/portal"; })
        .catch(function (x) {
          err.textContent = x.message;
          if (x.status === 404) { err.textContent = "There's no demo account with this email yet. Taking you to create one…"; setTimeout(function () { location.href = "/free-demo"; }, 2500); }
        });
      return;
    }
    if (!email || !password) { err.textContent = "Enter your email and password."; return; }
    err.textContent = "Signing you in…";
    fetch("/api/demo/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: password }), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.detail || "Login failed"); }); })
      .then(function () { location.href = "/portal"; })
      .catch(function (x) { err.textContent = x.message; });
  }, true);
})();
