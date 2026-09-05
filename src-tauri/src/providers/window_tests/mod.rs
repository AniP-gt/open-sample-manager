fn opening_source() -> &'static str {
    include_str!("../window_opening.rs")
}

fn closing_source() -> &'static str {
    include_str!("../window_closing.rs")
}

fn bounds_source() -> &'static str {
    include_str!("../window_bounds.rs")
}

fn script_source() -> &'static str {
    include_str!("../window_script.rs")
}

mod closing;
mod opening;
mod security;
