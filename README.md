# DAT.co mNAV Monitor

This project tracks Strategy's daily modified net asset value (mNAV) using a precomputed dataset built from:

- Bitcoin daily prices
- MSTR daily stock prices
- A dated Bitcoin holdings timeline

## Stack

- Next.js
- TypeScript
- Recharts
- Vercel-ready static deployment flow

## Local development

```bash
npm install
npm run data:build
npm run dev
```

## Dataset notes

- `data/raw/mstr-holdings-history.json` contains the auditable holdings timeline.
- `data/raw/mstr-company-profile.json` contains the v1 share-count assumption.
- `scripts/build-dataset.mjs` fetches BTC and stock prices, then writes `data/processed/mstr-mnav.json`.

## Formula

```text
mNAV = marketCap / (btcHoldings * btcPrice)
```

## Limitations

- v1 uses a fixed share count rather than a historical dilution series.
- Holdings are carried forward between confirmed disclosure dates.
- AI-generated commentary is intentionally out of scope in the first release.
