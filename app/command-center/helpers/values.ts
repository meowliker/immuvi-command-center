

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function numberOrNullValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Action failed.';
}
