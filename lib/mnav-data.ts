import rawSeries from "@/data/processed/mstr-mnav.json";
import type { MnavRecord, RangeOption } from "@/lib/types";

export const timeSeries = rawSeries as MnavRecord[];

export const rangeConfig: RangeOption[] = [
  { label: "1M", value: "1M", days: 30 },
  { label: "3M", value: "3M", days: 90 },
  { label: "6M", value: "6M", days: 180 },
  { label: "1Y", value: "1Y", days: 365 },
  { label: "All", value: "All", days: null },
];

export function latestSummary() {
  return timeSeries.at(-1) ?? null;
}
