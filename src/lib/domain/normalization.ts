const SAFETY_TERMS = [
  "pain",
  "reaction",
  "rash",
  "swelling",
  "bleeding",
  "infection",
  "fever",
  "worse",
  "worsening",
  "unexpected",
  "burning",
  "blister"
] as const;

export function normalizeProtocolTerm(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isProviderOnlyQuery(value: string): boolean {
  const normalized = normalizeProtocolTerm(value);
  return SAFETY_TERMS.some((term) => normalized.includes(term));
}
