import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  useTranslation();
  if (isLoading) return <div className="library-empty" role="status"><h2>{translate("loadingSamples")}</h2><p>{translate("yourLibraryIsBeingRetrieved")}</p></div>;
  if (error) return <div className="library-empty" role="alert">
    <h2>{translate("couldNotLoadSamples")}</h2><p>{translate("tryLoadingYourLibraryAgainIfThisContinuesRestart")}</p>
    <details><summary>{translate("errorDetails")}</summary><p>{error}</p></details>
    {onRetry && <button type="button" onClick={onRetry}>{translate("retryLoadingSamples")}</button>}
  </div>;
  if (isCollectionView) return <div className="library-empty" role="status"><h2>{translate("thisCollectionIsEmpty")}</h2><p>{translate("selectAnotherCollectionOrReturnToYourLibraryFrom")}</p></div>;
  if (hasFilters) return <div className="library-empty" role="status">
    <h2>{translate("noMatchingSamples")}</h2><p>{translate("tryADifferentSearchOrClearTheActiveFilters")}</p>
    <button type="button" onClick={onClearFilters}>{translate("resetSearchAndFilters")}</button>
  </div>;
  return <div className="library-empty" role="status">
    <h2>{translate("yourSampleLibraryIsEmpty")}</h2><p>{translate("scanAFolderOrDropAudioFilesHereTo")}</p>
    {onScanLibrary && <button type="button" onClick={onScanLibrary}>{translate("scanAFolder")}</button>}
  </div>;
}
