# Fisc

An open-source view of where U.S. federal dollars come from and where they go. Figures stay attached to the agency that published them. Nothing here is tax, legal, or investment advice.

![Flow of fiscal year 2026 receipts and outlays](docs/screenshots/flow.png)

## What you can do

- **Flow.** A Sankey of governmental receipts, borrowing, and offsetting receipts into outlays by budget function, for a completed fiscal year. On a phone the same totals are stacked bars.
- **Who pays.** Federal income tax by adjusted-gross-income bracket, and by state, from IRS Statistics of Income.
- **Spending.** Agency net outlays, then bureaus, assistance listings, and prime award recipients.
- **Recipients.** Search a company or organization and see obligations over time, awarding agencies, and the largest awards.
- **Nonprofits.** Top nonprofit grant recipients, with a Form 990 summary when the legal name matches ProPublica’s index.
- **Your taxes.** A wage and a filing status, an estimate of federal income tax plus the employee share of payroll tax, and that estimate split in proportion to gross outlays.

The fiscal year in the header is shared across pages. Light and dark follow the theme control.

![The same flow on a phone](docs/screenshots/flow-phone.png)

![Who pays federal income tax](docs/screenshots/revenue.png)

![Agency spending, Health and Human Services](docs/screenshots/spending-hhs.png)

![Recipient search](docs/screenshots/recipients.png)

![Obligations over time](docs/screenshots/recipient.png)

![Nonprofit grant recipients](docs/screenshots/nonprofits.png)

![Form 990 beside federal grant obligations](docs/screenshots/nonprofit.png)

![Your taxes](docs/screenshots/you.png)

![Your taxes on a phone](docs/screenshots/you-phone.png)

![Dark theme](docs/screenshots/flow-dark.png)

## Run it locally

Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847). No API keys. The first request to each source is slower; later requests use Next’s cache.

```bash
npm test
npm run lint
npm run build
npm start
```

`npm run soi` refreshes the IRS snapshots in `src/data/soi/`. Historic Table 2 is a CSV and needs nothing extra. Publication 1304 Table 1.1 is an `.xls` workbook; install `xlsx` (`npm install -D xlsx`) if you want that file refreshed too. The app runs without that step.

## Data sources

| Source | What it feeds | Live? |
| --- | --- | --- |
| [Monthly Treasury Statement](https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-outlays-and-the-deficit-surplus-of-the-u-s-government), Table 9 | Receipts by source and outlays by budget function | Yes, Treasury Fiscal Data API |
| Monthly Treasury Statement, Table 5 | Agency and bureau net outlays | Yes |
| [USAspending](https://api.usaspending.gov/api/v2) | Award obligations: agencies, assistance listings, recipients, awards | Yes |
| [ProPublica Nonprofit Explorer](https://projects.propublica.org/nonprofits/api) | Form 990 summaries by EIN | Yes |
| IRS Statistics of Income, [Publication 1304 Table 1.1](https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-returns-complete-report-publication-1304-basic-tables-part-1) | Income tax by AGI bracket | Snapshot in the repo (tax year 2023) |
| IRS SOI, [Historic Table 2](https://www.irs.gov/statistics/soi-tax-stats-historic-table-2) | Income tax by state | Live CSV, with a snapshot fallback |

Every figure on a page links back to the publication it came from, with the fiscal year or tax year.

### What the numbers are, and are not

- **Two different measures.** Treasury outlays are spending that left (or was credited to) the government. USAspending amounts are award **obligations**. Obligations are not outlays, and they leave out most payments to individuals and interest on the debt. A department’s outlay and its award total will not match.
- **The Sankey balances.** Inflows are governmental receipts, borrowing when the year is in deficit (outlays minus receipts), and the absolute value of negative budget functions (offsetting receipts). Outflows are the positive budget functions. The hub is that balanced total, which is larger than net outlays.
- **Payroll taxes** are the sum of the social insurance and retirement lines that sit under Treasury sequence 1.3. The parent line itself is empty in the statement.
- **Who pays lags the fiscal year.** The latest SOI individual-income release used here is tax year 2023. Table 1.1 (a sample) and Historic Table 2 (a different file) do not match to the dollar. Money in the IRS files is published in thousands and stored here in dollars. Return counts are rounded by the IRS.
- **Form 990.** ProPublica’s `filings_with_data` includes revenue, contributions, expenses, and officer compensation. It does not include the government-grants line (Form 990 Part VIII line 1e). Grant figures next to a filing are a USAspending lookup. The year and the legal entity can differ. A name match is kept when token overlap is at least 0.6.
- **“Multiple recipients”** rows from USAspending are omitted. A name search can hit more than one registration. Some registrations have a zero transaction total even when a sibling record does not.
- **The calculator is tax year 2026 wage income only.** Ordinary brackets and the standard deduction follow Revenue Procedure 2025-32. Employee Social Security is 6.2% up to the wage base and Medicare is 1.45%, from IRS Publication 15 for 2026. Additional Medicare is 0.9% above the statutory thresholds. No credits, no itemizing, no capital gains, no employer payroll tax. State of residence does not change the federal estimate; the state line is the SOI share of income tax for context. The split multiplies the estimate by each positive function’s share of gross outlays.

The latest completed fiscal year is the newest September statement. As of this writing that is fiscal year 2026 (statement of September 30, 2026): receipts about $5.40 trillion, outlays about $7.40 trillion.

## Add a data source

Sources live in `src/lib/sources/`. Each one returns `{ data, source }`, where `source` is a `SourceRef` (`src/lib/sources/types.ts`): name, publisher, URL, fiscal or tax year, and a note about what the number is.

1. Add a module next to `treasury.ts`. Fetch on the server. Mark the function with `"use cache"` and `cacheLife` from `next/cache` so repeat views do not hammer the API. Catch failures and keep a committed snapshot if the upstream file is not a stable API.
2. Register it in `src/lib/sources/registry.ts` so the About page lists it.
3. Pass the `SourceRef` to `<SourceNote>` beside the figure. Do not put a number on screen without one.
4. Keep units in dollars. If the publisher uses thousands, convert at the edge and say so in `notes`.

`scripts/fetch-soi.mjs` is the pattern for a file that has to be snapshotted.

## Add a visualization

Pages in `src/app/` load data on the server and hand plain objects to a client chart. Charts in `src/components/charts.tsx` and the Sankey in `src/components/flow-view.tsx` are SVG, colored from `src/lib/palette.ts`, and animated with the classes in `src/app/globals.css`.

A new view should:

- take data that is already in dollars, with a `SourceRef`
- work at a 390px width (the bottom nav covers the last `pb-28` of the page)
- respect `prefers-reduced-motion`
- avoid a second chart library; the app does not use one

The fiscal year belongs in the query string (`?fy=`). `withFy()` in `src/lib/links.ts` preserves it.

## Deploy

This is a Next.js server app. It is not a static export. On a host that runs Node (Vercel, or your own):

```bash
npm install
npm run build
npm start
```

No environment variables are required. Cache lifetimes are declared in the source modules (`hours` for recipient search, `days` for Treasury and award totals, `weeks` for the IRS snapshots and the agency list). Outbound HTTPS must be allowed to `fiscaldata.treasury.gov`, `api.usaspending.gov`, `projects.propublica.org`, and `www.irs.gov`.

## License

[MIT](LICENSE). The underlying statistics remain the property of the agencies that publish them.
