// Root layout for the React pages (the website CMS at /admin). Website pages are served by route handlers.
export const metadata = { title: "Inspire Website CMS", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
