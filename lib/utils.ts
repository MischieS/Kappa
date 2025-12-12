export function cn(
  ...values: Array<string | number | boolean | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function percentage(completed: number, total: number): number {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}
