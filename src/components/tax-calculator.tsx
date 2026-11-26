"use client";

import { useMemo, useState } from "react";

import { RankBars } from "@/components/charts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDollars, formatMoney, formatPercent } from "@/lib/format";
import { stateName } from "@/lib/states";
import {
  ADDITIONAL_MEDICARE_THRESHOLD,
  allocateByOutlays,
  estimateFederalTax,
  filingStatusLabel,
  SOCIAL_SECURITY_WAGE_BASE,
  TAX_YEAR,
  type FilingStatus,
} from "@/lib/tax";

type StateShare = { code: string; incomeTax: number };

type Outlay = { id: string; label: string; shortLabel: string; amount: number; color: string };

export function TaxCalculator({
  outlays,
  fiscalYear,
  states,
  nationalTax,
}: {
  outlays: Outlay[];
  fiscalYear: number;
  states: StateShare[];
  nationalTax: number;
}) {
  const [status, setStatus] = useState<FilingStatus>("single");
  const [income, setIncome] = useState("85000");
  const [state, setState] = useState("CA");
  const wages = Number(income.replace(/,/g, ""));
  const valid = Number.isFinite(wages) && wages >= 0 && wages < 1e12;
  const estimate = useMemo(() => (valid ? estimateFederalTax(wages, status) : null), [valid, wages, status]);
  const slices = useMemo(
    () => (estimate ? allocateByOutlays(estimate.total, outlays).slice(0, 12) : []),
    [estimate, outlays],
  );
  const stateRow = states.find((item) => item.code === state);
  const stateShare = stateRow && nationalTax > 0 ? stateRow.incomeTax / nationalTax : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Filing status</p>
          <ToggleGroup
            type="single"
            value={status}
            spacing={2}
            className="flex w-full flex-wrap"
            onValueChange={(value) => {
              if (value) setStatus(value as FilingStatus);
            }}
          >
            {(Object.keys(filingStatusLabel) as FilingStatus[]).map((key) => (
              <ToggleGroupItem key={key} value={key} className="px-3">
                {filingStatusLabel[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="wages">
          Annual wage income
          <Input
            id="wages"
            inputMode="decimal"
            value={income}
            onChange={(event) => setIncome(event.target.value)}
            className="h-12 font-heading text-2xl"
            aria-invalid={!valid}
          />
          <span className="font-normal text-muted-foreground">
            Treated entirely as wages. The standard deduction for tax year {TAX_YEAR} is applied. Credits are not.
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">State, for context</p>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-full" aria-label="State">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {states.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {stateName(item.code)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            State of residence does not change this federal estimate.
            {stateShare != null
              ? ` In tax year 2023, returns filed from ${stateName(state)} accounted for ${formatPercent(stateShare)} of U.S. federal income tax in IRS Statistics of Income.`
              : null}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {estimate ? (
          <>
            <div className="rounded-2xl border bg-card p-5 sm:p-6">
              <p className="text-xs tracking-[0.16em] text-primary uppercase">Estimated federal tax</p>
              <p className="mt-2 font-heading text-5xl tracking-tight tabular-nums sm:text-6xl">
                {formatDollars(estimate.total)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatPercent(estimate.effectiveRate)} of wages · marginal income-tax rate {formatPercent(estimate.marginalRate, 0)}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Income tax" value={formatDollars(estimate.incomeTax)} />
                <Stat label="Social Security" value={formatDollars(estimate.socialSecurity)} />
                <Stat label="Medicare" value={formatDollars(estimate.medicare)} />
                <Stat label="Additional Medicare" value={formatDollars(estimate.additionalMedicare)} />
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Employee share only. Social Security tax stops at the {TAX_YEAR} wage base of {formatDollars(SOCIAL_SECURITY_WAGE_BASE)}. Additional Medicare tax of 0.9% applies to wages over {formatDollars(ADDITIONAL_MEDICARE_THRESHOLD[status])}. The employer share of payroll tax is not in this total.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-5 sm:p-6">
              <p className="text-sm font-medium">If that estimate were split like FY{fiscalYear} outlays</p>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">
                Each bar is this estimate times that function’s share of gross outlays. Offsetting receipts are left out, so these shares describe where outlays went, not a payment from you to a program.
              </p>
              <RankBars
                rows={slices.map((slice) => ({
                  id: slice.id,
                  label: slice.shortLabel,
                  amount: slice.dollars,
                  color: slice.color,
                }))}
                total={estimate.total}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Largest slice: {slices[0] ? `${slices[0].shortLabel}, ${formatMoney(slices[0].dollars)}` : "—"}.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Enter a wage amount to see the estimate.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg tabular-nums">{value}</dd>
    </div>
  );
}
