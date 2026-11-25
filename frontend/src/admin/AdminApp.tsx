"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError, del, getPath, post, put, setPath } from "./api";
import { FieldInput } from "./fields";
import PaymentsApp from "./Payments";
import { SECTIONS, type Field, type Section } from "./schemas";

type Row = Record<string, unknown> & { id: number | string };

const NAV: [string, string][] = [
  ["", "Overview"], ["settings", "Website settings"],
  ...SECTIONS.map((s) => [s.name, s.title] as [string, string]),
  ["media", "Media library"], ["payments", "Payments"], ["leads", "Leads"], ["demo-accounts", "Demo accounts"],
];

function fmt(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "—";
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  return String(v);
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

// ---------------------------------------------------------------------------------------------------
function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) onDone();
    else setErr(j.detail || "Sign-in failed");
  };
  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <div className="brand"><b>inspire</b><span>college</span><em>website CMS</em></div>
        <h1>Sign in</h1>
        <label className="field wide"><span className="lbl">Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field wide"><span className="lbl">Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="warn">{err}</p>}
        <button className="btn" type="submit">Sign in</button>
        <small>Separate from the current CMS. Admins are created with <code>scripts/create_admin.py</code>.</small>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
function Overview() {
  const { data, error } = useLoad<Record<string, number>>("overview");
  const tiles: [string, string, string][] = [
    ["courses", "Courses", "courses"], ["news", "News items", "news"], ["leads_new", "New leads", "leads"],
    ["enrolments_active", "Active enrolments", "payments/students"], ["invoices_open", "Open invoices", "payments/invoices"],
    ["slips_pending", "Bank slips to review", "payments/slips"], ["demo_active", "Active demo accounts", "demo-accounts"],
  ];
  return (
    <>
      <header className="head"><h1>Overview</h1><a className="btn ghost" href="/" target="_blank">Open website ↗</a></header>
      {error && <p className="warn">{error}</p>}
      <div className="tiles">{tiles.map(([k, l, href]) => <Link key={k} href={"/admin/" + href} className="tile"><b>{data ? data[k] : "…"}</b><span>{l}</span></Link>)}</div>
      <p className="muted">Changes appear on the website within about a minute.</p>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function ItemForm({ section, item, onSaved, onCancel }: { section: Section; item: Row | null; onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Record<string, unknown>>(item ? { ...item } : { ...section.newItem });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      if (item) await put(`content/${section.name}/${item.id}`, draft);
      else await post(`content/${section.name}`, draft);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!item || !confirm(`Delete this ${section.singular}? This cannot be undone.`)) return;
    await del(`content/${section.name}/${item.id}`);
    onSaved();
  };
  return (
    <div className="card form">
      <div className="form-head">
        <h2>{item ? `Edit ${section.singular}` : `New ${section.singular}`}</h2>
        <div className="row">
          {item && <button className="btn danger ghost" type="button" onClick={remove}>Delete</button>}
          <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn" type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
      {err && <p className="warn">{err}</p>}
      <div className="grid">
        {section.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={getPath(draft, f.key)} onChange={(v) => setDraft((d) => setPath(d, f.key, v))} />
        ))}
      </div>
    </div>
  );
}

