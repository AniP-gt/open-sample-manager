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
    <div className="sample-search-form" role="search" aria-label="Search sample library">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.(query);
          }
        }}
        placeholder="Search by filename, tag, key..."
        aria-label="Search sample library"
      />
      <button
        type="button"
        aria-label="Search samples"
        onClick={() => onSubmit?.(query)}
        className="sample-search-submit"
      >
        Search
      </button>
    </div>
  );
}
