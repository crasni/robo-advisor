import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { alignSharesWithSplitAdjustedPrices } from "./share-adjustments.mjs";

const ROOT = process.cwd();
const HOLDINGS_PATH = path.join(ROOT, "data/raw/mstr-holdings-history.json");
const SHARES_PATH = path.join(ROOT, "data/raw/mstr-shares-history.json");
const PROCESSED_PATH = path.join(ROOT, "data/processed/mstr-mnav.json");
const START_DATE = "2020-08-11";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HOLDINGS_STALENESS_WARNING_DAYS = 45;
const SHARES_STALENESS_WARNING_DAYS = 120;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureAscending(rows, dateKey, label) {
  const seen = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    assert(typeof row[dateKey] === "string", `${label} row ${index} is missing ${dateKey}.`);
    if (index > 0) {
      assert(
        rows[index - 1][dateKey] < row[dateKey],
        `${label} must be strictly ascending by ${dateKey}. Problem around ${row[dateKey]}.`,
      );
    }
    assert(!seen.has(row[dateKey]), `${label} contains a duplicate ${dateKey}: ${row[dateKey]}.`);
    seen.add(row[dateKey]);
  }
}

function valueForDate(timeline, date, valueKey) {
  let current = timeline[0];

  for (const row of timeline) {
    if (row.date <= date) {
      current = row;
      continue;
    }
    break;
  }

  return current?.[valueKey] ?? null;
}

function preparedSharesTimeline(rawShares) {
  const normalizedShares = alignSharesWithSplitAdjustedPrices(rawShares);
  if (normalizedShares[0]?.date <= START_DATE) return normalizedShares;

  return [
    {
      date: START_DATE,
      sharesOutstanding: normalizedShares[0].sharesOutstanding,
    },
    ...normalizedShares,
  ];
}

function approxEqual(left, right, tolerance = 0.000001) {
  return Math.abs(left - right) <= tolerance;
}

function daysBetween(start, end) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((endTime - startTime) / ONE_DAY_MS);
}

async function main() {
  const [holdings, rawShares, processed] = await Promise.all([
    readJson(HOLDINGS_PATH),
    readJson(SHARES_PATH),
    readJson(PROCESSED_PATH),
  ]);

  assert(Array.isArray(holdings) && holdings.length > 0, "Holdings history is empty.");
  assert(Array.isArray(rawShares) && rawShares.length > 0, "Share history is empty.");
  assert(Array.isArray(processed) && processed.length > 0, "Processed dataset is empty.");

  ensureAscending(holdings, "date", "Holdings history");
  ensureAscending(rawShares, "date", "Share history");
  ensureAscending(processed, "date", "Processed dataset");

  const shares = preparedSharesTimeline(rawShares);
  const latestMarketDate = processed.at(-1)?.date ?? null;
  const latestHoldingsDate = holdings.at(-1)?.date ?? null;
  const latestSharesDate = rawShares.at(-1)?.date ?? null;

  let warnings = 0;
  if (rawShares[0].date > START_DATE) {
    console.warn(
      `Warning: share history begins at ${rawShares[0].date}; earlier dates are backfilled from the earliest available SEC-derived value.`,
    );
    warnings += 1;
  }
  if (latestMarketDate && latestHoldingsDate) {
    const holdingsAge = daysBetween(latestHoldingsDate, latestMarketDate);
    if (holdingsAge > HOLDINGS_STALENESS_WARNING_DAYS) {
      console.warn(
        `Warning: holdings history ends on ${latestHoldingsDate}, which is ${holdingsAge} day(s) before the latest market row ${latestMarketDate}. mNAV will understate BTC NAV until the holdings timeline is refreshed.`,
      );
      warnings += 1;
    }
  }
  if (latestMarketDate && latestSharesDate) {
    const sharesAge = daysBetween(latestSharesDate, latestMarketDate);
    if (sharesAge > SHARES_STALENESS_WARNING_DAYS) {
      console.warn(
        `Warning: share history ends on ${latestSharesDate}, which is ${sharesAge} day(s) before the latest market row ${latestMarketDate}. Recent market-cap rows may miss new share issuance.`,
      );
      warnings += 1;
    }
  }

  for (const row of processed) {
    assert(Number.isFinite(row.stockPrice) && row.stockPrice > 0, `Invalid stockPrice on ${row.date}.`);
    assert(Number.isFinite(row.btcPrice) && row.btcPrice > 0, `Invalid btcPrice on ${row.date}.`);
    assert(Number.isFinite(row.btcHoldings) && row.btcHoldings > 0, `Invalid btcHoldings on ${row.date}.`);
    assert(Number.isFinite(row.sharesOutstanding) && row.sharesOutstanding > 0, `Invalid sharesOutstanding on ${row.date}.`);
    assert(Number.isFinite(row.marketCap) && row.marketCap > 0, `Invalid marketCap on ${row.date}.`);
    assert(Number.isFinite(row.btcNav) && row.btcNav > 0, `Invalid btcNav on ${row.date}.`);
    assert(Number.isFinite(row.mnav) && row.mnav > 0, `Invalid mnav on ${row.date}.`);

    const expectedHoldings = valueForDate(holdings, row.date, "btcHoldings");
    const expectedShares = valueForDate(shares, row.date, "sharesOutstanding");

    assert(expectedHoldings !== null, `No holdings value available for ${row.date}.`);
    assert(expectedShares !== null, `No share-count value available for ${row.date}.`);
    assert(
      row.btcHoldings === expectedHoldings,
      `Holdings mismatch on ${row.date}: dataset=${row.btcHoldings}, expected=${expectedHoldings}.`,
    );
    assert(
      row.sharesOutstanding === expectedShares,
      `Share-count mismatch on ${row.date}: dataset=${row.sharesOutstanding}, expected=${expectedShares}.`,
    );

    const expectedMarketCap = Number((row.stockPrice * row.sharesOutstanding).toFixed(2));
    const expectedBtcNav = Number((row.btcPrice * row.btcHoldings).toFixed(2));
    const expectedMnav = Number((expectedMarketCap / expectedBtcNav).toFixed(6));

    assert(
      approxEqual(row.marketCap, expectedMarketCap, 0.01),
      `Market-cap mismatch on ${row.date}: dataset=${row.marketCap}, expected=${expectedMarketCap}.`,
    );
    assert(
      approxEqual(row.btcNav, expectedBtcNav, 0.01),
      `BTC NAV mismatch on ${row.date}: dataset=${row.btcNav}, expected=${expectedBtcNav}.`,
    );
    assert(
      approxEqual(row.mnav, expectedMnav, 0.000001),
      `mNAV mismatch on ${row.date}: dataset=${row.mnav}, expected=${expectedMnav}.`,
    );
  }

  console.log(`Validated ${processed.length} processed rows against holdings and share timelines.`);
  console.log(`Share history rows: ${rawShares.length}. Holdings rows: ${holdings.length}.`);
  if (warnings === 0) {
    console.log("No validation warnings.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
