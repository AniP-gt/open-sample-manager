import type { Sample } from "../../types/sample";

export function chooseRandomSample(
  candidates: Sample[],
  currentSampleId: number | null | undefined,
  random: () => number = Math.random,
): Sample | null {
  if (candidates.length === 0) return null;

  const selectable = candidates.length > 1
    ? candidates.filter((sample) => sample.id !== currentSampleId)
    : candidates;

  const index = Math.floor(random() * selectable.length);
  return selectable[Math.min(index, selectable.length - 1)] ?? null;
}

export function appendPreviousRandomSelection(
  history: Sample[],
  previousRandomSample: Sample | null,
): Sample[] {
  if (!previousRandomSample) return history;
  return [...history, previousRandomSample];
}

export function popRandomHistory(history: Sample[]): { previousSample: Sample | null; nextHistory: Sample[] } {
  if (history.length === 0) {
    return { previousSample: null, nextHistory: history };
  }

  return {
    previousSample: history[history.length - 1],
    nextHistory: history.slice(0, -1),
  };
}
