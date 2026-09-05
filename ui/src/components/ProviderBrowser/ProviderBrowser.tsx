import type { RefCallback } from "react";
import { PROVIDER_IDS } from "../../types/provider";
import type { ProviderBrowserMode, ProviderId } from "../../types/provider";

export const PROVIDER_SOURCES = [
  {
    id: PROVIDER_IDS.musicRadar,
    name: "MUSICRADAR",
    title: "SampleRadar",
    description: "Editorial sample packs and producer-ready downloads.",
  },
  {
    id: PROVIDER_IDS.fiftySounds,
    name: "FIFTYSOUNDS",
    title: "Free Sound Library",
    description: "Free music, ambience, and sound effect collections.",
  },
] as const satisfies readonly {
  readonly id: ProviderId;
  readonly name: string;
  readonly title: string;
  readonly description: string;
}[];

type ProviderBrowserProps = {
  readonly activeProvider: ProviderId | null;
  readonly mode: ProviderBrowserMode;
  readonly onBrowse: (provider: ProviderId) => void;
  readonly status: string | null;
  readonly viewportRef: RefCallback<HTMLDivElement>;
};

export function ProviderBrowser({ activeProvider, mode, onBrowse, status, viewportRef }: ProviderBrowserProps) {
  const isEmbeddedBrowserVisible = mode === "embedded" && activeProvider !== null;

  if (isEmbeddedBrowserVisible) {
    const source = PROVIDER_SOURCES.find((provider) => provider.id === activeProvider);
    return (
      <section style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", background: "#080a0f" }} aria-label="Web provider browser">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "44px", padding: "8px 12px", borderBottom: "1px solid #1f2937", background: "#0a0c12" }}>
          <span style={{ color: "#9ca3af", fontSize: "11px", letterSpacing: "0.1em" }}>{source?.name} / {source?.title}</span>
          {status && <span style={{ color: "#f97316", fontSize: "11px", letterSpacing: "0.06em" }}>{status}</span>}
        </div>
        <div ref={viewportRef} data-testid="provider-browser-viewport" style={{ flex: 1, minHeight: 0 }} />
      </section>
    );
  }

  return (
    <section style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", overflow: "auto", padding: "20px", background: "#080a0f" }} aria-label="Web sources">
      <div style={{ maxWidth: "760px", width: "100%" }}>
        <div style={{ color: "#f1f5f9", fontSize: "16px", fontWeight: 700, letterSpacing: "0.12em" }}>WEB SOURCES</div>
        <p style={{ color: "#6b7280", fontSize: "12px", lineHeight: 1.6, margin: "8px 0 20px" }}>
          Browse approved sample providers. Downloads are staged and imported into your local library.
        </p>
        <div style={{ borderTop: "1px solid #1f2937" }}>
          {PROVIDER_SOURCES.map((provider) => (
            <button key={provider.id} type="button" onClick={() => onBrowse(provider.id)} style={{ alignItems: "center", background: activeProvider === provider.id ? "#111827" : "transparent", border: "none", borderBottom: "1px solid #1f2937", borderLeft: activeProvider === provider.id ? "2px solid #f97316" : "2px solid transparent", color: "#e2e8f0", cursor: "pointer", display: "flex", fontFamily: "'Courier New', monospace", gap: "16px", padding: "14px 12px", textAlign: "left", width: "100%" }}>
              <span style={{ color: "#f97316", fontSize: "11px", letterSpacing: "0.1em", minWidth: "116px" }}>{provider.name}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontSize: "13px", letterSpacing: "0.05em" }}>{provider.title}</span>
                <span style={{ color: "#6b7280", fontSize: "11px", fontFamily: "inherit", letterSpacing: "normal" }}>{provider.description}</span>
              </span>
            </button>
          ))}
        </div>
        {status && <div style={{ color: "#f97316", fontSize: "11px", letterSpacing: "0.06em", marginTop: "12px" }}>{status}</div>}
      </div>
    </section>
  );
}
