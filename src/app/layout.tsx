import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  // Without a base, every relative URL in metadata resolves against localhost
  // once this is deployed — shared links would point at nothing.
  metadataBase: new URL(siteUrl),
  title: "What's for Dinner?",
  description: "Your household decides together, one vote a night.",
  applicationName: "What's for Dinner?",
  // Phone-first, so it should behave when someone adds it to their home screen.
  appleWebApp: { capable: true, title: "Dinner", statusBarStyle: "default" },
  openGraph: {
    title: "What's for Dinner?",
    description: "Your household decides together, one vote a night.",
    url: siteUrl,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6efdf",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
