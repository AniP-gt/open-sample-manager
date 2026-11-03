import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "../../../store/useSettingsStore";
import { SampleListSearch } from "../../SampleList/SampleListSearch";
import { TypeBadge, InstrumentBadge } from "../../TypeBadge/TypeBadge";
import { renderSettingsModal } from "./settingsModalTestHarness";

describe("Settings language", () => {
  beforeEach(() => { useSettingsStore.getState().setLanguage("en"); });
  afterEach(() => { act(() => { useSettingsStore.getState().setLanguage("en"); }); });

  it("switches labels while preserving the search input and English music terms", () => {
    render(<>
      <SampleListSearch appliedQuery="" />
      <TypeBadge type="loop" />
      <TypeBadge type="one-shot" />
      <InstrumentBadge type="kick" />
      <InstrumentBadge type="snare" />
    </>);
    renderSettingsModal();
    const search = screen.getByRole("textbox", { name: "Search sample library" });
    fireEvent.change(search, { target: { value: "kick 日本語.wav" } });
    fireEvent.click(screen.getByRole("button", { name: "Display" }));

    fireEvent.change(screen.getByRole("combobox", { name: /Language/ }), { target: { value: "ja" } });

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "表示" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("textbox", { name: "サンプルライブラリを検索" })).toBe(search);
    expect(search).toHaveValue("kick 日本語.wav");
    expect(document.documentElement.lang).toBe("ja");
    expect(screen.getByText("loop")).toBeInTheDocument();
    expect(screen.getByText("one-shot")).toBeInTheDocument();
    expect(screen.getByText("kick")).toBeInTheDocument();
    expect(screen.getByText("snare")).toBeInTheDocument();
  });

  it("restores English through the same selector and persists the choice", () => {
    useSettingsStore.getState().setLanguage("ja");
    renderSettingsModal();
    fireEvent.click(screen.getByRole("button", { name: "表示" }));

    fireEvent.change(screen.getByRole("combobox", { name: /言語/ }), { target: { value: "en" } });

    expect(screen.getByRole("dialog", { name: "SETTINGS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Display" })).toHaveAttribute("aria-current", "page");
    expect(JSON.parse(localStorage.getItem("osm_settings") ?? "null")).toMatchObject({ state: { language: "en" } });
  });
});
