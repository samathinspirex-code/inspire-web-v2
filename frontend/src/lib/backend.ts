// Server-side access to the Inspire API (AWS): the same backend as the CMS, CRM and LMS.
export const BACKEND_URL = (process.env.BACKEND_URL || "https://api.inspirecollege.lk").replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3110").replace(/\/$/, "");

export type Course = {
  id: number; key: string; slug: string; title: string; short: string; level: string; school: string; body: string;
  plan_type: string; duration: string; fee: number; fee_label: string; monthly_label: string; cpd_addon_fee: number | null;
  image: string; blurb: string; keywords: string; card_type: string; featured: boolean; sort_order: number;
  detail: Record<string, unknown>; seo_title: string; seo_description: string;
};
export type News = { id: number; slug: string; title: string; excerpt: string; body: string; category: string; image: string; video_url: string; video_orientation?: string; video_poster_url?: string; published_at: string };
export type Settings = {
  announcement_enabled: boolean; announcement_text: string; announcement_link: string; christmas_theme: boolean;
  hero_slides: unknown[]; promo_banner: { enabled: boolean; title: string; text: string; cta: string; link: string; image: string };
  contact: { whatsapp_main: string; whatsapp_advisor: string; phone_display: string; email: string };
  theme: { palette: string; shape: string; font: string };
  tracking: Record<string, string>;
  default_campaign: string;
  home_extra_cards: Record<string, string>[];
  seo: { site_name: string; default_description: string };
};
export type Bundle = {
  settings: Settings;
  fee_plans: Record<string, unknown[]>;
  courses: Course[];
  testimonials: { name: string; role: string; image: string; image_pos: string; video_url: string; caption: string }[];
  leaders: { name: string; role: string; initials: string; photo?: string; photo_pos?: string; bio?: string }[];
  faqs: { audience: string; question: string; answer: string }[];
  campaigns: { key: string; tag: string; text: string; short: string; perk: string }[];
  news: News[];
};

export async function backendGet<T>(path: string, revalidate = 60): Promise<T> {
  const r = await fetch(BACKEND_URL + path, { next: { revalidate } });
  if (!r.ok) throw new Error(`Backend ${path} -> ${r.status}`);
  return r.json() as Promise<T>;
}

export async function getBundle(): Promise<Bundle> {
  return backendGet<Bundle>("/api/v1/public/web/bundle", 60);
}

export async function getNewsList(): Promise<News[]> {
  return backendGet<News[]>("/api/v1/public/web/news", 300);
}

export async function getNewsItem(slug: string): Promise<News | null> {
  const r = await fetch(`${BACKEND_URL}/api/v1/public/web/news/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
  return r.ok ? r.json() : null;
}

export type DemoMe = { user: { name: string; email: string }; expires_at: string; state: Record<string, unknown> | null; classes?: Record<string, unknown>[] };

export async function getDemoMe(token: string | undefined): Promise<DemoMe | null> {
  const s = await demoSession(token);
  return s.me;
}

/** Demo login check that tells "not signed in" apart from "backend unreachable" (e.g. the free Render API waking up),
 *  so a sleeping backend never logs the student out. */
export async function demoSession(token: string | undefined): Promise<{ me: DemoMe | null; unavailable: boolean }> {
  if (!token) return { me: null, unavailable: false };
  try {
    const r = await fetch(BACKEND_URL + "/api/v1/public/web/demo/me", { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (r.ok) return { me: (await r.json()) as DemoMe, unavailable: false };
    if (r.status === 401 || r.status === 403 || r.status === 404) return { me: null, unavailable: false };
    return { me: null, unavailable: true };   // 5xx / gateway: backend starting or down
  } catch {
    return { me: null, unavailable: true };   // timeout / network
  }
}
