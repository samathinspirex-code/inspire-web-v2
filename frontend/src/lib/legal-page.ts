import { getBundle } from "./backend";
import { chromePage, esc } from "./chrome";
import { LEGAL } from "./legal";

export function legalHandler(key: string) {
  return async function GET(): Promise<Response> {
    const b = await getBundle();
    const p = LEGAL[key];
    const sections = p.sections
      .map((s) => `<h2>${esc(s.title)}</h2>${(s.paragraphs || []).map((x) => `<p>${esc(x)}</p>`).join("")}${s.bullets ? `<ul>${s.bullets.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`)
      .join("");
    return chromePage(
      b,
      { path: "/" + key, title: `${p.title} | Inspire College`, description: p.introduction },
      `<article class="page body"><span class="eyebrow">${esc(p.eyebrow)}</span><h1>${esc(p.title)}</h1><p class="lead">${esc(p.introduction)}</p>${sections}</article>`,
    );
  };
}
