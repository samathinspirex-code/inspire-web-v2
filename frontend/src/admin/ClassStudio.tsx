"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Class content editor for demo LMS classes — modelled on the current LMS lecturer "Course Studio"
// (LMS-UI src/components/CourseStudio.jsx → LecturerStudio): sections accordion, ↑/↓ ordering, Edit / Delete,
// "+ Add learning content", Section and Learning-item modals. Data: /api/admin/demo-classes/* (backend demo/studio_router.py).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { api, del, post, put } from "./api";

type J = Record<string, any>;

const TYPES: [string, string][] = [
  ["video", "Video (Vimeo / YouTube / MP4 link)"], ["pdf", "PDF material"], ["pptx", "PowerPoint presentation (PPTX)"],
  ["text", "Text lesson"], ["link", "External link"], ["assignment", "Assignment"], ["quiz", "Quiz"],
];
const ICON: Record<string, string> = { video: "▶", pdf: "PDF", pptx: "PPTX", text: "T", link: "↗", assignment: "A", quiz: "Q" };
const LABEL: Record<string, string> = { video: "Video", pdf: "PDF material", pptx: "PowerPoint", text: "Text lesson", link: "External link", assignment: "Assignment", quiz: "Quiz" };
const two = (n: number) => String(n).padStart(2, "0");

async function act(fn: () => Promise<unknown>, done?: () => void) {
  try { await fn(); done?.(); } catch (e) { alert((e as Error).message); }
}

