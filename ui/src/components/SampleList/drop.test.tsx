// React import not required in this test file (JSX not used directly)
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SampleList } from './SampleList';
import type { Sample } from '../../types/sample';

const emptySamples: Sample[] = [];

function makeDataTransferWithUri(uri: string) {
  return {
    items: [],
    getData: (type: string) => (type === 'text/uri-list' ? uri : ''),
  } as unknown as DataTransfer;
}

describe('SampleList drop handling', () => {
  it('calls onImportPaths with normalized path from URI list', () => {
    const onImportPaths = vi.fn();
    const { container } = render(
      <SampleList
        samples={emptySamples}
        samplePaths={{}}
        filters={{ search: '', filterType: 'all', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '' }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={() => {}}
        onFilterChange={() => {}}
        onSortChange={() => {}}
        onDeleteSample={() => {}}
        onImportPaths={onImportPaths}
      />,
    );

    const list = container.querySelector('div[style*="position: relative"]');
    expect(list).toBeTruthy();

    const dt = makeDataTransferWithUri('file:///Users/alice/Music/sample.wav');
    fireEvent.drop(list as Element, { dataTransfer: dt });

    expect(onImportPaths).toHaveBeenCalled();
    const calledWith = onImportPaths.mock.calls[0][0] as string[];
    expect(calledWith).toEqual(['/Users/alice/Music/sample.wav']);
  });
});
