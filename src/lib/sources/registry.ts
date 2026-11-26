import type { SourceModule } from "@/lib/sources/types";

/**
 * Add a source by creating src/lib/sources/<name>.ts and appending an entry here.
 * Keep fetch functions free of presentation code. Return Attributed<T> so every
 * number can carry its publisher, URL, and year into the UI.
 */
export const sourceRegistry: SourceModule[] = [
  {
    id: "treasury-mts",
    title: "Monthly Treasury Statement",
    summary: "Governmental receipts by source and outlays by budget function and agency.",
    module: "src/lib/sources/treasury.ts",
    docsUrl: "https://fiscaldata.treasury.gov/api-documentation/",
  },
  {
    id: "usaspending",
    title: "USAspending.gov",
    summary: "Federal award obligations: contracts, grants, assistance listings, and recipients.",
    module: "src/lib/sources/usaspending.ts",
    docsUrl: "https://api.usaspending.gov/docs/endpoints",
  },
  {
    id: "propublica-nonprofit",
    title: "ProPublica Nonprofit Explorer",
    summary: "Form 990 summaries: revenue, contributions, and officer compensation.",
    module: "src/lib/sources/propublica.ts",
    docsUrl: "https://projects.propublica.org/nonprofits/api",
  },
  {
    id: "irs-soi",
    title: "IRS Statistics of Income",
    summary: "Income tax by size of adjusted gross income and by state.",
    module: "src/lib/sources/irs.ts",
    docsUrl: "https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-statistics",
  },
];
