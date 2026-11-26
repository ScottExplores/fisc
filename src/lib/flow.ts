import { cleanName, colorForOutlay, hubColor, receiptColor, shortOutlay } from "./palette";

export type FlowNode = {
  id: string;
  label: string;
  shortLabel: string;
  amount: number;
  side: "source" | "hub" | "use";
  color: string;
};

export type FlowLink = {
  source: string;
  target: string;
  value: number;
};

export type DetailLine = {
  id: string;
  label: string;
  amount: number;
  color: string;
  note?: string;
};

export type FlowModel = {
  fiscalYear: number;
  recordDate: string;
  receiptTotal: number;
  outlayTotal: number;
  /** Positive when outlays exceed governmental receipts. */
  deficit: number;
  sources: FlowNode[];
  uses: FlowNode[];
  hub: FlowNode;
  links: FlowLink[];
  receiptDetails: DetailLine[];
  /** Parts of payroll taxes. Already included in the payroll line of receiptDetails. */
  payrollParts: DetailLine[];
  outlayDetails: DetailLine[];
  /** Absolute gap left after using published totals. Zero when the statement lines add up. */
  residual: number;
};

export type MtsRow = {
  classification_desc: string;
  current_fytd_rcpt_outly_amt: string | null;
  sequence_number_cd: string;
  record_date: string;
  record_fiscal_year: string;
};

const RECEIPT_META: Record<string, { id: string; label: string; short: string; color: string }> = {
  "1.1": { id: "individual", label: "Individual income taxes", short: "Income taxes", color: receiptColor.individual },
  "1.2": { id: "corporate", label: "Corporate income taxes", short: "Corporate", color: receiptColor.corporate },
  "1.3": { id: "payroll", label: "Payroll taxes", short: "Payroll taxes", color: receiptColor.payroll },
  "1.4": { id: "excise", label: "Excise taxes", short: "Excise", color: receiptColor.excise },
  "1.5": { id: "estate", label: "Estate and gift taxes", short: "Estate & gift", color: receiptColor.estate },
  "1.6": { id: "customs", label: "Customs duties", short: "Customs", color: receiptColor.customs },
  "1.7": { id: "miscellaneous", label: "Miscellaneous receipts", short: "Miscellaneous", color: receiptColor.miscellaneous },
};

function amountOf(row: MtsRow): number | null {
  if (row.current_fytd_rcpt_outly_amt == null || row.current_fytd_rcpt_outly_amt === "") return null;
  const value = Number(row.current_fytd_rcpt_outly_amt);
  return Number.isFinite(value) ? value : null;
}

function parentCode(code: string): string | null {
  const index = code.lastIndexOf(".");
  return index === -1 ? null : code.slice(0, index);
}

function directChildren(rows: MtsRow[], code: string): MtsRow[] {
  return rows
    .filter((row) => parentCode(row.sequence_number_cd) === code)
    .sort((a, b) => a.sequence_number_cd.localeCompare(b.sequence_number_cd, undefined, { numeric: true }));
}

function rolledAmount(rows: MtsRow[], row: MtsRow): number | null {
  const own = amountOf(row);
  if (own != null) return own;
  const kids = directChildren(rows, row.sequence_number_cd);
  if (kids.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const kid of kids) {
    const value = rolledAmount(rows, kid);
    if (value != null) {
      sum += value;
      any = true;
    }
  }
  return any ? sum : null;
}

