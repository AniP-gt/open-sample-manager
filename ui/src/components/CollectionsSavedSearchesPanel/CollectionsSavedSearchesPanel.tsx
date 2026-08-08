import { useState } from "react";
import type { CSSProperties } from "react";
import type { SampleCollection, SavedSearch } from "../../types/sample";

type Props = {
  collections: readonly SampleCollection[];
  savedSearches: readonly SavedSearch[];
  activeCollectionId: number | null;
  selectedIds: Set<number>;
  onCreateCollection: (name: string, description: string) => Promise<void>;
  onUpdateCollection: (id: number, name: string, description: string) => Promise<void>;
  onDeleteCollection: (id: number) => Promise<void>;
  onOpenCollection: (id: number) => Promise<void>;
  onClearCollection: () => Promise<void>;
  onAddSelected: (id: number, sampleIds: number[]) => Promise<void>;
  onRemoveSelected: (id: number, sampleIds: number[]) => Promise<void>;
  onCreateSavedSearch: (name: string) => Promise<void>;
  onUpdateSavedSearch: (id: number, name: string) => Promise<void>;
  onDeleteSavedSearch: (id: number) => Promise<void>;
  onApplySavedSearch: (search: SavedSearch) => void | Promise<void>;
};

export function CollectionsSavedSearchesPanel({
  collections = [],
  savedSearches = [],
  activeCollectionId,
  selectedIds = new Set<number>(),
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onOpenCollection,
  onClearCollection,
  onAddSelected,
  onRemoveSelected,
  onCreateSavedSearch,
  onUpdateSavedSearch,
  onDeleteSavedSearch,
  onApplySavedSearch,
}: Props) {
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [savedSearchName, setSavedSearchName] = useState("");
  const sampleIds = Array.from(selectedIds);

  return (
    <aside style={panelStyle} aria-label="Collections and saved searches">
      <section style={sectionStyle}>
        <div style={headingStyle}>COLLECTIONS</div>
        <input
          value={collectionName}
          onChange={(event) => setCollectionName(event.target.value)}
          placeholder="collection name"
          style={inputStyle}
        />
        <input
          value={collectionDescription}
          onChange={(event) => setCollectionDescription(event.target.value)}
          placeholder="description"
          style={inputStyle}
        />
        <button
          style={primaryButtonStyle}
          onClick={() => {
            if (!collectionName.trim()) return;
            void onCreateCollection(collectionName, collectionDescription).then(
              () => {
                setCollectionName("");
                setCollectionDescription("");
              },
              () => undefined,
            );
          }}
        >
          NEW COLLECTION
        </button>
        {activeCollectionId !== null && (
          <button style={ghostButtonStyle} onClick={() => void onClearCollection().catch(() => undefined)}>
            EXIT COLLECTION VIEW
          </button>
        )}
        <div style={listStyle}>
          {collections.map((collection) => {
            const active = collection.id === activeCollectionId;
            return (
              <div key={collection.id} style={{ ...itemStyle, ...(active ? activeItemStyle : {}) }}>
                <button style={itemButtonStyle} onClick={() => void onOpenCollection(collection.id).catch(() => undefined)}>
                  <span style={nameStyle}>{collection.name}</span>
                  <span style={metaStyle}>{collection.sample_count} samples</span>
                </button>
                <div style={actionRowStyle}>
                  <button style={tinyButtonStyle} onClick={() => void onAddSelected(collection.id, sampleIds).catch(() => undefined)} disabled={sampleIds.length === 0}>
                    ADD SELECTED
                  </button>
                  <button style={tinyButtonStyle} onClick={() => void onRemoveSelected(collection.id, sampleIds).catch(() => undefined)} disabled={sampleIds.length === 0}>
                    REMOVE
                  </button>
                  <button style={tinyButtonStyle} onClick={() => void renameCollection(collection, onUpdateCollection).catch(() => undefined)}>
                    RENAME
                  </button>
                  <button style={dangerButtonStyle} onClick={() => void onDeleteCollection(collection.id).catch(() => undefined)}>
                    DELETE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={headingStyle}>SAVED SEARCHES</div>
        <input
          value={savedSearchName}
          onChange={(event) => setSavedSearchName(event.target.value)}
          placeholder="search preset name"
          style={inputStyle}
        />
        <button
          style={primaryButtonStyle}
          onClick={() => {
            if (!savedSearchName.trim()) return;
            void onCreateSavedSearch(savedSearchName).then(
              () => setSavedSearchName(""),
              () => undefined,
            );
          }}
        >
          SAVE CURRENT FILTERS
        </button>
        <div style={listStyle}>
          {savedSearches.map((search) => (
            <div key={search.id} style={itemStyle}>
              <button style={itemButtonStyle} onClick={() => void Promise.resolve(onApplySavedSearch(search)).catch(() => undefined)}>
                <span style={nameStyle}>{search.name}</span>
                <span style={metaStyle}>{search.search || "all samples"}</span>
              </button>
              <div style={actionRowStyle}>
                <button style={tinyButtonStyle} onClick={() => void renameSavedSearch(search, onUpdateSavedSearch).catch(() => undefined)}>
                  UPDATE
                </button>
                <button style={dangerButtonStyle} onClick={() => void onDeleteSavedSearch(search.id).catch(() => undefined)}>
                  DELETE
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function renameCollection(collection: SampleCollection, onUpdate: Props["onUpdateCollection"]) {
  const name = window.prompt("Collection name", collection.name);
  if (!name) return Promise.resolve();
  const description = window.prompt("Description", collection.description ?? "") ?? "";
  return onUpdate(collection.id, name, description);
}

function renameSavedSearch(search: SavedSearch, onUpdate: Props["onUpdateSavedSearch"]) {
  const name = window.prompt("Saved search name", search.name);
  if (!name) return Promise.resolve();
  return onUpdate(search.id, name);
}

const panelStyle: CSSProperties = {
  width: "260px",
  flexShrink: 0,
  borderLeft: "1px solid #111827",
  background: "#0b0f16",
  overflow: "auto",
  padding: "10px",
};

const sectionStyle: CSSProperties = { marginBottom: "16px" };
const headingStyle: CSSProperties = { color: "#f97316", fontSize: "12px", letterSpacing: "0.12em", marginBottom: "8px" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", marginBottom: "6px", padding: "6px 8px", background: "#080a0f", border: "1px solid #1f2937", color: "#e2e8f0", fontFamily: "'Courier New', monospace", fontSize: "12px" };
const primaryButtonStyle: CSSProperties = { width: "100%", padding: "7px 8px", background: "#f97316", border: "1px solid #fb923c", color: "#111827", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "11px", fontWeight: 700 };
const ghostButtonStyle: CSSProperties = { ...primaryButtonStyle, marginTop: "6px", background: "#111827", border: "1px solid #374151", color: "#cbd5e1" };
const listStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" };
const itemStyle: CSSProperties = { border: "1px solid #1f2937", background: "#080a0f", padding: "6px" };
const activeItemStyle: CSSProperties = { borderColor: "#f97316", boxShadow: "0 0 0 1px #f9731640 inset" };
const itemButtonStyle: CSSProperties = { width: "100%", display: "flex", justifyContent: "space-between", gap: "8px", background: "transparent", border: "none", color: "#e2e8f0", padding: 0, cursor: "pointer", fontFamily: "'Courier New', monospace", textAlign: "left" };
const nameStyle: CSSProperties = { fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const metaStyle: CSSProperties = { color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" };
const actionRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" };
const tinyButtonStyle: CSSProperties = { background: "#111827", border: "1px solid #374151", color: "#9ca3af", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "10px", padding: "3px 5px" };
const dangerButtonStyle: CSSProperties = { ...tinyButtonStyle, color: "#fca5a5", border: "1px solid #7f1d1d" };
