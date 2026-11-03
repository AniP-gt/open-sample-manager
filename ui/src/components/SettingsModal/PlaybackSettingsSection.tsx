import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "./SettingsSection";
import { ToggleSetting } from "./ToggleSetting";

type PlaybackSettingsSectionProps = {
  readonly autoPlayOnSelect: boolean;
  readonly onAutoPlayChange: (enabled: boolean) => void;
};

export function PlaybackSettingsSection({
  autoPlayOnSelect,
  onAutoPlayChange,
}: PlaybackSettingsSectionProps) {
  useTranslation();
  return (
    <SettingsSection title={translate("playback")} hasBottomMargin>
      <ToggleSetting
        title={translate("autoPlayOnSelect")}
        description={translate("automaticallyPlayAudioWhenAFileIsSelected")}
        enabled={autoPlayOnSelect}
        onChange={onAutoPlayChange}
      />
    </SettingsSection>
  );
}
