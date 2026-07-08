mod collections;
mod fuzzy;
mod instrument_types;
mod midi;
mod samples;
mod saved_searches;
mod search_dsl;
mod types;

pub use collections::{
    add_samples_to_collection, create_collection, delete_collection, get_collection,
    list_collection_samples, list_collections, remove_samples_from_collection, update_collection,
};
pub use instrument_types::{
    delete_instrument_type, get_all_instrument_types, insert_instrument_type,
    update_instrument_type,
};
pub use midi::{
    assign_midi_tag, clear_all_midis, delete_midi, delete_midi_tag, get_all_midi_paths,
    get_all_midi_tags, get_midi_by_path, get_tags_for_midi, insert_midi, insert_midi_tag,
    list_midis_around_id, list_midis_paginated, remove_midi_tag, search_midis,
    search_midis_paginated, set_midi_tag, update_midi_tag,
};
pub use samples::{
    clear_all_samples, delete_sample, get_all_sample_paths, get_sample_by_id, get_sample_by_path,
    insert_sample, list_duplicate_groups, list_samples_around_id, list_samples_paginated,
    move_sample_path, search_by_embedding, search_samples, search_samples_paginated, update_sample,
    update_sample_license_metadata,
};
pub use saved_searches::{
    create_saved_search, delete_saved_search, get_saved_search, list_saved_searches,
    update_saved_search,
};
pub use types::{
    CollectionInput, CollectionRow, DuplicateGroup, EmbeddingSearchResult, InstrumentTypeRow,
    MidiInput, MidiRow, MidiTagRow, SampleInput, SampleRow, SavedSearchInput, SavedSearchRow,
};
