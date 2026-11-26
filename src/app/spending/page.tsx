import { Suspense } from "react";

import { RankBars } from "@/components/charts";
import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { formatMoney } from "@/lib/format";
import { withFy } from "@/lib/links";
import { colorForOutlay } from "@/lib/palette";
import { getAgencyReport, getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Spending" };

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  return (
    <Suspense fallback={null}>
      <SpendingPage searchParams={searchParams} />
    </Suspense>
  );
}

async function SpendingPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  let report: Awaited<ReturnType<typeof getAgencyReport>> | null = null;
  let error: string | null = null;
  try {
    report = await getAgencyReport(fy);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Agency outlays did not load.";
  }
  if (!report) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Spending" title="Agency outlays did not load." lede="The Monthly Treasury Statement is the source for this list." />
        <DataError title="Treasury Table 5" detail={error ?? undefined} />
      </PageFrame>
    );
  }
  const positive = report.data.agencies.filter((agency) => agency.amount > 0);
  return (
      <PageFrame>
        <PageIntro
          eyebrow={`Fiscal year ${fy}`}
          title="Net outlays by agency."
          lede={`${formatMoney(report.data.totalOutlays)} is the sum of agency totals in the September statement. Open an agency for its bureaus, assistance listings, and largest award recipients.`}
        />
        <section className="rounded-3xl border bg-card p-4 sm:p-6">
          <RankBars
            total={report.data.totalOutlays}
            rows={positive.map((agency, index) => ({
              id: agency.slug,
              label: agency.name,
              amount: agency.amount,
              color: colorForOutlay(agency.name, index),
              href: withFy(`/spending/${agency.slug}`, fy),
            }))}
          />
          <div className="mt-6">
            <SourceNote source={report.source} />
          </div>
        </section>
        {report.data.agencies.some((agency) => agency.amount < 0) ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-2xl tracking-tight">Agencies with net receipts</h2>
            <p className="text-sm text-muted-foreground">
              A negative net outlay means offsetting receipts exceeded spending for that account.
            </p>
            <RankBars
              rows={report.data.agencies
                .filter((agency) => agency.amount < 0)
                .map((agency) => ({
                  id: agency.slug,
                  label: agency.name,
                  amount: agency.amount,
                  color: "#6e8a72",
                  href: withFy(`/spending/${agency.slug}`, fy),
                }))}
            />
          </section>
        ) : null}
      </PageFrame>
    );
}
