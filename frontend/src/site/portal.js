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
        '<button class="dc-open" type="button" data-view="player">Open class →</button></article>';
    }).join("");
    return '<div class="dc-filters">' +
      sel("ab", "1 · Awarding body", "Select awarding body", uniq(a, "awarding_body"), true) +
      sel("school", "2 · School", cf.ab ? "All schools" : "Select awarding body first", uniq(b, "school"), !!cf.ab) +
      sel("prog", "3 · Programme", cf.school ? "All programmes" : "Select school first", uniq(s, "programme"), !!cf.school) +
      sel("mode", "4 · Study mode", cf.prog ? "All study modes" : "Select programme first", uniq(p, "study_mode"), !!cf.prog) + "</div>" +
      (cards ? '<div class="dc-grid">' + cards + "</div>" : '<p style="color:var(--muted)">No classes match these filters yet.</p>') +
      '<div class="dc-pager"><button type="button" data-dcp="-1" aria-label="Previous page"' + (cpage ? "" : " disabled") + '>←</button><b>' + (cpage + 1) + " / " + pages +
      '</b><button type="button" data-dcp="1" aria-label="Next page"' + (cpage < pages - 1 ? "" : " disabled") + ">→</button></div>";
  }
  window.icDemoClassesView = function () {
    return '<div class="wrap fade">' + CL_CSS + '<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c4a2ff">Student portal</p>' +
      '<h1 style="margin:6px 0 6px">My Classes</h1><p style="margin:0;color:var(--muted)">Open your classes, learning materials, assignments and discussions.</p>' +
      '<div id="dcBody">' + classesBody() + "</div></div>";
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
