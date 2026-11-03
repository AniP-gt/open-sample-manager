use super::*;
use crate::db::schema::init_database;

fn manager() -> SampleManager {
    let manager = SampleManager::new(None).unwrap();
    for (id, name, bpm, duration, instrument) in [
        (1, "Kick A", 120.0, 1.0, "kick"),
        (2, "Kick B", 121.0, 1.1, "kick"),
        (3, "Kick C", 180.0, 5.0, "kick"),
        (4, "Snare", 120.0, 1.0, "snare"),
    ] {
        manager.conn.execute("INSERT INTO samples(id,path,file_name,bpm,duration,instrument_type,playback_type) VALUES(?1,?2,?3,?4,?5,?6,'oneshot')", rusqlite::params![id,format!("/samples/{id}.wav"),name,bpm,duration,instrument]).unwrap();
    }
    manager
}

fn query(view: DiscoveryView) -> DiscoveryQuery {
    DiscoveryQuery {
        view,
        instrument: None,
        favorite_ids: vec![],
        offset: 0,
    }
}

fn ids(manager: &SampleManager, query: &DiscoveryQuery) -> Vec<i64> {
    manager
        .query_discovery(query)
        .unwrap()
        .iter()
        .map(|r| r.sample.id)
        .collect()
}

#[test]
fn usage_ranking_separates_metrics_cooldown_period_and_instrument() {
    let manager = manager();
    assert!(manager.record_sample_usage(1, UsageKind::Preview).unwrap());
    assert!(!manager.record_sample_usage(1, UsageKind::Preview).unwrap());
    assert!(manager.record_sample_usage(1, UsageKind::Export).unwrap());
    manager.conn.execute("INSERT INTO sample_usage_events(sample_id,kind,occurred_at) VALUES(2,'preview',unixepoch()-40*86400),(2,'preview',unixepoch()-41*86400),(4,'preview',unixepoch())", []).unwrap();
    let mut ranking = query(DiscoveryView::Ranking {
        metric: RankingMetric::Preview,
        days: None,
    });
    assert_eq!(ids(&manager, &ranking), vec![2, 1, 4]);
    ranking.instrument = Some("snare".into());
    assert_eq!(ids(&manager, &ranking), vec![4]);
    ranking.instrument = None;
    ranking.view = DiscoveryView::Ranking {
        metric: RankingMetric::Preview,
        days: Some(30),
    };
    assert_eq!(ids(&manager, &ranking), vec![1, 4]);
    ranking.view = DiscoveryView::Ranking {
        metric: RankingMetric::Export,
        days: None,
    };
    assert_eq!(ids(&manager, &ranking), vec![1]);
    assert!(manager
        .record_sample_usage(999, UsageKind::Preview)
        .is_err());
}

