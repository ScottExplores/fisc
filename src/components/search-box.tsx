"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBox({ initial, fy }: { initial: string; fy: number }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const q = query.trim();
        if (!q) return;
        router.push(`/recipients?fy=${fy}&q=${encodeURIComponent(q)}`);
      }}
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Agency, company, university, or nonprofit"
        aria-label="Search recipients"
        className="h-11"
      />
      <Button type="submit" className="h-11">
        <Search data-icon="inline-start" />
        Search
      </Button>
    </form>
  );
}
