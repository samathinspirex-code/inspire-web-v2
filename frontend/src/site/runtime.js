/* Inspire Web v2 runtime for the design pages. Injected into <head> after window.IC_DATA.
   Connects the design's in-page logic to real URLs, the CMS data and the backend (orders, leads, demo). */
(function () {
  "use strict";
  var D = window.IC_DATA || {};

  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error((j && (typeof j.detail === "string" ? j.detail : j.error)) || "Something went wrong. Please try again.");
          return j;
        });
      });
  }
  function utm() { try { return JSON.parse(localStorage.getItem("icUTM") || "{}"); } catch (e) { return {}; } }

  // ---- Real URLs for the design's page names ------------------------------------------------------
  var slugs = D.slugs || {};
  window.icRoute = function (page, hash) {
    hash = hash || "";
    var h = hash ? "#" + hash : "";
    switch (page) {
      case "Main": return hash === "features" ? "/brain" : "/" + h;
      case "Program":
        var m = /^p-(.+)$/.exec(hash);
        if (m) return slugs[m[1]] ? "/programs/" + slugs[m[1]] : "/programs";
        return "/programs" + h;
      case "Demo": return "/free-demo" + h;
      case "Aptitude": return "/aptitude" + h;
      case "Enrol": return "/admissions" + h;
      case "LMS": return "/portal";
      case "Live": return location.pathname.indexOf("/portal") === 0 ? "/portal/live-campus" : "/live-campus";
      default: return "/";
    }
  };
  // AI match results: the design names a course by key; show that course's live name, duration and price.
  window.icMatchProg = function (p) {
    var c = p[3] && D.cat && D.cat[p[3]];
    if (!c) return { n: p[0], d: p[1], f: p[2] };
    var dur = String(c.d || "").trim().toLowerCase().replace(/\b0+(\d)/g, "$1").replace(/\s*-\s*/g, "–");
    var body = c.p === "cpd" ? "CPD" : String(c.b || "").replace(/\s*\(.*?\)\s*/g, "").trim();
    var plans = (D.feePlans && D.feePlans[c.p]) || [];
    var monthly = plans.filter(function (x) { return x && x.u === "a month"; })[0];
    return { n: c.n || p[0], d: [dur, body].filter(Boolean).join(" · ") || p[1], f: monthly ? monthly.a + " / month" : (c.f || p[2]) };
  };
  window.icBootProps = function (def) { return Object.assign({}, def || {}, D.boot || {}); };

  // ---- Programme details (Program page) from the CMS ---------------------------------------------
  window.icDetails = function (T, base) {
    if (!D.details) return base;
    var out = {};
    Object.keys(D.details).forEach(function (k) {
      var d = Object.assign({}, D.details[k]);
      var tpl = d.plan === "hnd" ? T.H : d.plan === "fnd" ? T.F : d.plan === "cpd" ? T.C : d.lvl === "Top-Up" ? T.TU : T.PGx;
      out[k] = tpl ? tpl(d) : d;
    });
    return out;
  };
  var lkr = function (n) { return "LKR " + Math.round(n).toLocaleString("en-US"); };
  // Programme-page quest lists HND/Foundation plans as [full, monthly, reserve]; the enrol drawer as [monthly, full, reserve].
  var QUEST_ORDER = { hnd: [1, 0, 2], fnd: [1, 0, 2], cpd: [0, 1], pg: [0, 1, 0] };
  window.icQuestPlans = function (plan) {
    var fp = D.feePlans && D.feePlans[plan];
    if (!fp || (plan !== "hnd" && plan !== "fnd")) return null;
    return QUEST_ORDER[plan].map(function (i) { var p = fp[i]; return { t: p.t, d: p.d, a: p.a, u: p.u, today: lkr(p.today), then: p.then, hot: !!p.hot }; });
  };

  // ---- Orders and PayHere -----------------------------------------------------------------------
  window.icCreateOrder = function (body) {
    body.extra = Object.assign({ utm: utm() }, body.extra || {});
    return post("/api/orders", body).then(function (r) {
      // Card payment chosen but the gateway could not start: never show it as paid.
      if (body.method === "payhere" && r.amount > 0 && !r.checkout) {
        throw new Error((r.checkout_error ? r.checkout_error + ". " : "") + "Your seat request " + r.reference + " is saved; choose bank transfer or try again.");
      }
      // Bank transfer: open the student's invoice page (bank details + slip upload). The same link is emailed to them.
      if (body.method === "bank_transfer" && r.pay_url) setTimeout(function () { location.href = r.pay_url + "?new=1"; }, 1600);
      return r;
    });
  };
  window.icPayHere = function (co) {
    var f = document.createElement("form");
    f.method = "POST"; f.action = co.action;
    Object.keys(co.fields).forEach(function (k) {
      var i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = co.fields[k]; f.appendChild(i);
    });
    document.body.appendChild(f); f.submit();
  };
  window.icQuestOrder = function (self, key, plan) {
    var s = self.state, map = QUEST_ORDER[plan] || [0, 1, 0];
    window.icCreateOrder({
      course_key: key, plan: map[Math.min(s.plan, map.length - 1)], method: s.method === 0 ? "payhere" : "bank_transfer",
      name: s.name, email: s.email, phone: s.phone, extra: { who: s.who, start: s.start, scholarship: s.sch, referral: s.refCode }
    }).then(function (r) {
      if (r.checkout) window.icPayHere(r.checkout);
      else self.setState({ toast: { xp: 300, t: "Seat reserved · reference " + r.reference } });
    }).catch(function (e) { self.setState({ step: 5, err: e.message }); });
  };

  // ---- Leads (admissions / contact / aptitude) -----------------------------------------------------
  window.icLead = function (kind, data) {
    data = data || {};
    data.data = Object.assign({ utm: utm(), page: location.pathname }, data.data || {});
    return post("/api/leads", Object.assign({ kind: kind }, data)).catch(function () {});
  };

  // ---- Free demo account -> demo LMS --------------------------------------------------------------
  window.icDemo = function (kind, body) {
    if (kind === "signup") body.utm = utm();
    return post("/api/demo/" + kind, body).then(function () {
      if (window.icEmit) window.icEmit({ event: kind === "signup" ? "sign_up" : "login", method: "demo" });
      location.href = "/portal";
    });
  };

  // ---- Live Campus: real activity from demo students ----------------------------------------------
  var live = [], COLORS = ["#7c3aed", "#0d9488", "#e11d48", "#4f46e5", "#0891b2", "#b45309"];
  function pollLive() {
    fetch("/api/live/feed", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      live = (j.events || []).slice(0, 6).map(function (e, i) {
        return [e.who.charAt(0).toUpperCase(), COLORS[i % COLORS.length], e.who + " · " + e.label, "+" + e.points + " XP"];
      });
    }).catch(function () {});
  }
  window.icLiveFeed = function () { return live; };
  if (D.page === "Live") { pollLive(); setInterval(pollLive, 5000); }

  // ---- Colour theme: visitor's choice, else the site default from the CMS ------------------------
  function applyTheme() {
    if (!window.__icTheme) return;
    var t = window.__icTheme.load();
    if (!t || !Object.keys(t).length) { var th = D.theme || {}; t = { c: th.palette || "purple", s: th.shape || "", f: th.font || "" }; }
    window.__icTheme.apply(document, t);
  }
  document.addEventListener("DOMContentLoaded", applyTheme);

  // ---- CPU saver: autoplay videos (hero wall, feature and final banners) play only while on screen ----
  // and the tab is visible; nothing autoplays for visitors who ask for reduced motion or data saving.
  // Story videos (.st-vid) are handled separately below.
  (function () {
    var calm = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      (navigator.connection && navigator.connection.saveData);
    var seen = new WeakSet(), onScreen = new WeakMap(), io = null;
    function sync(v) {
      var want = !calm && !document.hidden && onScreen.get(v);
      if (want && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else if (!want && !v.paused) v.pause();
    }
    function scan() {
      document.querySelectorAll("video[autoplay]:not(.st-vid)").forEach(function (v) {
        if (seen.has(v)) return;
        seen.add(v);
        v.__tried = 1;                       // the page framework won't force-play it; we decide
        v.setAttribute("preload", "metadata");
        onScreen.set(v, false);
        if (io) io.observe(v); else sync(v);
      });
    }
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { onScreen.set(e.target, e.isIntersecting); sync(e.target); });
      }, { rootMargin: "120px 0px" });
    }
    document.addEventListener("visibilitychange", function () {
      document.querySelectorAll("video[autoplay]:not(.st-vid)").forEach(sync);
    });
    document.addEventListener("DOMContentLoaded", function () {
      scan();
      var root = document.getElementById("dc-root");
      if (root) {   // the framework can swap video elements on re-render: pick new ones up (debounced)
        var t = 0;
        new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 200); }).observe(root, { childList: true, subtree: true });
      }
    });
  })();

  // ---- Student stories: the expanded card plays its video while the visitor is on the stories row --
  // Which card is expanded and whether sound is on come from the page (class "on", data-sound);
  // this only starts/stops playback, which the page's re-renders never touch.
  if (D.page === "Main") {
    var stEngaged = false, stInside = false, stVisible = true, stTouch = false, stQueued = false;
    var stSync = function () {
      stQueued = false;
      var active = stEngaged && stVisible && (stInside || stTouch);
      document.querySelectorAll(".stories2 .st-vid").forEach(function (v) {
        var card = v.closest(".st"), on = !!(card && card.classList.contains("on"));
        v.muted = v.getAttribute("data-sound") !== "1";
        if (on && active) {
          if (v.paused) { v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else if (!v.paused) { v.pause(); }
      });
    };
    var stLater = function () { if (!stQueued) { stQueued = true; requestAnimationFrame(stSync); setTimeout(stSync, 120); } };
    document.addEventListener("mouseover", function (e) {
      var inside = !!(e.target.closest && e.target.closest(".stories2"));
      if (inside) stEngaged = true;
      if (inside !== stInside) { stInside = inside; stLater(); }
    }, true);
    document.addEventListener("pointerdown", function (e) {
      stTouch = e.pointerType === "touch";
      if (e.target.closest && e.target.closest(".stories2")) { stEngaged = true; stLater(); }
    }, true);
    document.addEventListener("focusin", function (e) { if (e.target.closest && e.target.closest(".stories2")) { stEngaged = true; stInside = true; stLater(); } }, true);
    document.addEventListener("DOMContentLoaded", function () {
      var root = document.getElementById("dc-root");
      if (!root) return;
      new MutationObserver(stLater).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-sound"] });
      if ("IntersectionObserver" in window) {
        var watch = function () {
          var row = document.querySelector(".stories2");
          if (!row) return setTimeout(watch, 500);
          new IntersectionObserver(function (es) { stVisible = es[0].isIntersecting; stLater(); }, { threshold: 0.25 }).observe(row);
        };
        watch();
      }
    });
  }
})();
