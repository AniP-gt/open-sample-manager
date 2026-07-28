function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

export function matchesFuzzySearch(query: string, targets: string[]) {
  const terms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const normalizedTargets = targets.filter(Boolean).map(normalizeSearchText);
  if (normalizedTargets.length === 0) return false;

  return terms.every((term) => normalizedTargets.some((target) => target.includes(term)));
}

export function matchesFilenameSubstring(query: string, fileName: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;

  return normalizeSearchText(fileName).includes(normalizedQuery);
}
