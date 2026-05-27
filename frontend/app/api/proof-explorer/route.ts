import { NextResponse } from "next/server";
import { fetchProofDataDirect } from "../../lib/proof-data";

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
