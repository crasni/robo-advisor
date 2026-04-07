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
- a manually maintained Strategy holdings timeline

Raw inputs live in:

- `data/raw/mstr-holdings-history.json`
- `data/raw/mstr-company-profile.json`

Processed output is written to:

- `data/processed/mstr-mnav.json`

The build script is:

- `scripts/build-dataset.mjs`

## Local Development

```bash
npm install
npm run data:build
npm run dev
```

## Data Refresh Workflow

To rebuild the dataset locally:

```bash
npm run data:build
```

That script fetches the latest market data, merges it with the local treasury timeline, and rewrites `data/processed/mstr-mnav.json`.

## Deployment

This repo is configured for **GitHub Actions + Vercel**:

- Vercel deploys the app from the connected GitHub branch
- GitHub Actions runs `.github/workflows/rebuild-data.yml`
- the workflow runs on weekdays at `21:15 UTC`
- it rebuilds the dataset and commits `data/processed/mstr-mnav.json` only when it changes
- that commit triggers a new Vercel deployment

For a deployment checklist, see [docs/deployment.md](docs/deployment.md).

## Limitations

- v1 uses a fixed share-count assumption rather than a historical dilution series
- holdings are carried forward between confirmed disclosure dates
- the dataset is keyed to trading sessions, not every calendar day
- AI-generated commentary is intentionally out of scope in this version
