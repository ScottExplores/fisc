import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DataError({ title, detail }: { title: string; detail?: string }) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {detail ?? "The public data source did not respond. Reload to try again."}
      </AlertDescription>
    </Alert>
  );
}
