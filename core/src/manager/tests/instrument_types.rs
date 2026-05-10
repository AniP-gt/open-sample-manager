use super::helpers::make_manager;

#[test]
fn manager_instrument_type_crud_roundtrip() {
    let manager = make_manager();

    let id = manager
        .add_instrument_type("phase4-manager-pad")
        .expect("add instrument type failed");
    let inserted = manager
        .get_all_instrument_types()
        .expect("list instrument types failed");
    assert!(inserted
        .iter()
        .any(|row| row.id == id && row.name == "phase4-manager-pad"));

    assert_eq!(
        manager
            .update_instrument_type(id, "phase4-manager-pluck")
            .expect("update instrument type failed"),
        1
    );
    let updated = manager
        .get_all_instrument_types()
        .expect("list updated instrument types failed");
    assert!(updated
        .iter()
        .any(|row| row.id == id && row.name == "phase4-manager-pluck"));

    assert_eq!(
        manager
            .delete_instrument_type(id)
            .expect("delete instrument type failed"),
        1
    );
    let remaining = manager
        .get_all_instrument_types()
        .expect("list remaining instrument types failed");
    assert!(!remaining.iter().any(|row| row.id == id));
}
