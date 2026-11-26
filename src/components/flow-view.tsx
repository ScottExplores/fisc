"use client";

import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { useMemo, useState } from "react";

import { formatCompact, formatMoney, formatPercent } from "@/lib/format";
import type { FlowModel, FlowNode } from "@/lib/flow";

type Extra = {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  side: FlowNode["side"];
  amount: number;
  rank: number;
};
type SNode = SankeyNode<Extra, { value: number }>;
type SLink = SankeyLink<Extra, { value: number }>;

export function FlowView({ model }: { model: FlowModel }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="hidden lg:block">
        <SankeyChart model={model} />
      </div>
      <div className="lg:hidden">
        <FlowStack model={model} />
      </div>
    </div>
  );
}

function FlowStack({ model }: { model: FlowModel }) {
  const total = model.hub.amount || 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Money in</p>
        <div className="flex h-9 overflow-hidden rounded-full bg-muted">
          {model.sources.map((node, index) => (
            <div
              key={node.id}
              className="fisc-bar h-full"
              style={{
                width: `${(node.amount / total) * 100}%`,
                background: node.color,
                animationDelay: `${index * 40}ms`,
              }}
              title={`${node.label}: ${formatMoney(node.amount)}`}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {model.sources.map((node) => (
            <li key={node.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: node.color }} />
                <span className="truncate">{node.shortLabel}</span>
              </span>
              <span className="font-heading tabular-nums">{formatCompact(node.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-center">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">All funds</p>
        <p className="font-heading text-3xl tracking-tight tabular-nums">{formatMoney(model.hub.amount, 2)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Receipts, borrowing, and offsetting receipts. Larger than net outlays.</p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Money out</p>
        <ul className="flex flex-col gap-3">
          {model.uses.map((node, index) => (
            <li key={node.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{node.shortLabel}</span>
                <span className="font-heading tabular-nums">{formatCompact(node.amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="fisc-bar h-full rounded-full"
                  style={{
                    width: `${(node.amount / total) * 100}%`,
                    background: node.color,
                    animationDelay: `${index * 30}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SankeyChart({ model }: { model: FlowModel }) {
  const width = 1120;
  const height = Math.max(680, Math.max(model.sources.length, model.uses.length) * 36);
  const [hover, setHover] = useState<{ x: number; y: number; title: string; body: string } | null>(null);

  const graph = useMemo(() => {
    const nodes = [
      ...model.sources.map((node, index) => ({ ...node, rank: index })),
      { ...model.hub, rank: 500 },
      ...model.uses.map((node, index) => ({ ...node, rank: 1000 + index })),
    ];
    const generator = sankey<Extra & { rank: number }, { value: number }>()
      .nodeId((node) => node.id)
      .nodeWidth(16)
      .nodePadding(14)
      .nodeSort((a, b) => a.rank - b.rank)
      .extent([
        [210, 18],
        [width - 230, height - 16],
      ]);
    return generator({
      nodes: nodes.map((node) => ({ ...node })),
      links: model.links.map((link) => ({ ...link })),
    });
  }, [model, height]);

  const linkPath = sankeyLinkHorizontal<SNode, SLink>();

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full text-foreground"
        role="img"
        aria-label={`Flow of federal funds in fiscal year ${model.fiscalYear}`}
      >
        <defs>
          {graph.links.map((link, index) => {
            const source = link.source as SNode;
            const target = link.target as SNode;
            return (
              <linearGradient
                key={`${source.id}-${target.id}-${index}`}
                id={`flow-${index}`}
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor={source.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={target.color} stopOpacity={0.9} />
              </linearGradient>
            );
          })}
        </defs>
        {graph.links.map((link, index) => {
          const source = link.source as SNode;
          const target = link.target as SNode;
          const dim = hover && !hover.title.includes(source.shortLabel) && !hover.title.includes(target.shortLabel);
          return (
            <path
              key={`${source.id}-${target.id}-${index}`}
              d={linkPath(link as SLink) ?? undefined}
              fill="none"
              stroke={`url(#flow-${index})`}
              strokeWidth={Math.max(1, link.width ?? 1)}
              strokeOpacity={dim ? 0.12 : 0.78}
              className="sankey-link"
              style={{ animationDelay: `${Math.min(index, 24) * 18}ms` }}
              onMouseEnter={(event) => {
                const svg = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                const share = model.hub.amount ? (link.value ?? 0) / model.hub.amount : 0;
                setHover({
                  x: event.clientX - (svg?.left ?? 0),
                  y: event.clientY - (svg?.top ?? 0),
                  title: `${source.shortLabel} → ${target.shortLabel}`,
                  body: `${formatMoney(link.value ?? 0)} · ${formatPercent(share)} of the budget`,
                });
              }}
              onMouseMove={(event) => {
                const svg = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                setHover((current) =>
                  current
                    ? { ...current, x: event.clientX - (svg?.left ?? 0), y: event.clientY - (svg?.top ?? 0) }
                    : current,
                );
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {graph.nodes.map((node) => {
          const x0 = node.x0 ?? 0;
          const x1 = node.x1 ?? 0;
          const y0 = node.y0 ?? 0;
          const y1 = node.y1 ?? 0;
          const labelLeft = node.side === "source";
          const labelRight = node.side === "use";
          return (
            <g key={node.id}>
              <rect
                x={x0}
                y={y0}
                width={Math.max(0, x1 - x0)}
                height={Math.max(1, y1 - y0)}
                rx={4}
                fill={node.color}
              />
              {labelLeft ? (
                <text
                  x={x0 - 10}
                  y={(y0 + y1) / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="currentColor"
                  fontSize={12}
                >
                  {node.shortLabel} {formatCompact(node.amount)}
                </text>
              ) : null}
              {labelRight ? (
                <text
                  x={x1 + 10}
                  y={(y0 + y1) / 2}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill="currentColor"
                  fontSize={12}
                >
                  {node.shortLabel} {formatCompact(node.amount)}
                </text>
              ) : null}
              {node.side === "hub" ? (
                <text
                  x={(x0 + x1) / 2}
                  y={y0 - 6}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.62}
                  fontSize={12}
                >
                  All funds
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
          style={{ left: Math.min(hover.x + 12, 640), top: hover.y + 12 }}
        >
          <p className="font-medium">{hover.title}</p>
          <p className="text-muted-foreground">{hover.body}</p>
        </div>
      ) : null}
    </div>
  );
}
