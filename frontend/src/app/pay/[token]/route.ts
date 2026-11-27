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

  function load() {
    fetch('/api/pay/' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'This payment link is not valid.'); return j; }); })
      .then(render)
      .catch(function (e) { root.replaceChildren(h('div', { 'class': 'card' }, [h('h1', { text: 'Payment link not found' }), h('p', { 'class': 'lead', text: e.message })])); });
  }

  function render(d) {
    var inv = d.invoice, paid = inv.status === 'paid', kids = [];
    var top = h('div', { 'class': 'card' }, [
      h('span', { 'class': 'eyebrow', text: 'Invoice ' + inv.number }),
      h('div', { 'class': 'row' }, [h('h1', { text: paid ? 'Thank you, ' + d.student.first_name + '!' : 'Hi ' + d.student.first_name + ',' , style: 'margin:0' }), pill(inv.status_label)]),
      h('p', { 'class': 'lead', text: inv.description }),
      h('div', { 'class': 'amt', text: lkr(paid ? inv.amount : inv.balance) }),
      h('p', { 'class': 'muted', text: paid ? 'Paid in full.' : (inv.paid > 0 ? lkr(inv.paid) + ' received · ' : '') + 'Due ' + day(inv.due_date) }),
      inv.lines && inv.lines.length > 1 ? h('ul', { 'class': 'lines' }, inv.lines.map(function (l) { return h('li', { text: l.label + ' — ' + lkr(l.amount) }); })) : null
    ]);
    if (q.get('status') === 'return' && !paid) {
      top.appendChild(msg('Checking your card payment with PayHere… this page updates by itself.', ''));
      if (polls++ < 20) setTimeout(load, 3000);
    }
    if (q.get('status') === 'cancelled' && !paid) top.appendChild(msg('The card payment was cancelled. No money was taken. You can try again or upload a bank slip.', 'err'));
    if (d.slip && !paid) {
      if (d.slip.status === 'pending') top.appendChild(msg('We received your bank slip. Our finance team will confirm it soon (usually within one working day).', 'ok'));
      if (d.slip.status === 'rejected') top.appendChild(msg('We could not confirm your last slip: ' + (d.slip.reason || '') + ' Please upload a new one or pay by card.', 'err'));
    }
    if (!paid) {
      var acts = h('div', { 'class': 'acts' });
      if (d.card_enabled) acts.appendChild(h('button', { 'class': 'btn p', type: 'button', text: 'Pay ' + lkr(inv.balance) + ' by card', onclick: payCard }));
      acts.appendChild(h('button', { 'class': 'btn s', type: 'button', text: 'Upload bank slip', onclick: function () { var f = document.getElementById('slipbox'); f.hidden = !f.hidden; if (!f.hidden) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
      top.appendChild(acts);
      if (!d.card_enabled) top.appendChild(h('p', { 'class': 'muted', text: 'Card payments are being switched on. For now please pay by bank transfer and upload your slip.' }));
    }
    if (q.get('new') === '1' && !paid && !d.slip) top.appendChild(msg('Your seat request is saved. Transfer the amount using the bank details below, then upload your slip here. Keep this page: we also email you the link when you gave us your email.', 'ok'));
    kids.push(top);
    if (!paid) { var sf = slipForm(d); if (q.get('new') === '1' && !d.slip) sf.hidden = false; kids.push(sf); }
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
      out.textContent = 'Uploading…';
      fetch('/api/pay/' + encodeURIComponent(token) + '/slip', { method: 'POST', body: fd })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'Upload failed'); return j; }); })
        .then(function () { load(); window.scrollTo({ top: 0, behavior: 'smooth' }); })
        .catch(function (x) { out.textContent = x.message; });
    } }, [
      h('div', { 'class': 'fgrid' }, [
        h('label', {}, ['Amount you transferred (LKR)', h('input', { name: 'amount', type: 'number', min: '1', step: '1', required: 'required', value: String(Math.round(inv.balance)) })]),
        h('label', {}, ['Date of transfer', h('input', { name: 'paid_on', type: 'date', value: new Date().toISOString().slice(0, 10) })]),
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
