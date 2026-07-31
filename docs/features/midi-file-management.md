# MIDI File Management

Open Sample Manager stores MIDI files alongside audio samples, with separate browsing, filtering, tagging, and playback behavior.

## Scanning

The MIDI scanner recursively indexes files with `mid` and `midi` extensions. Metadata is parsed and stored in the same local SQLite database used by the sample library.

## MIDI List

The MIDI list supports filename search, sorting, paging, favorites, selection, and row actions. A row can show tags, open the containing folder, copy the file path, move the file to trash, or start playback.

## Phrase Classification

Scanning a MIDI file also classifies the note pattern. These fields describe how the phrase behaves, independent of the sound used to play it:

| Field | Values | How it is derived |
|---|---|---|
| Role | `melody`, `chords`, `bass`, `drums`, `mixed` | Note range, overlapping notes, and percussion channel use |
| Voicing | `monophonic`, `polyphonic` | Whether notes overlap within a track |
| Density | `sparse`, `medium`, `dense` | Note count per bar |
| Range | `low`, `mid`, `high`, `wide` | Average pitch and total pitch span |
| Bars | Numeric phrase length | MIDI ticks and time signature |
| Instrument | General MIDI family | Explicit Program Change events or percussion channel use |

The MIDI list shows these values in the `ROLE`, `TEXTURE`, `BARS`, and `INSTRUMENT` columns. Filters above the list can combine role, voicing, density, range, and common bar counts.

Role detection uses a small set of deterministic rules. MIDI channel 10, represented as zero-based channel 9 in the file, counts as percussion. Pitched notes with an average pitch below MIDI note 48 are treated as bass. Three or more simultaneous pitched notes indicate chords. Remaining pitched phrases are classified as melody, while files containing both pitched notes and percussion are marked as mixed.

Density is based on notes per bar: fewer than 4 is sparse, 4 to fewer than 12 is medium, and 12 or more is dense. Range uses the average MIDI note unless the phrase spans at least 36 semitones, in which case it is marked wide.

Instrument is a suggestion, not a description of rendered audio. A MIDI file may omit Program Change events, use a non-General MIDI sound map, or control an external synthesizer with a different patch. In those cases the instrument field can be empty or differ from the sound heard in a DAW.

Classification is written during scanning. MIDI files indexed before this feature was added keep empty classification fields until their folder is scanned again.

## Tags

MIDI tags can be created and assigned to files. Tags are included in MIDI search, so they can work as custom labels for chord type, groove, source pack, instrument role, or any other grouping you use.

Tags are manual labels. Phrase classification is generated from MIDI events and doesn't replace custom tags.

## Playback

MIDI playback requires TiMidity++. The app checks common platform install paths and the system `PATH`, then starts TiMidity++ when you preview a MIDI file.

Starting a new MIDI preview stops the previous TiMidity++ process first. If TiMidity++ is missing, the Settings panel and README setup section explain how to install it.

## Preview Sync

MIDI preview can follow the project BPM and key controls. Tempo rewrite and note transposition are applied before playback. Percussion channel 9 is left unchanged so drum parts don't get transposed like pitched notes.
