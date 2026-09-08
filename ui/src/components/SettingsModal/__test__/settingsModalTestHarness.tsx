import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { SettingsModal } from "../SettingsModal";
import type { FreesoundWorkspace } from "../../../hooks/useFreesoundWorkspace";

type SettingsModalProps = ComponentProps<typeof SettingsModal>;

const defaultProps: SettingsModalProps = {
  isOpen: true,
  onClose: vi.fn(),
  sampleCount: 0,
  autoPlayOnSelect: false,
  onAutoPlayChange: vi.fn(),
  instrumentColorCoding: false,
  onInstrumentColorCodingChange: vi.fn(),
  directoryClickFiltering: true,
  onDirectoryClickFilteringChange: vi.fn(),
  showSampleMetadataQuality: true,
  onShowSampleMetadataQualityChange: vi.fn(),
  onDatabaseExport: vi.fn(),
  onDatabaseImport: vi.fn(),
  databaseMigrationBusy: false,
  databaseMigrationStatus: null,
  providerDownloadRoot: null,
  onSelectProviderDownloadRoot: vi.fn(),
  onClearProviderDownloadRoot: vi.fn(),
  freesoundWorkspace: {
    credential: "unset", canDownload: false, downloadPreview: vi.fn(), error: null, fetchPreview: vi.fn(), isBusy: false, page: 1, activeQuery: "", previewUrl: null, query: "", results: [], saveApiKey: vi.fn(), search: vi.fn(), setQuery: vi.fn(), stopPreview: vi.fn(), totalCount: 0, deleteApiKey: vi.fn(), failPreview: vi.fn(), openHomepage: vi.fn(), openRegistration: vi.fn(),
  } satisfies FreesoundWorkspace,
};

export function renderSettingsModal(overrides: Partial<SettingsModalProps> = {}) {
  return render(<SettingsModal {...defaultProps} {...overrides} />);
}
