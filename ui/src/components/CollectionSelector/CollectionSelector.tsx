import type { Collection } from "../../types/collection";

type CollectionSelectorProps = {
  readonly collections: readonly Collection[];
  readonly activeCollectionId: number | null;
  readonly isCollectionView: boolean;
  readonly onSelectCollection: (collectionId: number) => void;
  readonly onClearCollection: () => void;
};

export function CollectionSelector({
  collections,
  activeCollectionId,
  isCollectionView,
  onSelectCollection,
  onClearCollection,
}: CollectionSelectorProps) {
  return (
    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #0f1117" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 8px" }}>
        <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em" }}>COLLECTIONS</div>
        {isCollectionView && (
          <button
            type="button"
            title="Clear collection view"
            aria-label="Clear collection view"
            onClick={onClearCollection}
            style={{ background: "transparent", border: "none", color: "#f97316", fontSize: "11px", cursor: "pointer", fontFamily: "'Courier New', monospace", padding: 0 }}
          >
            [clear]
          </button>
        )}
      </div>
      {collections.length === 0 ? (
        <div style={{ padding: "4px 12px", fontSize: "12px", color: "#4b5563", fontFamily: "'Courier New', monospace" }}>No collections</div>
      ) : collections.map((collection) => {
        const isActive = activeCollectionId === collection.id;
        return (
          <button
            key={collection.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectCollection(collection.id)}
            style={{ width: "100%", padding: "4px 12px", border: "none", background: isActive ? "#1f2937" : "transparent", color: isActive ? "#f97316" : "#9ca3af", textAlign: "left", fontSize: "12px", fontFamily: "'Courier New', monospace", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {collection.name} ({collection.sample_count})
          </button>
        );
      })}
      {isCollectionView && activeCollectionId !== null && collections.some((collection) => collection.id === activeCollectionId && collection.sample_count === 0) && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "#4b5563", fontFamily: "'Courier New', monospace" }}>No samples in this collection</div>
      )}
      {isCollectionView && activeCollectionId === null && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "#4b5563", fontFamily: "'Courier New', monospace" }}>No samples in this collection</div>
      )}
    </div>
  );
}
