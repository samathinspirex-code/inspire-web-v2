// One place that knows which design page + SEO each public URL uses.
import { getBundle, type Bundle } from "./backend";
import { renderDesignPage, type RenderOpts, type Seo } from "./render";

const SITE = "Inspire College";
export const DEFAULT_DESC =
  "100% online UK-regulated ATHE qualifications, HNDs, Foundations, top-up degrees, postgraduate and CPD courses. Live classes, AI study buddy and a free demo class.";

export function designHandler(page: string, make: (b: Bundle) => Omit<RenderOpts, "seo"> & { seo: Partial<Seo> & { path: string } }) {
  return async function GET(): Promise<Response> {
    const b = await getBundle();
    const o = make(b);
    const seo: Seo = { title: SITE, description: b.settings.seo?.default_description || DEFAULT_DESC, ...o.seo } as Seo;
    return renderDesignPage(page, b, { ...o, seo });
  };
}

// Catalogue landing pages (same URLs as the current site) open the Program page on a level.
export function levelHandler(path: string, lvl: string, title: string, description: string) {
  return designHandler("Program", () => ({ seo: { path, title: `${title} | ${SITE}`, description }, data: { lvl } }));
}
