import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import SolanaProviders from "@/components/wallet/SolanaProviders";
import BridgeModePill from "@/components/BridgeModePill";
import DemoDisclaimer from "@/components/DemoDisclaimer";
import LiveTicker from "@/components/live/LiveTicker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display face — used for the wordmark + section headlines. Tighter, more
// editorial than Inter; gives Shopier its own typographic voice without
// trading off readability.
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Shopier — Buys clothes for you in real time on Solana",
  description:
    "A multi-agent trust container. Your agent — built on your likeness via a digital twin — settles purchases under an on-chain spending policy. Four agents collaborate; every one operates inside a bound it cannot exceed.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} h-full dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        <SolanaProviders>
          <LiveTicker />
          {children}
          <BridgeModePill />
          <DemoDisclaimer />
        </SolanaProviders>
      </body>
    </html>
  );
}
