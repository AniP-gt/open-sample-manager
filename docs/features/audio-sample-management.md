# Audio Sample Management

Open Sample Manager can scan folders of audio samples, analyze them, and keep the results in a local library.

## Scanning

The app recursively scans folders for common audio sample files. The scanner accepts `wav`, `mp3`, `flac`, `ogg`, and `aiff` extensions. During a re-scan, paths that already exist in the library are skipped so the scan can focus on new files.

Scan progress is reported back to the app while the Rust core analyzes files and writes metadata to SQLite.

## Analysis

Imported samples are decoded to mono audio for analysis. The app stores metadata that helps with browsing and previewing:

- BPM estimate
- Musical key estimate
- Kick detection
- Loop or one-shot classification
- Waveform peaks
- Embedding data for similarity lookup

The analysis is meant to make a large sample folder easier to search. You can still correct classifications from the UI when the automatic result doesn't match the sound.

## Sample List

The sample list is a dense desktop table with paging, sorting, selection, and row actions. It also has a grid view when a more visual browsing mode is better.

From each sample row, you can favorite a file, open its folder, copy its path, move it to trash, or drag it out to another app.

## Waveform Preview

Selecting a sample shows playback controls and a waveform preview in the player area. The player can auto-play on selection, loop playback, and show processing controls when you want to drag out a rendered version of the sample.

## Similar Samples

Similarity search compares the selected sample's stored embedding against other embeddings in the local database. It is a brute-force cosine search over stored data, not a remote or indexed service. Similarity lookup only works when the selected sample has a valid embedding.
