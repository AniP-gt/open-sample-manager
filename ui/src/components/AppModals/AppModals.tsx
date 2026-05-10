import {
  ConfirmModal,
  ClassificationEditModal,
  InstrumentTypeManagementModal,
  MidiTagManagementModal,
  MidiTagEditModal,
} from "..";
import type { Sample, InstrumentTypeRow, SampleType } from "../../types/sample";
import type { Midi, MidiTagRow } from "../../types/midi";

interface AppModalsProps {
  sampleState: {
    confirmOpen: boolean;
    pendingTrashSampleId: number | null;
    samples: Sample[];
    confirmTrash: () => Promise<void>;
    cancelTrash: () => void;
    classificationModalOpen: boolean;
    classificationSample: Sample | null;
    classificationTargetIds: number[];
    editInstrumentType: string;
    editSampleType: SampleType;
    instrumentTypes: InstrumentTypeRow[];
    setEditInstrumentType: (t: string) => void;
    handleSampleTypeSelect: (t: SampleType) => void;
    handleClassificationSave: () => Promise<void>;
    setClassificationModalOpen: (v: boolean) => void;
    setInstrumentTypeModalOpen: (v: boolean) => void;
    instrumentTypeModalOpen: boolean;
    handleAddInstrumentType: (name: string) => Promise<void>;
    handleDeleteInstrumentType: (id: number) => Promise<void>;
    handleUpdateInstrumentType: (id: number, name: string) => Promise<void>;
  };
  midiState: {
    confirmOpen: boolean;
    pendingTrashMidiId: number | null;
    midis: Midi[];
    confirmTrashMidi: () => Promise<void>;
    setPendingTrashMidiId: (id: number | null) => void;
    setConfirmOpen: (v: boolean) => void;
    midiTagModalOpen: boolean;
    midiTags: MidiTagRow[];
    handleAddMidiTag: (name: string) => Promise<void>;
    handleDeleteMidiTag: (id: number) => Promise<void>;
    handleUpdateMidiTag: (id: number, newName: string) => Promise<void>;
    setMidiTagModalOpen: (v: boolean) => void;
    midiTagEditOpen: boolean;
    midiTagEditTarget: Midi | null;
    midiTagEditTargetIds: number[];
    handleMidiTagChange: (midiIds: number | number[], tagId: number | null) => Promise<void>;
    setMidiTagEditOpen: (v: boolean) => void;
  };
}

export function AppModals({ sampleState, midiState }: AppModalsProps) {
  const confirmOpen = sampleState.confirmOpen || midiState.confirmOpen;

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        title={
          sampleState.pendingTrashSampleId === -1
            ? "Clear All Data"
            : midiState.pendingTrashMidiId
              ? "Move MIDI to Trash"
              : "Move to Trash"
        }
        message={
          sampleState.pendingTrashSampleId === -1
            ? "Are you sure you want to clear all samples and MIDI files from the library index? This will remove all samples and MIDI files from the application's index (your files on disk will NOT be deleted). This action cannot be undone in the app."
            : midiState.pendingTrashMidiId
              ? `Are you sure you want to move '${midiState.midis.find((m) => m.id === midiState.pendingTrashMidiId)?.file_name ?? "this MIDI file"}' to the Trash?`
              : `Are you sure you want to move '${sampleState.samples.find((s) => s.id === sampleState.pendingTrashSampleId)?.file_name ?? "this file"}' to the Trash?`
        }
        danger={sampleState.pendingTrashSampleId === -1}
        onConfirm={async () => {
          if (midiState.pendingTrashMidiId) {
            await midiState.confirmTrashMidi();
          } else {
            await sampleState.confirmTrash();
          }
        }}
        onCancel={() => {
          if (midiState.pendingTrashMidiId) {
            midiState.setPendingTrashMidiId(null);
            midiState.setConfirmOpen(false);
          } else {
            sampleState.cancelTrash();
          }
        }}
      />

      <ClassificationEditModal
        isOpen={sampleState.classificationModalOpen}
        sample={sampleState.classificationSample}
        targetIds={sampleState.classificationTargetIds}
        editInstrumentType={sampleState.editInstrumentType}
        editSampleType={sampleState.editSampleType}
        instrumentTypes={sampleState.instrumentTypes.map((t) => t.name)}
        onInstrumentTypeChange={sampleState.setEditInstrumentType}
        onSampleTypeChange={sampleState.handleSampleTypeSelect}
        onSave={sampleState.handleClassificationSave}
        onClose={() => sampleState.setClassificationModalOpen(false)}
        onManageClick={() => sampleState.setInstrumentTypeModalOpen(true)}
      />

      <InstrumentTypeManagementModal
        isOpen={sampleState.instrumentTypeModalOpen}
        instrumentTypes={sampleState.instrumentTypes}
        onAdd={sampleState.handleAddInstrumentType}
        onDelete={sampleState.handleDeleteInstrumentType}
        onUpdate={sampleState.handleUpdateInstrumentType}
        onClose={() => sampleState.setInstrumentTypeModalOpen(false)}
      />

      <MidiTagManagementModal
        isOpen={midiState.midiTagModalOpen}
        midiTags={midiState.midiTags}
        onAdd={midiState.handleAddMidiTag}
        onDelete={midiState.handleDeleteMidiTag}
        onUpdate={midiState.handleUpdateMidiTag}
        onClose={() => midiState.setMidiTagModalOpen(false)}
      />

      <MidiTagEditModal
        isOpen={midiState.midiTagEditOpen}
        midi={midiState.midiTagEditTarget}
        targetIds={midiState.midiTagEditTargetIds}
        midiTags={midiState.midiTags}
        onSave={(tagId) => midiState.handleMidiTagChange(midiState.midiTagEditTargetIds, tagId)}
        onClose={() => midiState.setMidiTagEditOpen(false)}
        onManageClick={() => {
          midiState.setMidiTagEditOpen(false);
          midiState.setMidiTagModalOpen(true);
        }}
      />
    </>
  );
}
