export type MnavRecord = {
  date: string;
  ticker: string;
  companyName: string;
  stockPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  btcPrice: number;
  btcHoldings: number;
  btcNav: number;
  mnav: number;
};

export type RangeOption = {
  label: string;
  value: "1M" | "3M" | "6M" | "1Y" | "All";
  days: number | null;
};

export type TreasuryEvent = {
  date: string;
  btcHoldings: number;
  label: string;
  source: string;
};

export type IndicatorKey = "mnav" | "btcPrice" | "stockPrice" | "btcNav" | "btcHoldings";
