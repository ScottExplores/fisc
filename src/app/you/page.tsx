import { Suspense } from "react";

import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { TaxCalculator } from "@/components/tax-calculator";
import { getIncomeByState } from "@/lib/sources/irs";
import { getFederalFlow, getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Your taxes" };

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  return (
    <Suspense fallback={null}>
      <YouPage searchParams={searchParams} />
    </Suspense>
  );
}

async function YouPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  let flow: Awaited<ReturnType<typeof getFederalFlow>> | null = null;
  let states: Awaited<ReturnType<typeof getIncomeByState>> | null = null;
  let error: string | null = null;
  try {
    [flow, states] = await Promise.all([getFederalFlow(fy), getIncomeByState()]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The budget totals did not load.";
  }
  if (!flow || !states) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Your taxes" title="The estimate needs the budget totals." lede="Those totals come from the Monthly Treasury Statement." />
        <DataError title="Calculator data" detail={error ?? undefined} />
      </PageFrame>
    );
  }
  return (
      <PageFrame>
        <PageIntro
          eyebrow={`Tax year 2026 · budget shares from FY${fy}`}
          title="An estimate of federal tax on wages."
          lede="Ordinary wage income, the standard deduction, and employee payroll taxes. No credits, no itemizing, no capital gains. The split uses gross outlays by budget function for the fiscal year selected in the header."
        />
        <TaxCalculator
          fiscalYear={fy}
          outlays={flow.data.uses}
          nationalTax={states.data.national.incomeTax}
          states={states.data.states.map((state) => ({ code: state.code, incomeTax: state.incomeTax }))}
        />
        <div className="flex flex-col gap-2">
          <SourceNote source={flow.source} />
          <SourceNote source={states.source} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Income-tax brackets and the standard deduction: IRS Revenue Procedure 2025-32 and IR-2025-103, tax year 2026. Social Security wage base of $184,500 and the 6.2% and 1.45% employee rates: IRS Publication 15 (2026). Additional Medicare tax thresholds are set in statute and are not adjusted for inflation. This is not tax advice.
          </p>
      </div>
    </PageFrame>
  );
}
