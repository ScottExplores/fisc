import Link from "next/link";
import { Suspense } from "react";

import { DataError } from "@/components/data-error";
import { PageFrame, PageIntro, SourceNote } from "@/components/source-note";
import { SearchBox } from "@/components/search-box";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatCompact } from "@/lib/format";
import { withFy } from "@/lib/links";
import { searchRecipients } from "@/lib/sources/usaspending";
import { getCompletedFiscalYears, resolveFiscalYear } from "@/lib/sources/treasury";

export const metadata = { title: "Recipients" };

const SUGGESTIONS = ["Lockheed Martin", "American National Red Cross", "World Vision", "Harvard"];

export default function Page({ searchParams }: { searchParams: Promise<{ fy?: string; q?: string }> }) {
  return (
    <Suspense fallback={null}>
      <SearchPage searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchPage({ searchParams }: { searchParams: Promise<{ fy?: string; q?: string }> }) {
  const params = await searchParams;
  const years = await getCompletedFiscalYears();
  const fy = resolveFiscalYear(params.fy, years);
  const q = (params.q ?? "").trim();
  return (
    <PageFrame>
      <PageIntro
        eyebrow="USAspending"
        title="Find a recipient."
        lede="Search a company, university, nonprofit, or government. Results are USAspending recipient records. The amount shown is that record’s cumulative obligations, not one fiscal year."
      />
      <SearchBox initial={q} fy={fy} />
      {!q ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((name) => (
            <Link
              key={name}
              href={withFy("/recipients", fy, { q: name })}
              className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              {name}
            </Link>
          ))}
        </div>
      ) : (
        <Results q={q} fy={fy} />
      )}
    </PageFrame>
  );
}

async function Results({ q, fy }: { q: string; fy: number }) {
  let found: Awaited<ReturnType<typeof searchRecipients>> | null = null;
  let error: string | null = null;
  try {
    found = await searchRecipients(q);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Recipient search failed.";
  }
  if (!found) return <DataError title="Recipient search" detail={error ?? undefined} />;
  if (found.data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No recipient records</EmptyTitle>
          <EmptyDescription>Try a shorter name, or the legal name on the award.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {found.data.map((hit) => (
          <li key={hit.id}>
            <Link
              href={withFy(`/recipients/${hit.id}`, fy)}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-muted/70"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{hit.name}</span>
                <span className="text-xs text-muted-foreground">
                  {hit.uei ? `UEI ${hit.uei}` : "No UEI on this record"}
                  {hit.level ? ` · level ${hit.level}` : ""}
                </span>
              </span>
              <span className="font-heading tabular-nums">{formatCompact(hit.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <SourceNote source={found.source} />
    </div>
  );
}