export default function ClassStudio({ id }: { id: string }) {
  const [data, setData] = useState<J | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [modal, setModal] = useState<J | null>(null);   // {kind:'section'|'item', section?, item?}
  const reload = useCallback(() => {
    api<J>(`demo-classes/${id}/studio`).then((d) => {
      setData(d);
      setOpen((o) => (o === null && d.sections.length ? d.sections[0].id : o));
    }).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(reload, [reload]);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const sections: J[] = data.sections;
  const itemCount = sections.reduce((n, s) => n + s.items.length, 0);

  const moveSection = (idx: number, dir: number) => {
    const ids = sections.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    act(() => put(`demo-classes/${id}/sections/reorder`, { ids }), reload);
  };
  const moveItem = (s: J, idx: number, dir: number) => {
    const ids = s.items.map((i: J) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    act(() => put(`demo-classes/sections/${s.id}/items/reorder`, { ids }), reload);
  };

  return (
    <div className="studio">
      <p><Link href="/admin/demo_classes">← Demo LMS classes</Link></p>
      <div className="studio-toolbar">
        <div>
          <span className="eyebrow">Lecturer workspace</span>
          <h2>Course Contents</h2>
          <p className="muted">{data.class.code} · {data.class.title}{data.class.programme ? ` · ${data.class.programme}` : ""}. Build sections, then add videos, PDFs, slides, lessons, links, assignments and quizzes.</p>
        </div>
        <button className="btn" onClick={() => setModal({ kind: "section" })}>+ Add section</button>
      </div>
      <div className="studio-summary">
        <div><b>{sections.length}</b><span>Sections</span></div>
        <div><b>{itemCount}</b><span>Learning items</span></div>
        <div><b>{sections.filter((s) => s.status === "active").length}</b><span>Published sections</span></div>
      </div>

      {!sections.length && (
        <button className="studio-empty" onClick={() => setModal({ kind: "section" })}>
          <i>+</i><b>Build your first course section</b><span>Sections group learning content, like weeks or units.</span>
        </button>
      )}

      <div className="studio-list">
        {sections.map((s, idx) => {
          const expanded = open === s.id;
          return (
            <section key={s.id} className="studio-section">
              <div className="studio-section-head">
                <button className="section-toggle" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}>
                  <span className="num">{two(idx + 1)}</span>
                  <span className="t"><b>{s.title}</b> <span className={"pill " + (s.status === "active" ? "ok" : "wait")}>{s.status === "active" ? "active" : "draft"}</span>
                    <small>{s.items.length} content{s.items.length === 1 ? "" : "s"}{s.description ? ` · ${s.description}` : ""}</small></span>
                  <span className="chev">{expanded ? "⌃" : "⌄"}</span>
                </button>
                <div className="section-actions">
                  <button className="mini" title="Move up" onClick={() => moveSection(idx, -1)} disabled={!idx}>↑</button>
                  <button className="mini" title="Move down" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}>↓</button>
                  <button className="btn ghost sm" onClick={() => setModal({ kind: "section", section: s })}>Edit</button>
                  <button className="btn ghost sm danger" onClick={() => confirm(`Delete "${s.title}" and its ${s.items.length} item(s)?`) && act(() => del(`demo-classes/sections/${s.id}`), reload)}>Delete</button>
                </div>
              </div>
              {expanded && (
                <div className="studio-items">
                  {s.items.map((it: J, j: number) => (
                    <div key={it.id} className="studio-item">
                      <span className={"content-icon " + it.item_type}>{ICON[it.item_type] || "•"}</span>
                      <span className="t"><b>{it.title}</b> <span className={"pill " + (it.status === "published" ? "ok" : "wait")}>{it.status}</span>
                        <small>{LABEL[it.item_type]}{it.duration_minutes ? ` · ${it.duration_minutes} min` : ""}{it.is_required ? " · Required" : ""}</small></span>
                      <span className="item-actions">
                        <button className="mini" onClick={() => moveItem(s, j, -1)} disabled={!j}>↑</button>
                        <button className="mini" onClick={() => moveItem(s, j, 1)} disabled={j === s.items.length - 1}>↓</button>
                        <button className="btn ghost sm" onClick={() => setModal({ kind: "item", section: s, item: it })}>Edit</button>
                        <button className="btn ghost sm danger" onClick={() => confirm(`Delete "${it.title}"?`) && act(() => del(`demo-classes/items/${it.id}`), reload)}>Delete</button>
                      </span>
                    </div>
                  ))}
                  <button className="add-content" onClick={() => setModal({ kind: "item", section: s })}>+ Add learning content</button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {modal?.kind === "section" && <SectionModal classId={id} section={modal.section} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.kind === "item" && <ItemModal section={modal.section} item={modal.item} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </div>
  );
}

function Shell({ title, wide, children, onClose }: { title: string; wide?: boolean; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-label={title}>
      <div className={"card pad studio-modal" + (wide ? " wide-modal" : "")}>
        <div className="row between"><div><span className="eyebrow">Course Studio</span><h2 style={{ margin: "4px 0 0" }}>{title}</h2></div><button className="btn ghost sm" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

function SectionModal({ classId, section, onClose, onDone }: { classId: string; section?: J; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<J>({ title: section?.title || "", description: section?.description || "", status: section?.status || "active" });
  const save = () => act(() => (section ? put(`demo-classes/sections/${section.id}`, f) : post(`demo-classes/${classId}/sections`, f)), onDone);
  return (
    <Shell title={section ? "Edit section" : "Add section"} onClose={onClose}>
      <label className="field wide"><span className="lbl">Section title</span><input value={f.title} placeholder="Week 1 · Introduction" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field wide"><span className="lbl">Description</span><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="field wide"><span className="lbl">Visibility</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
        <option value="draft">Draft · admins only</option><option value="active">Published · students see it</option></select></label>
      <div className="row end" style={{ marginTop: 16 }}><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={!f.title.trim()}>{section ? "Save section" : "Add section"}</button></div>
    </Shell>
  );
}

function ItemModal({ section, item, onClose, onDone }: { section: J; item?: J; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<J>({
    item_type: item?.item_type || "video", title: item?.title || "", description: item?.description || "", resource_url: item?.resource_url || "",
    text_content: item?.text_content || "", duration_minutes: item?.duration_minutes || "", status: item?.status || "published", is_required: !!item?.is_required,
  });
  const [busy, setBusy] = useState("");
  const t = f.item_type;
  const upload = async (file: File) => {
    setBusy("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const m = await api<J>("media", { method: "POST", body: fd });
      setF((x: J) => ({ ...x, resource_url: m.url, title: x.title || file.name.replace(/\.[^.]+$/, "") }));
      setBusy("");
    } catch (e) { setBusy((e as Error).message); }
  };
  const save = () => act(() => {
    const body = { ...f, duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null };
    return item ? put(`demo-classes/items/${item.id}`, body) : post(`demo-classes/sections/${section.id}/items`, body);
  }, onDone);
  return (
    <Shell title={item ? "Edit learning content" : `Add learning content · ${section.title}`} wide onClose={onClose}>
      <div className="grid2">
        <label className="field"><span className="lbl">Content type</span><select value={t} onChange={(e) => setF({ ...f, item_type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field"><span className="lbl">Status</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="published">Published</option><option value="draft">Draft</option></select></label>
      </div>
      <label className="field wide"><span className="lbl">Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>

      {t === "video" && <div className="grid2">
        <label className="field wide"><span className="lbl">Video link</span><input value={f.resource_url} placeholder="https://vimeo.com/123456789 · YouTube link · or .mp4 URL" onChange={(e) => setF({ ...f, resource_url: e.target.value })} /><small>Vimeo, YouTube or a direct MP4 link. You can also upload an MP4 below (max 25 MB).</small></label>
        <label className="field"><span className="lbl">Duration (minutes)</span><input type="number" min={0} value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></label>
        <label className="field"><span className="lbl">Upload MP4</span><input type="file" accept="video/mp4" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
      </div>}
      {(t === "pdf" || t === "pptx") && (
        <div className={"stored-file" + (f.resource_url ? " attached" : "")}>
          <span className={"content-icon " + t}>{ICON[t]}</span>
          <span className="t"><b>{f.resource_url ? "File attached" : `No ${t === "pdf" ? "PDF" : "PowerPoint"} attached`}</b><small>{f.resource_url ? f.resource_url.split("/").pop() : "Max 25 MB"}</small></span>
          <label className="btn ghost sm">{f.resource_url ? "Replace" : "Upload"} {t === "pdf" ? "PDF" : "PPTX"}<input type="file" hidden accept={t === "pdf" ? "application/pdf" : ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        </div>
      )}
      {t === "text" && <label className="field wide"><span className="lbl">Lesson content</span><textarea rows={8} value={f.text_content} onChange={(e) => setF({ ...f, text_content: e.target.value })} /></label>}
      {(t === "link" || t === "assignment" || t === "quiz") && <label className="field wide"><span className="lbl">{t === "link" ? "Link URL" : "Link (optional)"}</span><input value={f.resource_url} placeholder="https://…" onChange={(e) => setF({ ...f, resource_url: e.target.value })} />{t !== "link" && <small>Optional: a form or document students open for this {t}.</small>}</label>}
      {busy && <p className="muted">{busy}</p>}

      <label className="field wide"><span className="lbl">Description</span><textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="switch"><input type="checkbox" checked={f.is_required} onChange={(e) => setF({ ...f, is_required: e.target.checked })} /> Required content</label>
      <div className="row end" style={{ marginTop: 16 }}><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={!f.title.trim() || !!busy}>{item ? "Save content" : "Add content"}</button></div>
    </Shell>
  );
}
