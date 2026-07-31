import "./mockSampleListDependencies";
import { describe, expect, test } from "vitest";
import { renderSampleList } from "./sampleListTestHelpers";
import {
  SAMPLE_LIST_COLUMN_GAP,
  SAMPLE_LIST_MIN_WIDTH,
} from "../sampleListLayout";

describe("SampleList responsive layout", () => {
  test("keeps readable columns inside a horizontally scrollable list", () => {
    const { container } = renderSampleList();

    const scrollRegion = container.querySelector('[data-testid="sample-list-scroll-region"]');
    const header = container.querySelector('[data-testid="sample-list-header"]');
    const row = container.querySelector(".sample-row");

    expect(scrollRegion).toHaveStyle({ overflow: "auto" });
    expect(header).toHaveStyle({
      minWidth: `${SAMPLE_LIST_MIN_WIDTH}px`,
      columnGap: `${SAMPLE_LIST_COLUMN_GAP}px`,
    });
    expect(row).toHaveStyle({
      minWidth: `${SAMPLE_LIST_MIN_WIDTH}px`,
      columnGap: `${SAMPLE_LIST_COLUMN_GAP}px`,
    });
  });

  test("keeps the full table wider than the pane when the detail panel is open", () => {
    expect(SAMPLE_LIST_MIN_WIDTH).toBeGreaterThan(755);
  });
});
