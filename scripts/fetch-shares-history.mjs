import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "data/raw/mstr-shares-history.json");
const SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK0001050446.json";
const USER_AGENT =
  process.env.SEC_USER_AGENT || "robo-adviser/1.0 contact@example.com";
const START_DATE = "2020-01-01";

function warnDefaultUserAgent() {
  if (!process.env.SEC_USER_AGENT) {
    console.warn(
      "SEC_USER_AGENT is not set. Using the default User-Agent. Set SEC_USER_AGENT to a real contact string for sustained use.",
    );
  }
}

async function fetchJson(url) {
  return fetchWithRetry(url, { accept: "application/json" }, "json");
}

async function fetchText(url) {
  return fetchWithRetry(url, { accept: "text/html,application/xhtml+xml" }, "text");
}

async function fetchWithRetry(url, extraHeaders, mode) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...extraHeaders },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
      }

      return mode === "json" ? response.json() : response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError;
}

function rowsFromRecent(recent) {
  const rows = [];

  for (let index = 0; index < recent.form.length; index += 1) {
    rows.push({
      form: recent.form[index],
      filingDate: recent.filingDate[index],
      accessionNumber: recent.accessionNumber[index],
      primaryDocument: recent.primaryDocument[index],
    });
  }

  return rows;
}

async function fetchAllFilings() {
  const submissions = await fetchJson(SUBMISSIONS_URL);
  const rows = rowsFromRecent(submissions.filings.recent);

  for (const file of submissions.filings.files ?? []) {
    const older = await fetchJson(new URL(file.name, "https://data.sec.gov/submissions/"));
    rows.push(...rowsFromRecent(older));
  }

  return rows;
}

function normalizeArchiveUrl(accessionNumber, primaryDocument) {
  const accessionPath = accessionNumber.replaceAll("-", "");
  return `https://www.sec.gov/Archives/edgar/data/1050446/${accessionPath}/${primaryDocument}`;
}

function parseContexts(html) {
  const contexts = new Map();
  const contextPattern = /<xbrli:context\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/gi;

  for (const match of html.matchAll(contextPattern)) {
    const [, id, body] = match;
    const instant = body.match(/<xbrli:instant>([^<]+)<\/xbrli:instant>/i)?.[1] ?? null;
    const members = [...body.matchAll(/<xbrldi:explicitMember\b[^>]*>([^<]+)<\/xbrldi:explicitMember>/gi)].map(
      (member) => member[1],
    );

    contexts.set(id, { instant, members });
  }

  return contexts;
}

function parseScaledNumber(value, scaleText) {
  const numeric = Number.parseFloat(String(value).replaceAll(",", "").trim());
  if (!Number.isFinite(numeric)) return null;

  const scale = Number.parseInt(scaleText ?? "0", 10);
  if (!Number.isFinite(scale)) return numeric;

  return numeric * 10 ** scale;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCandidateFacts(html, contexts) {
  const facts = [];
  const factPattern =
    /<ix:nonFraction\b([^>]*\bname="([^"]*(?:EntityCommonStockSharesOutstanding|CommonStockSharesOutstanding)[^"]*)")[^>]*>([\s\S]*?)<\/ix:nonFraction>/gi;

  for (const match of html.matchAll(factPattern)) {
    const attrs = match[1];
    const name = match[2];
    const rawValue = match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const contextRef = attrs.match(/\bcontextRef="([^"]+)"/i)?.[1] ?? null;
    const scale = attrs.match(/\bscale="([^"]+)"/i)?.[1] ?? "0";

    if (!contextRef || !contexts.has(contextRef)) continue;

    const context = contexts.get(contextRef);
    const value = parseScaledNumber(rawValue, scale);
    if (!context?.instant || !value) continue;

    facts.push({
      name,
      value,
      instant: context.instant,
      members: context.members,
    });
  }

  return facts;
}

function classifyFactMembers(members) {
  if (members.some((member) => member.includes("CommonClassAMember"))) return "A";
  if (members.some((member) => member.includes("CommonClassBMember"))) return "B";
  return "other";
}

