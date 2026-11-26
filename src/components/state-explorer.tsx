"use client";

import { useMemo, useState } from "react";

import { RankBars } from "@/components/charts";
import { Input } from "@/components/ui/input";
import { formatMoney, formatPercent } from "@/lib/format";
import { AGI_STUBS, stateName } from "@/lib/states";
import type { StateRow } from "@/lib/sources/irs";
import { receiptColor } from "@/lib/palette";

export function StateExplorer({
  states,
  nationalTax,
}: {
  states: StateRow[];
  nationalTax: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(states[0]?.code ?? "CA");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return states.filter((state) => {
      const name = stateName(state.code).toLowerCase();
      return !needle || name.includes(needle) || state.code.toLowerCase().includes(needle);
    });
  }, [query, states]);
  const current = states.find((state) => state.code === selected) ?? filtered[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a state"
          aria-label="Find a state"
        />
        <ul className="flex max-h-[32rem] flex-col gap-1 overflow-auto pr-1">
          {filtered.map((state) => {
            const share = nationalTax ? state.incomeTax / nationalTax : 0;
            const on = state.code === current?.code;
            return (
              <li key={state.code}>
                <button
                  type="button"
                  onClick={() => setSelected(state.code)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${on ? "bg-secondary" : "hover:bg-muted"}`}
                >
                  <span>{stateName(state.code)}</span>
                  <span className="text-muted-foreground tabular-nums">{formatPercent(share)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {current ? (
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">{stateName(current.code)}</p>
            <p className="mt-1 font-heading text-4xl tracking-tight tabular-nums">{formatMoney(current.incomeTax)}</p>
            <p className="text-sm text-muted-foreground">
              Income tax on {current.returns.toLocaleString("en-US")} returns · {formatPercent(nationalTax ? current.incomeTax / nationalTax : 0)} of the U.S. total in this file
            </p>
          </div>
          <RankBars
            rows={current.brackets.map((bracket) => ({
              id: bracket.stub,
              label: AGI_STUBS.find((stub) => stub.code === bracket.stub)?.label ?? `Stub ${bracket.stub}`,
              amount: bracket.incomeTax,
              color: receiptColor.individual,
            }))}
            total={current.incomeTax}
          />
        </div>
      ) : null}
    </div>
  );
}
