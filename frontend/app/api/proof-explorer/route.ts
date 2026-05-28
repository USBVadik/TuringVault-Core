import { NextResponse } from "next/server";
import { fetchProofDataDirect } from "../../lib/proof-data";

// Intentional design: proof-explorer performs expensive on-chain reads
// (multiple contract calls + IPFS fetch). s-maxage=30 with stale-while-revalidate
// gives users fresh-enough data without hammering RPC on every page load.
// This route is NOT force-dynamic because the 30s cache is beneficial here.

export async function GET() {
  try {
    const data = await fetchProofDataDirect();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Proof Explorer API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch on-chain data", details: message },
      { status: 500 }
    );
  }
}