#[test]
fn project_notes_and_adoption_are_idempotent_and_removable() {
    let mut manager = manager();
    let project = manager.create_project_shelf("Song").unwrap();
    let mut update = ProjectMemberUpdate {
        collection_id: project,
        sample_id: 1,
        status: ProjectStatus::Adopted,
        note: "Chorus".into(),
        add_only: false,
    };
    manager.update_project_member(&update).unwrap();
    manager.update_project_member(&update).unwrap();
    let ranking = query(DiscoveryView::Ranking {
        metric: RankingMetric::Adopted,
        days: None,
    });
    let results = manager.query_discovery(&ranking).unwrap();
    assert_eq!(results[0].count, Some(1));
    let shelf = query(DiscoveryView::Project {
        collection_id: project,
    });
    assert_eq!(manager.query_discovery(&shelf).unwrap()[0].note, "Chorus");
    manager
        .update_project_member(&ProjectMemberUpdate {
            collection_id: project,
            sample_id: 1,
            status: ProjectStatus::Candidate,
            note: String::new(),
            add_only: true,
        })
        .unwrap();
    let retained = manager.query_discovery(&shelf).unwrap();
    assert_eq!(retained[0].note, "Chorus");
    assert_eq!(retained[0].status.as_deref(), Some("adopted"));
    update.status = ProjectStatus::Candidate;
    manager.update_project_member(&update).unwrap();
    assert!(ids(&manager, &ranking).is_empty());
    manager.remove_project_member(project, 1).unwrap();
    assert!(ids(&manager, &shelf).is_empty());
    let remaining: i64 = manager
        .conn
        .query_row("SELECT COUNT(*) FROM project_sample_details", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn smart_rules_cover_whole_library_validate_and_persist() {
    let manager = manager();
    let rules = SmartRules {
        instrument: Some("kick".into()),
        bpm_min: Some(119.0),
        bpm_max: Some(122.0),
        favorites_only: true,
        ..SmartRules::default()
    };
    manager.save_smart_collection("Favorites", &rules).unwrap();
    init_database(&manager.conn).unwrap();
    let saved = manager.list_smart_collections().unwrap();
    assert_eq!(saved.len(), 1);
    let mut q = query(DiscoveryView::Smart {
        rules: saved[0].rules.clone(),
    });
    q.favorite_ids = vec![2, 3, 4];
    assert_eq!(ids(&manager, &q), vec![2]);
    q.favorite_ids = vec![1];
    assert_eq!(ids(&manager, &q), vec![1]);
    assert!(manager
        .save_smart_collection(
            "Invalid",
            &SmartRules {
                bpm_min: Some(200.0),
                bpm_max: Some(100.0),
                ..SmartRules::default()
            }
        )
        .is_err());
    manager.delete_smart_collection(saved[0].id).unwrap();
    assert!(manager.list_smart_collections().unwrap().is_empty());
}

#[test]
fn rediscovery_and_similarity_exclude_played_and_source_samples() {
    let manager = manager();
    manager.record_sample_usage(1, UsageKind::Preview).unwrap();
    manager.record_sample_usage(2, UsageKind::Export).unwrap();
    manager.conn.execute("INSERT INTO sample_usage_events(sample_id,kind,occurred_at) VALUES(3,'preview',unixepoch()-100*86400)",[]).unwrap();
    assert_eq!(ids(&manager, &query(DiscoveryView::Unplayed)), vec![4, 2]);
    let mut forgotten = query(DiscoveryView::Forgotten { days: 90 });
    forgotten.favorite_ids = vec![1, 3, 4];
    assert_eq!(ids(&manager, &forgotten), vec![4, 3]);
    assert_eq!(
        ids(&manager, &query(DiscoveryView::Similar { sample_id: 1 })),
        vec![2, 3]
    );
    manager
        .conn
        .execute("DELETE FROM samples WHERE id=1", [])
        .unwrap();
    let events: i64 = manager
        .conn
        .query_row(
            "SELECT COUNT(*) FROM sample_usage_events WHERE sample_id=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(events, 0);
}

#[test]
fn file_backed_history_and_notes_survive_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.db");
    let path = path.to_str().unwrap();
    {
        let mut manager = SampleManager::new(Some(path)).unwrap();
        manager
            .conn
            .execute(
                "INSERT INTO samples(id,path,file_name) VALUES(1,'/a.wav','a.wav')",
                [],
            )
            .unwrap();
        manager.record_sample_usage(1, UsageKind::Export).unwrap();
        let project = manager.create_project_shelf("Song").unwrap();
        manager
            .update_project_member(&ProjectMemberUpdate {
                collection_id: project,
                sample_id: 1,
                status: ProjectStatus::Adopted,
                note: "Verse".into(),
                add_only: false,
            })
            .unwrap();
    }
    let manager = SampleManager::new(Some(path)).unwrap();
    assert_eq!(
        ids(
            &manager,
            &query(DiscoveryView::Ranking {
                metric: RankingMetric::Export,
                days: None
            })
        ),
        vec![1]
    );
    let project = manager.list_collections().unwrap()[0].id;
    assert_eq!(
        manager
            .query_discovery(&query(DiscoveryView::Project {
                collection_id: project
            }))
            .unwrap()[0]
            .note,
        "Verse"
    );
}
