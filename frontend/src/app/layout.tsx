import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA Prediction Lab",
  description: "Live NBA win probabilities from an Elo + form model, with power rankings, team deep-dives and a matchup lab.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request so pages are sent with Cache-Control: no-cache. Behind Firebase Hosting's CDN,
  // a prerendered page would be cached for a year and keep pointing at JS files from an old deploy.
  await connection();
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
