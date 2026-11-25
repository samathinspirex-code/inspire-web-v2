import { getBundle } from "@/lib/backend";
import { chromePage } from "@/lib/chrome";

export const dynamic = "force-dynamic";

// PayHere sends the student back here. The page only SHOWS the status the backend confirmed through PayHere's notify call.
export async function GET() {
  const b = await getBundle();
  const body = `<div class="page card" style="text-align:center;margin-top:30px"><span class="eyebrow">Payment</span><h1 id="pt">Checking your payment…</h1>
<p class="lead" id="pm">This takes a few seconds.</p><p class="muted" id="pr"></p>
<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px"><a class="btn p" href="/portal">Open Inspire Brain</a><a class="btn s" href="/">Back to home</a></div></div>`;
  const script = `
(function () {
  var q = new URLSearchParams(location.search), ref = q.get('ref') || '', n = 0;
  var T = document.getElementById('pt'), M = document.getElementById('pm');
  document.getElementById('pr').textContent = ref ? 'Reference ' + ref : '';
  if (!/^(IC-[A-Z0-9]{6}|INV-\d{5,})$/.test(ref)) { T.textContent = 'Payment reference missing'; M.textContent = 'If you paid, an advisor will confirm on WhatsApp.'; return; }
  function show(o) {
    if (o.status === 'paid') {
      T.textContent = 'Payment received. Your seat is confirmed.'; M.textContent = 'Welcome to Inspire! An advisor will message you with next steps.';
      if (window.dataLayer) dataLayer.push({ event: 'purchase', transaction_id: ref, currency: 'LKR', value: o.amount });
      if (o.pay_url) { var a = document.createElement('a'); a.className = 'btn s'; a.href = o.pay_url; a.textContent = 'View my payment schedule'; document.getElementById('pr').after(a); }
      return true;
    }
    if (o.status === 'failed' || q.get('status') === 'cancelled') { T.textContent = 'Payment not completed'; M.textContent = 'No money was taken. You can try again or choose bank transfer.'; return true; }
    return false;
  }
  function tick() {
    fetch('/api/orders/' + encodeURIComponent(ref), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (o) { if (show(o)) return; if (++n < 20) setTimeout(tick, 3000); else { T.textContent = 'Payment is being confirmed'; M.textContent = 'PayHere is still confirming. We will message you as soon as it arrives.'; } })
      .catch(function () { if (++n < 20) setTimeout(tick, 3000); });
  }
  tick();
})();`;
  return chromePage(b, { path: "/payment/return", title: "Payment | Inspire College", noindex: true }, body, { script });
}
