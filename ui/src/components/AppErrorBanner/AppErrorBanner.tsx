import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
interface AppErrorBannerProps {
  error: string | null;
  onRetry: () => void;
}

export function AppErrorBanner({ error, onRetry }: AppErrorBannerProps) {
  useTranslation();
  if (!error) return null;

  return (
    <div
      style={{
        margin: "10px 16px 0",
        padding: "10px 12px",
        border: "1px solid #ef444480",
        background: "#7f1d1d55",
        color: "#fecaca",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: "#ef4444",
          border: "none",
          borderRadius: "2px",
          color: "#fff",
          fontFamily: "var(--osm-font)",
          padding: "4px 10px",
          flexShrink: 0,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {translate("retryUpper")}
      </button>
    </div>
  );
}
