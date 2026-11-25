"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { Field } from "./schemas";

type Props = { field: Field; value: unknown; onChange: (v: unknown) => void };

function JsonField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState("");
  const focused = useRef(false);
  // Follow edits made through the simple fields above, unless the user is typing here.
  useEffect(() => {
    if (!focused.current) setText(JSON.stringify(value ?? {}, null, 2));
  }, [value]);
  return (
    <>
      <textarea
        className="mono"
        rows={14}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setErr("");
          } catch {
            setErr("Not valid JSON yet; changes here are not saved until it is.");
          }
        }}
      />
      {err && <small className="warn">{err}</small>}
    </>
  );
}

function UploadField({ value, onChange, accept }: { value: string; onChange: (v: string) => void; accept: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upload = async (file: File) => {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const m = await api<{ url: string }>("media", { method: "POST", body: fd });
      onChange(m.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="upload">
      {value && accept.startsWith("image") && <img src={value} alt="" />}
      {value && accept.startsWith("video") && <video src={value} muted controls />}
      <div className="row">
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /assets/…" />
        <button type="button" className="btn ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Upload"}</button>
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {err && <small className="warn">{err}</small>}
    </div>
  );
}

export function FieldInput({ field, value, onChange }: Props) {
  const t = field.type || "text";
  let input: React.ReactNode;
  if (t === "textarea") input = <textarea rows={4} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  else if (t === "number") input = <input type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  else if (t === "bool") input = <label className="switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{value ? "Yes" : "No"}</span></label>;
  else if (t === "select") input = <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>{field.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
  else if (t === "json") input = <JsonField value={value} onChange={onChange} />;
  else if (t === "image") input = <UploadField value={(value as string) || ""} onChange={onChange} accept="image/*" />;
  else if (t === "video") input = <UploadField value={(value as string) || ""} onChange={onChange} accept="video/mp4" />;
  else if (t === "date") input = <input type="date" value={typeof value === "string" ? value.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value ? e.target.value + "T00:00:00Z" : null)} />;
  else if (t === "lines") input = <textarea rows={5} value={Array.isArray(value) ? value.join("\n") : ""} onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />;
  else input = <input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className={"field" + (field.wide || t === "json" ? " wide" : "")}>
      <span className="lbl">{field.label}</span>
      {input}
      {field.help && <small>{field.help}</small>}
    </div>
  );
}
