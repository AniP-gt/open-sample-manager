import { describe, expect, test } from 'vitest';
import { appendPreviousRandomSelection, chooseRandomSample, popRandomHistory } from '../randomSelection';
import type { Sample } from '../../../types/sample';

const samples: Sample[] = [
  {
    id: 1,
    file_name: 'kick.wav',
    sample_type: 'one-shot',
    instrument_type: 'kick',
    bpm: 120,
    duration: 1,
    tags: [],
    periodicity: 0,
    low_ratio: 0,
    attack_slope: 0,
    decay_time: null,
    playback_type: 'oneshot',
    waveform_peaks: null,
    sample_rate: 44100,
    musical_key: 'C',
  },
  {
    id: 2,
    file_name: 'loop.wav',
    sample_type: 'loop',
    instrument_type: 'other',
    bpm: 140,
    duration: 4,
    tags: [],
    periodicity: 0,
    low_ratio: 0,
    attack_slope: 0,
    decay_time: null,
    playback_type: 'loop',
    waveform_peaks: null,
    sample_rate: 48000,
    musical_key: 'A',
  },
];

describe('random selection helpers', () => {
  test('returns null when there are no candidates', () => {
    expect(chooseRandomSample([], null, () => 0)).toBeNull();
  });

  test('avoids the current sample when another candidate exists', () => {
    const selected = chooseRandomSample(samples, samples[0].id, () => 0);

    expect(selected).toEqual(samples[1]);
  });

  test('allows the current sample when it is the only candidate', () => {
    const selected = chooseRandomSample([samples[0]], samples[0].id, () => 0);

    expect(selected).toEqual(samples[0]);
  });

  test('pushes and pops random history in stack order', () => {
    const history = appendPreviousRandomSelection([], samples[0]);
    const secondHistory = appendPreviousRandomSelection(history, samples[1]);

    expect(popRandomHistory(secondHistory)).toEqual({
      previousSample: samples[1],
      nextHistory: [samples[0]],
    });
  });
});
