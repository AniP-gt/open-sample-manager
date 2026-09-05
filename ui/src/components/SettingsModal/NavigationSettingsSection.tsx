import { SettingsSection } from "./SettingsSection";
import { ToggleSetting } from "./ToggleSetting";

type NavigationSettingsSectionProps = {
  readonly directoryClickFiltering: boolean;
  readonly onDirectoryClickFilteringChange: (enabled: boolean) => void;
};

export function NavigationSettingsSection({
  directoryClickFiltering,
  onDirectoryClickFilteringChange,
}: NavigationSettingsSectionProps) {
  return (
    <SettingsSection title="NAVIGATION" hasBottomMargin>
      <ToggleSetting
        title="Directory click filtering"
        description="Filter list when clicking directories in the sidebar"
        enabled={directoryClickFiltering}
        onChange={onDirectoryClickFilteringChange}
      />
    </SettingsSection>
  );
}
