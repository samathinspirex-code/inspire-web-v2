// Turns backend content into the exact data shapes the design pages already use (IC_CAT, P, S, L, FQ...).
import { LEADERS } from "./leaders";
import type { Bundle, Course } from "./backend";

export const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const LEVEL_CAT: Record<string, string> = { HND: "HND", Foundation: "Foundation", "Top-Up": "Top-Up", Postgraduate: "Postgraduate", "Short course": "Short Course" };

export function cardName(c: Course): string {
  return (c.detail?.card_name as string) || c.title;
}

// Imported text sometimes carries a stray "A-circumflex" before "·" (UTF-8 read twice); fix it everywhere in a course's details.
function fixText<T>(v: T): T {
  if (typeof v === "string") return v.replace(/Â(?=[ -¿])/g, "") as T;
  if (Array.isArray(v)) return v.map(fixText) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixText(x)])) as T;
  return v;
}

const PG_ENTRY = "A bachelor's degree, or an HND / Level 5 diploma with relevant work experience";

function cleanDetail(c: Course, d: Record<string, unknown>): Record<string, unknown> {
  const out = fixText(d);
  // Postgraduate pages: the imported entry text was copied from the HND template (O/L, A/L, "completed the HND").
  if (c.level === "Postgraduate" && typeof out.entry === "string" && /O\/L|A\/L|HND in related field/i.test(out.entry)) out.entry = PG_ENTRY;
  return out;
}

export function buildIcData(b: Bundle, extra: Record<string, unknown> = {}) {
  const cat: Record<string, object> = {};
  const details: Record<string, object> = {};
  const imgs: Record<string, string> = {};
  const slugs: Record<string, string> = {};
  const cpdfee: Record<string, number> = {};
  for (const c of b.courses) {
    cat[c.key] = { s: c.short || c.title, n: c.title, l: c.level, b: c.body, p: c.plan_type, f: c.fee_label, d: c.duration, i: c.image, sc: c.school };
    if (c.key === extra.detailKey) details[c.key] = cleanDetail(c, { lvl: c.level, plan: c.plan_type, short: c.short || c.title, name: c.title, img: c.image, dur: c.duration, body: c.body, ...c.detail });
    imgs[c.key] = c.image;
    slugs[c.key] = c.slug;
    slugs[slugify(c.title)] = c.slug;
    slugs[slugify(cardName(c))] = c.slug;
    if (c.plan_type === "cpd" && (c.cpd_addon_fee || c.fee)) cpdfee[c.key] = c.cpd_addon_fee || c.fee;
  }
  const cards = b.courses
    .filter((c) => c.featured)
    .sort((a, z) => a.sort_order - z.sort_order)
    .map((c) => ({
      name: cardName(c), type: c.card_type || c.level, cat: LEVEL_CAT[c.level] || c.level, school: c.school, img: c.image, hue: "",
      dur: c.duration, body: (c.body || "").replace(/ \(UK\)$/, ""), fee: c.fee_label, monthly: c.monthly_label, blurb: c.blurb, k: c.keywords,
    }))
    .concat((b.settings.home_extra_cards || []).map((x) => ({ ...x, hue: x.hue || "" })) as never[]);
  const camp: Record<string, object> = {};
  for (const x of b.campaigns) camp[x.key] = { tag: x.tag, text: x.text, short: x.short, perk: x.perk };
  return {
    cat, details, imgs, slugs, cpdfee, cards, camp,
    feePlans: b.fee_plans,
    stories: b.testimonials.map((t) => [t.name, t.role, t.image, t.image_pos, t.video_url]),
    leaders: LEADERS.map((l) => [l.name, l.role, l.initials, l.photo || "", l.bio || "", l.photo_pos || "center 20%"]),
    faq: b.faqs.filter((f) => f.audience === "student").map((f) => [f.question, f.answer]),
    faqp: b.faqs.filter((f) => f.audience === "parent").map((f) => [f.question, f.answer]),
    contact: b.settings.contact,
    tracking: b.settings.tracking,
    theme: b.settings.theme,
    boot: { campaign: b.settings.default_campaign || "scholarship" },
    ...extra,
    detailKey: undefined,
  };
}

export function courseBySlug(b: Bundle, slug: string): Course | undefined {
  return b.courses.find((c) => c.slug === slug);
}
