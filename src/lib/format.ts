const abs = (value: number) => Math.abs(value);

/** Compact figure for headlines and chart labels. */
export function formatMoney(value: number, digits = 2): string {
  const sign = value < 0 ? "−" : "";
  const v = abs(value);
  if (v >= 1e12) return `${sign}$${(v / 1e12).toFixed(digits)} trillion`;
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(v >= 1e11 ? 1 : digits)} billion`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(v >= 1e8 ? 1 : digits)} million`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1)} thousand`;
  return (
    sign +
    v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })
  );
}

/** Tight label, as in $1.67T. */
export function formatCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const v = abs(value);
  if (v >= 1e12) return `${sign}$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(0)}K`;
  return (
    sign +
    v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })
  );
}

export function formatDollars(value: number): string {
  const sign = value < 0 ? "−" : "";
  return (
    sign +
    abs(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })
  );
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(share: number, digits = 1): string {
  if (!Number.isFinite(share)) return "—";
  const pct = share * 100;
  if (Math.abs(pct) > 0 && Math.abs(pct) < 0.05) return `${pct < 0 ? "−" : ""}<0.1%`;
  return `${pct.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fiscalYearRange(fy: number): string {
  return `October 1, ${fy - 1} – September 30, ${fy}`;
}
