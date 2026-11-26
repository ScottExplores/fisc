import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { SiteChrome, SiteFooter } from "@/components/site-chrome";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCompletedFiscalYears } from "@/lib/sources/treasury";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: {
    default: "Fisc — where federal dollars come from and where they go",
    template: "%s · Fisc",
  },
  description:
    "Open-source view of U.S. federal receipts, outlays, award recipients, nonprofit filings, and a plain estimate of how a wage splits across the budget.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            <Suspense fallback={<div className="h-14 border-b" />}>
              <Chrome />
            </Suspense>
            {children}
            <SiteFooter />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

async function Chrome() {
  const years = await getCompletedFiscalYears();
  return <SiteChrome years={years} />;
}
