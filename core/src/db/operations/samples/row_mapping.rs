use crate::db::operations::types::SampleRow;

pub(in crate::db::operations::samples) fn row_to_sample(
    row: &rusqlite::Row<'_>,
) -> Result<SampleRow, rusqlite::Error> {
    let tag_names = optional_tag_names(row)?;
    Ok(SampleRow {
        id: row.get::<_, i64>("id")?,
        path: row.get::<_, String>("path")?,
        file_name: row.get::<_, String>("file_name")?,
        duration: row.get::<_, Option<f64>>("duration")?,
        bpm: row.get::<_, Option<f64>>("bpm")?,
        periodicity: row.get::<_, Option<f64>>("periodicity")?,
        sample_rate: row.get::<_, Option<i64>>("sample_rate")?,
        file_size: row.get::<_, Option<i64>>("file_size")?,
        artist: row.get::<_, Option<String>>("artist")?,
        low_ratio: row.get::<_, Option<f64>>("low_ratio")?,
        attack_slope: row.get::<_, Option<f64>>("attack_slope")?,
        decay_time: row.get::<_, Option<f64>>("decay_time")?,
        sample_type: row.get::<_, Option<String>>("sample_type")?,
        waveform_peaks: row.get::<_, Option<String>>("waveform_peaks")?,
        embedding: row.get::<_, Option<Vec<u8>>>("embedding")?,
        is_online: row.get::<_, i32>("is_online")? != 0,
        playback_type: row.get::<_, String>("playback_type")?,
        instrument_type: row.get::<_, String>("instrument_type")?,
        musical_key: row.get::<_, Option<String>>("musical_key")?,
        tags: parse_tag_names(tag_names.as_deref()),
    })
}

fn optional_tag_names(row: &rusqlite::Row<'_>) -> Result<Option<String>, rusqlite::Error> {
    match row.get::<_, Option<String>>("tag_names") {
        Ok(tag_names) => Ok(tag_names),
        Err(rusqlite::Error::InvalidColumnName(_)) => Ok(None),
        Err(err) => Err(err),
    }
}

fn parse_tag_names(tag_names: Option<&str>) -> Vec<String> {
    tag_names
        .unwrap_or("")
        .split('\u{1f}')
        .filter(|tag| !tag.is_empty())
        .map(str::to_string)
        .collect()
}
