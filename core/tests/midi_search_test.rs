#[path = "common/db.rs"]
mod db_common;

use open_sample_manager_core::db::operations::{
    assign_midi_tag, insert_midi, insert_midi_tag, search_midis_paginated,
};

use db_common::{init_test_db, midi_input};

#[test]
fn midi_search_filters_directory_before_fuzzy_pagination() {
    let conn = init_test_db();

    for (path, file_name) in [
        ("/packs/KICK/alpha_kick.mid", "alpha_kick.mid"),
        ("/packs/KICK/beta_kick.mid", "beta_kick.mid"),
        ("/packs/KICK2/gamma_kick.mid", "gamma_kick.mid"),
    ] {
        insert_midi(&conn, &midi_input(path, file_name)).expect("insert midi");
    }

    let page = search_midis_paginated(&conn, "kick", 1, 1, Some("/packs/KICK"), None)
        .expect("search filtered midis");

    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "beta_kick.mid");
}

#[test]
fn midi_search_paginated_applies_offset_after_fuzzy_filter() {
    let conn = init_test_db();

    for file_name in [
        "alpha_kick.mid",
        "beta_kick.mid",
        "gamma_kick.mid",
        "snare.mid",
    ] {
        let input = midi_input(&format!("/tmp/{file_name}"), file_name);
        insert_midi(&conn, &input).expect("insert midi");
    }

    let page = search_midis_paginated(&conn, "kick", 1, 1, None, None).expect("search midi page");
    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "beta_kick.mid");
}

#[test]
fn midi_search_normalizes_full_width_ascii_and_matches_tags() {
    let conn = init_test_db();

    let midi = midi_input("/tmp/mystery.mid", "mystery.mid");
    let midi_id = insert_midi(&conn, &midi).expect("insert midi");
    let tag_id = insert_midi_tag(&conn, "melody-custom").expect("insert tag");
    assign_midi_tag(&conn, midi_id, tag_id).expect("assign tag");

    let by_tag = search_midis_paginated(&conn, "ｍｅｌｏｄｙ", 10, 0, None, None)
        .expect("search midi by tag");
    assert_eq!(by_tag.len(), 1);
    assert_eq!(by_tag[0].file_name, "mystery.mid");

    let by_name =
        search_midis_paginated(&conn, "ｍｙｓ", 10, 0, None, None).expect("search midi by name");
    assert_eq!(by_name.len(), 1);
    assert_eq!(by_name[0].file_name, "mystery.mid");
}

#[test]
fn midi_search_fill_matches_contiguous_terms_and_not_noncontiguous_legacy_match() {
    let conn = init_test_db();

    insert_midi(&conn, &midi_input("/tmp/Drum Fill.mid", "Drum Fill.mid")).expect("insert midi");
    insert_midi(
        &conn,
        &midi_input(
            "/tmp/FL_PV2022_VP_Kit04_Fx_Loop_Delayed_Impact_143_Amin_02.mid",
            "FL_PV2022_VP_Kit04_Fx_Loop_Delayed_Impact_143_Amin_02.mid",
        ),
    )
    .expect("insert midi");

    let results =
        search_midis_paginated(&conn, "fill", 10, 0, None, None).expect("search midi by fill");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "Drum Fill.mid");
}
