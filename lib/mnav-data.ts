import rawSeries from "@/data/processed/mstr-mnav.json";
import rawHoldings from "@/data/raw/mstr-holdings-history.json";
import type { MnavRecord, RangeOption, TreasuryEvent } from "@/lib/types";

export const timeSeries = rawSeries as MnavRecord[];
type RawTreasuryEvent = Omit<TreasuryEvent, "label">;

export const treasuryEvents = (rawHoldings as RawTreasuryEvent[]).map((event) => ({
  ...event,
  label: `${event.btcHoldings.toLocaleString("en-US")} BTC`,
}));

export const rangeConfig: RangeOption[] = [
  { label: "1M", value: "1M", days: 30 },
  { label: "3M", value: "3M", days: 90 },
  { label: "6M", value: "6M", days: 180 },
  { label: "1Y", value: "1Y", days: 365 },
  { label: "All", value: "All", days: null },
];

type CoverageGap = {
  from: string;
  to: string;
  missingDates: string[];
  note: string;
};

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getMissingDates(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  const dates: string[] = [];

  for (let cursor = startTime + 24 * 60 * 60 * 1000; cursor < endTime; cursor += 24 * 60 * 60 * 1000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }

  return dates;
}

function describeGap(missingDates: string[]) {
  const weekendDates = missingDates.filter((date) => {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
  });
  const weekdayDates = missingDates.filter((date) => !weekendDates.includes(date));

  if (weekdayDates.length === 0) {
    return `Weekend gap: ${missingDates.map(formatShortDate).join(", ")}`;
  }

  if (weekdayDates.length === 1) {
    const closure = formatShortDate(weekdayDates[0]);
    const weekendPart =
      weekendDates.length > 0 ? `; weekend ${weekendDates.map(formatShortDate).join(", ")}` : "";
    return `Market closure on ${closure}${weekendPart}`;
  }

  return `Multi-session market gap: ${missingDates.map(formatShortDate).join(", ")}`;
}

function analyzeCoverage(data: MnavRecord[]) {
  const gaps: CoverageGap[] = [];

  for (let index = 1; index < data.length; index += 1) {
    const previous = data[index - 1];
    const current = data[index];
    const missingDates = getMissingDates(previous.date, current.date);

    if (missingDates.length === 0) continue;

    gaps.push({
      from: previous.date,
      to: current.date,
      missingDates,
      note: describeGap(missingDates),
    });
  }

  const latestGap = gaps.at(-1) ?? null;

  return {
    latestTradingDate: data.at(-1)?.date ?? null,
    latestGap,
    tradingCadenceNote: "Series is keyed to U.S. stock-market sessions. Non-trading days are skipped.",
  };
}

export const coverageInfo = analyzeCoverage(timeSeries);

export function latestSummary() {
  return timeSeries.at(-1) ?? null;
}
