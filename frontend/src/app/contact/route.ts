import { getBundle } from "@/lib/backend";
import { chromePage, esc } from "@/lib/chrome";

export const revalidate = 60;

export async function GET() {
  const b = await getBundle();
  const c = b.settings.contact;
  const options = b.courses.map((x) => `<option value="${esc(x.key)}">${esc(x.short || x.title)}</option>`).join("");
  const body = `<div class="page"><span class="eyebrow">Contact</span><h1>Talk to an advisor.</h1>
<p class="lead">Free counselling for students and parents. We usually reply on WhatsApp within the hour.</p>
<div class="grid" style="margin:26px 0">
 <a class="card" href="https://wa.me/${esc(c.whatsapp_main)}" style="text-decoration:none"><b>WhatsApp</b><p class="muted">${esc(c.phone_display)}</p></a>
 <a class="card" href="tel:${esc(c.phone_display.replace(/\s/g, ""))}" style="text-decoration:none"><b>Call us</b><p class="muted">${esc(c.phone_display)}</p></a>
 <a class="card" href="mailto:${esc(c.email)}" style="text-decoration:none"><b>Email</b><p class="muted">${esc(c.email)}</p></a>
</div>
<form id="contact-form" class="card" style="display:grid;gap:14px" novalidate>
 <h2 style="margin:0">Send us a message</h2>
 <div class="row2"><label class="l">Full name<input name="name" autocomplete="name" required></label><label class="l">Mobile / WhatsApp<input name="phone" type="tel" autocomplete="tel" required></label></div>
 <label class="l">Email<input name="email" type="email" autocomplete="email"></label>
 <label class="l">I'm interested in<select name="course_key"><option value="">Not sure yet</option>${options}</select></label>
 <label class="l">Message<textarea name="message"></textarea></label>
 <p class="err" role="alert" id="cf-msg"></p>
 <button class="btn p" type="submit">Send message</button>
</form></div>`;
  const script = `
document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, m = document.getElementById('cf-msg');
  var d = { kind: 'contact', name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), course_key: f.course_key.value, message: f.message.value.trim(), data: { page: '/contact' } };
  // Email is optional here, but checked when given. The first problem is named and that field focused.
  var bad = d.name.length < 2 ? ['name', 'Please add your full name.'] : d.phone.replace(/\\D/g, '').length < 9 ? ['phone', 'Please add a mobile number with at least 9 digits.'] :
    d.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(d.email) ? ['email', "That email address doesn't look right. Please check it (for example name@gmail.com)."] : null;
  if (bad) { m.style.color = ''; m.textContent = bad[1]; f[bad[0]].focus(); return; }
  m.style.color = ''; m.textContent = 'Sending…';
  fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'Could not send'); }); })
    .then(function () { m.style.color = '#047857'; m.textContent = 'Thank you. An advisor will contact you shortly.'; f.reset(); })
    .catch(function (x) { m.textContent = x.message; });
});`;
  return chromePage(b, { path: "/contact", title: "Contact | Inspire College", description: "Contact Inspire College for free counselling on WhatsApp, phone or email." }, body, { script });
}
