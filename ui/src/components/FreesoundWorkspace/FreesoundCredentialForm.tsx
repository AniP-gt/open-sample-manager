import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { FreesoundCredentialState } from "../../hooks/useFreesoundWorkspace";

type FreesoundCredentialFormProps = {
  readonly credential: FreesoundCredentialState;
  readonly isBusy: boolean;
  readonly onDelete: () => void;
  readonly onOpenRegistration: () => Promise<void>;
  readonly onSave: (apiKey: string) => Promise<void>;
};

export function FreesoundCredentialForm({ credential, isBusy, onDelete, onOpenRegistration, onSave }: FreesoundCredentialFormProps) {
  useTranslation();
  const [apiKey, setApiKey] = useState("");
  const configured = credential === "configured";
  const save = async () => {
    if (apiKey.trim().length === 0) return;
    const submittedKey = apiKey;
    setApiKey("");
    await onSave(submittedKey);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    <label htmlFor="freesound-api-key" style={{ color: "#d1d5db", fontSize: "12px" }}>{translate("freesoundApiKey")}</label>
    <input id="freesound-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder={configured ? translate("enterAReplacementKey") : translate("enterYourApiKey")} style={{ background: "#080a0f", border: "1px solid #374151", borderRadius: "2px", color: "#e2e8f0", fontFamily: "'Courier New', monospace", fontSize: "12px", padding: "8px" }} />
    <div style={{ display: "flex", gap: "8px" }}>
      <button type="button" onClick={() => { void save(); }} disabled={isBusy || apiKey.trim().length === 0} style={{ background: "#f97316", border: "1px solid #f97316", borderRadius: "2px", color: "#000", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", padding: "8px 12px" }}>{configured ? translate("replaceKey") : translate("saveKey")}</button>
      {!configured && <button type="button" onClick={() => { void onOpenRegistration(); }} style={{ background: "transparent", border: "1px solid #374151", borderRadius: "2px", color: "#d1d5db", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px", letterSpacing: "0.08em", padding: "8px 12px" }}>{translate("getApiKey")}</button>}
      {configured && <button type="button" onClick={onDelete} disabled={isBusy} style={{ background: "transparent", border: "1px solid #374151", borderRadius: "2px", color: "#d1d5db", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px", letterSpacing: "0.08em", padding: "8px 12px" }}>{translate("removeKey")}</button>}
    </div>
    <span style={{ color: configured ? "#22d3ee" : "#9ca3af", fontSize: "11px" }}>{configured ? translate("aKeyIsConfiguredItsValueIsNeverShown") : translate("noKeyIsConfigured")}</span>
  </div>;
}
