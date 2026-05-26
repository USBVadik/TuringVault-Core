import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "./components/Navbar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TuringVault — Proof-of-Reasoning Trust Firewall",
  description: "Autonomous AI agents make verifiable on-chain RWA decisions via Proof-of-Reasoning — three-model adversarial consensus (GLM-5 + Claude 4.6 + Gemini 3.5) on Mantle Mainnet, fully auditable.",
  metadataBase: new URL("https://frontend-seven-beta-46.vercel.app"),
  openGraph: {
    title: "TuringVault — Proof-of-Reasoning Trust Firewall",
    description: "Autonomous AI agents make verifiable on-chain RWA decisions via Proof-of-Reasoning — three-model adversarial consensus on Mantle Mainnet, fully auditable.",
    url: "https://frontend-seven-beta-46.vercel.app",
    siteName: "TuringVault",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TuringVault — AI-Driven DeFi on Mantle",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TuringVault — Proof-of-Reasoning Trust Firewall",
    description: "Autonomous AI agents make verifiable on-chain RWA decisions via Proof-of-Reasoning — three-model adversarial consensus on Mantle Mainnet.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-[#06060e] text-gray-200 min-h-screen antialiased`}>
        <Providers>
          <Navbar />
          <div className="pt-14">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
