import { Suspense } from "react";

import { ShareCompare } from "@/components/charts";
import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { StateExplorer } from "@/components/state-explorer";
import { formatMoney, formatPercent } from "@/lib/format";
import { getIncomeBrackets, getIncomeByState } from "@/lib/sources/irs";
import { getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Who pays" };

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RevenuePage searchParams={searchParams} />
    </Suspense>
  );
}

async function RevenuePage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  let brackets: Awaited<ReturnType<typeof getIncomeBrackets>> | null = null;
  let states: Awaited<ReturnType<typeof getIncomeByState>> | null = null;
  let error: string | null = null;
  try {
    [brackets, states] = await Promise.all([getIncomeBrackets(), getIncomeByState()]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Statistics of Income did not load.";
  }
  if (!brackets || !states) {
    return (
      <PageFrame>
        <PageIntro eyebrow="IRS" title="The income-tax tables did not load." lede="Statistics of Income is published as files, not a live query API." />
        <DataError title="Statistics of Income" detail={error ?? undefined} />
      </PageFrame>
    );
  }
  const rows = brackets.data.brackets.map((bracket) => ({
      label: bracket.label,
      taxShare: brackets.data.allIncomeTax ? bracket.incomeTax / brackets.data.allIncomeTax : 0,
      returnShare: brackets.data.allReturns ? bracket.returns / brackets.data.allReturns : 0,
    }));
    return (
      <PageFrame>
        <PageIntro
          eyebrow={`Shown with fiscal year ${fy}`}
          title="Who pays federal income tax."
          lede="Income tax is one receipt among several. These tables are the latest IRS Statistics of Income release, tax year 2023, which is behind the fiscal year on the flow."
        />
        <section className="grid gap-3 sm:grid-cols-3">
          <Figure label="Income tax" value={formatMoney(brackets.data.allIncomeTax)} detail="Publication 1304, all returns" />
          <Figure label="Returns" value={brackets.data.allReturns.toLocaleString("en-US")} detail="Sample estimate of returns filed" />
          <Figure
            label="Top bracket’s share of tax"
            value={formatPercent(rows[rows.length - 1]?.taxShare ?? 0)}
            detail={rows[rows.length - 1]?.label ?? ""}
          />
        </section>
        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl tracking-tight">By size of adjusted gross income</h2>
            <p className="text-sm text-muted-foreground">
              The upper bar is the group’s share of total income tax. The lower bar is its share of returns. Adjusted gross income is not the same thing as wages.
            </p>
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Share of income tax</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-1" /> Share of returns</span>
            </div>
          </div>
          <ShareCompare rows={rows} />
          <SourceNote source={brackets.source} />
        </section>
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl tracking-tight">By state</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Historic Table 2 is a different IRS product from the bracket table above, so the national income-tax total will not match to the dollar. Amounts are income tax (field A06500). Open a state to see the same tax split by income band.
            </p>
          </div>
          <StateExplorer states={states.data.states} nationalTax={states.data.national.incomeTax} />
        <SourceNote source={states.source} />
      </section>
    </PageFrame>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-3xl tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
