import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "TuringVault — AI-Managed RWA Router",
  description: "Autonomous AI agent managing real-world assets on Mantle Network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrains.variable} font-mono bg-[#0a0a0f] text-gray-200 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
