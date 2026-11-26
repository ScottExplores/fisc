import Link from "next/link";

import { PageFrame, PageIntro } from "@/components/source-note";

export default function NotFound() {
  return (
    <PageFrame>
      <PageIntro eyebrow="404" title="That page is not in the books." lede="The agency or record may have a different name in the statement." />
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to the flow
      </Link>
    </PageFrame>
  );
}
