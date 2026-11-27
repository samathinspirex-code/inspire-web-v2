// Site fixes applied after the design patches in prepare-design.mjs (one checked replacement each).
// Added when the generated pages were edited directly; keep new page fixes here or in prepare-design.mjs.
export const SITE_FIXES = {
  Program: [
    // Level tabs open the first course of that level on its own page
    ["this.setState({ lvl: l[0], id: first, faq: 0 }); } }));",
     "if (first && first !== id) icGoProgram(first); else this.setState({ lvl: l[0], faq: 0 }); } }));"],
    // Course chips open that course page
    ["go: () => this.setState({ id: k, faq: 0 }) }));",
     "go: () => icGoProgram(k) }));"],
    // Related course cards open that course page
    ["view: () => { this.setState({ id: z, lvl: null, faq: 0 }); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }",
     "view: () => icGoProgram(z)"],
    // CPD offer opens the AI Mastery page
    ["cpd: () => { this.setState({ id: 'c-aimastery', lvl: null, faq: 0 }); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }",
     "cpd: () => icGoProgram('c-aimastery')"],
    // Pay panel: Paylab Sri Lanka job sets per subject, chosen by icPayArea (runtime.js)
    ["const PAY = { comp: [['Software engineer', 'LKR 129K–555K'], ['AI engineer', 'LKR 62K–280K'], ['Data analyst', 'LKR 33K–298K']], cyber: [['Software engineer', 'LKR 129K–555K'], ['AI engineer', 'LKR 62K–280K'], ['Data analyst', 'LKR 33K–298K']], bus: [['Marketing manager', 'LKR 95K–254K'], ['HR manager', 'LKR 55K–290K'], ['Accountant', 'LKR 42K–173K']], acc: [['Accountant', 'LKR 42K–173K'], ['Data analyst', 'LKR 33K–298K'], ['Marketing manager', 'LKR 95K–254K']], mkt: [['Digital marketing specialist', 'LKR 40K–121K'], ['Digital marketing manager', 'LKR 56K–185K'], ['Marketing manager', 'LKR 95K–254K']], hr: [['HR generalist', 'LKR 60K–119K'], ['HR manager', 'LKR 55K–290K']], edu: [['Secondary school teacher', 'LKR 45K–90K'], ['University lecturer', 'LKR 64K–112K'], ['School principal', 'LKR 39K–220K']], data: [['Data analyst', 'LKR 33K–298K'], ['AI engineer', 'LKR 62K–280K'], ['Software engineer', 'LKR 129K–555K']] };\n        const area = /^c-(aimkt|dm)/.test(k) || /sales/.test(k) ? 'mkt' : /aihr|people/.test(k) ? 'hr' : /edu|eng$/.test(k) ? (k === 'pg-edu' ? 'edu' : 'bus') : /acc|fin|stat/.test(k) ? 'acc' : /looker|data/.test(k) ? 'data' : /^(hnd-(se|ai|cyber|net)|f-idt|pg-(ai|gen|se|app)|tu-beng|c-(aimastery|cyber))/.test(k) ? 'comp' : 'bus';\n        ",
     "const PAY = { comp: [['Software engineer', 'LKR 129K–555K'], ['AI engineer', 'LKR 62K–280K'], ['Data analyst', 'LKR 33K–298K']], cyber: [['IT security specialist', 'LKR 61K–251K'], ['Network administrator', 'LKR 45K–153K'], ['Cloud engineer', 'LKR 79K–416K']], cloud: [['DevOps engineer', 'LKR 132K–752K'], ['Cloud engineer', 'LKR 79K–416K'], ['Network administrator', 'LKR 45K–153K']], bus: [['Marketing manager', 'LKR 95K–254K'], ['HR manager', 'LKR 55K–290K'], ['Accountant', 'LKR 42K–173K']], acc: [['Accountant', 'LKR 42K–173K'], ['Financial analyst', 'LKR 56K–186K'], ['Finance manager', 'LKR 99K–439K']], bank: [['Financial analyst', 'LKR 56K–186K'], ['Bank relationship manager', 'LKR 60K–169K'], ['Loan specialist', 'LKR 45K–121K']], mkt: [['Digital marketing specialist', 'LKR 40K–121K'], ['Digital marketing manager', 'LKR 56K–185K'], ['Marketing manager', 'LKR 95K–254K']], hr: [['HR generalist', 'LKR 60K–119K'], ['HR manager', 'LKR 55K–290K']], edu: [['Secondary school teacher', 'LKR 45K–90K'], ['University lecturer', 'LKR 64K–112K'], ['School principal', 'LKR 39K–220K']], data: [['Data analyst', 'LKR 33K–298K'], ['Data scientist', 'LKR 60K–231K'], ['IT business analyst', 'LKR 63K–309K']], ba: [['IT business analyst', 'LKR 63K–309K'], ['Data analyst', 'LKR 33K–298K'], ['Financial analyst', 'LKR 56K–186K']], mgmt: [['Operations manager', 'LKR 47K–287K'], ['Business development manager', 'LKR 65K–257K'], ['Managing director', 'LKR 74K–394K']], pm: [['Project manager', 'LKR 45K–306K'], ['Senior project manager', 'LKR 69K–349K'], ['IT project manager', 'LKR 83K–360K']], ops: [['Operations manager', 'LKR 47K–287K'], ['Project manager', 'LKR 45K–306K'], ['Logistics manager', 'LKR 42K–299K']], log: [['Logistics manager', 'LKR 42K–299K'], ['Purchasing manager', 'LKR 49K–195K'], ['Warehouse manager', 'LKR 34K–157K']], law: [['Lawyer', 'LKR 56K–152K'], ['Legal advisor', 'LKR 59K–150K'], ['Paralegal', 'LKR 42K–98K']], health: [['Healthcare institution manager', 'LKR 47K–128K'], ['Public health administrator', 'LKR 38K–105K'], ['Social caseworker', 'LKR 33K–98K']] };\n        const area = window.icPayArea ? window.icPayArea(k) : 'bus';\n        "],
    // Quest step 1: name the field that is wrong
    ["go2: () => { const ok = s.name.trim().length > 1 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s.email.trim()) && s.phone.replace(/\\D/g, '').length >= 9; if (!ok) { this.setState({ err: 'Please add a name, a valid email and a mobile number.' }); return; }",
     "go2: () => { const bad = window.icFieldErr({ name: s.name, email: s.email, phone: s.phone }); if (bad) { this.setState({ err: bad }); return; }"],
    // Enrol drawer: send the price the student saw, so the server stops if it changed
    ["email: (self.state.x.email || '') }).then(r => {",
     "email: (self.state.x.email || ''), quoted_amount: today }).then(r => {"],
  ],
  Main: [
    // Feature badges wide enough for Chat / Live
    [".plist i{flex:none;width:34px;height:34px;border-radius:12px;background:var(--act);color:#fff;display:grid;place-items:center;font-style:normal;font-weight:750;font-size:14px}",
     ".plist i{flex:none;width:48px;height:34px;border-radius:12px;background:var(--act);color:#fff;display:grid;place-items:center;font-style:normal;font-weight:750;font-size:12.5px;letter-spacing:-.01em;white-space:nowrap}"],
    // Feature badges on phones
    [".plist i{width:auto;min-width:36px;padding:0 8px;font-size:11.5px;height:30px;border-radius:10px}",
     ".plist i{width:44px;padding:0;font-size:11.5px;height:30px;border-radius:10px}"],
    // Find my course button keeps the pill shape inside the menu
    [".ic .mega .feat a.btn{margin:0;padding:0 18px;color:#2a0e5c}",
     ".ic .mega .feat a.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin:0;padding:0 18px;border-radius:999px;line-height:1;color:#2a0e5c}"],
    // Footer heading spelling
    ["<p class=\"fh\">Programs</p>",
     "<p class=\"fh\">Programmes</p>"],
    // Enrol drawer: send the price the student saw, so the server stops if it changed
    ["email: (self.state.x.email || '') }).then(r => {",
     "email: (self.state.x.email || ''), quoted_amount: today }).then(r => {"],
  ],
  Enrol: [
    // Step 1: name the field that is wrong
    ["next1: () => { const ok = s.name.trim().length > 1 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s.email.trim()) && s.phone.replace(/\\D/g, '').length >= 9; this.setState(ok ? { step: 2, err: '' } : { err: 'Please add a name, a valid email and a mobile number.' }); },",
     "next1: () => { const bad = window.icFieldErr({ name: s.name, email: s.email, phone: s.phone }); this.setState(bad ? { err: bad } : { step: 2, err: '' }); },"],
    // Admissions: show the confirmation only after the details are saved; no double submit
    ["pay: () => { if (!s.agree) { this.setState({ err: 'Please accept the terms to continue.' }); return; } const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += a[Math.floor(Math.random() * a.length)]; this.setState({ step: 5, err: '', ref: 'IC-2026-' + r }); window.icLead('admissions', { name: s.name, email: s.email, phone: s.phone, course_key: (C[s.course] || [])[0] || '', data: { who: s.who, plan: s.plan, method: s.method, scholarship: s.sch, referral: s.refCode, ref: 'IC-2026-' + r } }); },",
     "pay: () => { if (!s.agree) { this.setState({ err: 'Please accept the terms to continue.' }); return; } if (s.saving) return; const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += a[Math.floor(Math.random() * a.length)]; this.setState({ saving: true, err: '' }); window.icLead('admissions', { name: s.name, email: s.email, phone: s.phone, course_key: (C[s.course] || [])[0] || '', data: { who: s.who, plan: s.plan, method: s.method, scholarship: s.sch, referral: s.refCode, ref: 'IC-2026-' + r } }, true).then(() => this.setState({ step: 5, saving: false, err: '', ref: 'IC-2026-' + r })).catch(e => this.setState({ saving: false, err: (e && e.message) || 'We could not save your details. Please try again or WhatsApp us.' })); },"],
    // Admissions: button shows Saving… while the details are sent
    ["payTxt: s.method === 1 ? 'Reserve my seat · +300 XP' : 'Pay ' + p.pr + ' · +300 XP',",
     "payTxt: s.saving ? 'Saving…' : s.method === 1 ? 'Reserve my seat · +300 XP' : 'Pay ' + p.pr + ' · +300 XP',"],
  ],
  Demo: [
    // Sign-up: name the field that is wrong
    ["register: () => { if (s.name.trim().length < 2 || !okEmail(s.email) || s.phone.replace(/\\D/g, '').length < 9 || s.pw.length < 6) { this.setState({ err: 'Please add your name, a valid email, a mobile number and a password of at least 6 characters.' }); return; }",
     "register: () => { const bad = window.icFieldErr({ name: s.name, email: s.email, phone: s.phone, pw: s.pw }); if (bad) { this.setState({ err: bad }); return; }"],
  ],
};
