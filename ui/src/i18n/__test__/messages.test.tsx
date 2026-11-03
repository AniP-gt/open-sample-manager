import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../resources/en";
import { ja } from "../resources/ja";
import { translate, type TranslationKey } from "../index";
import { useMessageState } from "../useMessageState";
import { useSettingsStore } from "../../store/useSettingsStore";
import { getErrorMessage } from "../../utils/sampleMapper";

afterEach(() => { act(() => { useSettingsStore.getState().setLanguage("en"); }); });

describe("localized messages", () => {
  it("changes a visible completion message and its interpolated counts in both directions", () => {
    useSettingsStore.getState().setLanguage("en");
    const { result } = renderHook(() => useMessageState());
    act(() => { result.current[1](translate("exportCompleted", { samples: 12, midis: 3 })); });

    act(() => { useSettingsStore.getState().setLanguage("ja"); });

    expect(result.current[0]).toBe("サンプル12件とMIDIファイル3件を書き出しました。");
  });

  it("translates a notification created in Japanese after returning to English", () => {
    useSettingsStore.getState().setLanguage("ja");
    const { result } = renderHook(() => useMessageState());
    act(() => { result.current[1](translate("importCompleted", { samples: 4, midis: 2 })); });

    act(() => { useSettingsStore.getState().setLanguage("en"); });

    expect(result.current[0]).toBe("Imported 4 samples and 2 MIDI files.");
  });

  it("localizes a backend error code while retaining its original technical details", () => {
    useSettingsStore.getState().setLanguage("en");
    const { result } = renderHook(() => useMessageState());
    act(() => { result.current[1](getErrorMessage({ code: "db_error", message: "database is locked" })); });

    act(() => { useSettingsStore.getState().setLanguage("ja"); });

    expect(result.current[0]).toBe("データベースにアクセスできませんでした：database is locked");
  });

  it.each([[1, "1 sample"], [2, "2 samples"]])("formats an English sample count of %i", (count, expected) => {
    useSettingsStore.getState().setLanguage("en");
    expect(translate("sampleCount", { count })).toBe(expected);
  });

  it("ships the same keys and interpolation variables in both languages", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en).filter((value): value is TranslationKey => value in en)) {
      const variables = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
      expect(variables(ja[key]), key).toEqual(variables(en[key]));
    }
  });
});
