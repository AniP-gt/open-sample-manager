import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  useTranslation();
  return (
    <SettingsSection title={translate("navigation")} hasBottomMargin>
      <ToggleSetting
        title={translate("directoryClickFiltering")}
        description={translate("filterListWhenClickingDirectoriesInTheSidebar")}
        enabled={directoryClickFiltering}
        onChange={onDirectoryClickFilteringChange}
      />
    </SettingsSection>
  );
}
