/**
 * Tax year 2026 federal income tax and employee payroll tax.
 * Income-tax brackets and the standard deduction: IRS Rev. Proc. 2025-32
 * and IR-2025-103. Social Security wage base and rates: IRS Publication 15 (2026).
 * Additional Medicare tax thresholds are statutory (IRC 3101(b)(2)) and are not inflation-adjusted.
 *
 * This is an estimate of wage income only. It does not apply credits, itemized
 * deductions, or preferential rates on capital gains.
 */

export type FilingStatus = "single" | "joint" | "hoh" | "separate";

export const TAX_YEAR = 2026;

export const filingStatusLabel: Record<FilingStatus, string> = {
  single: "Single",
  joint: "Married filing jointly",
  hoh: "Head of household",
  separate: "Married filing separately",
};

type Slice = { limit: number; rate: number };

/** Upper bound of each taxable-income band, then the rate that applies inside it. */
const BRACKETS: Record<FilingStatus, Slice[]> = {
  single: [
    { limit: 12_400, rate: 0.1 },
    { limit: 50_400, rate: 0.12 },
    { limit: 105_700, rate: 0.22 },
    { limit: 201_775, rate: 0.24 },
    { limit: 256_225, rate: 0.32 },
    { limit: 640_600, rate: 0.35 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  joint: [
    { limit: 24_800, rate: 0.1 },
    { limit: 100_800, rate: 0.12 },
    { limit: 211_400, rate: 0.22 },
    { limit: 403_550, rate: 0.24 },
    { limit: 512_450, rate: 0.32 },
    { limit: 768_700, rate: 0.35 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  hoh: [
    { limit: 17_700, rate: 0.1 },
    { limit: 67_450, rate: 0.12 },
    { limit: 105_700, rate: 0.22 },
    { limit: 201_750, rate: 0.24 },
    { limit: 256_200, rate: 0.32 },
    { limit: 640_600, rate: 0.35 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  separate: [
    { limit: 12_400, rate: 0.1 },
    { limit: 50_400, rate: 0.12 },
    { limit: 105_700, rate: 0.22 },
    { limit: 201_775, rate: 0.24 },
    { limit: 256_225, rate: 0.32 },
    { limit: 384_350, rate: 0.35 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
};

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16_100,
  joint: 32_200,
  hoh: 24_150,
  separate: 16_100,
};

/** Employee Social Security rate and 2026 wage base. Employer share is not included. */
export const SOCIAL_SECURITY_RATE = 0.062;
export const SOCIAL_SECURITY_WAGE_BASE = 184_500;
export const MEDICARE_RATE = 0.0145;
export const ADDITIONAL_MEDICARE_RATE = 0.009;

export const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  joint: 250_000,
  hoh: 200_000,
  separate: 125_000,
};

export type TaxEstimate = {
  wages: number;
  status: FilingStatus;
  standardDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  marginalRate: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  payrollTax: number;
  total: number;
  effectiveRate: number;
};

function roundDollar(value: number): number {
  return Math.round(value);
}

export function incomeTaxOn(taxableIncome: number, status: FilingStatus): { tax: number; marginalRate: number } {
  if (taxableIncome <= 0) return { tax: 0, marginalRate: BRACKETS[status][0].rate };
  let tax = 0;
  let prev = 0;
  let marginalRate = BRACKETS[status][0].rate;
  for (const band of BRACKETS[status]) {
    const top = Math.min(taxableIncome, band.limit);
    const slice = top - prev;
    if (slice > 0) {
      tax += slice * band.rate;
      marginalRate = band.rate;
    }
    if (taxableIncome <= band.limit) break;
    prev = band.limit;
  }
  return { tax: roundDollar(tax), marginalRate };
}

export function estimateFederalTax(wages: number, status: FilingStatus): TaxEstimate {
  const income = Math.max(0, wages);
  const standardDeduction = STANDARD_DEDUCTION[status];
  const taxableIncome = Math.max(0, income - standardDeduction);
  const { tax: incomeTax, marginalRate } = incomeTaxOn(taxableIncome, status);
  const socialSecurity = roundDollar(Math.min(income, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE);
  const medicare = roundDollar(income * MEDICARE_RATE);
  const additionalMedicare = roundDollar(
    Math.max(0, income - ADDITIONAL_MEDICARE_THRESHOLD[status]) * ADDITIONAL_MEDICARE_RATE,
  );
  const payrollTax = socialSecurity + medicare + additionalMedicare;
  const total = incomeTax + payrollTax;
  return {
    wages: income,
    status,
    standardDeduction,
    taxableIncome,
    incomeTax,
    marginalRate,
    socialSecurity,
    medicare,
    additionalMedicare,
    payrollTax,
    total,
    effectiveRate: income > 0 ? total / income : 0,
  };
}

export type OutlayShare = {
  id: string;
  label: string;
  shortLabel: string;
  amount: number;
  color: string;
  share: number;
};

/** Split a dollar amount across positive outlay functions. Shares sum to 1. */
export function allocateByOutlays<T extends { id: string; label: string; shortLabel: string; amount: number; color: string }>(
  tax: number,
  uses: T[],
): Array<T & { share: number; dollars: number }> {
  const positive = uses.filter((row) => row.amount > 0);
  const gross = positive.reduce((sum, row) => sum + row.amount, 0);
  if (gross <= 0) return [];
  return positive
    .map((row) => {
      const share = row.amount / gross;
      return { ...row, share, dollars: tax * share };
    })
    .sort((a, b) => b.amount - a.amount);
}
