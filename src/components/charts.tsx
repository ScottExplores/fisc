"use client";

import Link from "next/link";
import { useState } from "react";

import { formatCompact, formatMoney, formatPercent } from "@/lib/format";

export type BarRow = {
  id: string;
  label: string;
  amount: number;
  color: string;
  href?: string;
  note?: string;
};

export function RankBars({ rows, total }: { rows: BarRow[]; total?: number }) {
  const max = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);
  const basis = total && total !== 0 ? total : rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, index) => {
        const share = basis ? row.amount / basis : 0;
        const width = `${Math.max(1.5, (Math.abs(row.amount) / max) * 100)}%`;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3" title={`${row.label}: ${formatMoney(row.amount)} (${formatPercent(share)})`}>
              <span className="min-w-0 truncate text-sm">{row.label}</span>
              <span className="shrink-0 text-right">
                <span className="font-heading text-base tabular-nums">{formatCompact(row.amount)}</span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">{formatPercent(share)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="fisc-bar h-full rounded-full"
                style={{ width, background: row.color, animationDelay: `${Math.min(index, 18) * 25}ms` }}
              />
            </div>
            {row.note ? <p className="text-xs text-muted-foreground">{row.note}</p> : null}
          </>
        );
        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className="flex flex-col gap-1 rounded-lg px-1 py-1 hover:bg-muted/70">
                {body}
              </Link>
            ) : (
              <div className="flex flex-col gap-1 px-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type TrendPoint = { label: string; value: number; secondary?: number };

export function TrendChart({
  points,
  primaryLabel,
  secondaryLabel,
}: {
  points: TrendPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;
  const width = 640;
  const height = 220;
  const pad = { l: 16, r: 16, t: 18, b: 28 };
  const max = Math.max(...points.map((point) => Math.max(point.value, point.secondary ?? 0)), 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) => pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const line = (key: "value" | "secondary") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point[key] ?? 0).toFixed(1)}`)
      .join(" ");
  const area = `${line("value")} L ${x(points.length - 1).toFixed(1)} ${pad.t + innerH} L ${x(0).toFixed(1)} ${pad.t + innerH} Z`;
  const current = active == null ? points[points.length - 1] : points[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-heading text-3xl tracking-tight tabular-nums">{formatMoney(current.value)}</p>
          <p className="text-sm text-muted-foreground">
            {primaryLabel}
            {current ? ` · FY${current.label}` : ""}
          </p>
        </div>
        {secondaryLabel && current.secondary != null ? (
          <p className="text-sm text-muted-foreground">
            {secondaryLabel}: <span className="font-heading text-foreground tabular-nums">{formatCompact(current.secondary)}</span>
          </p>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={primaryLabel}>
        <path d={area} fill="var(--primary)" opacity={0.12} />
        <path d={line("value")} fill="none" stroke="var(--primary)" strokeWidth={2.5} pathLength={1} className="trend-line" />
        {secondaryLabel ? (
          <path d={line("secondary")} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="4 4" />
        ) : null}
        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r={active === index ? 5 : 3.5}
              fill="var(--primary)"
            />
            <text x={x(index)} y={height - 8} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
              {point.label}
            </text>
            <rect
              x={x(index) - innerW / points.length / 2}
              y={pad.t}
              width={innerW / points.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ShareCompare({
  rows,
}: {
  rows: { label: string; taxShare: number; returnShare: number }[];
}) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatPercent(row.taxShare)} of tax · {formatPercent(row.returnShare)} of returns
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="fisc-bar h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.taxShare * 100)}%` }} />
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="fisc-bar h-full rounded-full bg-chart-1"
                style={{ width: `${Math.min(100, row.returnShare * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
