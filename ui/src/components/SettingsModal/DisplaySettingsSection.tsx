import { SettingsSection } from "./SettingsSection";
import { ToggleSetting } from "./ToggleSetting";
import { useSettingsStore } from "../../store/useSettingsStore";
import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";

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
  useTranslation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  return (
    <SettingsSection title={translate("display")} hasBottomMargin>
      <label className="settings-language">
        <span>{translate("language")}</span>
        <select value={language} onChange={(event) => {
          const value = event.target.value;
          if (value === "en" || value === "ja") setLanguage(value);
        }}>
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
      </label>
      <ToggleSetting
        title={translate("instrumentColorCoding")}
        description={translate("colorCodeRowsAndBadgesByInstrumentType")}
        enabled={instrumentColorCoding}
        onChange={onInstrumentColorCodingChange}
      />
      <ToggleSetting
        title={translate("sampleMetadataAndQualityUi")}
        description={translate("showLicenseMetadataAndQualityCheckControlsInThe")}
        enabled={showSampleMetadataQuality}
        onChange={onShowSampleMetadataQualityChange}
        hasTopMargin
      />
    </SettingsSection>
  );
}
