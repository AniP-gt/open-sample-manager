import { describe, expect, test } from "vitest";
import { matchesFuzzySearch } from "../search";

describe("matchesFuzzySearch", () => {
  test("treats contiguous lowercase normalized terms with includes semantics", () => {
    expect(matchesFuzzySearch("fill", ["DrumFill.wav", "meta"])).toBe(true);
    expect(matchesFuzzySearch("fll", ["DrumFill.wav", "meta"])).toBe(false);
    expect(matchesFuzzySearch("fill", ["FL_PV2022_VP_Kit04_Fx_Loop_Delayed_Impact_143_Amin_02.wav"])).toBe(false);
  });

  test("normalizes NFKC full-width tokens and full-width spaces with multi-term matching", () => {
    expect(matchesFuzzySearch("ＦＩＬＬ　ＡＭＢＩＥＮＴ", ["drum fill.wav", "ambient pad.wav"])).toBe(true);
    expect(matchesFuzzySearch("ＦＩＬＬ　Missing", ["drum fill.wav", "ambient pad.wav"])).toBe(false);
  });

  test("allows each whitespace term to match any individual target", () => {
    expect(matchesFuzzySearch("drum ambient", ["DrumFill.wav", "ambient pad.wav"])).toBe(true);
  });

  test("returns false for non-matching terms and true for empty query", () => {
    expect(matchesFuzzySearch("", ["kick.wav"])).toBe(true);
    expect(matchesFuzzySearch("fill", ["kick.wav"])).toBe(false);
  });
});
