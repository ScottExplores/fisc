import { PageFrame, PageIntro } from "@/components/source-note";
import { sourceRegistry } from "@/lib/sources/registry";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PageFrame>
      <PageIntro
        eyebrow="Methods"
        title="What the numbers are, and what they are not."
        lede="Fisc shows published federal statistics. It does not rank programs, assign blame, or turn a household into a share of the deficit."
      />
      <section className="flex max-w-3xl flex-col gap-4 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl tracking-tight">Two different measures</h2>
        <p>
          The flow and the agency list use the Monthly Treasury Statement: governmental receipts and net outlays for the fiscal year, which runs from October 1 to September 30. The latest completed year is the most recent September statement.
        </p>
        <p>
          Recipient, program, and nonprofit pages use USAspending award obligations. An obligation is a commitment to spend. It is not an outlay, it is not limited to a single budget function, and it leaves out most payments to individuals, such as Social Security benefits, and interest on the debt. Those pages say so next to the figure.
        </p>
        <h2 className="font-heading text-2xl tracking-tight">How the flow is balanced</h2>
        <p>
          Governmental receipts and net outlays are not equal. The difference is the deficit (or surplus). Some budget functions are negative because offsetting receipts exceed spending. The diagram treats governmental receipts, borrowing, and the absolute value of those negative functions as inflows, and positive outlays as outflows. A reconciling line appears only if the published lines do not add up.
        </p>
        <h2 className="font-heading text-2xl tracking-tight">Who pays</h2>
        <p>
          Bracket shares come from IRS Publication 1304, Table 1.1, a sample of individual returns. State shares come from Historic Table 2, which is population data and will not match Table 1.1 to the dollar. Both are tax year 2023, the latest release in each series, and both lag the fiscal year on the flow. Money amounts in the IRS files are published in thousands of dollars.
        </p>
        <h2 className="font-heading text-2xl tracking-tight">Your taxes</h2>
        <p>
          The calculator applies the tax year 2026 ordinary brackets and standard deduction from Revenue Procedure 2025-32, plus the employee share of Social Security and Medicare from Publication 15 (2026). It assumes every dollar entered is wages. It ignores credits, itemized deductions, and preferential rates. The category split multiplies that estimate by each positive budget function’s share of gross outlays. It is an illustration of budget shares, not a trace of a payment.
        </p>
        <h2 className="font-heading text-2xl tracking-tight">Form 990</h2>
        <p>
          ProPublica’s organization API returns revenue, contributions, expenses, and officer compensation. It does not return the government-grants line on Form 990. Where this app shows federal grants next to a filing, that figure is a USAspending name search and can disagree with the return.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl tracking-tight">Sources in this app</h2>
        <ul className="flex flex-col gap-3">
          {sourceRegistry.map((source) => (
            <li key={source.id} className="rounded-2xl border bg-card px-4 py-3">
              <a className="font-medium underline-offset-4 hover:underline" href={source.docsUrl}>
                {source.title}
              </a>
              <p className="text-sm text-muted-foreground">{source.summary}</p>
              <p className="text-xs text-muted-foreground">{source.module}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
