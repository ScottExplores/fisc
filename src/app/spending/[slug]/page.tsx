import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RankBars } from "@/components/charts";
import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { withFy } from "@/lib/links";
import { colorForOutlay } from "@/lib/palette";
import {
  getToptierAgencies,
  matchToptier,
  spendingByCategory,
  type CategoryResult,
} from "@/lib/sources/usaspending";
import { getAgency, getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fy?: string; program?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <AgencyPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AgencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fy?: string; program?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(query.fy, years);
  const agency = await getAgency(fy, slug);
  if (!agency) notFound();

  let toptierName: string | null = null;
  try {
    const toptiers = await getToptierAgencies();
    toptierName = matchToptier(agency.data.name, toptiers)?.name ?? null;
  } catch {
    toptierName = null;
  }

  let programs: CategoryResult[] = [];
  let recipients: CategoryResult[] = [];
  let awardError: string | null = null;
  let awardSource = null as Awaited<ReturnType<typeof spendingByCategory>>["source"] | null;
  if (toptierName) {
    try {
      const [programResult, recipientResult] = await Promise.all([
        spendingByCategory("cfda", { fy, agencyName: toptierName }, 12),
        spendingByCategory(
          "recipient",
          { fy, agencyName: toptierName, programNumber: query.program },
          12,
        ),
      ]);
      programs = programResult.data;
      recipients = recipientResult.data.filter((row) => row.name !== "MULTIPLE RECIPIENTS");
      awardSource = recipientResult.source;
    } catch (error) {
      awardError = error instanceof Error ? error.message : "USAspending did not respond.";
    }
  }
  const selected = programs.find((program) => program.code === query.program);

  return (
    <PageFrame>
      <PageIntro
        eyebrow={`Fiscal year ${fy} · net outlays`}
        title={agency.data.name}
        lede={`${formatMoney(agency.data.amount)} in net outlays on the Monthly Treasury Statement. Award amounts further down are obligations reported to USAspending, a different measure.`}
      />
      <SourceNote source={agency.source} />
      <section className="rounded-3xl border bg-card p-4 sm:p-6">
        <h2 className="mb-4 font-heading text-2xl tracking-tight">Bureaus and accounts</h2>
        <RankBars
          rows={agency.data.bureaus.slice(0, 16).map((bureau, index) => ({
            id: bureau.name,
            label: bureau.name,
            amount: bureau.amount,
            color: colorForOutlay(bureau.name, index),
          }))}
        />
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-tight">Assistance listings</h2>
          <p className="text-sm text-muted-foreground">
            {toptierName
              ? `Award obligations from ${toptierName}. Select a listing to limit the recipient list.`
              : "This Treasury account is not matched to a single USAspending awarding agency, so award drill-down is not shown."}
          </p>
        </div>
        {awardError ? <DataError title="USAspending" detail={awardError} /> : null}
        {programs.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {programs.map((program) => {
              const on = program.code === query.program;
              return (
                <li key={String(program.code)}>
                  <Link
                    href={withFy(`/spending/${slug}`, fy, { program: program.code ?? undefined })}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${on ? "bg-secondary" : "bg-card hover:bg-muted/70"}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm">{program.name}</span>
                      <span className="text-xs text-muted-foreground">{program.code}</span>
                    </span>
                    <span className="font-heading tabular-nums">{formatMoney(program.amount)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      {toptierName ? (
        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl tracking-tight">
              {selected ? selected.name : "Largest recipients"}
            </h2>
            {query.program ? (
              <Badge variant="secondary">
                <Link href={withFy(`/spending/${slug}`, fy)}>Clear listing</Link>
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            “Multiple recipients” is omitted. These are prime award recipients, not sub-awardees.
          </p>
          <RankBars
            rows={recipients.map((row, index) => ({
              id: row.recipientId ?? row.name,
              label: row.name,
              amount: row.amount,
              color: colorForOutlay(row.name, index),
              href: row.recipientId ? withFy(`/recipients/${row.recipientId}`, fy) : undefined,
            }))}
          />
          {awardSource ? <SourceNote source={awardSource} /> : null}
        </section>
      ) : null}
    </PageFrame>
  );
}
