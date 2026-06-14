function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

export function matchesFilenameSubstring(query: string, fileName: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;

  return normalizeSearchText(fileName).includes(normalizedQuery);
}
