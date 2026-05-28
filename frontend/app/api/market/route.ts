import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENDPOINTS = {
  COINGECKO_ETH:
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle&vs_currencies=usd&include_24hr_change=true",
  FEAR_GREED: "https://api.alternative.me/fng/?limit=1",
  DEFILLAMA_TVL: "https://api.llama.fi/v2/chains",
  DEFILLAMA_YIELDS: "https://yields.llama.fi/pools",
};

export async function GET() {
  try {
    const [priceRes, fgRes, tvlRes] = await Promise.all([
      fetch(ENDPOINTS.COINGECKO_ETH)
        .then((r) => r.json())
        .catch(() => null),
      fetch(ENDPOINTS.FEAR_GREED)
        .then((r) => r.json())
        .catch(() => null),
      fetch(ENDPOINTS.DEFILLAMA_TVL)
        .then((r) => r.json())
        .catch(() => null),
    ]);

    const ethPrice = priceRes?.ethereum?.usd || 0;
    const ethChange24h = priceRes?.ethereum?.usd_24h_change || 0;
    const mantlePrice = priceRes?.mantle?.usd || 0;

    const fgValue = parseInt(fgRes?.data?.[0]?.value || "50");
    let sentiment = "neutral";
    if (fgValue <= 20) sentiment = "extreme_fear";
    else if (fgValue <= 40) sentiment = "bearish";
    else if (fgValue <= 60) sentiment = "neutral";
    else if (fgValue <= 80) sentiment = "bullish";
    else sentiment = "extreme_greed";

    const mantle = tvlRes?.find((c: any) => c.name === "Mantle");
    const mantleTVL = mantle?.tvl || 0;
    const mantleTVLChange1d = mantle?.change_1d || 0;

    return NextResponse.json({
      ethPrice,
      ethChange24h,
      mantlePrice,
      mETHYield: 3.8, // placeholder until DeFiLlama yields parsed
      mETHPool: "mETH",
      sentiment,
      fearGreedValue: fgValue,
      smartMoneyFlow: Math.round(mantleTVL * (mantleTVLChange1d / 100)),
      volatility: Math.min(Math.abs(ethChange24h) / 10, 1.0),
      mantleTVL,
      mantleTVLChange1d,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
