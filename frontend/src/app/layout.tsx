// Root layout (Next requires one). Website pages are served by route handlers; there are no React pages.
export const metadata = { title: "Inspire College", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
