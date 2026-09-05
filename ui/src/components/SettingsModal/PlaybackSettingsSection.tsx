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
  return (
    <SettingsSection title="PLAYBACK" hasBottomMargin>
      <ToggleSetting
        title="Auto-play on select"
        description="Automatically play audio when a file is selected"
        enabled={autoPlayOnSelect}
        onChange={onAutoPlayChange}
      />
    </SettingsSection>
  );
}
