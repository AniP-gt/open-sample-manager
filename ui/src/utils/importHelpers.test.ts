import { describe, it, expect } from 'vitest';
import { resolveDroppedPaths } from './importHelpers';

describe('resolveDroppedPaths', () => {
  it('returns directories when stat reports directory', async () => {
    const paths = ['/Users/alice/Music/samples'];
    const statFn = async (_p: string) => ({ isDirectory: true, isFile: false });
    const resolved = await resolveDroppedPaths(paths, statFn);
    expect(resolved).toEqual(['/Users/alice/Music/samples']);
  });

  it('returns parent directory when stat reports file', async () => {
    const paths = ['/Users/alice/Music/samples/kick.wav'];
    const statFn = async (_p: string) => ({ isDirectory: false, isFile: true });
    const resolved = await resolveDroppedPaths(paths, statFn);
    expect(resolved).toEqual(['/Users/alice/Music/samples']);
  });

  it('falls back to heuristic when stat fails', async () => {
    const paths = ['/Users/alice/Music/samples/kick.wav', '/Users/alice/Music/loops'];
    const statFn = async (_p: string) => { throw new Error('stat-failed'); };
    const resolved = await resolveDroppedPaths(paths, statFn);
    expect(resolved).toEqual(['/Users/alice/Music/samples', '/Users/alice/Music/loops']);
  });
});
