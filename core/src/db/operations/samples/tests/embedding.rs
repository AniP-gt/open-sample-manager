use crate::db::operations::{insert_sample, search_by_embedding};

use super::{make_input, setup_db};

fn encode_embedding(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

#[test]
fn search_by_embedding_returns_exact_match_first() {
    let conn = setup_db();
    let mut kick = make_input("/samples/kick.wav", "kick.wav");
    kick.embedding = Some(encode_embedding(&[1.0, 0.0, 0.0]));
    insert_sample(&conn, &kick).expect("kick insert failed");

    let mut snare = make_input("/samples/snare.wav", "snare.wav");
    snare.embedding = Some(encode_embedding(&[0.0, 1.0, 0.0]));
    insert_sample(&conn, &snare).expect("snare insert failed");

    let results = search_by_embedding(&conn, &[1.0, 0.0, 0.0], 2).expect("search failed");

    assert_eq!(results.len(), 2);
    assert_eq!(results[0].row.path, "/samples/kick.wav");
    assert!((results[0].similarity - 1.0).abs() < 0.0001);
    assert_eq!(results[1].row.path, "/samples/snare.wav");
}

#[test]
fn search_by_embedding_limits_result_count() {
    let conn = setup_db();
    for index in 0..3 {
        let mut input = make_input(
            &format!("/samples/sample-{index}.wav"),
            &format!("sample-{index}.wav"),
        );
        input.embedding = Some(encode_embedding(&[1.0, index as f32, 0.0]));
        insert_sample(&conn, &input).expect("insert failed");
    }

    let results = search_by_embedding(&conn, &[1.0, 0.0, 0.0], 1).expect("search failed");

    assert_eq!(results.len(), 1);
}

#[test]
fn search_by_embedding_skips_malformed_and_wrong_dimension_embeddings() {
    let conn = setup_db();

    let mut malformed = make_input("/samples/malformed.wav", "malformed.wav");
    malformed.embedding = Some(vec![1, 2, 3]);
    insert_sample(&conn, &malformed).expect("malformed insert failed");

    let mut wrong_dimension = make_input("/samples/wrong-dimension.wav", "wrong-dimension.wav");
    wrong_dimension.embedding = Some(encode_embedding(&[1.0, 0.0]));
    insert_sample(&conn, &wrong_dimension).expect("wrong dimension insert failed");

    let mut valid = make_input("/samples/valid.wav", "valid.wav");
    valid.embedding = Some(encode_embedding(&[0.0, 1.0, 0.0]));
    insert_sample(&conn, &valid).expect("valid insert failed");

    let results = search_by_embedding(&conn, &[0.0, 1.0, 0.0], 10).expect("search failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].row.path, "/samples/valid.wav");
}

#[test]
fn search_by_embedding_skips_row_mapping_errors() {
    let conn = setup_db();

    let mut unreadable = make_input("/samples/unreadable.wav", "unreadable.wav");
    unreadable.embedding = Some(encode_embedding(&[0.0, 1.0, 0.0]));
    insert_sample(&conn, &unreadable).expect("unreadable insert failed");
    conn.execute(
        "UPDATE samples SET duration = 'not a number' WHERE path = ?1",
        ["/samples/unreadable.wav"],
    )
    .expect("corrupting duration failed");

    let mut valid = make_input("/samples/valid.wav", "valid.wav");
    valid.embedding = Some(encode_embedding(&[0.0, 1.0, 0.0]));
    insert_sample(&conn, &valid).expect("valid insert failed");

    let results = search_by_embedding(&conn, &[0.0, 1.0, 0.0], 10).expect("search failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].row.path, "/samples/valid.wav");
}

#[test]
fn search_by_embedding_returns_empty_for_empty_query_or_missing_embeddings() {
    let conn = setup_db();
    insert_sample(
        &conn,
        &make_input("/samples/no-embedding.wav", "no-embedding.wav"),
    )
    .expect("insert failed");

    assert!(search_by_embedding(&conn, &[], 10)
        .expect("empty query search failed")
        .is_empty());
    assert!(search_by_embedding(&conn, &[1.0, 0.0, 0.0], 10)
        .expect("missing embedding search failed")
        .is_empty());
}
#[test]
fn search_by_embedding_characterizes_source_row_as_top_exact_match() {
    let conn = setup_db();
    let mut source = make_input("/samples/source.wav", "source.wav");
    source.embedding = Some(encode_embedding(&[1.0, 0.0, 0.0]));
    insert_sample(&conn, &source).expect("source insert failed");

    let mut other = make_input("/samples/other.wav", "other.wav");
    other.embedding = Some(encode_embedding(&[0.0, 1.0, 0.0]));
    insert_sample(&conn, &other).expect("other insert failed");

    let results = search_by_embedding(&conn, &[1.0, 0.0, 0.0], 2).expect("search failed");

    assert_eq!(results[0].row.path, "/samples/source.wav");
    assert!((results[0].similarity - 1.0).abs() < 0.0001);
    assert_eq!(results[1].row.path, "/samples/other.wav");
}