function summarizeFilingFacts(facts, filing) {
  const preferredFacts = facts.filter((fact) => fact.name.includes("EntityCommonStockSharesOutstanding"));
  const candidates = preferredFacts.length > 0 ? preferredFacts : facts;
  if (candidates.length === 0) return null;

  const byDate = new Map();

  for (const fact of candidates) {
    const classification = classifyFactMembers(fact.members);
    const bucket = byDate.get(fact.instant) ?? { A: null, B: null, other: [] };

    if (classification === "A") bucket.A = fact.value;
    else if (classification === "B") bucket.B = fact.value;
    else bucket.other.push(fact.value);

    byDate.set(fact.instant, bucket);
  }

  const dated = [...byDate.entries()]
    .map(([date, bucket]) => {
      const total =
        (bucket.A ?? 0) + (bucket.B ?? 0) + (bucket.other.length === 1 ? bucket.other[0] : 0);

      if (!total) return null;

      return {
        date,
        sharesOutstanding: Math.round(total),
        classAShares: bucket.A ? Math.round(bucket.A) : null,
        classBShares: bucket.B ? Math.round(bucket.B) : null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));

  const latest = dated.at(-1);
  if (!latest) return null;

  return {
    ...latest,
    form: filing.form,
    filingDate: filing.filingDate,
    accessionNumber: filing.accessionNumber,
    source: normalizeArchiveUrl(filing.accessionNumber, filing.primaryDocument),
  };
}

const SHARE_TEXT_PATTERNS = [
  /As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}),\s+the registrant had\s+([\d,]+)\s+and\s+([\d,]+)\s+shares of class A common stock and class B common stock outstanding/gi,
  /As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}),\s+there were\s+([\d,]+)\s+shares of class A common stock and\s+([\d,]+)\s+shares of class B common stock outstanding/gi,
  /As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}),\s+there were\s+([\d,]+)\s+shares of Class A Common Stock[^.]{0,80}?and\s+([\d,]+)\s+shares of Class B Common Stock outstanding/gi,
];

function parseTextSharesFallback(html, filing) {
  const text = stripHtml(html);

  for (const pattern of SHARE_TEXT_PATTERNS) {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;

    if (!match) continue;

    const date = new Date(match[1]).toISOString().slice(0, 10);
    const classAShares = Number.parseInt(match[2].replaceAll(",", ""), 10);
    const classBShares = Number.parseInt(match[3].replaceAll(",", ""), 10);

    if (!Number.isFinite(classAShares) || !Number.isFinite(classBShares)) continue;

    return {
      date,
      sharesOutstanding: classAShares + classBShares,
      classAShares,
      classBShares,
      form: filing.form,
      filingDate: filing.filingDate,
      accessionNumber: filing.accessionNumber,
      source: normalizeArchiveUrl(filing.accessionNumber, filing.primaryDocument),
    };
  }

  return null;
}

function validateTimeline(rows) {
  if (rows.length === 0) {
    throw new Error("No share-history rows were extracted from SEC filings.");
  }

  let previousDate = null;
  for (const row of rows) {
    if (!row.date || !row.sharesOutstanding || row.sharesOutstanding <= 0) {
      throw new Error(`Invalid share-history row: ${JSON.stringify(row)}`);
    }
    if (previousDate && row.date <= previousDate) {
      throw new Error(`Share-history output must be strictly ascending. Problem around ${row.date}.`);
    }
    previousDate = row.date;
  }
}

async function main() {
  warnDefaultUserAgent();

  const filings = (await fetchAllFilings())
    .filter((filing) => ["10-Q", "10-K"].includes(filing.form))
    .filter((filing) => filing.filingDate >= START_DATE)
    .sort((left, right) => left.filingDate.localeCompare(right.filingDate));

  const extracted = [];

  for (const filing of filings) {
    const url = normalizeArchiveUrl(filing.accessionNumber, filing.primaryDocument);
    try {
      const html = await fetchText(url);
      const contexts = parseContexts(html);
      const facts = extractCandidateFacts(html, contexts);
      const summary = summarizeFilingFacts(facts, filing) ?? parseTextSharesFallback(html, filing);

      if (!summary) {
        console.warn(`No share-outstanding facts found in ${filing.form} ${filing.filingDate}`);
        continue;
      }

      extracted.push(summary);
    } catch (error) {
      console.warn(`Skipping ${filing.form} ${filing.filingDate}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }

  const deduped = [...new Map(extracted.map((row) => [row.date, row])).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  validateTimeline(deduped);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");

  console.log(`Wrote ${deduped.length} share-history rows to ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`Latest share-history date: ${deduped.at(-1)?.date}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
