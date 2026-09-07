import { describe, expect, it } from "vitest";
import { formatTauriCommandError, getTauriCommandErrorCode } from "../tauriError";

describe("formatTauriCommandError", () => {
  it("formats a serialized CommandError record", () => {
    // Given: a Tauri command rejection serialized by the IPC boundary.
    const rejection = JSON.stringify({
      code: "provider_root_invalid",
      message: "download root must be an existing absolute directory",
      details: null,
    });

    // When: the UI formats the command rejection.
    const message = formatTauriCommandError(rejection, "Provider browser could not be opened.");

    // Then: the stable code and actionable message reach the user.
    expect(message).toBe(
      "Provider browser could not be opened (provider_root_invalid): download root must be an existing absolute directory",
    );
  });

  it("preserves a plain string rejection", () => {
    // Given: a plain rejection without a structured command error.
    const rejection = "native surface unavailable";

    // When: the UI formats the command rejection.
    const message = formatTauriCommandError(rejection, "Provider browser could not be opened.");

    // Then: the existing plain-string behavior remains unchanged.
    expect(message).toBe("Provider browser could not be opened.: native surface unavailable");
  });

  it("preserves a malformed serialized rejection", () => {
    // Given: a string that resembles malformed JSON.
    const rejection = '{"code":"provider_root_invalid"';

    // When: the UI formats the command rejection.
    const message = formatTauriCommandError(rejection, "Provider browser could not be opened.");

    // Then: the original sanitized string behavior remains unchanged.
    expect(message).toBe('Provider browser could not be opened.: {"code":"provider_root_invalid"');
  });

  it("extracts only allowed stable codes from serialized command errors", () => {
    const rejection = JSON.stringify({
      code: "freesound_unauthorized",
      message: "key=secret /Users/alice/private",
      details: "https://private.example.test",
    });

    expect(getTauriCommandErrorCode(rejection, ["freesound_unauthorized", "freesound_rate_limited"])).toBe("freesound_unauthorized");
    expect(getTauriCommandErrorCode(rejection, ["freesound_rate_limited"])).toBeNull();
  });
});
