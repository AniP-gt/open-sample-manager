# Sample Metadata and Quality Checks

Open Sample Manager stores license details and quality signals next to each indexed sample. The data stays in the local SQLite database and travels with the library export/import flow.

## License And Source Metadata

Each sample can store:

| Field | Purpose |
|---|---|
| Source | Where the sound came from, such as Splice, ADSR, a free pack, or your own recording |
| Pack name | The sample pack, collection, or product name |
| License | A short license label, such as royalty-free, commercial OK, own recording, or unknown |
| License URL | A link to the license page, product page, or download page |
| Memo | Free text for usage notes, attribution rules, or purchase details |
| Imported date | The date the row was added to the local library |

Click the `LIC` cell in the sample list to edit these fields. If multiple samples are selected, the same values are applied to all selected rows. Empty fields are saved as blank metadata.

The sample list includes a license filter, and the search box also checks source, pack name, license text, tags, file names, and quality flags.

## Quality Checks

Quality checks run during audio scan and import. They are meant to catch common problems before a sound reaches a DAW.

| Field | Meaning |
|---|---|
| Peak dB | Maximum absolute sample level, converted to dB |
| RMS dB | Average power level, converted to dB |
| Leading silence | Silent time at the start of the sample, in milliseconds |
| Clipping count | Number of samples close to full scale |
| Channel count | Source channel count reported by the decoder |
| Bit depth | Source bit depth when the decoder exposes it |
| Quality flags | Short labels for issues found during analysis |

Current flags include:

| Flag | Trigger |
|---|---|
| empty_or_silent | No measurable signal |
| clipping | One or more samples are near full scale |
| low_level | Peak is very low |
| very_quiet | RMS level is very low |
| leading_silence | The sample starts with more than 100 ms of silence |

The sample list shows a compact `QC` status. `OK` means no quality flags were found. `!` means one or more flags are present. Use the `QC` button in the sample list toolbar to show only samples with quality flags.

## Storage Notes

The fields are stored on the `samples` table. Existing databases are migrated on startup, so old libraries receive the new columns without a manual reset.

Manual license metadata is preserved when a sample is re-scanned or when its playback/instrument classification is edited. Re-analysis updates quality metrics, but it doesn't overwrite source, pack, license, URL, or memo fields.

Quality metrics use the existing decoded analysis buffer for level checks. Channel count and bit depth come from decoder metadata when available. Some compressed formats may not expose bit depth, so that field can be blank.

## Suggested Workflow

1. Scan a sample folder.
2. Use `QC` to find files with clipping, leading silence, or very low level.
3. Click `LIC` on a row, then fill source, pack, license, URL, and memo.
4. Select multiple related samples before editing metadata to tag a whole pack at once.
5. Use the license filter before exporting or using samples in commercial work.