function SectionPage({ section }: { section: Section }) {
  const { data, error, reload } = useLoad<Row[]>(`content/${section.name}`);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [data, q]);
  if (editing) {
    return <ItemForm section={section} item={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;
  }
  return (
    <>
      <header className="head"><h1>{section.title}</h1><button className="btn" onClick={() => setEditing("new")}>Add {section.singular}</button></header>
      {section.help && <p className="muted">{section.help}</p>}
      {error && <p className="warn">{error}</p>}
      <input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card table">
        <table>
          <thead><tr>{section.columns.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} onClick={() => setEditing(r)}>
                {section.columns.map((c) => <td key={c}>{fmt(r[c])}</td>)}
                <td className="right"><button className="btn ghost sm">Edit</button></td>
              </tr>
            ))}
            {data && !rows.length && <tr><td colSpan={section.columns.length + 1} className="muted">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
const SETTINGS_GROUPS: { title: string; help?: string; fields: Field[] }[] = [
  {
    title: "Announcement strip", help: "Thin bar above every page.",
    fields: [
      { key: "announcement_enabled", label: "Show the strip", type: "bool" },
      { key: "announcement_text", label: "Text", wide: true }, { key: "announcement_link", label: "Link (optional)", wide: true },
    ],
  },
  {
    title: "Bottom banner (home page)",
    fields: [
      { key: "promo_banner.enabled", label: "Show the banner", type: "bool" }, { key: "promo_banner.title", label: "Title" },
      { key: "promo_banner.text", label: "Text", wide: true }, { key: "promo_banner.cta", label: "Button text" },
      { key: "promo_banner.link", label: "Button link" }, { key: "promo_banner.image", label: "Image", type: "image", wide: true },
    ],
  },
  { title: "Christmas theme", fields: [{ key: "christmas_theme", label: "Show falling snow on every page", type: "bool" }] },
  {
    title: "Contact details", help: "Used for every WhatsApp button, the contact page and the footer.",
    fields: [
      { key: "contact.whatsapp_main", label: "WhatsApp number (main)", help: "Digits with country code, e.g. 94760974225" },
      { key: "contact.whatsapp_advisor", label: "WhatsApp number (advisors / parents)" },
      { key: "contact.phone_display", label: "Phone as shown" }, { key: "contact.email", label: "Email" },
    ],
  },
  {
    title: "Look & campaign",
    fields: [
      { key: "theme.palette", label: "Default colour", type: "select", options: ["purple", "ocean", "emerald", "sunset", "rose", "midnight"], help: "Visitors can still choose their own in the theme panel" },
      { key: "theme.shape", label: "Default corners", type: "select", options: ["", "soft", "extra"] },
      { key: "theme.font", label: "Default font", type: "select", options: ["", "sleek", "friendly"] },
      { key: "default_campaign", label: "Campaign shown at the top of the home page", help: "Key from Campaigns & offers, e.g. scholarship" },
    ],
  },
  {
    title: "Tracking", help: "Leave empty to keep tags off. A cookie banner appears automatically when any is set.",
    fields: [
      { key: "tracking.gtm", label: "Google Tag Manager ID" }, { key: "tracking.ga4", label: "GA4 measurement ID" },
      { key: "tracking.metaPixel", label: "Meta Pixel ID" }, { key: "tracking.tiktokPixel", label: "TikTok Pixel ID" },
      { key: "tracking.googleAdsId", label: "Google Ads ID" }, { key: "tracking.googleAdsPurchaseLabel", label: "Google Ads purchase label" },
      { key: "tracking.googleAdsLeadLabel", label: "Google Ads lead label" },
    ],
  },
  {
    title: "Advanced",
    fields: [
      { key: "fee_plans", label: "HND / Foundation fee plans (JSON)", type: "json", help: "Empty {} uses the design's plans. Keys: hnd, fnd. Each plan: t, d, a, u, today (LKR due today), then, hot. Checkout charges 'today'." },
      { key: "home_extra_cards", label: "Extra home cards (JSON)", type: "json", help: "Cards that are not one course, e.g. Jain University degrees" },
      { key: "seo.default_description", label: "Default meta description", type: "textarea", wide: true },
    ],
  },
];

function SettingsPage() {
  const { data, error, reload } = useLoad<Record<string, unknown>>("settings");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (data) setDraft(data); }, [data]);
  if (error) return <p className="warn">{error}</p>;
  if (!draft) return <p className="muted">Loading…</p>;
  const save = async () => {
    setMsg("Saving…");
    try {
      await put("settings", draft);
      setMsg("Saved. The website updates within a minute.");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <>
      <header className="head"><h1>Website settings</h1><div className="row"><span className="muted">{msg}</span><button className="btn" onClick={save}>Save settings</button></div></header>
      {SETTINGS_GROUPS.map((g) => (
        <section className="card form" key={g.title}>
          <h2>{g.title}</h2>
          {g.help && <p className="muted">{g.help}</p>}
          <div className="grid">{g.fields.map((f) => <FieldInput key={f.key} field={f} value={getPath(draft, f.key)} onChange={(v) => setDraft((d) => setPath(d!, f.key, v))} />)}</div>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
function MediaPage() {
  const { data, error, reload } = useLoad<Row[]>("media");
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList) => {
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      await api("media", { method: "POST", body: fd }).catch((e: Error) => alert(e.message));
    }
    setBusy(false);
    reload();
  };
  return (
    <>
      <header className="head"><h1>Media library</h1><label className="btn">{busy ? "Uploading…" : "Upload files"}<input type="file" multiple hidden accept="image/*,video/mp4,application/pdf" onChange={(e) => e.target.files && upload(e.target.files)} /></label></header>
      {error && <p className="warn">{error}</p>}
      <div className="media">
        {(data || []).map((m) => (
          <figure key={String(m.id)} className="card">
            {String(m.content_type).startsWith("image") ? <img src={String(m.url)} alt="" /> : <div className="file">{String(m.content_type)}</div>}
            <figcaption>{String(m.filename)}</figcaption>
            <button className="btn ghost sm" onClick={() => navigator.clipboard.writeText(String(m.url))}>Copy link</button>
          </figure>
        ))}
      </div>
    </>
  );
}

function RecordsPage({ title, path, columns, actions, help }: { title: string; path: string; columns: string[]; help?: string; actions?: (r: Row, reload: () => void) => React.ReactNode }) {
  const { data, error, reload } = useLoad<Row[]>(path);
  return (
    <>
      <header className="head"><h1>{title}</h1><button className="btn ghost" onClick={reload}>Refresh</button></header>
      {help && <p className="muted">{help}</p>}
      {error && <p className="warn">{error}</p>}
      <div className="card table">
        <table>
          <thead><tr>{columns.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}{actions && <th />}</tr></thead>
          <tbody>
            {(data || []).map((r) => (
              <tr key={String(r.id)}>{columns.map((c) => <td key={c}>{fmt(r[c])}</td>)}{actions && <td className="right">{actions(r, reload)}</td>}</tr>
            ))}
            {data && !data.length && <tr><td colSpan={columns.length + 1} className="muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
export default function AdminApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const page = pathname.replace(/^\/admin\/?/, "").split("/")[0] || "";

  useEffect(() => {
    api("auth/me").then(() => setAuthed(true)).catch((e) => setAuthed(e instanceof ApiError && e.status === 401 ? false : true));
  }, []);

  if (authed === null) return <div className="boot">Loading…</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const section = SECTIONS.find((s) => s.name === page);
  let body: React.ReactNode;
  if (page === "") body = <Overview />;
  else if (page === "settings") body = <SettingsPage />;
  else if (section) body = <SectionPage key={section.name} section={section} />;
  else if (page === "media") body = <MediaPage />;
  else if (page === "leads")
    body = <RecordsPage title="Leads" path="leads" help="Sign-ups and forms from the new website (stored only in the new database)." columns={["created_at", "kind", "name", "email", "phone", "course_key", "status"]}
      actions={(r, reload) => r.status === "new" ? <button className="btn ghost sm" onClick={() => put(`leads/${r.id}`, { status: "contacted" }).then(reload)}>Mark contacted</button> : null} />;
  else if (page === "payments") body = <PaymentsApp path={pathname.replace(/^\/admin\/payments\/?/, "").split("/").filter(Boolean)} />;
  else if (page === "demo-accounts")
    body = <RecordsPage title="Demo accounts" path="demo-accounts" help="Free-demo LMS accounts. Each one is deleted automatically 24 hours after sign-up." columns={["created_at", "full_name", "email", "phone", "interest", "points_earned", "expires_at"]}
      actions={(r, reload) => (
        <div className="row">
          <button className="btn ghost sm" onClick={() => post(`demo-accounts/${r.id}/extend`, {}).then(reload)}>+24h</button>
          <button className="btn danger ghost sm" onClick={() => confirm("Delete this demo account and its data now?") && del(`demo-accounts/${r.id}`).then(reload)}>Delete</button>
        </div>
      )} />;
  else body = <p>Not found.</p>;

  return (
    <div className="shell">
      <aside>
        <div className="brand"><b>inspire</b><span>college</span><em>website CMS</em></div>
        <nav>{NAV.map(([k, l]) => <Link key={k} href={"/admin" + (k ? "/" + k : "")} aria-current={page === k ? "page" : undefined}>{l}</Link>)}</nav>
        <button className="btn ghost signout" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthed(false); router.push("/admin"); }}>Sign out</button>
      </aside>
      <main>{body}</main>
    </div>
  );
}
