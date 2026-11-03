import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

type SampleListSearchProps = {
  appliedQuery: string;
  onSubmit?: (query: string) => void;
};

export function SampleListSearch({
  appliedQuery,
  onSubmit,
}: SampleListSearchProps) {
  useTranslation();
  const [query, setQuery] = useState(appliedQuery);

  useEffect(() => {
    setQuery(appliedQuery);
  }, [appliedQuery]);

  return (
    <div className="sample-search-form" role="search" aria-label={translate("searchSampleLibrary")}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.(query);
          }
        }}
        placeholder={translate("searchByFilenameTagKey")}
        aria-label={translate("searchSampleLibrary")}
      />
      <button
        type="button"
        aria-label={translate("searchSamples")}
        onClick={() => onSubmit?.(query)}
        className="sample-search-submit"
      >
        {translate("search")}
      </button>
    </div>
  );
}
