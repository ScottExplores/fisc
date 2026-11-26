import { cacheLife, cacheTag } from "next/cache";

import tableSnapshot from "@/data/soi/table-1-1.json";
import stateSnapshot from "@/data/soi/states.json";
import { AGI_STUBS } from "@/lib/states";
import type { Attributed, SourceRef } from "@/lib/sources/types";

const STATE_CSV = "https://www.irs.gov/pub/irs-soi/23in55cmcsv.csv";

export type IncomeBracket = {
  label: string;
  returns: number;
  agi: number;
  incomeTax: number;
};

export type BracketReport = {
  taxYear: number;
  allReturns: number;
  allAgi: number;
  allIncomeTax: number;
  brackets: IncomeBracket[];
  live: boolean;
};

export type StateBracket = { stub: string; returns: number; agi: number; incomeTax: number };

export type StateRow = {
  code: string;
  returns: number;
  agi: number;
  incomeTax: number;
  brackets: StateBracket[];
};

export type StateReport = {
  taxYear: number;
  national: { returns: number; agi: number; incomeTax: number };
  states: StateRow[];
  live: boolean;
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows[0] ?? [];
  return rows.slice(1).filter((cells) => cells.some((value) => value !== "")).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });
}

function dollars(raw: string): number {
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value * 1000) : 0;
}

function count(raw: string): number {
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function parseHistoricTable(csv: string): StateReport {
  const records = parseCsv(csv);
  const byState = new Map<string, Map<string, StateBracket & { total?: boolean }>>();
  for (const record of records) {
    const code = (record.STATE ?? "").trim();
    const stub = (record.AGI_STUB ?? "").trim();
    if (!code || stub === "") continue;
    const bucket = byState.get(code) ?? new Map();
    bucket.set(stub, {
      stub,
      returns: count(record.N1 ?? "0"),
      agi: dollars(record.A00100 ?? "0"),
      incomeTax: dollars(record.A06500 ?? "0"),
    });
    byState.set(code, bucket);
  }
  const nationalRaw = byState.get("US")?.get("0");
  const states: StateRow[] = [];
  for (const [code, stubs] of byState) {
    if (code === "US") continue;
    const total = stubs.get("0");
    if (!total) continue;
    const brackets = AGI_STUBS.map((stub) => stubs.get(stub.code)).filter((item): item is StateBracket => Boolean(item));
    states.push({
      code,
      returns: total.returns,
      agi: total.agi,
      incomeTax: total.incomeTax,
      brackets,
    });
  }
  states.sort((a, b) => b.incomeTax - a.incomeTax);
  return {
    taxYear: 2023,
    national: nationalRaw ?? { returns: 0, agi: 0, incomeTax: 0 },
    states,
    live: true,
  };
}

const bracketSource = (live: boolean): SourceRef => ({
  id: "irs-soi-table-1-1",
  name: tableSnapshot.sourceName,
  publisher: "Internal Revenue Service, Statistics of Income",
  url: tableSnapshot.publicationUrl,
  taxYear: tableSnapshot.taxYear,
  notes: live
    ? tableSnapshot.notes
    : `${tableSnapshot.notes} Loaded from the snapshot committed in this repository (${tableSnapshot.retrievedAt}). Refresh with npm run soi.`,
});

export async function getIncomeBrackets(): Promise<Attributed<BracketReport>> {
  "use cache";
  cacheLife("weeks");
  cacheTag("irs", "table-1-1");
  const data: BracketReport = {
    taxYear: tableSnapshot.taxYear,
    allReturns: tableSnapshot.allReturns,
    allAgi: tableSnapshot.allAgi,
    allIncomeTax: tableSnapshot.allIncomeTax,
    brackets: tableSnapshot.brackets,
    live: false,
  };
  return { data, source: bracketSource(false) };
}

export async function getIncomeByState(): Promise<Attributed<StateReport>> {
  "use cache";
  cacheLife("weeks");
  cacheTag("irs", "historic-table-2");
  try {
    const response = await fetch(STATE_CSV, {
      headers: { "user-agent": "fisc/0.1 (open source federal budget explorer)" },
      signal: AbortSignal.timeout(40_000),
    });
    if (!response.ok) throw new Error(`IRS CSV ${response.status}`);
    const csv = await response.text();
    const parsed = parseHistoricTable(csv);
    if (parsed.states.length < 50) throw new Error("IRS CSV did not include state rows.");
    return {
      data: parsed,
      source: {
        id: "irs-soi-historic-table-2",
        name: "IRS Statistics of Income, Historic Table 2",
        publisher: "Internal Revenue Service, Statistics of Income",
        url: "https://www.irs.gov/statistics/soi-tax-stats-historic-table-2",
        taxYear: parsed.taxYear,
        notes:
          "Live CSV (23in55cmcsv.csv). Money amounts in the file are in thousands of dollars. Income tax is field A06500. Return counts are rounded by the IRS. Tax year 2023 is the latest file in this series.",
      },
    };
  } catch {
    const fallback: StateReport = {
      taxYear: stateSnapshot.taxYear,
      national: stateSnapshot.national,
      states: stateSnapshot.states,
      live: false,
    };
    return {
      data: fallback,
      source: {
        id: "irs-soi-historic-table-2",
        name: stateSnapshot.sourceName,
        publisher: "Internal Revenue Service, Statistics of Income",
        url: stateSnapshot.documentationUrl,
        taxYear: stateSnapshot.taxYear,
        notes: `${stateSnapshot.notes} The live file did not load, so this view uses the snapshot committed in the repository (${stateSnapshot.retrievedAt}).`,
      },
    };
  }
}
