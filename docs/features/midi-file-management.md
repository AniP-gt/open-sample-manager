# MIDI File Management

Open Sample Manager stores MIDI files alongside audio samples, with separate browsing, filtering, tagging, and playback behavior.

## Scanning

The MIDI scanner recursively indexes files with `mid` and `midi` extensions. Metadata is parsed and stored in the same local SQLite database used by the sample library.

## MIDI List

The MIDI list supports filename search, sorting, paging, favorites, selection, and row actions. A row can show tags, open the containing folder, copy the file path, move the file to trash, or start playback.

## Tags

MIDI tags can be created and assigned to files. Tags are included in MIDI search, so they can work as custom labels for chord type, groove, source pack, instrument role, or any other grouping you use.

## Playback

MIDI playback requires TiMidity++. The app checks common platform install paths and the system `PATH`, then starts TiMidity++ when you preview a MIDI file.

Starting a new MIDI preview stops the previous TiMidity++ process first. If TiMidity++ is missing, the Settings panel and README setup section explain how to install it.

## Preview Sync

MIDI preview can follow the project BPM and key controls. Tempo rewrite and note transposition are applied before playback. Percussion channel 9 is left unchanged so drum parts don't get transposed like pitched notes.
