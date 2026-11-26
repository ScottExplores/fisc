export function withFy(path: string, fy: number, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ fy: String(fy) });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `${path}?${params.toString()}`;
}
