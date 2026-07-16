use open_sample_manager_core::{
    db::operations::{insert_sample, SampleInput},
    SampleManager,
};
use serde_json::Value;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::time::Duration;

pub struct HttpRequest<'a> {
    pub token: &'a str,
    pub host: &'a str,
    pub origin: Option<&'a str>,
    pub path: &'a str,
    pub body: &'a str,
}

pub struct HttpResponse {
    pub status: u16,
    pub headers: String,
    pub body: Value,
}

pub fn manager_with_samples(database_path: &Path) -> (SampleManager, SampleIds) {
    let database_path = database_path.to_string_lossy();
    let manager = SampleManager::new(Some(&database_path)).expect("sample manager");
    let connection = rusqlite::Connection::open(database_path.as_ref()).expect("seed connection");
    let source = seed_sample(&connection, "source.wav", Some(vector([1.0, 0.0])), 128.0);
    let similar = seed_sample(&connection, "similar.wav", Some(vector([0.8, 0.6])), 128.0);
    let missing_embedding = seed_sample(&connection, "missing.wav", None, 90.0);
    (
        manager,
        SampleIds {
            source,
            similar,
            missing_embedding,
        },
    )
}

pub struct SampleIds {
    pub source: i64,
    pub similar: i64,
    pub missing_embedding: i64,
}

pub fn request(address: SocketAddr, input: HttpRequest<'_>) -> HttpResponse {
    let origin = input
        .origin
        .map(|origin| format!("Origin: {origin}\r\n"))
        .unwrap_or_default();
    let request = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\n{}Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        input.path,
        input.host,
        input.token,
        origin,
        input.body.len(),
        input.body,
    );
    let mut client = TcpStream::connect(address).expect("connect to local API");
    client
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("set socket timeout");
    client.write_all(request.as_bytes()).expect("send request");
    let mut raw = String::new();
    client.read_to_string(&mut raw).expect("read response");
    let (headers, body) = raw.split_once("\r\n\r\n").expect("HTTP response body");
    let status = headers
        .split_whitespace()
        .nth(1)
        .expect("HTTP status")
        .parse::<u16>()
        .expect("numeric HTTP status");
    HttpResponse {
        status,
        headers: headers.to_owned(),
        body: serde_json::from_str(body).expect("JSON response"),
    }
}

fn seed_sample(
    connection: &rusqlite::Connection,
    file_name: &str,
    embedding: Option<Vec<u8>>,
    bpm: f64,
) -> i64 {
    insert_sample(
        connection,
        &SampleInput {
            path: format!("/library/{file_name}"),
            file_name: file_name.to_owned(),
            duration: Some(1.0),
            bpm: Some(bpm),
            periodicity: None,
            sample_rate: Some(44_100),
            file_size: Some(512),
            artist: None,
            low_ratio: None,
            sample_type: Some("oneshot".to_owned()),
            waveform_peaks: Some("[0.1]".to_owned()),
            attack_slope: None,
            decay_time: None,
            embedding,
            source: None,
            pack_name: None,
            license: None,
            license_url: None,
            license_memo: None,
            imported_at: None,
            peak_db: None,
            rms_db: None,
            leading_silence_ms: None,
            clipping_count: None,
            channel_count: None,
            bit_depth: None,
            quality_flags: None,
            playback_type: Some("oneshot".to_owned()),
            instrument_type: Some("kick".to_owned()),
            musical_key: Some("C".to_owned()),
            content_hash: None,
        },
    )
    .expect("seed sample")
}

fn vector(values: [f32; 2]) -> Vec<u8> {
    values.into_iter().flat_map(f32::to_le_bytes).collect()
}
