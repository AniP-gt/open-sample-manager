import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { SettingsModal } from "../SettingsModal";

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
};

export function renderSettingsModal(overrides: Partial<SettingsModalProps> = {}) {
  return render(<SettingsModal {...defaultProps} {...overrides} />);
}
