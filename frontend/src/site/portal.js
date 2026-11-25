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

  window.icDemoLoginPanel = function (ASSET) {
    var expired = /expired=1/.test(location.search);
    // Same scene as the current LMS login (LMS-UI LoginScene): drifting glossy orbs + the floating student picture.
    var orbs = LX_ORBS.map(function (o) {
      return '<i class="lx-orb ' + o[0] + '" style="--orb-size:' + o[1] + 'px;--orb-dx:' + o[4] + 'px;--orb-dy:' + o[5] + 'px;left:' + o[2] + '%;top:' + o[3] + '%;animation-duration:' + o[6] + 's;animation-delay:' + o[7] + 's"></i>';
    }).join("");
    var art = '<div class="art lx-art">' + LX_CSS + '<div class="lx-orbs" aria-hidden="true">' + orbs + '</div>' +
      '<img class="lx-student" src="/assets/lms/login-student.webp" alt="A student studying on a laptop, floating among glossy shapes"><div class="tagline"><b>Learn. Level up.<br><span class="hl">Get coffee.</span></b></div></div>';
    var panel = '<div class="brand"><b>inspire</b><span>college</span></div>' +
      '<div><h1>Hey, welcome back.</h1><p style="margin-top:10px">' + (expired ? "Your session ended. Log in again to continue." : "Log in to your Inspire Brain demo account.") + '</p></div>' +
      '<div class="stickers"><span class="sticker" style="background:#C6F432;color:#1A2300">12-day streaks</span><span class="sticker" style="background:#FF4FA3;color:#fff">Free coffee</span><span class="sticker" style="background:#7CC8FF;color:#06243D">AI study buddy</span></div>' +
      '<form id="demoLoginForm" style="display:flex;flex-direction:column;gap:14px" novalidate>' +
      '<div class="field"><label for="lgEmail">Email</label><input class="lin" id="lgEmail" name="email" type="email" autocomplete="username" placeholder="you@example.com" required></div>' +
      '<div class="field"><label for="lgPw">Password</label><input class="lin" id="lgPw" name="password" type="password" autocomplete="current-password" required></div>' +
      '<p class="tiny" id="lgErr" role="alert" style="min-height:1em;color:#FFB4D6"></p>' +
      '<button class="go" type="submit">Log in</button></form>' +
      '<div class="or">or</div><a class="alt" href="/free-demo" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Create a free demo account</a>' +
      '<p class="tiny">Demo accounts are filled with sample data and deleted 24 hours after sign-up.</p>';
    return '<div class="login" role="dialog" aria-label="Student sign in">' + art + '<div class="panel">' + panel + "</div></div>";
  };

  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || f.id !== "demoLoginForm") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var err = document.getElementById("lgErr");
    var email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) { err.textContent = "Enter your email and password."; return; }
    err.textContent = "Signing you in…";
    fetch("/api/demo/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: password }), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.detail || "Login failed"); }); })
      .then(function () { location.href = "/portal"; })
      .catch(function (x) { err.textContent = x.message; });
  }, true);
})();
