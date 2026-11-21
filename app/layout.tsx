import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_SC, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  weight: ["400", "600", "700"],
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
});

const notoSansTamil = Noto_Sans_Tamil({
  weight: ["400", "600", "700"],
  variable: "--font-noto-tamil",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "My Schedule",
  description: "A simple schedule with reminders.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang is updated on the client once the saved language is read.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${notoSans.variable} ${notoSansSC.variable} ${notoSansTamil.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
