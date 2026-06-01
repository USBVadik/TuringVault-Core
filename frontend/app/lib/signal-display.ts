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
  strategyData?: any;
  marketData?: any;
  perfData?: any;
  signalMode?: MethSignalMode | string;
  fallbackEthPrice?: number;
}

export interface MethSignalDisplay {
  channelLooksEth: boolean;
  referenceLabel: string;
  referencePrice: number;
  referencePriceLabel: string;
  markerLeft: number;
  support: number;
  resistance: number;
  priceAtChannelPct: (pct: number) => number | null;
}

export const deriveMethSignalDisplay: (
  input: MethSignalDisplayInput
) => MethSignalDisplay = shared.deriveMethSignalDisplay;

export const formatSignalPrice: (price: number | null | undefined) => string =
  shared.formatSignalPrice;
