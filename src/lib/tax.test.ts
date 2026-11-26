import assert from "node:assert/strict";
import test from "node:test";

import { estimateFederalTax, incomeTaxOn } from "./tax";

test("single filer at the top of the 22 percent band matches Rev. Proc. 2025-32", () => {
  const result = incomeTaxOn(105_700, "single");
  assert.equal(result.tax, 17_966);
  assert.equal(result.marginalRate, 0.22);
});

test("married filing jointly at $100,800 of taxable income matches the published base", () => {
  const result = incomeTaxOn(100_800, "joint");
  assert.equal(result.tax, 11_600);
});

test("wage estimate for a single filer at $100,000", () => {
  const estimate = estimateFederalTax(100_000, "single");
  assert.equal(estimate.taxableIncome, 83_900);
  assert.equal(estimate.incomeTax, 13_170);
  assert.equal(estimate.socialSecurity, 6_200);
  assert.equal(estimate.medicare, 1_450);
  assert.equal(estimate.additionalMedicare, 0);
  assert.equal(estimate.total, 20_820);
});

test("payroll tax stops Social Security at the wage base and adds Additional Medicare", () => {
  const estimate = estimateFederalTax(300_000, "joint");
  assert.equal(estimate.socialSecurity, Math.round(184_500 * 0.062));
  assert.equal(estimate.additionalMedicare, Math.round(50_000 * 0.009));
  assert.ok(estimate.incomeTax > 0);
});
