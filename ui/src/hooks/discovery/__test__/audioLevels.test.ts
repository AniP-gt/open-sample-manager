import { describe, expect, it } from "vitest";
import { comparisonGain, measureAudio } from "../useDiscoveryAudio";

describe("comparison levels", () => {
  it("measures all channels and matches RMS without changing the source samples", () => {
    const left = new Float32Array([0.5, -0.5]), right = new Float32Array([0.25, -0.25]);
    const level = measureAudio({ numberOfChannels: 2, length: 2, getChannelData: (channel) => channel === 0 ? left : right });
    expect(level.rms).toBeCloseTo(Math.sqrt(0.15625));
    expect(level.peak).toBe(0.5);
    expect(level.rms * comparisonGain(level)).toBeCloseTo(0.1);
    expect(Array.from(left)).toEqual([0.5, -0.5]);
  });
  it("limits transient peaks and leaves silence finite", () => {
    const gain = comparisonGain({ rms: 0.01, peak: 0.5 });
    expect(0.5 * gain).toBeCloseTo(Math.pow(10, -1 / 20));
    expect(comparisonGain({ rms: 0, peak: 0 })).toBe(1);
  });
});
