// eslint-disable-next-line @typescript-eslint/no-require-imports
const shared = require("./signal-display.shared.js");

export type MethSignalMode =
  | "risk-on"
  | "risk-off"
  | "blocked"
  | "stale"
  | "watch"
  | "waiting";

export interface MethSignalDisplayInput {
  latestDecision?: any;
  targetAsset?: string | null;
  sourceAsset?: string | null;
  strategyData?: any;
  marketData?: any;
  perfData?: any;
  signalMode?: MethSignalMode | string;
  fallbackEthPrice?: number;
  fallbackMntPrice?: number;
  baseAsset?: "mETH" | "MNT";
}

export interface MethSignalDisplay {
  baseAsset: "mETH" | "MNT";
  displayAsset: string;
  gridLabel: string;
  axisLeft: string;
  axisRight: string;
  channelLooksEth: boolean;
  channelLooksMnt: boolean;
  channelLooksPrimary: boolean;
  referenceLabel: string;
  referencePrice: number;
  referencePriceLabel: string;
  markerLeft: number;
  support: number;
  resistance: number;
  priceAtChannelPct: (pct: number) => number | null;
}

export const deriveSignalDisplay: (
  input: MethSignalDisplayInput
) => MethSignalDisplay = shared.deriveSignalDisplay;

export const deriveMethSignalDisplay: (
  input: MethSignalDisplayInput
) => MethSignalDisplay = shared.deriveMethSignalDisplay;

export const formatSignalPrice: (price: number | null | undefined) => string =
  shared.formatSignalPrice;
