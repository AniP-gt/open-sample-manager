# Preview Sync and Drag Export

Open Sample Manager is built around auditioning sounds before moving them into a project.

## Project Controls

The header has project BPM and key controls. You can use them as the target context for previewing samples and MIDI files.

Two sync options control how preview behaves:

- Tempo sync adjusts playback rate or MIDI tempo for the target BPM.
- Key sync pitch-shifts samples or transposes MIDI notes toward the target key.

These controls affect preview and export behavior inside the app. They don't edit the original files in your library.

## Audio Preview

Sample preview can follow the project BPM with playback-rate changes. When key sync is enabled and the sample has key metadata, preview can also apply pitch shift.

The player bar includes waveform display, loop playback, auto-play on selection, and processing controls.

## MIDI Preview

MIDI preview can rewrite tempo and transpose notes before playback through TiMidity++. Drum/percussion channel 9 stays unchanged during transposition.

## Raw Drag-Out

Samples and MIDI files can be dragged from the app to another destination, including a DAW. Raw drag-out uses the existing file as the source.

## Processed Sample Drag Export

When you need a changed audio file, open the player controls and set trim, fade, and gain. The app renders a temporary WAV for drag-out while leaving the original file untouched.

Processed drag export is only for audio samples. MIDI preview sync changes playback, not the saved MIDI file in the library.
