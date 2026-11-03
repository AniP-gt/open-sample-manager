import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  useTranslation();
  return (
    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #0f1117" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 8px" }}>
        <div style={{ fontSize: "11px", color: "var(--osm-secondary)", letterSpacing: "0.04em" }}>{translate("collections")}</div>
        {isCollectionView && (
          <button
            type="button"
            title={translate("clearCollectionView")}
            aria-label={translate("clearCollectionView")}
            onClick={onClearCollection}
            style={{ background: "transparent", border: "none", color: "#f97316", fontSize: "11px", cursor: "pointer", fontFamily: "var(--osm-font)", padding: 0 }}
          >
            {translate("clear")}
          </button>
        )}
      </div>
      {collections.length === 0 ? (
        <div style={{ padding: "4px 12px", fontSize: "12px", color: "var(--osm-secondary)", fontFamily: "var(--osm-font)" }}>{translate("noCollections")}</div>
      ) : collections.map((collection) => {
        const isActive = activeCollectionId === collection.id;
        return (
          <button
            key={collection.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectCollection(collection.id)}
            style={{ width: "100%", padding: "4px 12px", border: "none", background: isActive ? "#1f2937" : "transparent", color: isActive ? "#f97316" : "#9ca3af", textAlign: "left", fontSize: "12px", fontFamily: "var(--osm-font)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {collection.name} ({collection.sample_count})
          </button>
        );
      })}
      {isCollectionView && activeCollectionId !== null && collections.some((collection) => collection.id === activeCollectionId && collection.sample_count === 0) && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "var(--osm-secondary)", fontFamily: "var(--osm-font)" }}>{translate("noSamplesInThisCollection")}</div>
      )}
      {isCollectionView && activeCollectionId === null && (
        <div style={{ padding: "8px 12px 0", fontSize: "12px", color: "var(--osm-secondary)", fontFamily: "var(--osm-font)" }}>{translate("noSamplesInThisCollection")}</div>
      )}
    </div>
  );
}