export function buildFlow(rows: MtsRow[]): FlowModel {
  if (rows.length === 0) {
    throw new Error("Monthly Treasury Statement returned no rows.");
  }
  const fiscalYear = Number(rows[0].record_fiscal_year);
  const recordDate = rows[0].record_date;

  const receiptTotalRow = rows.find(
    (row) => row.classification_desc === "Total" && parentCode(row.sequence_number_cd) === "1",
  );
  const outlayTotalRow = rows.find(
    (row) => row.classification_desc === "Total" && parentCode(row.sequence_number_cd) === "2",
  );
  const receiptTotal = receiptTotalRow ? amountOf(receiptTotalRow) : null;
  const outlayTotal = outlayTotalRow ? amountOf(outlayTotalRow) : null;
  if (receiptTotal == null || outlayTotal == null) {
    throw new Error("Monthly Treasury Statement is missing receipt or outlay totals.");
  }

  const receiptDetails: DetailLine[] = [];
  const payrollParts: DetailLine[] = [];
  const sources: FlowNode[] = [];

  for (const row of directChildren(rows, "1")) {
    if (row.classification_desc === "Total") continue;
    const value = rolledAmount(rows, row);
    if (value == null) continue;
    const meta = RECEIPT_META[row.sequence_number_cd];
    const label = meta?.label ?? cleanName(row.classification_desc);
    const id = meta?.id ?? `receipt-${row.sequence_number_cd}`;
    const color = meta?.color ?? receiptColor.other;
    receiptDetails.push({ id, label, amount: value, color });
    if (row.sequence_number_cd === "1.3") {
      for (const kid of directChildren(rows, row.sequence_number_cd)) {
        const part = rolledAmount(rows, kid);
        if (part == null) continue;
        payrollParts.push({
          id: `${id}-${kid.sequence_number_cd}`,
          label: cleanName(kid.classification_desc),
          amount: part,
          color,
          note: "Included in payroll taxes",
        });
      }
    }
    sources.push({
      id,
      label,
      shortLabel: meta?.short ?? label,
      amount: value,
      side: "source",
      color,
    });
  }

  const categorySum = sources.reduce((sum, node) => sum + node.amount, 0);
  const receiptGap = receiptTotal - categorySum;
  if (Math.abs(receiptGap) >= 1) {
    sources.push({
      id: "receipt-residual",
      label: "Other governmental receipts",
      shortLabel: "Other receipts",
      amount: receiptGap,
      side: "source",
      color: receiptColor.other,
    });
    receiptDetails.push({
      id: "receipt-residual",
      label: "Other governmental receipts",
      amount: receiptGap,
      color: receiptColor.other,
      note: "Difference between the published total and the sum of the lines above",
    });
  }

  const outlayDetails: DetailLine[] = [];
  const uses: FlowNode[] = [];
  const offsetting: FlowNode[] = [];

  for (const row of directChildren(rows, "2")) {
    if (row.classification_desc === "Total") continue;
    const value = rolledAmount(rows, row);
    if (value == null || value === 0) continue;
    const full = cleanName(row.classification_desc);
    const color = value < 0 ? receiptColor.offset : colorForOutlay(full, uses.length);
    const shortLabel = shortOutlay(full);
    outlayDetails.push({ id: `outlay-${row.sequence_number_cd}`, label: full, amount: value, color });
    if (value < 0) {
      offsetting.push({
        id: `offset-${row.sequence_number_cd}`,
        label: `${full} (offsetting receipt)`,
        shortLabel: shortLabel,
        amount: Math.abs(value),
        side: "source",
        color,
      });
    } else {
      uses.push({
        id: `outlay-${row.sequence_number_cd}`,
        label: full,
        shortLabel,
        amount: value,
        side: "use",
        color,
      });
    }
  }

  const deficit = outlayTotal - receiptTotal;
  if (deficit > 0) {
    sources.push({
      id: "borrowing",
      label: "Borrowing (deficit)",
      shortLabel: "Borrowing",
      amount: deficit,
      side: "source",
      color: receiptColor.borrowing,
    });
  } else if (deficit < 0) {
    uses.push({
      id: "surplus",
      label: "Surplus",
      shortLabel: "Surplus",
      amount: Math.abs(deficit),
      side: "use",
      color: receiptColor.borrowing,
    });
  }

  sources.push(...offsetting);

  const sourceSum = sources.reduce((sum, node) => sum + node.amount, 0);
  const useSum = uses.reduce((sum, node) => sum + node.amount, 0);
  const residual = sourceSum - useSum;
  if (Math.abs(residual) >= 1) {
    if (residual > 0) {
      uses.push({
        id: "use-residual",
        label: "Reconciling item",
        shortLabel: "Reconciling item",
        amount: residual,
        side: "use",
        color: receiptColor.other,
      });
    } else {
      sources.push({
        id: "source-residual",
        label: "Reconciling item",
        shortLabel: "Reconciling item",
        amount: Math.abs(residual),
        side: "source",
        color: receiptColor.other,
      });
    }
  }

  sources.sort((a, b) => b.amount - a.amount);
  uses.sort((a, b) => b.amount - a.amount);

  const balancedSources = sources.reduce((sum, node) => sum + node.amount, 0);
  const hub: FlowNode = {
    id: "budget",
    label: `Federal budget, FY${fiscalYear}`,
    shortLabel: "Federal budget",
    amount: balancedSources,
    side: "hub",
    color: hubColor,
  };

  const links: FlowLink[] = [
    ...sources.map((node) => ({ source: node.id, target: hub.id, value: node.amount })),
    ...uses.map((node) => ({ source: hub.id, target: node.id, value: node.amount })),
  ];

  return {
    fiscalYear,
    recordDate,
    receiptTotal,
    outlayTotal,
    deficit,
    sources,
    uses,
    hub,
    links,
    receiptDetails,
    payrollParts,
    outlayDetails,
    residual,
  };
}
