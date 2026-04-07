Session date: 2026-04-07

Scope:
- Reviewed and corrected the MSTR mNAV data workflow.
- Added automated BTC holdings refresh from Strategy official tracker pages.
- Fixed pre-split share basis alignment against split-adjusted MSTR prices.
- Removed dashboard treasury event markers.

Key workflow changes:
- `scripts/fetch-holdings-history.mjs` now generates `data/raw/mstr-holdings-history.json`.
- Primary holdings source: Strategy `/purchases` `__NEXT_DATA__` payload.
- Official fallback: Strategy `/shares` `__NEXT_DATA__` payload.
- Local fallback: `data/raw/mstr-holdings-press-releases.json`.
- `scripts/fetch-shares-history.mjs` remains the share-history builder from SEC filings.
- `scripts/share-adjustments.mjs` applies the 2024-08-08 10-for-1 split basis so older share counts match split-adjusted Nasdaq prices.
- `scripts/validate-data.mjs` now validates the generated holdings/share timelines and warns on staleness.

Current data state after rebuild:
- Holdings history rows: 104.
- Latest holdings snapshot: 2026-04-06, 766970 BTC.
- Processed dataset latest row uses 766970 BTC and shows mNAV near 0.807005x on 2026-04-06.

Files intentionally left out of commit:
- `docs/roadmap.md`
- `scripts/fetch-mstr.py`

Verification completed:
- `npm run data:holdings`
- `npm run data:build`
- `npm run data:validate`
- `npm run lint`
- `npm run typecheck`
