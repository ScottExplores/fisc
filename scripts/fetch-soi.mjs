/**
 * Refresh the IRS Statistics of Income snapshots used as a fallback,
 * and as the source for Publication 1304 Table 1.1 (Excel, not a JSON API).
 *
 *   node scripts/fetch-soi.mjs
 *
 * Table 1.1 is an .xls workbook. This script parses it when the optional
 * `xlsx` package is installed (`npm install -D xlsx`). Historic Table 2 is
 * a CSV and needs no extra dependency. The running app also fetches that CSV
 * itself and falls back to src/data/soi/states.json.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "src/data/soi");
const retrievedAt = new Date().toISOString().slice(0, 10);

const TABLE_XLS = "https://www.irs.gov/pub/irs-soi/23in11si.xls";
const STATE_CSV = "https://www.irs.gov/pub/irs-soi/23in55cmcsv.csv";

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "fisc-soi-refresh" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
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
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows[0] ?? [];
  return rows.slice(1).filter((cells) => cells.some(Boolean)).map((cells) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });
}

function dollars(raw) {
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value * 1000) : 0;
}
function count(raw) {
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

await mkdir(outDir, { recursive: true });

const csv = (await download(STATE_CSV)).toString("utf8");
const records = parseCsv(csv);
const byState = new Map();
for (const record of records) {
  const code = (record.STATE ?? "").trim();
  const stub = (record.AGI_STUB ?? "").trim();
  if (!code || stub === "") continue;
  const bucket = byState.get(code) ?? new Map();
  bucket.set(stub, {
    stub,
    returns: count(record.N1),
    agi: dollars(record.A00100),
    incomeTax: dollars(record.A06500),
  });
  byState.set(code, bucket);
}
const states = [];
for (const [code, stubs] of byState) {
  if (code === "US") continue;
  const total = stubs.get("0");
  if (!total) continue;
  const brackets = [...stubs.values()].filter((item) => item.stub !== "0").sort((a, b) => Number(a.stub) - Number(b.stub));
  states.push({ code, returns: total.returns, agi: total.agi, incomeTax: total.incomeTax, brackets });
}
states.sort((a, b) => b.incomeTax - a.incomeTax);
const national = byState.get("US")?.get("0") ?? { returns: 0, agi: 0, incomeTax: 0 };
await writeFile(
  path.join(outDir, "states.json"),
  JSON.stringify({
    taxYear: 2023,
    sourceName: "IRS Statistics of Income, Historic Table 2",
    sourceUrl: STATE_CSV,
    documentationUrl: "https://www.irs.gov/statistics/soi-tax-stats-historic-table-2",
    retrievedAt,
    notes:
      "Population data from individual income tax returns. Money amounts in the CSV are in thousands of dollars and are stored here in dollars. Income tax is field A06500. Return counts are rounded by the IRS.",
    national: { returns: national.returns, agi: national.agi, incomeTax: national.incomeTax },
    states,
  }),
);
console.log(`Wrote states.json (${states.length} areas)`);

try {
  const require = createRequire(import.meta.url);
  const XLSX = require("xlsx");
  const workbook = XLSX.read(await download(TABLE_XLS), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const all = grid[9];
  const brackets = [];
  for (let r = 10; r < grid.length; r += 1) {
    const label = String(grid[r]?.[0] ?? "").trim();
    if (!label || label.toLowerCase().startsWith("accumulated")) break;
    brackets.push({
      label,
      returns: Math.round(Number(grid[r][1])),
      agi: Math.round(Number(grid[r][3]) * 1000),
      incomeTax: Math.round(Number(grid[r][16]) * 1000),
    });
  }
  await writeFile(
    path.join(outDir, "table-1-1.json"),
    JSON.stringify(
      {
        taxYear: 2023,
        sourceName: "IRS Statistics of Income, Publication 1304, Table 1.1",
        sourceUrl: TABLE_XLS,
        publicationUrl:
          "https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-returns-complete-report-publication-1304-basic-tables-part-1",
        retrievedAt,
        notes:
          "Sample estimates. Money amounts in the workbook are in thousands of dollars and are stored here in dollars. Total income tax is column 16. This is not the same file as Historic Table 2.",
        allReturns: Math.round(Number(all[1])),
        allAgi: Math.round(Number(all[3]) * 1000),
        allIncomeTax: Math.round(Number(all[16]) * 1000),
        brackets,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote table-1-1.json (${brackets.length} brackets)`);
} catch (error) {
  console.warn("Skipped Table 1.1. Install the xlsx package to refresh it: npm install -D xlsx");
  console.warn(error instanceof Error ? error.message : error);
}
