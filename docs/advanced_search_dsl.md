# Advanced Search DSL

The sample search bar supports a small query language for combining free text, metadata filters, and exclusions in one input. Plain words still use the existing fuzzy filename and tag matching, so `kick 808` keeps working as before.

## Quick Examples

```text
kick bpm:120-180 type:oneshot tag:metal
guitar key:Am bpm:140-160 type:loop
snare -rimshot favorite:true
instrument:kick tag:drums -tag:processed
```

All clauses are combined with implicit AND. A sample must satisfy every positive clause and must not match any negative clause.

## Supported Clauses

| Clause | Example | Meaning |
|---|---|---|
| Free text | `kick 808` | Fuzzy match filename or tags |
| Negative text | `-rimshot` | Exclude samples whose filename or tags match the term |
| BPM range | `bpm:120-180` | Match samples with BPM inside the range |
| Exact BPM | `bpm:140` | Match samples with that BPM value |
| Open BPM range | `bpm:120-` or `bpm:-160` | Match samples above or below a boundary |
| Playback type | `type:loop`, `type:oneshot`, `type:one-shot` | Match loop or one-shot samples |
| Instrument | `instrument:kick` | Match the assigned instrument type |
| Key | `key:C`, `key:C#`, `key:Am` | Match the detected pitch class. Minor suffixes are accepted and normalized to the root pitch class |
| Tag | `tag:metal` | Match an assigned sample tag |
| Negative tag | `-tag:rimshot` | Exclude samples with that tag |
| Favorite | `favorite:true`, `favorite:false` | Match local UI favorites |

Field names are case-insensitive. `type`, `playback`, `playbackType`, and `sampleType` are aliases for the same playback-type filter. `tag` and `tags` are aliases.

## Quoted Values

Use double quotes when a value contains spaces:

```text
tag:"one shot" bpm:90-120
```

Quotes only group the token. They are not part of the searched value.

## Backend and UI Behavior

Most clauses are applied in the Rust backend before pagination, so range and metadata filters do not create empty pages. `favorite:true` and `favorite:false` are applied in the UI because favorites are stored in local UI state, not in the SQLite sample rows.

Unknown field names fall back to plain text search. This keeps partially typed queries useful and avoids hard failures while editing a search.

## Current Scope

The DSL currently applies to audio sample search. MIDI search still uses its existing search box and metadata controls.
