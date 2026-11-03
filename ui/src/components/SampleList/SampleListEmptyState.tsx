type Props = {
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly hasFilters: boolean;
  readonly isCollectionView?: boolean;
  readonly onClearFilters: () => void;
  readonly onScanLibrary?: () => void;
  readonly onRetry?: () => void;
};

export function SampleListEmptyState({ isLoading, error, hasFilters, isCollectionView, onClearFilters, onScanLibrary, onRetry }: Props) {
  if (isLoading) return <div className="library-empty" role="status"><h2>Loading samples…</h2><p>Your library is being retrieved.</p></div>;
  if (error) return <div className="library-empty" role="alert">
    <h2>Could not load samples</h2><p>Try loading your library again. If this continues, restart Open Sample Manager.</p>
    <details><summary>Error details</summary><p>{error}</p></details>
    {onRetry && <button type="button" onClick={onRetry}>Retry loading samples</button>}
  </div>;
  if (isCollectionView) return <div className="library-empty" role="status"><h2>This collection is empty</h2><p>Select another collection or return to your library from the sidebar.</p></div>;
  if (hasFilters) return <div className="library-empty" role="status">
    <h2>No matching samples</h2><p>Try a different search or clear the active filters.</p>
    <button type="button" onClick={onClearFilters}>Reset search and filters</button>
  </div>;
  return <div className="library-empty" role="status">
    <h2>Your sample library is empty</h2><p>Scan a folder or drop audio files here to start browsing and previewing samples.</p>
    {onScanLibrary && <button type="button" onClick={onScanLibrary}>Scan a folder</button>}
  </div>;
}
