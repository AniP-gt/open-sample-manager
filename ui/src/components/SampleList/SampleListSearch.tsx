import { useEffect, useState } from "react";

type SampleListSearchProps = {
  appliedQuery: string;
  onSubmit?: (query: string) => void;
};

export function SampleListSearch({
  appliedQuery,
  onSubmit,
}: SampleListSearchProps) {
  const [query, setQuery] = useState(appliedQuery);

  useEffect(() => {
    setQuery(appliedQuery);
  }, [appliedQuery]);

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.(query);
          }
        }}
        placeholder="Search by filename, tag, key..."
        style={{ flex: "1 1 220px", minWidth: "160px", fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em", background: "transparent", border: "none", outline: "none", fontFamily: "'Courier New', monospace" }}
      />
      <button
        type="button"
        aria-label="Search samples"
        onClick={() => onSubmit?.(query)}
        style={{ ...controlStyle, cursor: "pointer", color: "#f97316" }}
      >
        Search
      </button>
    </>
  );
}

const controlStyle = {
  background: "#111827",
  border: "1px solid #1f2937",
  padding: "5px 8px",
  borderRadius: "3px",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  letterSpacing: "0.04em",
} as const;
