import Link from "next/link";
import { Suspense } from "react";

import { DataError } from "@/components/data-error";
import { FlowView } from "@/components/flow-view";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatPercent } from "@/lib/format";
import { withFy } from "@/lib/links";
import { getFederalFlow, getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Flow" };

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <FlowPage searchParams={searchParams} />
    </Suspense>
  );
}

async function FlowPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  let flow: Awaited<ReturnType<typeof getFederalFlow>> | null = null;
  let error: string | null = null;
  try {
    flow = await getFederalFlow(fy);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The Treasury statement could not be read.";
  }
  if (!flow) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Fiscal year" title="The flow is unavailable." lede="The Treasury statement could not be read." />
        <DataError title="Monthly Treasury Statement" detail={error ?? undefined} />
      </PageFrame>
    );
  }
  const model = flow.data;
  const deficitShare = model.outlayTotal ? model.deficit / model.outlayTotal : 0;
  return (
      <PageFrame>
        <PageIntro
          eyebrow={`Fiscal year ${model.fiscalYear}`}
          title="Where the money comes from, and where it goes."
          lede={`Governmental receipts were ${formatMoney(model.receiptTotal)}. Outlays were ${formatMoney(model.outlayTotal)}. The gap, ${formatMoney(model.deficit)}, is borrowing.`}
        />
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Receipts" value={formatMoney(model.receiptTotal)} detail="Governmental receipts" />
          <Stat label="Outlays" value={formatMoney(model.outlayTotal)} detail="Net outlays" />
          <Stat
            label={model.deficit >= 0 ? "Deficit" : "Surplus"}
            value={formatMoney(Math.abs(model.deficit))}
            detail={model.deficit >= 0 ? `${formatPercent(deficitShare)} of outlays` : "Receipts exceeded outlays"}
          />
        </section>
        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl tracking-tight">The year, as a flow</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The left side is governmental receipts, borrowing, and offsetting receipts. The right side is outlays by budget function. The two sides match. Hover a band for the amount.
            </p>
          </div>
          <FlowView model={model} />
          <SourceNote source={flow.source} />
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          <Jump href={withFy("/revenue", fy)} title="Who pays income tax" body="Share of federal income tax by income bracket and by state, from IRS Statistics of Income." />
          <Jump href={withFy("/spending", fy)} title="Spending by agency" body="Net outlays, then the contracts and grants those departments awarded." />
          <Jump href={withFy("/you", fy)} title="Your taxes" body="A wage, a filing status, and an estimate of how it would split across this year’s outlays." />
        </section>
      </PageFrame>
    );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="fisc-rise rounded-2xl border bg-card px-4 py-4 sm:px-5">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-3xl tracking-tight tabular-nums sm:text-4xl">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function Jump({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
      <span className="font-heading text-xl tracking-tight">{title}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
    </Link>
  );
}

function FrameSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-8">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
