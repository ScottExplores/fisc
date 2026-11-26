import { cacheLife, cacheTag } from "next/cache";

import { buildFlow, type MtsRow } from "@/lib/flow";
import { cleanName } from "@/lib/palette";
import type { Attributed, SourceRef } from "@/lib/sources/types";

const TABLE9 =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9";
const TABLE5 =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5";

const STATEMENT_URL =
  "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-by-source-and-outlays-by-function-of-the-u-s-government";

type FiscalResponse<T> = {
  data: T[];
  meta?: { "total-count"?: number };
};

export type AgencyBureau = { name: string; amount: number };

export type AgencyOutlay = {
  id: string;
  slug: string;
  name: string;
  amount: number;
  bureaus: AgencyBureau[];
};

export type AgencyReport = {
  fiscalYear: number;
  recordDate: string;
  totalOutlays: number;
  agencies: AgencyOutlay[];
};

type Table5Row = {
  classification_id: string;
  classification_desc: string;
  parent_id: string | null;
  current_fytd_net_outly_amt: string | null;
  sequence_level_nbr: string;
  record_date: string;
  record_fiscal_year: string;
};

function source(fy: number, asOf: string, notes: string): SourceRef {
  return {
    id: "treasury-mts",
    name: "Monthly Treasury Statement",
    publisher: "U.S. Department of the Treasury, Fiscal Data",
    url: STATEMENT_URL,
    fiscalYear: fy,
    asOf,
    notes,
  };
}

async function fiscalGet<T>(url: string, params: Record<string, string>): Promise<T[]> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${url}?${query.toString()}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(40_000),
  });
  if (!response.ok) {
    throw new Error(`Treasury Fiscal Data responded ${response.status} for ${url}`);
  }
  const body = (await response.json()) as FiscalResponse<T>;
  return body.data ?? [];
}

export async function getCompletedFiscalYears(): Promise<number[]> {
  "use cache";
  cacheLife("days");
  cacheTag("treasury", "fiscal-years");
  try {
    const rows = await fiscalGet<{ record_fiscal_year: string }>(TABLE9, {
      filter: "record_calendar_month:eq:09,sequence_number_cd:eq:1.8",
      fields: "record_fiscal_year,record_date",
      "page[size]": "100",
      sort: "-record_date",
    });
    const years = rows
      .map((row) => Number(row.record_fiscal_year))
      .filter((year) => Number.isFinite(year));
    const unique = [...new Set(years)].sort((a, b) => b - a);
    if (unique.length > 0) return unique;
  } catch {
    // Fall through to the published range we have already observed.
  }
  return [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
}

export function resolveFiscalYear(raw: string | undefined, years: number[]): number {
  const requested = Number(raw);
  if (years.includes(requested)) return requested;
  return years[0] ?? 2026;
}

async function table9(fy: number): Promise<MtsRow[]> {
  return fiscalGet<MtsRow>(TABLE9, {
    filter: `record_date:eq:${fy}-09-30`,
    "page[size]": "100",
    sort: "sequence_number_cd",
  });
}

export async function getFederalFlow(fy: number) {
  "use cache";
  cacheLife("days");
  cacheTag("treasury", `fy-${fy}`, "flow");
  const rows = await table9(fy);
  const flow = buildFlow(rows);
  return {
    data: flow,
    source: source(
      flow.fiscalYear,
      flow.recordDate,
      "Table 9, year-to-date governmental receipts and outlays by function. September statement, so the fiscal year is complete.",
    ),
  } satisfies Attributed<typeof flow>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function netAmount(value: string | null): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getAgencyReport(fy: number): Promise<Attributed<AgencyReport>> {
  "use cache";
  cacheLife("days");
  cacheTag("treasury", `fy-${fy}`, "agencies");
  const rows = await fiscalGet<Table5Row>(TABLE5, {
    filter: `record_date:eq:${fy}-09-30`,
    "page[size]": "1000",
    sort: "sequence_number_cd",
  });
  if (rows.length === 0) {
    throw new Error(`No agency outlays were published for fiscal year ${fy}.`);
  }
  const byParent = new Map<string, Table5Row[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const agencies: AgencyOutlay[] = [];
  for (const row of rows) {
    if (row.sequence_level_nbr !== "1") continue;
    const name = cleanName(row.classification_desc);
    if (name.startsWith("Total")) continue;
    const children = byParent.get(row.classification_id) ?? [];
    const totalRow = children.find((child) => child.classification_desc.startsWith("Total"));
    const amount = totalRow ? netAmount(totalRow.current_fytd_net_outly_amt) : null;
    if (amount == null) continue;
    const bureaus: AgencyBureau[] = [];
    for (const child of children) {
      if (child.classification_desc.startsWith("Total")) continue;
      const direct = netAmount(child.current_fytd_net_outly_amt);
      if (direct != null) {
        bureaus.push({ name: cleanName(child.classification_desc), amount: direct });
        continue;
      }
      const nested = (byParent.get(child.classification_id) ?? []).find((item) =>
        item.classification_desc.startsWith("Total"),
      );
      const nestedAmount = nested ? netAmount(nested.current_fytd_net_outly_amt) : null;
      if (nestedAmount != null) {
        bureaus.push({ name: cleanName(child.classification_desc), amount: nestedAmount });
      }
    }
    bureaus.sort((a, b) => b.amount - a.amount);
    agencies.push({
      id: row.classification_id,
      slug: slugify(name),
      name,
      amount,
      bureaus,
    });
  }
  agencies.sort((a, b) => b.amount - a.amount);
  const totalOutlays = agencies.reduce((sum, agency) => sum + agency.amount, 0);
  const recordDate = rows[0].record_date;
  return {
    data: { fiscalYear: fy, recordDate, totalOutlays, agencies },
    source: source(
      fy,
      recordDate,
      "Table 5, net outlays by agency. Department totals are the statement’s “Total” line for that agency. Bureau lines are that bureau’s own net outlays and will not add to the department total when other lines are offsetting receipts.",
    ),
  };
}

export async function getAgency(fy: number, slug: string): Promise<Attributed<AgencyOutlay> | null> {
  const report = await getAgencyReport(fy);
  const agency = report.data.agencies.find((item) => item.slug === slug);
  if (!agency) return null;
  return { data: agency, source: report.source };
}
