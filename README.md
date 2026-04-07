# DAT.co mNAV Monitor

A chart-first web app for tracking **Strategy's mNAV** over time.

The app uses one primary indicator:

```text
mNAV = marketCap / (btcHoldings * btcPrice)
```

Supporting series such as BTC price, MSTR price, and BTC held are included for context, but the monitored indicator is **mNAV**.

## What It Uses

- Next.js
- TypeScript
- Recharts
- precomputed JSON dataset
- GitHub Actions + Vercel deployment flow

## Data Sources

The processed dataset is built from:

- daily MSTR closes from Nasdaq
- daily BTC prices from Binance
- Strategy holdings from Strategy's official `/purchases` page, with `/shares` and local press-release fallback paths

Raw inputs live in:

- `data/raw/mstr-holdings-history.json`
- `data/raw/mstr-holdings-press-releases.json`
- `data/raw/mstr-company-profile.json`
- `data/raw/mstr-shares-history.json`

Processed output is written to:

- `data/processed/mstr-mnav.json`

The build script is:

- `scripts/build-dataset.mjs`

## Local Development

```bash
npm install
npm run data:refresh
npm run dev
```

## Data Refresh Workflow

To rebuild the dataset locally:

```bash
npm run data:holdings
npm run data:shares
npm run data:build
npm run data:validate
```

Or run the full refresh in one step:

```bash
npm run data:refresh
```

That workflow:

- fetches dated holdings history from Strategy's official tracker pages, with local press-release fallback
- fetches dated share history from Strategy SEC filings
- fetches the latest market data
- merges everything with the generated treasury timeline
- rewrites `data/raw/mstr-holdings-history.json`
- rewrites `data/raw/mstr-shares-history.json`
- rewrites `data/processed/mstr-mnav.json`
- validates that the processed dataset matches the underlying holdings and share timelines

The holdings workflow is now:

- `data/raw/mstr-holdings-history.json` is the generated holdings timeline used by the dataset build
- `scripts/fetch-holdings-history.mjs` first parses Strategy's official `/purchases` page from the server-rendered `__NEXT_DATA__` payload
- if `/purchases` is unavailable, it falls back to Strategy's `/shares` page for official BTC holdings snapshots
- if both official pages fail, it falls back to `data/raw/mstr-holdings-press-releases.json`

The share-count workflow is now:

- `data/raw/mstr-shares-history.json` is the preferred source for dated `sharesOutstanding`
- `scripts/fetch-shares-history.mjs` rebuilds that file from SEC 10-Q / 10-K filings
- `scripts/build-dataset.mjs` retroactively split-adjusts pre-August 8, 2024 SEC share counts so they stay on the same basis as Nasdaq's split-adjusted price history
- if SEC-derived history starts after the market series start, the dataset builder backfills earlier dates with the earliest fetched share-count entry so the build remains usable
- the builder validates that the share timeline is ascending and usable from the first market date
- if the share-history file is missing, the builder falls back safely to the fixed value in `data/raw/mstr-company-profile.json`

For best results, set `SEC_USER_AGENT` to a real contact string when fetching SEC data.

`npm run data:validate` checks:

- ascending dates and no duplicates
- processed holdings against the holdings event timeline
- processed share counts against the share-history timeline
- market cap, BTC NAV, and mNAV formula consistency
- stale holdings and share timelines relative to the latest market date

If share history starts after the first market date, validation emits a warning because earlier rows are being backfilled from the earliest available SEC-derived share count.

## Deployment

This repo is configured for **GitHub Actions + Vercel**:

- Vercel deploys the app from the connected GitHub branch
- GitHub Actions runs `.github/workflows/rebuild-data.yml`
- the workflow runs on weekdays at `21:15 UTC`
- it rebuilds the dataset and commits the generated raw holdings file, share-history file, and processed mNAV dataset only when they change
- that commit triggers a new Vercel deployment

For a deployment checklist, see [docs/deployment.md](docs/deployment.md).

## Limitations

- the app still uses basic share-count snapshots rather than a full daily diluted share series
- holdings are carried forward between confirmed disclosure dates
- the dataset is keyed to trading sessions, not every calendar day
- AI-generated commentary is intentionally out of scope in this version
