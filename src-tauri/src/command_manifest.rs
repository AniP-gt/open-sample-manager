macro_rules! app_commands {
    ($consumer:ident) => {
        $consumer!(
            health_check,
            scan_directory,
            export_library_database,
            import_library_database,
            import_file,
            search_samples,
            list_samples_paginated,
            list_samples_around_id,
            search_by_embedding,
            get_sample,
            get_samples_by_ids,
            list_collections,
            get_collection_members,
            list_all_sample_paths,
            list_duplicate_groups,
            delete_sample,
            clear_all_samples,
            re_scan_all_samples,
            move_sample,
            send_to_trash,
            update_sample_classification,
            update_sample_license_metadata,
            get_instrument_types,
            add_instrument_type,
            delete_instrument_type,
            update_instrument_type,
            open_folder,
            copy_to_clipboard,
            prepare_processed_drag_file,
            get_drag_icon_path,
            debug_start_drag,
            debug_try_deserialize,
            claim_ui_command_queue,
            acknowledge_ui_command,
            nack_ui_command,
            emit_ui_command_wake,
            open_provider_browser,
            set_provider_browser_bounds,
            show_provider_browser,
            hide_provider_browser,
            close_all_provider_browsers,
            close_embedded_provider_browser,
            go_back_provider_browser,
            go_forward_provider_browser,
            read_audio_file,
            check_timidity,
            play_midi,
            stop_midi,
            scan_midi_directory,
            list_midis_paginated,
            list_midis_around_id,
            get_all_midi_paths,
            get_midi,
            delete_midi,
            clear_all_midis,
            search_midis,
            search_midis_paginated,
            get_midi_tags,
            add_midi_tag,
            delete_midi_tag,
            update_midi_tag,
            set_midi_file_tag,
            get_midi_file_tags
        )
    };
}

#[cfg(test)]
mod tests {
    macro_rules! command_names {
        ($($command:ident),* $(,)?) => { &[$(stringify!($command)),*] };
    }

    #[test]
    fn provider_browser_commands_are_in_the_generated_manifest() {
        let commands = app_commands!(command_names);

        for command in [
            "open_provider_browser",
            "set_provider_browser_bounds",
            "show_provider_browser",
            "hide_provider_browser",
            "close_all_provider_browsers",
            "close_embedded_provider_browser",
            "go_back_provider_browser",
            "go_forward_provider_browser",
        ] {
            assert!(commands.contains(&command));
        }
    }
}
