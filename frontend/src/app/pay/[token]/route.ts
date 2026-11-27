import { getBundle } from "@/lib/backend";
import { chromePage } from "@/lib/chrome";

export const dynamic = "force-dynamic";

// The student's private invoice page (link in every invoice / reminder email). No login: the long random token is the key.
// Shows the invoice, pay by card (PayHere) or upload a bank slip, and the whole payment schedule.
export async function GET() {
  const b = await getBundle();
  const body = `<style>
.pay{max-width:880px;margin:24px auto 0;display:grid;gap:18px}
.pay .pill{display:inline-flex;align-items:center;padding:5px 12px;border-radius:999px;font-size:13px;font-weight:650;background:var(--soft)}
.pay .pill.paid{background:#dcfce7;color:#166534}.pay .pill.overdue{background:#fee2e2;color:#991b1b}.pay .pill.due{background:#ede9fe;color:#5b21b6}
.pay .amt{font-size:clamp(34px,5vw,52px);font-weight:700;letter-spacing:-.03em;margin:6px 0}
.pay .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.pay .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.pay table{width:100%;border-collapse:collapse;font-size:15px}
.pay td,.pay th{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left}
.pay th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.pay td.r,.pay th.r{text-align:right}
.pay .bank{background:var(--soft);border-radius:20px;padding:14px 16px;font-size:15px;line-height:1.7}
.pay .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:12px;margin-top:12px}
.pay label{display:grid;gap:6px;font-weight:600;font-size:14px}
.pay input{min-height:50px;padding:10px 14px;border-radius:16px;border:1px solid var(--line);background:var(--card);font:inherit;color:var(--ink)}
.pay .msg{padding:12px 16px;border-radius:16px;background:var(--soft);font-size:15px}
.pay .msg.err{background:#fee2e2;color:#991b1b}.pay .msg.ok{background:#dcfce7;color:#166534}
.pay .lines{margin:10px 0 0;padding:0;list-style:none;color:var(--muted);font-size:14px}
.pay .stats{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 14px}.pay .stats span{background:var(--soft);border-radius:14px;padding:8px 12px;font-size:14px}
/* Payment received: green tick, then the receipt slides out of a printer slot like a till bill. */
.ok-pop{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:20px;background:rgba(18,10,36,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:okfade .3s ease both;overflow-y:auto}
.ok-box{width:min(380px,100%);display:flex;flex-direction:column;align-items:center}
.ok-tick{width:92px;height:92px;border-radius:50%;background:#16a34a;display:grid;place-items:center;box-shadow:0 0 0 0 rgba(22,163,74,.5);animation:okpop .55s cubic-bezier(.34,1.56,.64,1) .1s both,okring 1.6s ease-out .6s 2}
.ok-tick svg{width:50px;height:50px}.ok-tick path{fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:okdraw .45s ease-out .55s forwards}
.ok-title{margin:16px 0 4px;color:#fff;font-size:24px;font-weight:700;text-align:center;animation:okup .4s ease .8s both}
.ok-sub{margin:0 0 14px;color:rgba(255,255,255,.8);text-align:center;font-size:15px;animation:okup .4s ease .9s both}
.ok-slot{width:100%;height:14px;border-radius:999px;background:#1d1530;box-shadow:inset 0 3px 6px rgba(0,0,0,.6);position:relative;z-index:2;animation:okup .3s ease 1s both}
.ok-paper{width:92%;margin-top:-7px;overflow:hidden;clip-path:inset(0 0 100% 0);animation:okprint 1.5s cubic-bezier(.25,.8,.3,1) 1.25s forwards}
.ok-bill{background:#fff;color:#1d1530;padding:22px 20px 26px;font:14px/1.5 "Geist Mono",ui-monospace,Menlo,Consolas,monospace;
  -webkit-mask:linear-gradient(#000 0 0) top/100% calc(100% - 9px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/18px 9px repeat-x;
  mask:linear-gradient(#000 0 0) top/100% calc(100% - 9px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/18px 9px repeat-x}
.ok-bill .bh{text-align:center;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}
.ok-bill .bs{text-align:center;color:#6b6280;font-size:12px;margin-bottom:10px}
.ok-bill hr{border:0;border-top:1.5px dashed #c9c2d6;margin:10px 0}
.ok-bill .br{display:flex;justify-content:space-between;gap:12px}.ok-bill .br span:first-child{color:#6b6280}.ok-bill .br b{text-align:right}
.ok-bill .bt{display:flex;justify-content:space-between;font-size:17px;font-weight:700;margin-top:4px}
.ok-bill .stamp{display:inline-block;margin:12px auto 0;padding:3px 12px;border:2px solid #16a34a;border-radius:6px;color:#16a34a;font-weight:700;letter-spacing:.12em;transform:rotate(-6deg);animation:okstamp .35s cubic-bezier(.34,1.56,.64,1) 2.7s both}
.ok-acts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:18px;animation:okup .4s ease 2.8s both}
.ok-acts .btn.s{background:rgba(255,255,255,.14);color:#fff}
@keyframes okfade{from{opacity:0}}@keyframes okpop{from{transform:scale(0)}}@keyframes okdraw{to{stroke-dashoffset:0}}
@keyframes okring{to{box-shadow:0 0 0 26px rgba(22,163,74,0)}}@keyframes okup{from{opacity:0;transform:translateY(8px)}}
@keyframes okprint{to{clip-path:inset(0 0 0 0)}}@keyframes okstamp{from{opacity:0;transform:rotate(-6deg) scale(2.2)}}
.ok-paper{transform-origin:top}.ok-bill{animation:okfeed 1.5s cubic-bezier(.25,.8,.3,1) 1.25s both}@keyframes okfeed{from{transform:translateY(-100%)}}
@media(prefers-reduced-motion:reduce){.ok-pop *,.ok-pop{animation:none!important}.ok-paper{clip-path:none}.ok-tick path{stroke-dashoffset:0}}
@media print{body *{visibility:hidden}.ok-bill,.ok-bill *{visibility:visible}.ok-bill{position:absolute;left:0;top:0;width:100%;-webkit-mask:none;mask:none}}
</style>
<div class="pay" id="pay"><div class="card"><p class="lead">Loading your invoice…</p></div></div>`;
  const script = `
(function () {
  var token = location.pathname.split('/').pop(), root = document.getElementById('pay');
  var q = new URLSearchParams(location.search), polls = 0;
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') el.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]); else el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function lkr(n) { return 'LKR ' + Math.round(Number(n || 0)).toLocaleString('en-US'); }
  function day(s) { if (!s) return ''; var d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function pill(label) { var c = label === 'Paid' ? 'paid' : label === 'Overdue' ? 'overdue' : label === 'Due' ? 'due' : ''; return h('span', { 'class': 'pill ' + c, text: label }); }
  function msg(text, kind) { return h('div', { 'class': 'msg ' + (kind || ''), text: text }); }
  // Today in the student's own time zone (toISOString is UTC: before 05:30 in Sri Lanka it would say yesterday).
  function localDay() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  // Back from PayHere can restore this page from memory with "Opening PayHere…" stuck: reload for a fresh status.
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  function load() {
    fetch('/api/pay/' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'This payment link is not valid.'); return j; }); })
      .then(render)
      .catch(function (e) { root.replaceChildren(h('div', { 'class': 'card' }, [h('h1', { text: 'Payment link not found' }), h('p', { 'class': 'lead', text: e.message })])); });
  }

  // Payment confirmed: green tick + the receipt printing out. Shown once, when the student comes back from PayHere
  // or the page sees the payment arrive while they wait (not on every later visit to a paid invoice).
  var seenUnpaid = false;
  function shouldCelebrate(d) {
    var key = 'icPaidShown:' + token + ':' + d.invoice.number;
    var fresh = q.get('status') === 'return' || seenUnpaid;
    try { if (!fresh || sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch (e) { if (!fresh) return false; }
    return true;
  }
  function celebrate(d) {
    var inv = d.invoice, s = d.summary || {}, now = new Date();
    function row(k, v) { return v ? h('div', { 'class': 'br' }, [h('span', { text: k }), h('b', { text: v })]) : null; }
    var bill = h('div', { 'class': 'ok-bill', id: 'ok-bill' }, [
      h('div', { 'class': 'bh', text: 'Inspire College' }), h('div', { 'class': 'bs', text: 'Payment receipt' }), h('hr'),
      row('Invoice', inv.number), row('Date', now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
      row('Student', d.student && d.student.first_name), row('For', d.course || inv.description), row('Plan', d.plan),
      row('Method', q.get('status') === 'return' ? 'Card (PayHere)' : ''), h('hr'),
      h('div', { 'class': 'bt' }, [h('span', { text: 'PAID' }), h('span', { text: lkr(inv.amount) })]),
      s.next_due ? h('hr') : null, s.next_due ? row('Next payment', lkr(s.next_amount) + ' on ' + day(s.next_due)) : null,
      h('div', { style: 'text-align:center' }, [h('span', { 'class': 'stamp', text: 'PAID' })])
    ]);
    function close() { pop.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    var pop = h('div', { 'class': 'ok-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Payment received' }, [h('div', { 'class': 'ok-box' }, [
      h('div', { 'class': 'ok-tick', 'aria-hidden': 'true' }),
      h('p', { 'class': 'ok-title', text: 'Payment received' }),
      h('p', { 'class': 'ok-sub', text: 'Thank you, ' + ((d.student && d.student.first_name) || 'there') + '! A receipt is on its way to your email.' }),
      h('div', { 'class': 'ok-slot', 'aria-hidden': 'true' }), h('div', { 'class': 'ok-paper' }, [bill]),
      h('div', { 'class': 'ok-acts' }, [
        h('button', { 'class': 'btn s', type: 'button', text: 'Print receipt', onclick: function () { window.print(); } }),
        h('button', { 'class': 'btn p', type: 'button', text: 'View my payment schedule', onclick: close })
      ])
    ])]);
    pop.querySelector('.ok-tick').innerHTML = '<svg viewBox="0 0 52 52"><path d="M14 27 l8 8 l16 -18"/></svg>';
    pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
    document.addEventListener('keydown', esc);
    (document.querySelector('.ic') || document.body).appendChild(pop);   // inside the site wrapper: its fonts and button colours
    pop.querySelector('.ok-acts .btn.p').focus({ preventScroll: true });
    if (window.dataLayer) window.dataLayer.push({ event: 'payment_received', invoice: inv.number, value: Number(inv.amount) || 0, currency: 'LKR' });
  }

  function render(d) {
    var inv = d.invoice, paid = inv.status === 'paid', kids = [];
    if (!paid) seenUnpaid = true;
    else if (shouldCelebrate(d)) setTimeout(function () { celebrate(d); }, 150);
    var top = h('div', { 'class': 'card' }, [
      h('span', { 'class': 'eyebrow', text: 'Invoice ' + inv.number }),
      h('div', { 'class': 'row' }, [h('h1', { text: paid ? 'Thank you, ' + d.student.first_name + '!' : 'Hi ' + d.student.first_name + ',' , style: 'margin:0' }), pill(inv.status_label)]),
      h('p', { 'class': 'lead', text: inv.description }),
      h('div', { 'class': 'amt', text: lkr(paid ? inv.amount : inv.balance) }),
      h('p', { 'class': 'muted', text: paid ? 'Paid in full.' : (inv.paid > 0 ? lkr(inv.paid) + ' received · ' : '') + 'Due ' + day(inv.due_date) }),
      inv.lines && inv.lines.length > 1 ? h('ul', { 'class': 'lines' }, inv.lines.map(function (l) { return h('li', { text: l.label + ' — ' + lkr(l.amount) }); })) : null
    ]);
    // Back from PayHere: PayHere tells us about the payment separately, a few seconds later. Until then the pay buttons
    // stay hidden so nobody pays twice; after a minute the student can check again or contact us.
    var checking = q.get('status') === 'return' && !paid;
    if (checking) {
      if (polls++ < 20) {
        top.appendChild(msg('Checking your card payment with PayHere… Please do not pay again. This page updates by itself.', ''));
        setTimeout(load, 3000);
      } else {
        top.appendChild(msg('PayHere has not confirmed this payment yet. If money left your account, please do not pay again: we will confirm by email, or WhatsApp us with your invoice number.', 'err'));
        top.appendChild(h('div', { 'class': 'acts' }, [
          h('button', { 'class': 'btn s', type: 'button', text: 'Check again', onclick: function () { polls = 0; load(); } }),
          h('button', { 'class': 'btn s', type: 'button', text: 'Pay another way', onclick: function () { history.replaceState(null, '', location.pathname); q = new URLSearchParams(''); load(); } })
        ]));
      }
    }
    if (q.get('status') === 'cancelled' && !paid) top.appendChild(msg('The card payment was cancelled. No money was taken. You can try again or upload a bank slip.', 'err'));
    if (d.slip && !paid) {
      if (d.slip.status === 'pending') top.appendChild(msg('We received your bank slip. Our finance team will confirm it soon (usually within one working day).', 'ok'));
      if (d.slip.status === 'rejected') top.appendChild(msg('We could not confirm your last slip: ' + (d.slip.reason || '') + ' Please upload a new one or pay by card.', 'err'));
    }
    if (!paid && !checking) {
      var acts = h('div', { 'class': 'acts' });
      if (d.card_enabled) acts.appendChild(h('button', { 'class': 'btn p', type: 'button', text: 'Pay ' + lkr(inv.balance) + ' by card', onclick: payCard }));
      acts.appendChild(h('button', { 'class': 'btn s', type: 'button', text: 'Upload bank slip', onclick: function () { var f = document.getElementById('slipbox'); f.hidden = !f.hidden; if (!f.hidden) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
      top.appendChild(acts);
      var slipWaiting = d.slip && d.slip.status === 'pending';
      if (!d.card_enabled && !slipWaiting) top.appendChild(h('p', { 'class': 'muted', text: 'Card payments are being switched on. For now please pay by bank transfer and upload your slip.' }));
    }
    if (q.get('new') === '1' && !paid && !d.slip) top.appendChild(msg('Your seat request is saved. Transfer the amount using the bank details below, then upload your slip here. Keep this page: we also email you the link when you gave us your email.', 'ok'));
    kids.push(top);
    if (!paid && !checking) { var sf = slipForm(d); if (q.get('new') === '1' && !d.slip) sf.hidden = false; kids.push(sf); }
    if (d.schedule && d.schedule.length) kids.push(scheduleCard(d));
    root.replaceChildren.apply(root, kids);
  }

  function slipForm(d) {
    var b = d.bank || {}, inv = d.invoice;
    var bank = h('div', { 'class': 'bank' }, [
      h('b', { text: 'Bank transfer details' }), h('br'),
      b.account_name ? 'Account name: ' + b.account_name : null, b.account_name ? h('br') : null,
      b.bank ? 'Bank: ' + b.bank + (b.branch ? ', ' + b.branch : '') : null, b.bank ? h('br') : null,
      b.account_no ? 'Account number: ' + b.account_no : null, b.account_no ? h('br') : null,
      'Reference: ' + inv.number, b.note ? h('br') : null, b.note || null
    ]);
    var out = h('p', { 'class': 'muted' });
    var form = h('form', { onsubmit: function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var file = fd.get('file');
      if (!file || !file.size) { out.textContent = 'Please choose a photo or PDF of your slip.'; return; }
      if (file.size > 4 * 1024 * 1024) { out.textContent = 'The file is too large (max 4 MB).'; return; }
      var send = form.querySelector('button[type=submit]');
      if (send.disabled) return;                         // already sending: a second click must not upload twice
      send.disabled = true; send.textContent = 'Sending…'; out.textContent = 'Uploading…';
      fetch('/api/pay/' + encodeURIComponent(token) + '/slip', { method: 'POST', body: fd })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'Upload failed'); return j; }); })
        .then(function () { load(); window.scrollTo({ top: 0, behavior: 'smooth' }); })
        .catch(function (x) { out.textContent = x.message; send.disabled = false; send.textContent = 'Send slip for review'; });
    } }, [
      h('div', { 'class': 'fgrid' }, [
        h('label', {}, ['Amount you transferred (LKR)', h('input', { name: 'amount', type: 'number', min: '1', step: '1', required: 'required', value: String(Math.round(inv.balance)) })]),
        h('label', {}, ['Date of transfer', h('input', { name: 'paid_on', type: 'date', value: localDay(), max: localDay() })]),
        h('label', {}, ['Bank reference (optional)', h('input', { name: 'reference', maxlength: '120' })]),
        h('label', {}, ['Slip photo or PDF (max 4 MB)', h('input', { name: 'file', type: 'file', accept: 'image/jpeg,image/png,application/pdf', required: 'required' })])
      ]),
      h('div', { 'class': 'acts' }, [h('button', { 'class': 'btn p', type: 'submit', text: 'Send slip for review' })]), out
    ]);
    return h('div', { 'class': 'card', id: 'slipbox', hidden: 'hidden' }, [h('h2', { text: 'Pay by bank transfer', style: 'margin-top:0' }), bank, form]);
  }

  function scheduleCard(d) {
    var s = d.summary, stats = h('div', { 'class': 'stats' });
    if (s) {
      if (s.instalments) stats.appendChild(h('span', { text: s.instalments_paid + ' of ' + s.instalments + ' monthly payments made' }));
      stats.appendChild(h('span', { text: 'Paid so far ' + lkr(s.paid_total) }));
      stats.appendChild(h('span', { text: 'Remaining ' + lkr(s.balance) }));
      if (s.next_due) stats.appendChild(h('span', { text: 'Next: ' + lkr(s.next_amount) + ' on ' + day(s.next_due) }));
    }
    var rows = d.schedule.map(function (r) {
      return h('tr', {}, [h('td', { text: r.label }), h('td', { text: day(r.due_date) }), h('td', { 'class': 'r', text: lkr(r.amount) }), h('td', {}, [pill(r.status_label)])]);
    });
    return h('div', { 'class': 'card' }, [
      h('h2', { text: 'Your payment schedule', style: 'margin-top:0' }), h('p', { 'class': 'muted', text: (d.course || '') + (d.plan ? ' · ' + d.plan : '') }), stats,
      h('div', { style: 'overflow-x:auto' }, [h('table', {}, [h('thead', {}, [h('tr', {}, [h('th', { text: 'Payment' }), h('th', { text: 'Due' }), h('th', { 'class': 'r', text: 'Amount' }), h('th', { text: 'Status' })])]), h('tbody', {}, rows)])]),
      h('p', { 'class': 'muted', text: 'We email each invoice a few days before it is due, with a link back to this page.' })
    ]);
  }

  function payCard(e) {
    var btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Opening PayHere…';
    fetch('/api/pay/' + encodeURIComponent(token) + '/checkout', { method: 'POST' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'Could not start the card payment'); return j; }); })
      .then(function (c) {
        if (c.method === 'get') { location.href = c.action; return; }
        var f = h('form', { method: 'POST', action: c.action });
        Object.keys(c.fields).forEach(function (k) { f.appendChild(h('input', { type: 'hidden', name: k, value: c.fields[k] })); });
        document.body.appendChild(f); f.submit();
      })
      .catch(function (x) { btn.disabled = false; btn.textContent = 'Try card payment again'; alert(x.message); });
  }
  load();
})();`;
  return chromePage(b, { path: "/pay", title: "Your invoice | Inspire College", noindex: true }, body, { script });
}
