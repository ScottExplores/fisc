import Link from "next/link";
import { Suspense } from "react";

import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { formatMoney } from "@/lib/format";
import { withFy } from "@/lib/links";
import { bestNonprofitMatch } from "@/lib/sources/propublica";
import { topNonprofitGrants } from "@/lib/sources/usaspending";
import { getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Nonprofits" };

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  return (
    <Suspense fallback={null}>
      <NonprofitPage searchParams={searchParams} />
    </Suspense>
  );
}

async function NonprofitPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  let grants: Awaited<ReturnType<typeof topNonprofitGrants>> | null = null;
  let error: string | null = null;
  try {
    grants = await topNonprofitGrants(fy, 12);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "USAspending did not return nonprofit grants.";
  }
  if (!grants) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Nonprofits" title="The grant list did not load." lede="USAspending classifies recipients. That filter can be slow." />
        <DataError title="Nonprofit grants" detail={error ?? undefined} />
      </PageFrame>
    );
  }
  const matches = await Promise.all(
      grants.data.slice(0, 8).map(async (row) => {
        try {
          return await bestNonprofitMatch(row.name);
        } catch {
          return null;
        }
      }),
    );
    return (
      <PageFrame>
        <PageIntro
          eyebrow={`Fiscal year ${fy} · grant obligations`}
          title="Nonprofit recipients of federal grants."
          lede="These are prime recipients USAspending classifies as nonprofits, limited to grant awards. A Form 990 link appears when the legal name is a close match in ProPublica’s index. Medicaid and other grants to state governments are not in this list."
        />
        <ul className="flex flex-col gap-3">
          {grants.data.map((row, index) => {
            const match = index < matches.length ? matches[index] : null;
            return (
              <li key={row.recipientId ?? row.name} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {row.recipientId ? (
                      <Link href={withFy(`/recipients/${row.recipientId}`, fy)} className="text-base hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      <p>{row.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{row.uei ? `UEI ${row.uei}` : "No UEI"}</p>
                  </div>
                  <p className="font-heading text-2xl tracking-tight tabular-nums">{formatMoney(row.amount)}</p>
                </div>
                {match ? (
                  <Link
                    href={withFy(`/nonprofits/${match.ein}`, fy, {
                      award: row.name,
                      rid: row.recipientId ?? undefined,
                    })}
                    className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Form 990: {match.name} · EIN {match.ein}
                  </Link>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">No close Form 990 name match in the first search results.</p>
                )}
              </li>
            );
          })}
        </ul>
        <SourceNote source={grants.source} />
      </PageFrame>
    );
}
