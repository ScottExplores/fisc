import { formatDate } from "@/lib/format";
import type { SourceRef } from "@/lib/sources/types";

export function SourceNote({ source }: { source: SourceRef }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <a
        href={source.url}
        className="underline decoration-border underline-offset-4 hover:text-foreground"
        target="_blank"
        rel="noreferrer"
      >
        {source.name}
      </a>
      <span> · {source.publisher}</span>
      {source.fiscalYear ? <span> · Fiscal year {source.fiscalYear}</span> : null}
      {source.taxYear ? <span> · Tax year {source.taxYear}</span> : null}
      {source.asOf && source.asOf.includes("-") && !source.asOf.includes("/") ? (
        <span> · statement of {formatDate(source.asOf)}</span>
      ) : null}
      {source.notes ? <span> · {source.notes}</span> : null}
    </p>
  );
}

export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="flex max-w-3xl flex-col gap-3">
      <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      <h1 className="font-heading text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">{title}</h1>
      <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{lede}</p>
    </header>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6 pb-28 md:px-6 md:pb-16">{children}</div>;
}
