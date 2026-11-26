import Link from "next/link";
import { Suspense } from "react";

import { RankBars, TrendChart } from "@/components/charts";
import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatMoney } from "@/lib/format";
import { withFy } from "@/lib/links";
import { colorForOutlay } from "@/lib/palette";
import { bestNonprofitMatch } from "@/lib/sources/propublica";
import {
  getRecipient,
  isNonprofitType,
  spendingByCategory,
  spendingOverTime,
  topAwards,
} from "@/lib/sources/usaspending";
import { getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: decodeURIComponent(id) };
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fy?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <RecipientPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RecipientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fy?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recipientId = decodeURIComponent(id);
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(query.fy, years);

  let profile;
  try {
    profile = await getRecipient(recipientId);
  } catch (error) {
    return (
      <PageFrame>
        <PageIntro eyebrow="Recipient" title="This record did not load." lede="USAspending did not return a profile for that id." />
        <DataError title="Recipient" detail={error instanceof Error ? error.message : undefined} />
      </PageFrame>
    );
  }

  const [series, agencies, awards, nonprofit] = await Promise.all([
    spendingOverTime({ fy, recipientId }).catch(() => null),
    spendingByCategory("awarding_agency", { fy, recipientId }, 8).catch(() => null),
    topAwards({ fy, recipientId }, 6).catch(() => null),
    isNonprofitType(profile.data.businessTypes)
      ? bestNonprofitMatch(profile.data.name).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <PageFrame>
      <PageIntro
        eyebrow={profile.data.location ?? "Recipient"}
        title={profile.data.name}
        lede={
          profile.data.totalAmount != null
            ? `${formatMoney(profile.data.totalAmount)} in transactions on the USAspending profile, across years. The chart below is obligations by fiscal year for this record.`
            : "Obligations by fiscal year for this USAspending record."
        }
      />
      <div className="flex flex-wrap gap-2">
        {profile.data.businessTypes.slice(0, 4).map((type) => (
          <Badge key={type} variant="secondary">
            {type.replaceAll("_", " ")}
          </Badge>
        ))}
        {profile.data.uei ? <Badge variant="outline">UEI {profile.data.uei}</Badge> : null}
      </div>
      {profile.data.parentName ? (
        <p className="text-sm text-muted-foreground">Parent record: {profile.data.parentName}</p>
      ) : null}
      <SourceNote source={profile.source} />
      {nonprofit ? (
        <Link
          href={withFy(`/nonprofits/${nonprofit.ein}`, fy)}
          className="rounded-2xl border bg-card px-4 py-4 hover:bg-muted/70"
        >
          <p className="text-xs tracking-[0.14em] text-primary uppercase">Possible Form 990 match</p>
          <p className="mt-1 font-heading text-xl">{nonprofit.name}</p>
          <p className="text-sm text-muted-foreground">
            EIN {nonprofit.ein}
            {nonprofit.city ? ` · ${nonprofit.city}, ${nonprofit.state ?? ""}` : ""}
          </p>
        </Link>
      ) : null}
      {series ? (
        <section className="rounded-3xl border bg-card p-4 sm:p-6">
          <h2 className="mb-4 font-heading text-2xl tracking-tight">Obligations over time</h2>
          <TrendChart
            primaryLabel="All obligations"
            secondaryLabel="Grants"
            points={series.data.map((point) => ({
              label: String(point.fiscalYear),
              value: point.total,
              secondary: point.grants,
            }))}
          />
          <div className="mt-4">
            <SourceNote source={series.source} />
          </div>
        </section>
      ) : (
        <DataError title="Spending over time" detail="USAspending did not return a yearly series for this id." />
      )}
      {agencies && agencies.data.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl tracking-tight">Awarding agencies in FY{fy}</h2>
          <RankBars
            rows={agencies.data.map((row, index) => ({
              id: String(row.id ?? row.name),
              label: row.name,
              amount: row.amount,
              color: colorForOutlay(row.name, index),
            }))}
          />
          <SourceNote source={agencies.source} />
        </section>
      ) : null}
      {awards && awards.data.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl tracking-tight">Largest awards in FY{fy}</h2>
          <ul className="flex flex-col gap-2">
            {awards.data.map((award) => (
              <li key={award.id} className="rounded-2xl border bg-card px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <a
                    className="text-sm underline-offset-4 hover:underline"
                    href={`https://www.usaspending.gov/award/${award.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {award.name}
                  </a>
                  <span className="font-heading tabular-nums">{formatCompact(award.amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {award.type} · {award.agency}
                </p>
                {award.description ? <p className="mt-1 text-sm">{award.description}</p> : null}
              </li>
            ))}
          </ul>
          <SourceNote source={awards.source} />
        </section>
      ) : null}
    </PageFrame>
  );
}
