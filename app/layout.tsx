import type { Metadata } from "next";
import { readStudio } from "@/lib/studio-store";
import "./globals.css";
import "./studio.css";
import "./refinements.css";
import "./october-updates.css";

const fallbackIcon = "/favicon.svg";

export async function generateMetadata(): Promise<Metadata> {
  let icon = fallbackIcon;
  try {
    const logo = (await readStudio()).live.settings.logo?.url;
    if (logo)
      icon = logo;
  }
  catch {
    icon = fallbackIcon;
  }
  return {
    title: "Julie Sufi | Melbourne Bridal Couture",
    description: "Made-to-measure bridal couture, designed in Melbourne.",
    other: {
      "codex-preview": "development",
    },
    icons: {
      icon,
      shortcut: icon,
      apple: icon,
    },
  };
}

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
