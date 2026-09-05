import { SettingsSection } from "./SettingsSection";
import { ToggleSetting } from "./ToggleSetting";

type DisplaySettingsSectionProps = {
  readonly instrumentColorCoding: boolean;
  readonly onInstrumentColorCodingChange: (enabled: boolean) => void;
  readonly showSampleMetadataQuality: boolean;
  readonly onShowSampleMetadataQualityChange: (enabled: boolean) => void;
};

export function DisplaySettingsSection({
  instrumentColorCoding,
  onInstrumentColorCodingChange,
  showSampleMetadataQuality,
  onShowSampleMetadataQualityChange,
}: DisplaySettingsSectionProps) {
  return (
    <SettingsSection title="DISPLAY" hasBottomMargin>
      <ToggleSetting
        title="Instrument color coding"
        description="Color-code rows and badges by instrument type"
        enabled={instrumentColorCoding}
        onChange={onInstrumentColorCodingChange}
      />
      <ToggleSetting
        title="Sample metadata and quality UI"
        description="Show license metadata and quality check controls in the sample list"
        enabled={showSampleMetadataQuality}
        onChange={onShowSampleMetadataQualityChange}
        hasTopMargin
      />
    </SettingsSection>
  );
}
