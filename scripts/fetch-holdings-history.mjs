import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "data/raw/mstr-holdings-history.json");
const PRESS_RELEASE_FALLBACK_PATH = path.join(ROOT, "data/raw/mstr-holdings-press-releases.json");

const PURCHASES_URL = "https://www.strategy.com/purchases";
const SHARES_URL = "https://www.strategy.com/shares";
const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0",
  accept: "text/html,application/xhtml+xml",
};
const NEXT_DATA_START = '<script id="__NEXT_DATA__" type="application/json">';
const NEXT_DATA_END = "</script>";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fetchHtml(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError;
}

function extractNextData(html, url) {
  const startIndex = html.indexOf(NEXT_DATA_START);
  if (startIndex === -1) {
    throw new Error(`Could not find __NEXT_DATA__ payload in ${url}`);
  }

  const contentStart = startIndex + NEXT_DATA_START.length;
  const endIndex = html.indexOf(NEXT_DATA_END, contentStart);
  if (endIndex === -1) {
    throw new Error(`Could not find the end of the __NEXT_DATA__ payload in ${url}`);
  }

  return JSON.parse(html.slice(contentStart, endIndex));
}

function normalizeDate(value) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDateFromSecFilename(filename) {
  if (typeof filename !== "string") return null;
  const match = filename.match(/_(\d{2})-(\d{2})-(\d{4})\.pdf$/i);
  if (!match) return null;

  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

function normalizePositiveInteger(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replaceAll(",", ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function validateTimeline(rows, label) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${label} is empty.`);
  }

  let previousDate = null;

  for (const row of rows) {
    if (!row?.date || !row?.btcHoldings || row.btcHoldings <= 0) {
      throw new Error(`Invalid holdings row in ${label}: ${JSON.stringify(row)}`);
    }

    if (previousDate && row.date <= previousDate) {
      throw new Error(`${label} must be strictly ascending by date. Problem around ${row.date}.`);
    }

    previousDate = row.date;
  }
}

function dedupeAndSort(rows) {
  const deduped = [...new Map(rows.map((row) => [row.date, row])).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  validateTimeline(deduped, "Holdings history output");
  return deduped;
}

function parsePurchasesPayload(payload) {
  const rows = payload?.props?.pageProps?.bitcoinData;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Strategy purchases payload is missing pageProps.bitcoinData.");
  }

  const parsedRows = rows
    .map((row) => {
      const btcHoldings = normalizePositiveInteger(row?.btc_holdings);
      const date =
        normalizeDateFromSecFilename(row?.sec?.filename) ??
        normalizeDate(row?.date) ??
        normalizeDate(row?.date_of_purchase);

      if (!date || !btcHoldings) {
        return null;
      }

      return {
        date,
        btcHoldings,
        source: row?.sec?.url || PURCHASES_URL,
        sourceKind: "strategy-purchases",
        title: row?.title ?? null,
        dateOfPurchase: normalizeDate(row?.date_of_purchase),
      };
    })
    .filter(Boolean);

  return dedupeAndSort(parsedRows);
}

function parseSharesPayload(payload) {
  const rows = payload?.props?.pageProps?.shares;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Strategy shares payload is missing pageProps.shares.");
  }

  const parsedRows = rows
    .map((row) => {
      const date = normalizeDate(row?.date);
      const btcHoldings = normalizePositiveInteger(row?.total_bitcoin_holdings);

      if (!date || !btcHoldings) {
        return null;
      }

      return {
        date,
        btcHoldings,
        source: SHARES_URL,
        sourceKind: "strategy-shares",
        title: row?.title ?? null,
      };
    })
    .filter(Boolean);

  return dedupeAndSort(parsedRows);
}

async function fetchHoldingsFromPurchases() {
  const html = await fetchHtml(PURCHASES_URL);
  return parsePurchasesPayload(extractNextData(html, PURCHASES_URL));
}

async function fetchHoldingsFromShares() {
  const html = await fetchHtml(SHARES_URL);
  return parseSharesPayload(extractNextData(html, SHARES_URL));
}

async function readPressReleaseFallback() {
  const rows = await readJson(PRESS_RELEASE_FALLBACK_PATH);
  const normalizedRows = rows.map((row) => ({
    ...row,
    sourceKind: "press-release-fallback",
  }));

  return dedupeAndSort(normalizedRows);
}

async function loadHoldingsHistory() {
  try {
    const purchases = await fetchHoldingsFromPurchases();
    return {
      rows: purchases,
      mode: "strategy-purchases",
      note: `Loaded ${purchases.length} holdings snapshots from ${PURCHASES_URL}`,
    };
  } catch (purchasesError) {
    console.warn(
      `[holdings] Strategy purchases parse failed: ${purchasesError instanceof Error ? purchasesError.message : String(purchasesError)}`,
    );
  }

  try {
    const shares = await fetchHoldingsFromShares();
    return {
      rows: shares,
      mode: "strategy-shares",
      note: `Loaded ${shares.length} holdings snapshots from ${SHARES_URL}`,
    };
  } catch (sharesError) {
    console.warn(
      `[holdings] Strategy shares parse failed: ${sharesError instanceof Error ? sharesError.message : String(sharesError)}`,
    );
  }

  const fallback = await readPressReleaseFallback();
  return {
    rows: fallback,
    mode: "press-release-fallback",
    note: `Loaded ${fallback.length} fallback holdings snapshots from ${path.relative(ROOT, PRESS_RELEASE_FALLBACK_PATH)}`,
  };
}

async function main() {
  const { rows, mode, note } = await loadHoldingsHistory();

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

  console.log(`Wrote ${rows.length} holdings rows to ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`Source mode: ${mode}`);
  console.log(note);
  console.log(`Latest holdings date: ${rows.at(-1)?.date}`);
  console.log(`Latest holdings balance: ${rows.at(-1)?.btcHoldings?.toLocaleString("en-US")} BTC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
