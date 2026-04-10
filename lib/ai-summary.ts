import type { MnavRecord, RangeOption } from "@/lib/types";

export type SummaryRangeValue = RangeOption["value"];

export type SummaryMetrics = {
  range: SummaryRangeValue;
  latestTradingDate: string;
  sessions: number;
  latestMnav: number;
  mnavChange: number;
  latestBtcPrice: number;
  btcPriceChange: number;
  latestStockPrice: number;
  stockPriceChange: number;
  latestBtcHoldings: number;
  btcHoldingsChange: number;
};

function percentageChange(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return 0;
  return end / start - 1;
}

export function buildSummaryMetrics(
  data: MnavRecord[],
  range: SummaryRangeValue,
): SummaryMetrics | null {
  const first = data[0];
  const latest = data.at(-1);

  if (!first || !latest) return null;

  return {
    range,
    latestTradingDate: latest.date,
    sessions: data.length,
    latestMnav: latest.mnav,
    mnavChange: percentageChange(first.mnav, latest.mnav),
    latestBtcPrice: latest.btcPrice,
    btcPriceChange: percentageChange(first.btcPrice, latest.btcPrice),
    latestStockPrice: latest.stockPrice,
    stockPriceChange: percentageChange(first.stockPrice, latest.stockPrice),
    latestBtcHoldings: latest.btcHoldings,
    btcHoldingsChange: percentageChange(first.btcHoldings, latest.btcHoldings),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidRange(value: unknown): value is SummaryRangeValue {
  return value === "1M" || value === "3M" || value === "6M" || value === "1Y" || value === "All";
}

export function isSummaryMetrics(value: unknown): value is SummaryMetrics {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    isValidRange(candidate.range) &&
    typeof candidate.latestTradingDate === "string" &&
    isFiniteNumber(candidate.sessions) &&
    isFiniteNumber(candidate.latestMnav) &&
    isFiniteNumber(candidate.mnavChange) &&
    isFiniteNumber(candidate.latestBtcPrice) &&
    isFiniteNumber(candidate.btcPriceChange) &&
    isFiniteNumber(candidate.latestStockPrice) &&
    isFiniteNumber(candidate.stockPriceChange) &&
    isFiniteNumber(candidate.latestBtcHoldings) &&
    isFiniteNumber(candidate.btcHoldingsChange)
  );
}
