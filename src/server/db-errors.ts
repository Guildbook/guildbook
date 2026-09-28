function pgField(err: unknown, field: "code" | "constraint"): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const value = (current as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (pgField(err, "code") !== "23505") return false;
  return constraint === undefined || pgField(err, "constraint") === constraint;
}
