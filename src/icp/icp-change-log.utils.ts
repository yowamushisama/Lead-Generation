/** Resolve the effective value of an ICP field: top-level column wins, else config.* fallback. */
export function resolveICPField(profile: any, field: string): unknown {
  const top = profile?.[field];
  const fromConfig = profile?.config?.[field];
  if (Array.isArray(top)) return top.length > 0 ? top : (fromConfig ?? top);
  if (top !== undefined && top !== null) return top;
  return fromConfig;
}

export function diffICPFields(
  before: any,
  simulatedAfter: any,
  fields: string[],
): Array<{ field: string; before: unknown; after: unknown }> {
  return fields
    .map((f) => ({ field: f, before: resolveICPField(before, f), after: resolveICPField(simulatedAfter, f) }))
    .filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after));
}
