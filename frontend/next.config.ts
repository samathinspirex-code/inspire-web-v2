import type { NextConfig } from "next";

// Same redirect tables as the current site (copied from inspire-ui-host), so old links and Google results keep working.
import { currentProgramPath, LEGACY_PROGRAM_SLUGS } from "./src/lib/legacySlugs";
import { oldSiteRedirects } from "./src/lib/redirects";

const PUBLIC_ASSET_CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Design page templates are read from disk by the route handlers.
  outputFileTracingIncludes: { "/**": ["./src/site/**/*"] },
  async redirects() {
    return [
      { source: "/free-counselling", destination: "/contact#contact-form", permanent: false },
      ...Object.entries(LEGACY_PROGRAM_SLUGS).map(([from, to]) => ({ source: `/programs/${from}`, destination: `/programs/${to}`, permanent: true })),
      ...oldSiteRedirects.map((r) => ({ ...r, destination: currentProgramPath(r.destination) })),
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Hosted preview (SITE_NOINDEX=1): keep it out of Google so it never competes with inspirecollege.lk.
          ...(process.env.SITE_NOINDEX === "1" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
        ],
      },
      { source: "/:file*\\.(png|jpg|jpeg|webp|avif|gif|svg|ico|woff2|ttf|mp4)", headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }] },
    ];
  },
};

export default nextConfig;
