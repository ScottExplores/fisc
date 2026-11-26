import { cacheLife, cacheTag } from "next/cache";

import type { Attributed, SourceRef } from "@/lib/sources/types";

const API = "https://api.usaspending.gov/api/v2";

export type AwardCategory = "awarding_agency" | "recipient" | "cfda";

export type CategoryResult = {
  id: string | number | null;
  name: string;
  code: string | null;
  amount: number;
  uei?: string | null;
  recipientId?: string | null;
  slug?: string | null;
};

export type RecipientHit = {
  id: string;
  name: string;
  uei: string | null;
  amount: number;
  level: string | null;
};

export type RecipientProfile = {
  id: string;
  name: string;
  uei: string | null;
  duns: string | null;
  businessTypes: string[];
  parentName: string | null;
  location: string | null;
  totalAmount: number | null;
};

export type YearAmount = {
  fiscalYear: number;
  total: number;
  contracts: number;
  grants: number;
  loans: number;
  other: number;
};

export type AwardRow = {
  id: string;
  name: string;
  amount: number;
  agency: string;
  type: string;
  description: string;
};

type SpendingFilters = {
  fy: number;
  agencyName?: string;
  programNumber?: string;
  recipientId?: string;
  recipientName?: string;
  awardTypeCodes?: string[];
  recipientTypeNames?: string[];
};

const GRANT_CODES = ["02", "03", "04", "05"];

function period(fy: number) {
  return { start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` };
}

function source(fy: number, notes: string, url = "https://www.usaspending.gov"): SourceRef {
  return {
    id: "usaspending",
    name: "USAspending.gov",
    publisher: "U.S. Department of the Treasury",
    url,
    fiscalYear: fy,
    asOf: `${fy - 1}-10-01/${fy}-09-30`,
    notes,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`USAspending ${response.status} on ${path}: ${detail.slice(0, 180)}`);
  }
  return (await response.json()) as T;
}

function filtersFor(input: SpendingFilters): Record<string, unknown> {
  const filters: Record<string, unknown> = { time_period: [period(input.fy)] };
  if (input.agencyName) {
    filters.agencies = [{ type: "awarding", tier: "toptier", name: input.agencyName }];
  }
  if (input.programNumber) filters.program_numbers = [input.programNumber];
  if (input.recipientId) filters.recipient_id = input.recipientId;
  if (input.recipientName) filters.recipient_search_text = [input.recipientName];
  if (input.awardTypeCodes) filters.award_type_codes = input.awardTypeCodes;
  if (input.recipientTypeNames) filters.recipient_type_names = input.recipientTypeNames;
  return filters;
}

export async function spendingByCategory(
  category: AwardCategory,
  input: SpendingFilters,
  limit = 15,
): Promise<Attributed<CategoryResult[]>> {
  "use cache";
  cacheLife("days");
  cacheTag("usaspending", category, `fy-${input.fy}`);
  const body = await post<{
    results: Array<Record<string, unknown>>;
  }>(`/search/spending_by_category/${category}/`, {
    filters: filtersFor(input),
    limit,
    page: 1,
  });
  const results = (body.results ?? []).map((row) => ({
    id: (row.id as string | number | null) ?? null,
    name: String(row.name ?? "Unknown"),
    code: row.code == null ? null : String(row.code),
    amount: Number(row.amount ?? 0),
    uei: (row.uei as string | null) ?? null,
    recipientId: (row.recipient_id as string | null) ?? null,
    slug: (row.agency_slug as string | null) ?? null,
  }));
  return {
    data: results,
    source: source(
      input.fy,
      "Award obligations (not outlays). USAspending covers contracts, grants, loans, and other awards. It does not include most benefit payments to individuals or interest on the debt.",
    ),
  };
}

export async function searchRecipients(keyword: string, limit = 8): Promise<Attributed<RecipientHit[]>> {
  "use cache";
  cacheLife("hours");
  cacheTag("usaspending", "recipient-search");
  const body = await post<{ results: Array<Record<string, unknown>> }>("/recipient/", {
    keyword,
    award_type: "all",
    limit,
    page: 1,
    order: "desc",
    sort: "amount",
  });
  const results = (body.results ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    uei: row.uei == null ? null : String(row.uei),
    amount: Number(row.amount ?? 0),
    level: row.recipient_level == null ? null : String(row.recipient_level),
  }));
  return {
    data: results,
    source: source(0, "Recipient name search. The amount is USAspending’s cumulative figure for that record, not a single fiscal year."),
  };
}

export async function getRecipient(id: string): Promise<Attributed<RecipientProfile>> {
  "use cache";
  cacheLife("days");
  cacheTag("usaspending", "recipient", id);
  const response = await fetch(`${API}/recipient/${encodeURIComponent(id)}/`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(40_000),
  });
  if (!response.ok) throw new Error(`USAspending recipient ${response.status}`);
  const row = (await response.json()) as Record<string, unknown>;
  const location = row.location as Record<string, string | null> | null;
  const place = location
    ? [location.city_name, location.state_code].filter(Boolean).join(", ")
    : null;
  const profile: RecipientProfile = {
    id: String(row.recipient_id ?? id),
    name: String(row.name ?? "Recipient"),
    uei: row.uei == null ? null : String(row.uei),
    duns: row.duns == null ? null : String(row.duns),
    businessTypes: Array.isArray(row.business_types) ? row.business_types.map(String) : [],
    parentName: row.parent_name == null ? null : String(row.parent_name),
    location: place,
    totalAmount: row.total_transaction_amount == null ? null : Number(row.total_transaction_amount),
  };
  return {
    data: profile,
    source: source(
      0,
      "Recipient profile. Business types come from USAspending’s record, which is derived from SAM.gov registration data.",
      `https://www.usaspending.gov/recipient/${profile.id}/latest`,
    ),
  };
}

