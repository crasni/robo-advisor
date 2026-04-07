# Deployment Checklist

This project is designed to deploy from GitHub to Vercel, with GitHub Actions refreshing the dataset on a schedule.

## One-time setup

1. Push the repo to GitHub.
2. Import the GitHub repo into Vercel.
3. Confirm the production branch in Vercel matches the branch used for scheduled updates.
4. Make sure GitHub Actions is enabled for the repository.
5. Add a GitHub repository variable named `SEC_USER_AGENT` with a real contact string for SEC requests.

## Scheduled data refresh

- Workflow file: `.github/workflows/rebuild-data.yml`
- Trigger: weekdays at `21:15 UTC`
- Expected timing:
  - `4:15 PM` during Eastern Standard Time
  - `5:15 PM` during Eastern Daylight Time

The workflow:

1. Installs dependencies with `npm ci`
2. Refreshes holdings history with `npm run data:holdings`
3. Refreshes share history with `npm run data:shares`
4. Rebuilds data with `npm run data:build`
5. Commits `data/raw/mstr-holdings-history.json`, `data/raw/mstr-shares-history.json`, and `data/processed/mstr-mnav.json` only if they changed
6. Pushes the update back to GitHub
7. Triggers a fresh Vercel deployment from that commit

## First verification

1. Run the workflow manually once with `workflow_dispatch` in GitHub Actions.
2. Confirm the workflow finishes successfully.
3. Check whether `data/processed/mstr-mnav.json` changed.
4. Confirm Vercel receives the new commit and starts a deployment.
5. Open the site and verify the latest trading date matches the rebuilt dataset.

## Operational notes

- The dataset is keyed to U.S. stock-market sessions, so weekends and market holidays may produce no new row.
- BTC trades continuously, but the rebuild timing should follow MSTR market close because mNAV depends on the stock close.
- If the workflow finds no data change, it should exit without creating a commit.
- If an upstream source fails, the site should continue serving the previous successful dataset until the next successful run.
