import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Presumptuous Learning", template: "%s · Presumptuous Learning" },
  description: "Overreaching is how students get ahead. Assessment, daily plans and coaching for every subject in the Ontario curriculum.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#242426" }, { media: "(prefers-color-scheme: light)", color: "#F4F4F2" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