export async function spendingOverTime(input: {
  fy: number;
  recipientId?: string;
  recipientName?: string;
}): Promise<Attributed<YearAmount[]>> {
  "use cache";
  cacheLife("days");
  cacheTag("usaspending", "over-time", input.recipientId ?? input.recipientName ?? "none");
  const start = Math.max(2018, input.fy - 8);
  const body = await post<{ results: Array<Record<string, unknown>> }>("/search/spending_over_time/", {
    group: "fiscal_year",
    filters: {
      time_period: [{ start_date: `${start - 1}-10-01`, end_date: `${input.fy}-09-30` }],
      ...(input.recipientId ? { recipient_id: input.recipientId } : {}),
      ...(input.recipientName ? { recipient_search_text: [input.recipientName] } : {}),
    },
  });
  const results = (body.results ?? []).map((row) => {
    const time = row.time_period as { fiscal_year?: string } | undefined;
    return {
      fiscalYear: Number(time?.fiscal_year),
      total: Number(row.aggregated_amount ?? 0),
      contracts: Number(row.Contract_Obligations ?? 0),
      grants: Number(row.Grant_Obligations ?? 0),
      loans: Number(row.Loan_Obligations ?? 0),
      other: Number(row.Other_Obligations ?? 0) + Number(row.Direct_Obligations ?? 0),
    };
  });
  return {
    data: results.filter((row) => Number.isFinite(row.fiscalYear)),
    source: source(
      input.fy,
      "Obligations by fiscal year. A name search can include more than one legal entity. A recipient id is limited to that USAspending record.",
    ),
  };
}

const AWARD_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Award Amount",
  "Awarding Agency",
  "Award Type",
  "Description",
  "generated_internal_id",
];

export async function topAwards(input: SpendingFilters, limit = 8): Promise<Attributed<AwardRow[]>> {
  "use cache";
  cacheLife("days");
  cacheTag("usaspending", "awards", `fy-${input.fy}`);
  const body = await post<{ results: Array<Record<string, unknown>> }>("/search/spending_by_award/", {
    filters: {
      ...filtersFor(input),
      award_type_codes: input.awardTypeCodes ?? ["A", "B", "C", "D", ...GRANT_CODES],
    },
    fields: AWARD_FIELDS,
    limit,
    page: 1,
    sort: "Award Amount",
    order: "desc",
  });
  const results = (body.results ?? []).map((row) => ({
    id: String(row.generated_internal_id ?? row["Award ID"] ?? ""),
    name: String(row["Award ID"] ?? "Award"),
    amount: Number(row["Award Amount"] ?? 0),
    agency: String(row["Awarding Agency"] ?? ""),
    type: String(row["Award Type"] ?? ""),
    description: String(row.Description ?? ""),
  }));
  return {
    data: results,
    source: source(input.fy, "Largest awards in the fiscal year for this filter. Amounts are obligations."),
  };
}

export async function topNonprofitGrants(fy: number, limit = 12) {
  return spendingByCategory(
    "recipient",
    {
      fy,
      awardTypeCodes: GRANT_CODES,
      recipientTypeNames: ["nonprofit"],
    },
    limit,
  );
}

export type ToptierAgency = { name: string; abbreviation: string };

export async function getToptierAgencies(): Promise<ToptierAgency[]> {
  "use cache";
  cacheLife("weeks");
  cacheTag("usaspending", "toptier");
  const response = await fetch(`${API}/references/toptier_agencies/`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`USAspending agencies ${response.status}`);
  const body = (await response.json()) as { results: Array<{ agency_name: string; abbreviation: string }> };
  return (body.results ?? []).map((row) => ({
    name: row.agency_name,
    abbreviation: row.abbreviation,
  }));
}

const AGENCY_ALIASES: Record<string, string> = {
  "department of defense military programs": "department of defense",
  "international assistance programs": "agency for international development",
  "corps of engineers": "corps of engineers civil works",
  "judicial branch": "the judicial branch",
  "legislative branch": "the legislative branch",
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchToptier(treasuryName: string, agencies: ToptierAgency[]): ToptierAgency | null {
  const key = norm(treasuryName);
  const target = AGENCY_ALIASES[key] ?? key;
  const exact = agencies.find((agency) => norm(agency.name) === target);
  if (exact) return exact;
  const partial = agencies.filter((agency) => {
    const name = norm(agency.name);
    return name === target || name.startsWith(target) || target.startsWith(name);
  });
  return partial.length === 1 ? partial[0] : null;
}

export function isNonprofitType(types: string[]): boolean {
  return types.some((type) => /nonprofit|higher_education|tax_exempt/.test(type));
}

export const GRANT_AWARD_CODES = GRANT_CODES;
