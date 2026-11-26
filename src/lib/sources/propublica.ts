import { cacheLife, cacheTag } from "next/cache";

import type { Attributed, SourceRef } from "@/lib/sources/types";

const API = "https://projects.propublica.org/nonprofits/api/v2";

export type NonprofitSearchHit = {
  ein: string;
  name: string;
  city: string | null;
  state: string | null;
  ntee: string | null;
};

export type FilingSummary = {
  taxYear: number | null;
  period: string | null;
  form: string | null;
  revenue: number | null;
  expenses: number | null;
  contributions: number | null;
  officerCompensation: number | null;
  officerCompensationShare: number | null;
  assets: number | null;
  pdfUrl: string | null;
};

export type NonprofitProfile = {
  ein: string;
  name: string;
  city: string | null;
  state: string | null;
  ntee: string | null;
  subsection: string | null;
  filings: FilingSummary[];
};

function source(notes: string, url: string, taxYear?: number): SourceRef {
  return {
    id: "propublica-nonprofit",
    name: "ProPublica Nonprofit Explorer",
    publisher: "ProPublica, from IRS Form 990 extracts",
    url,
    taxYear,
    notes,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { accept: "application/json", "user-agent": "fisc/0.1 (open source federal budget explorer)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`ProPublica ${response.status} on ${path}`);
  return (await response.json()) as T;
}

function tokens(value: string): Set<string> {
  const stop = new Set(["inc", "the", "llc", "corp", "co", "ltd", "of", "and", "for"]);
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word)),
  );
}

export function nameSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

export async function searchNonprofits(query: string): Promise<Attributed<NonprofitSearchHit[]>> {
  "use cache";
  cacheLife("days");
  cacheTag("propublica", "search");
  const body = await getJson<{
    organizations: Array<Record<string, unknown>>;
  }>(`/search.json?q=${encodeURIComponent(query)}`);
  const hits = (body.organizations ?? []).slice(0, 8).map((org) => ({
    ein: String(org.ein),
    name: String(org.name ?? ""),
    city: org.city == null ? null : String(org.city),
    state: org.state == null ? null : String(org.state),
    ntee: org.ntee_code == null ? null : String(org.ntee_code),
  }));
  return {
    data: hits,
    source: source(
      "Name search. A match is not proof that the USAspending recipient and the Form 990 filer are the same legal entity.",
      "https://projects.propublica.org/nonprofits/",
    ),
  };
}

export async function bestNonprofitMatch(name: string): Promise<NonprofitSearchHit | null> {
  const result = await searchNonprofits(name);
  const ranked = result.data
    .map((hit) => ({ hit, score: nameSimilarity(name, hit.name) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 0.6) return null;
  return top.hit;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getNonprofit(ein: string): Promise<Attributed<NonprofitProfile>> {
  "use cache";
  cacheLife("days");
  cacheTag("propublica", "org", ein);
  const digits = ein.replace(/\D/g, "");
  const body = await getJson<{
    organization: Record<string, unknown>;
    filings_with_data: Array<Record<string, unknown>>;
  }>(`/organizations/${digits}.json`);
  const org = body.organization ?? {};
  const filings = (body.filings_with_data ?? []).slice(0, 8).map((filing) => ({
    taxYear: num(filing.tax_prd_yr),
    period: filing.tax_prd == null ? null : String(filing.tax_prd),
    form: filing.formtype == null ? null : String(filing.formtype),
    revenue: num(filing.totrevenue),
    expenses: num(filing.totfuncexpns),
    contributions: num(filing.totcntrbgfts),
    officerCompensation: num(filing.compnsatncurrofcr),
    officerCompensationShare: num(filing.pct_compnsatncurrofcr),
    assets: num(filing.totassetsend),
    pdfUrl: filing.pdf_url == null ? null : String(filing.pdf_url),
  }));
  const latestYear = filings.find((filing) => filing.taxYear)?.taxYear ?? undefined;
  return {
    data: {
      ein: digits,
      name: String(org.name ?? "Nonprofit"),
      city: org.city == null ? null : String(org.city),
      state: org.state == null ? null : String(org.state),
      ntee: org.ntee_code == null ? null : String(org.ntee_code),
      subsection: org.subsection_code == null ? null : String(org.subsection_code),
      filings,
    },
    source: source(
      "Form 990 summary fields from ProPublica’s filings_with_data. That summary does not include the government-grants line (Form 990, Part VIII, line 1e). Federal award obligations shown beside it come from USAspending and can cover a different year.",
      `https://projects.propublica.org/nonprofits/organizations/${digits}`,
      latestYear,
    ),
  };
}
