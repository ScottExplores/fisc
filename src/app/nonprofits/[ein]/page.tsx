import Link from "next/link";
import { Suspense } from "react";

import { TrendChart } from "@/components/charts";
import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { formatDollars, formatMoney, formatPercent } from "@/lib/format";
import { withFy } from "@/lib/links";
import { getNonprofit } from "@/lib/sources/propublica";
import { searchRecipients, spendingOverTime } from "@/lib/sources/usaspending";
import { getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export async function generateMetadata({ params }: { params: Promise<{ ein: string }> }) {
  const { ein } = await params;
  return { title: `EIN ${ein}` };
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ ein: string }>;
  searchParams: Promise<{ fy?: string; award?: string; rid?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <FilingPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function FilingPage({
  params,
  searchParams,
}: {
  params: Promise<{ ein: string }>;
  searchParams: Promise<{ fy?: string; award?: string; rid?: string }>;
}) {
  const [{ ein }, query] = await Promise.all([params, searchParams]);
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(query.fy, years);
  let org;
  try {
    org = await getNonprofit(ein);
  } catch (error) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Form 990" title="This EIN did not load." lede="ProPublica Nonprofit Explorer did not return the organization." />
        <DataError title="Nonprofit Explorer" detail={error instanceof Error ? error.message : undefined} />
      </PageFrame>
    );
  }
  const latest = org.data.filings[0];
  const awardName = query.award?.trim() || org.data.name;
  const recipientId = query.rid?.trim() || undefined;
  const awards = await spendingOverTime(
    recipientId ? { fy, recipientId } : { fy, recipientName: awardName },
  ).catch(() => null);
  const recipient = recipientId ? null : await searchRecipients(awardName, 1).catch(() => null);
  const latestGrant = awards?.data.find((point) => point.fiscalYear === fy)?.grants ?? null;
  const grantShare =
    latest && latest.revenue && latestGrant != null && latest.revenue > 0 ? latestGrant / latest.revenue : null;

  return (
    <PageFrame>
      <PageIntro
        eyebrow={[org.data.city, org.data.state].filter(Boolean).join(", ") || "Form 990"}
        title={org.data.name}
        lede={`EIN ${org.data.ein}. The filing summary is what ProPublica publishes from IRS extracts. Federal grant figures beside it are USAspending obligations to recipients matching this name, which may not be the same accounting year or the same legal entity.`}
      />
      <div className="flex flex-wrap gap-3">
        <a
          className="text-sm underline underline-offset-4"
          href={org.source.url}
          target="_blank"
          rel="noreferrer"
        >
          Open in Nonprofit Explorer
        </a>
        {recipientId || recipient?.data[0] ? (
          <Link
            className="text-sm underline underline-offset-4"
            href={withFy(`/recipients/${recipientId ?? recipient?.data[0]?.id}`, fy)}
          >
            USAspending record
          </Link>
        ) : null}
      </div>
      {latest ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Figure label={`Revenue, ${latest.taxYear ?? "latest filing"}`} value={formatDollars(latest.revenue ?? 0)} />
          <Figure label="Officer compensation" value={formatDollars(latest.officerCompensation ?? 0)} />
          <Figure
            label={`Federal grant obligations, FY${fy}`}
            value={latestGrant == null ? "—" : formatMoney(latestGrant)}
            detail={
              grantShare == null
                ? "Name search on USAspending, not the Form 990 government-grants line."
                : `${formatPercent(grantShare)} of the latest reported total revenue. Years may not match.`
            }
          />
        </section>
      ) : null}
      <section className="overflow-x-auto rounded-3xl border bg-card">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Expenses</th>
              <th className="px-4 py-3 font-medium">Contributions</th>
              <th className="px-4 py-3 font-medium">Officer pay</th>
              <th className="px-4 py-3 font-medium">Share of expenses</th>
            </tr>
          </thead>
          <tbody>
            {org.data.filings.map((filing) => (
              <tr key={`${filing.taxYear}-${filing.period}`} className="border-t">
                <td className="px-4 py-3">{filing.taxYear ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{formatDollars(filing.revenue ?? 0)}</td>
                <td className="px-4 py-3 tabular-nums">{formatDollars(filing.expenses ?? 0)}</td>
                <td className="px-4 py-3 tabular-nums">{formatDollars(filing.contributions ?? 0)}</td>
                <td className="px-4 py-3 tabular-nums">{formatDollars(filing.officerCompensation ?? 0)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {filing.officerCompensationShare == null ? "—" : `${filing.officerCompensationShare.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <SourceNote source={org.source} />
      {awards ? (
        <section className="rounded-3xl border bg-card p-4 sm:p-6">
          <h2 className="mb-2 font-heading text-2xl tracking-tight">Federal award obligations by name</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            USAspending {recipientId ? "record" : `search for “${awardName}”`}. The dashed line is grant obligations. The Form 990 name is “{org.data.name}”.
          </p>
          <TrendChart
            primaryLabel="All obligations"
            secondaryLabel="Grants"
            points={awards.data.map((point) => ({
              label: String(point.fiscalYear),
              value: point.total,
              secondary: point.grants,
            }))}
          />
          <div className="mt-4">
            <SourceNote source={awards.source} />
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-3xl tracking-tight tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
