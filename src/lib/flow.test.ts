import assert from "node:assert/strict";
import test from "node:test";

import { buildFlow, type MtsRow } from "./flow";

function row(code: string, desc: string, amount: number | null, fy = "2026"): MtsRow {
  return {
    classification_desc: desc,
    current_fytd_rcpt_outly_amt: amount == null ? null : String(amount),
    sequence_number_cd: code,
    record_date: `${fy}-09-30`,
    record_fiscal_year: fy,
  };
}

test("receipts, borrowing, and offsetting receipts balance outlays", () => {
  const flow = buildFlow([
    row("1", "Receipts", null),
    row("1.1", "Individual Income Taxes", 100),
    row("1.2", "Corporation Income Taxes", 40),
    row("1.3", "Social Insurance and Retirement Receipts:", null),
    row("1.3.1", "Employment and General Retirement", 50),
    row("1.3.2", "Unemployment Insurance", 5),
    row("1.8", "Total", 195),
    row("2", "Net Outlays", null),
    row("2.1", "National Defense", 80),
    row("2.14", "Social Security", 150),
    row("2.18", "Net Interest", 30),
    row("2.19", "Undistributed Offsetting Receipts", -20),
    row("2.20", "Total", 240),
  ]);

  assert.equal(flow.receiptTotal, 195);
  assert.equal(flow.outlayTotal, 240);
  assert.equal(flow.deficit, 45);
  const sourceSum = flow.sources.reduce((sum, node) => sum + node.amount, 0);
  const useSum = flow.uses.reduce((sum, node) => sum + node.amount, 0);
  assert.equal(sourceSum, useSum);
  assert.equal(flow.hub.amount, sourceSum);
  assert.ok(flow.sources.some((node) => node.id === "borrowing" && node.amount === 45));
  assert.ok(flow.sources.some((node) => node.id.startsWith("offset-") && node.amount === 20));
  assert.equal(flow.payrollParts.length, 2);
  assert.ok(Math.abs(flow.residual) < 1 || flow.links.length > 0);
});

test("published fiscal year 2026 statement lines balance", () => {
  const receipts: Array<[string, string, number | null]> = [
    ["1.1", "Individual Income Taxes", 2845526866159.55],
    ["1.2", "Corporation Income Taxes", 381414689057.62],
    ["1.3", "Social Insurance and Retirement Receipts:", null],
    ["1.3.1", "Employment and General Retirement", 1768000000000],
    ["1.3.2", "Unemployment Insurance", 45000000000],
    ["1.3.3", "Other Retirement", 9000000000],
    ["1.4", "Excise Taxes", 105995126578.38],
    ["1.5", "Estate and Gift Taxes", 38720146356.13],
    ["1.6", "Customs Duties", 173218614643.4],
    ["1.7", "Miscellaneous Receipts", 46656595004.81],
  ];
  const receiptSum =
    2845526866159.55 +
    381414689057.62 +
    1768000000000 +
    45000000000 +
    9000000000 +
    105995126578.38 +
    38720146356.13 +
    173218614643.4 +
    46656595004.81;
  const outlays: Array<[string, string, number]> = [
    ["2.1", "National Defense", 100],
    ["2.14", "Social Security", 200],
    ["2.19", "Undistributed Offsetting Receipts", -40],
  ];
  const rows: MtsRow[] = [
    row("1", "Receipts", null),
    ...receipts.map(([code, desc, amount]) => row(code, desc, amount)),
    row("1.8", "Total", receiptSum),
    row("2", "Net Outlays", null),
    ...outlays.map(([code, desc, amount]) => row(code, desc, amount)),
    row("2.20", "Total", 260),
  ];
  const flow = buildFlow(rows);
  const sourceSum = flow.sources.reduce((sum, node) => sum + node.amount, 0);
  const useSum = flow.uses.reduce((sum, node) => sum + node.amount, 0);
  assert.ok(Math.abs(sourceSum - useSum) < 1);
  assert.equal(flow.links.length, flow.sources.length + flow.uses.length);
});
