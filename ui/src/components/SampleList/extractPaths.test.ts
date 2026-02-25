import { describe, it, expect } from 'vitest';
import { extractPathsFromDataTransfer } from '../../utils/dataTransfer';

function makeDataTransferFromUriList(uriList: string) {
  return {
    items: [],
    getData: (type: string) => (type === 'text/uri-list' ? uriList : ''),
  } as unknown as DataTransfer;
}

describe('extractPathsFromDataTransfer', () => {
  it('parses file:// URIs on macOS', () => {
    const uri = 'file:///Users/alice/Music/sample.wav';
    const dt = makeDataTransferFromUriList(uri);
    const paths = extractPathsFromDataTransfer(dt);
    expect(paths).toEqual(['/Users/alice/Music/sample.wav']);
  });

  it('parses Windows file:///C:/path URIs', () => {
    const uri = 'file:///C:/Users/Alice/Music/sample.wav';
    const dt = makeDataTransferFromUriList(uri);
    const paths = extractPathsFromDataTransfer(dt);
    expect(paths).toEqual(['C:/Users/Alice/Music/sample.wav']);
  });

  it('returns filename when DataTransfer files have no path', () => {
    const fakeFile = { name: 'sample.wav' } as File;
    const dt = {
      items: [
        {
          kind: 'file',
          getAsFile: () => fakeFile,
        },
      ],
    } as unknown as DataTransfer;

    const paths = extractPathsFromDataTransfer(dt);
    expect(paths).toEqual(['sample.wav']);
  });
});
