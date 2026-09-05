import type { ReactNode } from "react";

type SettingsSectionProps = {
  readonly title: string;
  readonly children: ReactNode;
  readonly hasBottomMargin?: boolean;
};

export function SettingsSection({ title, children, hasBottomMargin = false }: SettingsSectionProps) {
  return (
    <div style={hasBottomMargin ? { marginBottom: "24px" } : undefined}>
      <h3
        style={{
          fontSize: "14px",
          letterSpacing: "0.1em",
          color: "#9ca3af",
          marginBottom: "12px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
