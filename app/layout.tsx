import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
import "./refinements.css";
import "./october-updates.css";

export const metadata: Metadata = {
  title: "Julie Sufi | Melbourne Bridal Couture",
  description: "Made-to-measure bridal couture, designed in Melbourne.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
