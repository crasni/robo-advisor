import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const HOLDINGS_PATH = path.join(ROOT, "data/raw/mstr-holdings-history.json");
const PROFILE_PATH = path.join(ROOT, "data/raw/mstr-company-profile.json");
const OUTPUT_PATH = path.join(ROOT, "data/processed/mstr-mnav.json");

const STOCK_SOURCE = "https://api.nasdaq.com/api/quote/MSTR/historical";
const BTC_SOURCE = "https://api.binance.com/api/v3/klines";
const BTC_SERIES_START = "2020-08-11";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fetchStockSeries() {
  const rows = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const url = new URL(STOCK_SOURCE);
    url.searchParams.set("assetclass", "stocks");
    url.searchParams.set("fromdate", BTC_SERIES_START);
    url.searchParams.set("todate", new Date().toISOString().slice(0, 10));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const pageRows = payload?.data?.tradesTable?.rows ?? [];
    if (!Array.isArray(pageRows) || pageRows.length === 0) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows.reverse().map((row) => ({
    date: normalizeNasdaqDate(row.date),
    close: Number.parseFloat(String(row.close).replaceAll("$", "").replaceAll(",", "")),
  }));
}

function normalizeNasdaqDate(value) {
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function fetchBtcSeries() {
  const startTime = new Date(`${BTC_SERIES_START}T00:00:00Z`).getTime();
  const endTime = Date.now();
  const prices = new Map();
  let cursor = startTime;

  while (cursor < endTime) {
    const url = new URL(BTC_SOURCE);
    url.searchParams.set("symbol", "BTCUSDT");
    url.searchParams.set("interval", "1d");
    url.searchParams.set("limit", "1000");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(endTime));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const date = new Date(row[0]).toISOString().slice(0, 10);
      const close = Number.parseFloat(row[4]);
      prices.set(date, close);
    }

    const lastOpenTime = rows.at(-1)?.[0];
    if (!lastOpenTime) {
      break;
    }

    cursor = Number(lastOpenTime) + ONE_DAY_MS;
  }

  return prices;
}

function latestHoldingsForDate(holdingsTimeline, date) {
  let current = holdingsTimeline[0];
  for (const item of holdingsTimeline) {
    if (item.date <= date) {
      current = item;
      continue;
    }
    break;
  }
  return current?.btcHoldings ?? null;
}

function buildSeries({ stockRows, btcSeries, profile, holdingsTimeline }) {
  return stockRows
    .filter((row) => row.date && row.close)
    .map((row) => {
      const date = row.date;
      const btcPrice = btcSeries.get(date);
      const btcHoldings = latestHoldingsForDate(holdingsTimeline, date);

      if (!btcPrice || !btcHoldings) {
        return null;
      }

      const stockPrice = row.close;
      const marketCap = stockPrice * profile.sharesOutstanding;
      const btcNav = btcPrice * btcHoldings;
      const mnav = marketCap / btcNav;

      return {
        date,
        ticker: profile.ticker,
        companyName: profile.companyName,
        stockPrice: Number(stockPrice.toFixed(2)),
        sharesOutstanding: profile.sharesOutstanding,
        marketCap: Number(marketCap.toFixed(2)),
        btcPrice: Number(btcPrice.toFixed(2)),
        btcHoldings,
        btcNav: Number(btcNav.toFixed(2)),
        mnav: Number(mnav.toFixed(6)),
      };
    })
    .filter(Boolean);
}

async function main() {
  const [holdingsTimeline, profile, stockRows, btcSeries] = await Promise.all([
    readJson(HOLDINGS_PATH),
    readJson(PROFILE_PATH),
    fetchStockSeries(),
    fetchBtcSeries(),
  ]);

  const output = buildSeries({ stockRows, btcSeries, profile, holdingsTimeline });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${output.length} records to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
