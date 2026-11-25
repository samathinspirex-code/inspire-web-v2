"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// CMS "Payments": modelled on the current CMS Accounts console (Learners & fees, Payment links, Receipts, Settings),
// plus bank-slip review and the email outbox. Data: /api/admin/payments/* (backend app/modules/payments/admin_router.py).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { api, post, put } from "./api";

type J = Record<string, any>;

const TABS: [string, string][] = [
  ["", "Overview"], ["students", "Students & fees"], ["invoices", "Invoices & links"], ["slips", "Bank slips"],
  ["log", "Payments log"], ["emails", "Emails"], ["settings", "Billing settings"],
];

const lkr = (n: unknown) => "LKR " + Math.round(Number(n || 0)).toLocaleString("en-US");
const day = (s: unknown) => (s ? new Date(String(s).length === 10 ? s + "T00:00:00" : String(s)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const when = (s: unknown) => (s ? new Date(String(s)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const STATE: Record<string, [string, string]> = {
  current: ["Current", "ok"], paid: ["Paid up", "ok"], overdue: ["Overdue", "bad"], at_risk: ["At risk 60+ days", "bad"],
  pending: ["Awaiting first payment", "wait"], reserved: ["Reserved · plan needed", "wait"], withdrawn: ["Withdrawn", "off"], completed: ["Completed", "ok"],
};

function Pill({ s }: { s: string }) {
  const [label, tone] = STATE[s] || [s, ""];
  return <span className={"pill " + tone}>{label}</span>;
}
function InvPill({ i }: { i: J }) {
  const tone = i.status === "paid" ? "ok" : i.status_label === "Overdue" ? "bad" : i.status === "cancelled" ? "off" : i.status === "scheduled" ? "" : "wait";
  return <span className={"pill " + tone}>{i.status === "cancelled" ? "Cancelled" : i.status_label}</span>;
}

function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    if (!path) return;
    setError("");
    api<T>(path).then(setData).catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

async function act(fn: () => Promise<unknown>, done?: () => void, okMsg?: string) {
  try {
    await fn();
    if (okMsg) alert(okMsg);
    done?.();
  } catch (e) {
    alert((e as Error).message);
  }
}

// ---------------------------------------------------------------------------------------------------
export default function PaymentsApp({ path }: { path: string[] }) {
  const sub = path[0] || "";
  let body: React.ReactNode;
  if (sub === "") body = <POverview />;
  else if (sub === "students" && path[1]) body = <PStudent id={path[1]} />;
  else if (sub === "students") body = <PStudents />;
  else if (sub === "invoices") body = <PInvoices />;
  else if (sub === "slips") body = <PSlips />;
  else if (sub === "log") body = <PLog />;
  else if (sub === "emails") body = <PEmails />;
  else if (sub === "settings") body = <PSettings />;
  else body = <p>Not found.</p>;
  return (
    <div className="pay-admin">
      <header className="head"><h1>Payments</h1></header>
      <nav className="tabs">{TABS.map(([k, l]) => <Link key={k} href={"/admin/payments" + (k ? "/" + k : "")} aria-current={sub === k ? "page" : undefined}>{l}</Link>)}</nav>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
function POverview() {
  const { data: d, error, reload } = useLoad<J>("payments/overview");
  const [asOf, setAsOf] = useState("");
  const [result, setResult] = useState("");
  const run = async () => {
    setResult("Running…");
    try {
      const r = await post<J>("payments/run-billing", { as_of: asOf || null });
      setResult(r.skipped ? r.skipped : `${r.as_of}: ${r.issued} invoice(s) issued, ${r.reminders} reminder(s), emails sent ${r.email?.sent ?? 0}`);
      reload();
    } catch (e) {
      setResult((e as Error).message);
    }
  };
  if (error) return <p className="warn">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="notes">
        {!d.mail_enabled && <p className="note">Email is <b>off</b> (MAIL_ENABLED=false): invoices and reminders stay queued in Emails. Add the Mailjet keys to <code>backend/.env</code> and switch it on.</p>}
        {d.mail_enabled && d.mail_test_to && <p className="note">Test mode: every email goes to the MAIL_TEST_TO inbox, not to students.</p>}
        {!d.payhere_ready && <p className="note">PayHere keys are not set, so card payment is hidden on invoice pages. Students can still upload bank slips.</p>}
        <p className="note">PayHere mode: <b>{d.payhere_mode}</b>. Billing runs every 15 minutes: invoices are emailed 5 days before each due date, then reminders 3 days before, on the day and 7 days after (Billing settings).</p>
      </div>
      <div className="tiles">
        <div className="tile"><b>{lkr(d.collected_month)}</b><span>Collected this month</span></div>
        <div className="tile"><b>{lkr(d.outstanding)}</b><span>Open invoices</span></div>
        <Link className="tile" href="/admin/payments/students?state=overdue"><b>{lkr(d.overdue)}</b><span>Overdue ({d.overdue_count})</span></Link>
        <div className="tile"><b>{lkr(d.scheduled)}</b><span>Scheduled (future months)</span></div>
        <Link className="tile" href="/admin/payments/slips"><b>{d.pending_slips}</b><span>Bank slips to review</span></Link>
        <Link className="tile" href="/admin/payments/emails"><b>{d.queued_emails}{d.failed_emails ? ` · ${d.failed_emails} failed` : ""}</b><span>Emails queued</span></Link>
      </div>
      <div className="card pad">
        <h2>Run billing now</h2>
        <p className="muted">Issues invoices that are due soon, sends reminders and queued emails.{d.sandbox_tools ? " In sandbox you can pick a future date to test what happens then." : ""}</p>
        <div className="row">
          {d.sandbox_tools && <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ maxWidth: 200 }} />}
          <button className="btn" onClick={run}>Run billing</button>
          <span className="muted">{result}</span>
        </div>
      </div>
      <h2 className="sec">Due in the next 14 days</h2>
      <InvoiceTable rows={d.due_soon} showStudent reload={reload} />
      <h2 className="sec">Latest payments</h2>
      <div className="card table"><table><thead><tr><th>Date</th><th>Student</th><th>Method</th><th className="right">Amount</th></tr></thead>
        <tbody>{d.latest_payments.map((p: J) => <tr key={p.id}><td>{day(p.received_on)}</td><td><Link href={`/admin/payments/students/${p.student_id}`}>{p.student}</Link></td><td>{p.method}</td><td className="right">{lkr(p.amount)}</td></tr>)}
          {!d.latest_payments.length && <tr><td colSpan={4} className="muted">No payments yet.</td></tr>}</tbody></table></div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function PStudents() {
  const initial = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("state") || "" : "";
  const [state, setState] = useState(initial);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error } = useLoad<J[]>(`payments/students?state=${state}&q=${encodeURIComponent(query)}`);
  const filters: [string, string][] = [["", "All"], ["overdue", "Overdue"], ["at_risk", "At risk"], ["current", "Current"], ["paid", "Paid up"], ["pending", "Awaiting payment"], ["reserved", "Reserved"], ["completed", "Completed"], ["withdrawn", "Withdrawn"]];
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        {filters.map(([k, l]) => <button key={k} className={"btn sm " + (state === k ? "" : "ghost")} onClick={() => setState(k)}>{l}</button>)}
        <a className="btn ghost sm" href="/api/admin/payments/export/students.csv">Export CSV</a>
      </div>
      <form className="row search" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}><input placeholder="Search name, email, phone, S-number, course" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn ghost sm">Search</button></form>
      {error && <p className="warn">{error}</p>}
      <div className="card table"><table>
        <thead><tr><th>Student</th><th>Programme</th><th>Plan</th><th>Months paid</th><th className="right">Paid</th><th className="right">Balance</th><th>Next due</th><th>Status</th></tr></thead>
        <tbody>
          {(data || []).map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/payments/students/${r.student_id}`}><b>{r.name}</b></Link><br /><small className="muted">{r.student_no} · {r.email || r.phone}</small></td>
              <td>{r.course}{r.year === 2 ? " · Year 2" : ""}</td>
              <td>{r.plan_label || r.plan_code}{r.auto ? "" : " · manual"}</td>
              <td>{r.instalments ? `${r.instalments_paid} of ${r.instalments}` : "—"}</td>
              <td className="right">{lkr(r.paid_total)}</td>
              <td className="right">{lkr(r.balance)}</td>
              <td>{r.next_due ? <>{day(r.next_due)}<br /><small className="muted">{lkr(r.next_amount)}</small></> : "—"}</td>
              <td><Pill s={r.state} />{r.days_overdue ? <small className="muted"> {r.days_overdue}d</small> : null}</td>
            </tr>
          ))}
          {data && !data.length && <tr><td colSpan={8} className="muted">No students here yet. Students appear when they enrol on the website, or when you create an invoice.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function InvoiceTable({ rows, reload, showStudent, sandbox }: { rows: J[]; reload: () => void; showStudent?: boolean; sandbox?: boolean }) {
  const [pay, setPay] = useState<J | null>(null);
  return (
    <>
      <div className="card table"><table>
        <thead><tr><th>Invoice</th>{showStudent && <th>Student</th>}<th>For</th><th>Due</th><th className="right">Amount</th><th className="right">Balance</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>{i.number}</td>
              {showStudent && <td><Link href={`/admin/payments/students/${i.student_id}`}>{i.student}</Link></td>}
              <td title={i.description}>{i.label || i.description}</td>
              <td>{day(i.due_date)}</td>
              <td className="right">{lkr(i.amount)}</td>
              <td className="right">{lkr(i.balance)}</td>
              <td><InvPill i={i} />{i.last_reminder_at ? <small className="muted"> · reminded {day(i.last_reminder_at)}</small> : null}</td>
              <td className="right"><div className="row end">
                <button className="btn ghost sm" title="Copy the student's payment link" onClick={() => navigator.clipboard.writeText(i.pay_url).then(() => alert("Payment link copied:\n" + i.pay_url))}>Copy link</button>
                {(i.status === "open" || i.status === "scheduled") && <>
                  <button className="btn ghost sm" onClick={() => confirm(`Email invoice ${i.number} to the student now?`) && act(() => post(`payments/invoices/${i.id}/send`, {}), reload, "Queued. It is sent straight away when email is switched on.")}>Email</button>
                  <button className="btn ghost sm" onClick={() => setPay(i)}>Record payment</button>
                  {sandbox && <button className="btn ghost sm" title="Sandbox only" onClick={() => act(() => post(`payments/invoices/${i.id}/simulate`, {}), reload)}>Simulate card</button>}
                  {Number(i.amount_paid || 0) === 0 && <button className="btn ghost sm danger" onClick={() => confirm(`Cancel ${i.number}?`) && act(() => post(`payments/invoices/${i.id}/cancel`, {}), reload)}>Cancel</button>}
                </>}
              </div></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={showStudent ? 8 : 7} className="muted">Nothing here.</td></tr>}
        </tbody>
      </table></div>
      {pay && <RecordPayment inv={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); reload(); }} />}
    </>
  );
}

function RecordPayment({ inv, onClose, onDone }: { inv: J; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<J>({ amount: Math.round(inv.balance), method: "bank_transfer", reference: "", received_on: new Date().toISOString().slice(0, 10), note: "" });
  return (
    <div className="modal" role="dialog" aria-label="Record payment"><div className="card pad">
      <h2>Record a payment · {inv.number}</h2>
      <p className="muted">For money received outside PayHere (bank transfer seen in the bank account, or cash). Card payments are recorded automatically.</p>
      <div className="grid2">
        <label className="field"><span className="lbl">Amount (LKR)</span><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="field"><span className="lbl">Method</span><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label>
        <label className="field"><span className="lbl">Received on</span><input type="date" value={f.received_on} onChange={(e) => setF({ ...f, received_on: e.target.value })} /></label>
        <label className="field"><span className="lbl">Reference</span><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
      </div>
      <div className="row end" style={{ marginTop: 14 }}><button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn" onClick={() => act(() => post(`payments/invoices/${inv.id}/payments`, { ...f, amount: Number(f.amount) }), onDone)}>Save payment</button></div>
    </div></div>
  );
}

// ---------------------------------------------------------------------------------------------------
function PStudent({ id }: { id: string }) {
  const { data: d, error, reload } = useLoad<J>(`payments/students/${id}`);
  const ov = useLoad<J>("payments/overview");
  const [edit, setEdit] = useState<J | null>(null);
  const [form, setForm] = useState<J | null>(null);   // {kind: plan|year2|invoice, enr?}
  if (error) return <p className="warn">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const st = d.student;
  const sandbox = !!ov.data?.sandbox_tools;
  return (
    <>
      <p><Link href="/admin/payments/students">← Students & fees</Link></p>
      <div className="card pad">
        <div className="row between">
          <div><h2 style={{ margin: 0 }}>{st.name} <small className="muted">{st.student_no}</small></h2><p className="muted" style={{ margin: "4px 0 0" }}>{st.email || "No email: invoices can't be emailed"} · {st.phone || "no phone"}</p></div>
          <div className="row"><button className="btn ghost sm" onClick={() => setEdit({ name: st.name, email: st.email, phone: st.phone })}>Edit contact</button>
            <button className="btn ghost sm" onClick={() => setForm({ kind: "invoice" })}>New invoice / link</button></div>
        </div>
        {edit && <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field"><span className="lbl">Name</span><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label className="field"><span className="lbl">Email</span><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
          <label className="field"><span className="lbl">Phone</span><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
          <div className="row end"><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn" onClick={() => act(() => put(`payments/students/${st.id}`, edit), () => { setEdit(null); reload(); })}>Save</button></div>
        </div>}
      </div>

      {d.enrolments.map(({ summary: s, invoices, extra }: J) => (
        <div key={s.id} className="card pad enr">
          <div className="row between">
            <div>
              <h2 style={{ margin: 0 }}>{s.course}{s.year === 2 ? " · Year 2" : ""} <Pill s={s.state} /></h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>{s.reference} · {s.plan_label || s.plan_code} · started {day(s.start_date)} · {s.auto ? "automatic instalments" : "manual billing"}
                {extra?.addons?.length ? ` · add-ons: ${extra.addons.map((a: J) => a.title).join(", ")}` : ""}</p>
            </div>
            <div className="row">
              {s.status === "reserved" && <button className="btn sm" onClick={() => setForm({ kind: "plan", enr: s })}>Set plan</button>}
              {s.plan_type === "hnd" && s.year === 1 && !["withdrawn", "pending"].includes(s.status) && <button className="btn sm" onClick={() => setForm({ kind: "year2", enr: s })}>Start Year 2</button>}
              {s.status !== "withdrawn" && <button className="btn ghost sm" onClick={() => act(() => put(`payments/enrolments/${s.id}/auto`, { auto: !s.auto }), reload)}>{s.auto ? "Switch to manual" : "Switch to automatic"}</button>}
              {s.status !== "withdrawn" && <button className="btn ghost sm danger" onClick={() => { const r = prompt("Withdraw this enrolment? Unpaid invoices are cancelled. Reason:"); if (r !== null) act(() => post(`payments/enrolments/${s.id}/withdraw`, { reason: r }), reload); }}>Withdraw</button>}
            </div>
          </div>
          <div className="stats">
            {s.instalments ? <span><b>{s.instalments_paid} of {s.instalments}</b> months paid</span> : null}
            <span>Paid <b>{lkr(s.paid_total)}</b></span><span>Balance <b>{lkr(s.balance)}</b></span>
            {s.next_due && <span>Next <b>{lkr(s.next_amount)}</b> on <b>{day(s.next_due)}</b></span>}
            {s.days_overdue ? <span className="bad">Overdue {lkr(s.overdue_amount)} · {s.days_overdue} days</span> : null}
          </div>
          <InvoiceTable rows={invoices} reload={reload} sandbox={sandbox} />
        </div>
      ))}
      {d.other_invoices.length > 0 && <><h2 className="sec">Other invoices</h2><InvoiceTable rows={d.other_invoices} reload={reload} sandbox={sandbox} /></>}

      <h2 className="sec">Payments received</h2>
      <div className="card table"><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Recorded by</th><th className="right">Amount</th></tr></thead>
        <tbody>{d.payments.map((p: J) => <tr key={p.id}><td>{day(p.received_on)}</td><td>{p.method}</td><td>{p.reference}</td><td>{p.recorded_by}</td><td className="right">{lkr(p.amount)}</td></tr>)}
          {!d.payments.length && <tr><td colSpan={5} className="muted">None yet.</td></tr>}</tbody></table></div>
      <h2 className="sec">Emails</h2>
      <div className="card table"><table><thead><tr><th>Queued</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>{d.messages.map((m: J) => <tr key={m.id}><td>{when(m.created_at)}</td><td title={m.subject}>{m.subject}</td><td>{m.status}{m.error ? ` · ${m.error}` : ""}</td></tr>)}
          {!d.messages.length && <tr><td colSpan={3} className="muted">None yet.</td></tr>}</tbody></table></div>

      {form && <StudentForm form={form} student={st} y2={d.year2_defaults} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
    </>
  );
}

function StudentForm({ form, student, y2, onClose, onDone }: { form: J; student: J; y2: J; onClose: () => void; onDone: () => void }) {
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState<J>(form.kind === "year2"
    ? { first_due: nextMonth, instalments: y2?.instalments || 9, amount: y2?.instalment_amount || 9999 }
    : form.kind === "plan" ? { code: "monthly", first_due: nextMonth, instalments: 9, amount: 9999 }
      : { description: "", amount: "", due_date: new Date().toISOString().slice(0, 10), send: true, enrolment_id: "" });
  const title = form.kind === "year2" ? "Start Year 2" : form.kind === "plan" ? "Set the payment plan" : "New invoice / payment link";
  const save = () => {
    if (form.kind === "year2") return act(() => post(`payments/enrolments/${form.enr.id}/year2`, { ...f, instalments: Number(f.instalments), amount: Number(f.amount) }), onDone);
    if (form.kind === "plan") return act(() => post(`payments/enrolments/${form.enr.id}/plan`, { ...f, instalments: Number(f.instalments), amount: Number(f.amount) }), onDone);
    return act(() => post("payments/invoices", { student_id: student.id, description: f.description, amount: Number(f.amount), due_date: f.due_date, send: f.send }), onDone);
  };
  return (
    <div className="modal" role="dialog" aria-label={title}><div className="card pad">
      <h2>{title}</h2>
      {form.kind !== "invoice" && <p className="muted">Creates monthly invoices from the first due date, same day each month. Each one is emailed 5 days before it is due, with reminders after.</p>}
      {form.kind === "invoice" && <p className="muted">A one-off invoice (late fee, exam fee, custom amount). The student gets an email with a link to pay by card or upload a slip.</p>}
      <div className="grid2">
        {form.kind === "plan" && <label className="field"><span className="lbl">Plan</span><select value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}><option value="monthly">Monthly instalments</option><option value="full">One payment (balance)</option></select></label>}
        {form.kind === "invoice" ? <>
          <label className="field wide"><span className="lbl">What is it for?</span><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Late fee, Exam re-sit fee" /></label>
          <label className="field"><span className="lbl">Amount (LKR)</span><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="field"><span className="lbl">Due date</span><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
          <label className="switch"><input type="checkbox" checked={f.send} onChange={(e) => setF({ ...f, send: e.target.checked })} /> Email it to the student now</label>
        </> : <>
          <label className="field"><span className="lbl">First due date</span><input type="date" value={f.first_due} onChange={(e) => setF({ ...f, first_due: e.target.value })} /></label>
          {(form.kind === "year2" || f.code === "monthly") && <label className="field"><span className="lbl">Number of months</span><input type="number" min={1} max={36} value={f.instalments} onChange={(e) => setF({ ...f, instalments: e.target.value })} /></label>}
          <label className="field"><span className="lbl">{form.kind === "year2" || f.code === "monthly" ? "Monthly amount (LKR)" : "Amount (LKR)"}</span><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        </>}
      </div>
      <div className="row end" style={{ marginTop: 14 }}><button className="btn ghost" onClick={onClose}>Close</button><button className="btn" onClick={save}>Save</button></div>
    </div></div>
  );
}

// ---------------------------------------------------------------------------------------------------
function PInvoices() {
  const [status, setStatus] = useState("open");
  const [overdue, setOverdue] = useState(false);
  const { data, error, reload } = useLoad<J[]>(`payments/invoices?status=${overdue ? "" : status}&overdue=${overdue}`);
  const ov = useLoad<J>("payments/overview");
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        {[["open", "Open"], ["scheduled", "Scheduled"], ["paid", "Paid"], ["cancelled", "Cancelled"], ["", "All"]].map(([k, l]) => <button key={k} className={"btn sm " + (!overdue && status === k ? "" : "ghost")} onClick={() => { setOverdue(false); setStatus(k); }}>{l}</button>)}
        <button className={"btn sm " + (overdue ? "" : "ghost")} onClick={() => setOverdue(true)}>Overdue</button>
      </div>
      <p className="muted">Every invoice has its own payment link (Copy link). Students can pay by card or upload a bank slip there, and see their whole schedule.</p>
      {error && <p className="warn">{error}</p>}
      <InvoiceTable rows={data || []} reload={reload} showStudent sandbox={!!ov.data?.sandbox_tools} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function SlipPreview({ slip }: { slip: J }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let u = "";
    fetch(`/api/admin/payments/slips/${slip.id}/file`, { credentials: "same-origin" }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [slip.id]);
  if (!url) return <div className="slip-img muted">Loading file…</div>;
  return slip.mime === "application/pdf"
    ? <a className="slip-img pdf" href={url} target="_blank" rel="noopener">Open PDF slip ↗</a>
    : <a href={url} target="_blank" rel="noopener"><img className="slip-img" src={url} alt="Bank slip" /></a>;
}

function PSlips() {
  const [status, setStatus] = useState("pending");
  const { data, error, reload } = useLoad<J[]>(`payments/slips?status=${status}`);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>{[["pending", "To review"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]].map(([k, l]) => <button key={k} className={"btn sm " + (status === k ? "" : "ghost")} onClick={() => setStatus(k)}>{l}</button>)}</div>
      <p className="muted">Check the slip against the bank account. Approve records the payment and emails a receipt; Reject emails the student your reason so they can upload again.</p>
      {error && <p className="warn">{error}</p>}
      <div className="slips">
        {(data || []).map((s) => (
          <div key={s.id} className="card pad slip">
            <SlipPreview slip={s} />
            <div>
              <h2 style={{ margin: 0 }}>{lkr(s.amount)} <span className={"pill " + (s.status === "approved" ? "ok" : s.status === "rejected" ? "bad" : "wait")}>{s.status}</span></h2>
              <p style={{ margin: "6px 0" }}><Link href={`/admin/payments/students/${s.student_id}`}><b>{s.student}</b></Link> <span className="muted">{s.student_no}</span></p>
              <p className="muted" style={{ margin: 0 }}>{s.invoice.number} · {s.invoice.label} · balance {lkr(s.invoice.balance)}<br />Transferred {day(s.paid_on)} · ref {s.reference || "—"} · uploaded {when(s.created_at)}</p>
              {s.reason && <p className="warn">Reason: {s.reason}</p>}
              {s.status === "pending" && <div className="row" style={{ marginTop: 10 }}>
                <input type="number" style={{ maxWidth: 150 }} placeholder={String(Math.round(Math.min(s.amount, s.invoice.balance)))} value={amounts[s.id] || ""} onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })} title="Amount to record (default: the slip amount, up to the balance)" />
                <button className="btn sm" onClick={() => confirm("Approve this slip and record the payment?") && act(() => post(`payments/slips/${s.id}/approve`, { amount: amounts[s.id] ? Number(amounts[s.id]) : null }), reload)}>Approve</button>
                <button className="btn ghost sm danger" onClick={() => { const r = prompt("Why can't it be confirmed? (sent to the student)"); if (r) act(() => post(`payments/slips/${s.id}/reject`, { reason: r }), reload); }}>Reject</button>
              </div>}
            </div>
          </div>
        ))}
        {data && !data.length && <p className="muted">No slips here.</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function PLog() {
  const pays = useLoad<J[]>("payments/payments");
  const gw = useLoad<J[]>("payments/gateway-events");
  return (
    <>
      <div className="row between"><h2 className="sec">Payments received</h2><a className="btn ghost sm" href="/api/admin/payments/export/payments.csv">Export CSV</a></div>
      <div className="card table"><table><thead><tr><th>Date</th><th>Student</th><th>Invoice</th><th>For</th><th>Method</th><th className="right">Amount</th><th>Recorded by</th></tr></thead>
        <tbody>{(pays.data || []).map((p) => <tr key={p.id}><td>{day(p.received_on)}</td><td>{p.student} <small className="muted">{p.student_no}</small></td><td>{p.invoice_number}</td><td title={p.description}>{p.description}</td><td>{p.method}</td><td className="right">{lkr(p.amount)}</td><td>{p.recorded_by}</td></tr>)}
          {pays.data && !pays.data.length && <tr><td colSpan={7} className="muted">None yet.</td></tr>}</tbody></table></div>
      <h2 className="sec">PayHere notifications</h2>
      <p className="muted">Every call PayHere makes to the server. Only verified, matching payments are posted; the rest are logged with the reason.</p>
      <div className="card table"><table><thead><tr><th>Received</th><th>Order</th><th>Payment ID</th><th>Status</th><th className="right">Amount</th><th>Outcome</th></tr></thead>
        <tbody>{(gw.data || []).map((g) => <tr key={g.id}><td>{when(g.created_at)}</td><td>{g.gateway_order_id}</td><td>{g.payment_id}</td><td>{g.status_code}</td><td className="right">{g.amount}</td><td>{g.outcome}{g.payload?.reason ? ` · ${g.payload.reason}` : ""}</td></tr>)}
          {gw.data && !gw.data.length && <tr><td colSpan={6} className="muted">None yet.</td></tr>}</tbody></table></div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function PEmails() {
  const [status, setStatus] = useState("");
  const { data, error, reload } = useLoad<J[]>(`payments/messages?status=${status}`);
  const [view, setView] = useState<J | null>(null);
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>{[["", "All"], ["queued", "Queued"], ["sent", "Sent"], ["failed", "Failed"], ["skipped", "Skipped"]].map(([k, l]) => <button key={k} className={"btn sm " + (status === k ? "" : "ghost")} onClick={() => setStatus(k)}>{l}</button>)}</div>
      <p className="muted">Invoices, reminders, receipts and slip emails, sent through Mailjet from {"enrol@inspire.college"}. Each automatic email is sent once.</p>
      {error && <p className="warn">{error}</p>}
      <div className="card table"><table><thead><tr><th>Queued</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
        <tbody>{(data || []).map((m) => <tr key={m.id}><td>{when(m.created_at)}</td><td>{m.to_email}</td><td title={m.subject}>{m.subject}</td><td>{m.status}{m.error ? ` · ${m.error}` : ""}</td>
          <td className="right"><div className="row end"><button className="btn ghost sm" onClick={() => api<J>(`payments/messages/${m.id}`).then(setView)}>View</button>
            {(m.status === "failed" || m.status === "skipped") && <button className="btn ghost sm" onClick={() => act(() => post(`payments/messages/${m.id}/retry`, {}), reload)}>Send again</button>}</div></td></tr>)}
          {data && !data.length && <tr><td colSpan={5} className="muted">No emails yet.</td></tr>}</tbody></table></div>
      {view && <div className="modal" role="dialog" aria-label="Email preview"><div className="card pad wide-modal">
        <div className="row between"><h2 style={{ margin: 0 }}>{view.subject}</h2><button className="btn ghost sm" onClick={() => setView(null)}>Close</button></div>
        <p className="muted">To {view.to_email} · {view.status}</p>
        <iframe title="Email preview" sandbox="" srcDoc={view.html} className="mail-frame" />
      </div></div>}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function PSettings() {
  const { data, error } = useLoad<J>("payments/settings");
  const [f, setF] = useState<J | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  if (error) return <p className="warn">{error}</p>;
  if (!f) return <p className="muted">Loading…</p>;
  const bank = f.bank || {};
  const y2 = (f.year2 || {}).hnd || {};
  const num = (k: string) => <input type="number" min={0} max={60} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="card pad form">
      <h2>When invoices and reminders go out</h2>
      <div className="grid2">
        <label className="field"><span className="lbl">Email each monthly invoice … days before it is due</span>{num("invoice_lead_days")}</label>
        <label className="field"><span className="lbl">First reminder … days before the due date</span>{num("remind_before_days")}</label>
        <label className="switch"><input type="checkbox" checked={!!f.remind_on_due} onChange={(e) => setF({ ...f, remind_on_due: e.target.checked })} /> Reminder on the due date</label>
        <label className="field"><span className="lbl">Overdue reminder … days after the due date</span>{num("remind_after_days")}</label>
      </div>
      <h2 style={{ marginTop: 22 }}>Bank details shown on invoice pages</h2>
      <div className="grid2">
        {[["account_name", "Account name"], ["bank", "Bank"], ["branch", "Branch"], ["account_no", "Account number"]].map(([k, l]) => (
          <label key={k} className="field"><span className="lbl">{l}</span><input value={bank[k] || ""} onChange={(e) => setF({ ...f, bank: { ...bank, [k]: e.target.value } })} /></label>))}
        <label className="field wide"><span className="lbl">Note for students</span><input value={bank.note || ""} onChange={(e) => setF({ ...f, bank: { ...bank, note: e.target.value } })} /></label>
      </div>
      <h2 style={{ marginTop: 22 }}>Alerts and defaults</h2>
      <div className="grid2">
        <label className="field"><span className="lbl">Finance email (new bank slip alerts)</span><input type="email" value={f.finance_email || ""} onChange={(e) => setF({ ...f, finance_email: e.target.value })} /></label>
        <label className="field"><span className="lbl">HND Year 2 · number of months (prefill)</span><input type="number" value={y2.instalments || ""} onChange={(e) => setF({ ...f, year2: { hnd: { ...y2, instalments: Number(e.target.value) } } })} /></label>
        <label className="field"><span className="lbl">HND Year 2 · monthly amount LKR (prefill)</span><input type="number" value={y2.instalment_amount || ""} onChange={(e) => setF({ ...f, year2: { hnd: { ...y2, instalment_amount: Number(e.target.value) } } })} /></label>
      </div>
      <p className="muted">Course fees and monthly plans (registration, number of months, monthly amount) are set in Website settings → Fee plans, and each course's "Automatic instalments" switch is on the course form.</p>
      <div className="row end"><button className="btn" onClick={() => act(() => put("payments/settings", f), undefined, "Saved")}>Save billing settings</button></div>
    </div>
  );
}
