import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atmospherica — Can you feel what they felt?",
  description:
    "Someone described a feeling. AI turned it into music. Can you guess what they were feeling?",
  openGraph: {
    title: "Atmospherica",
    description: "Can you feel what they felt? Guess the emotion behind the music.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full antialiased ${playfair.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}
