"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  bybitWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";

// ─── Chains ─────────────────────────────────────────────────────────
const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
  blockExplorers: {
    default: { name: "MantleScan", url: "https://explorer.sepolia.mantle.xyz" },
  },
  testnet: true,
});

const mantleMainnet = defineChain({
  id: 5000,
  name: "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mantle.xyz"] } },
  blockExplorers: {
    default: { name: "MantleScan", url: "https://mantlescan.xyz" },
  },
});

// ─── Wallet connectors ──────────────────────────────────────────────
// Bybit Wallet is featured as the primary recommended connector — this is
// our hackathon-aligned partner integration. See
// `node_modules/@rainbow-me/rainbowkit/dist/wallets/walletConnectors/bybitWallet/`
// for the connector source. WalletConnect projectId is reused from the prior
// generic config so existing test connections do not break.
const projectId = "4bbc4a3e3e36d2e28cf769726eb36313";
const appName = "TuringVault";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [bybitWallet, metaMaskWallet, walletConnectWallet],
    },
    {
      groupName: "Other",
      wallets: [rabbyWallet, rainbowWallet, coinbaseWallet, injectedWallet],
    },
  ],
  { appName, projectId }
);

const config = createConfig({
  connectors,
  chains: [mantleMainnet, mantleSepolia],
  transports: {
    [mantleMainnet.id]: http("https://rpc.mantle.xyz"),
    [mantleSepolia.id]: http("https://rpc.sepolia.mantle.xyz"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00ff88",
            accentColorForeground: "#000",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
