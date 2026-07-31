use midly::MidiMessage;

const PERCUSSION_CHANNEL: u8 = 9;
const GM_FAMILIES: [&str; 16] = [
    "piano",
    "chromatic percussion",
    "organ",
    "guitar",
    "bass",
    "strings",
    "ensemble",
    "brass",
    "reed",
    "pipe",
    "synth lead",
    "synth pad",
    "synth effects",
    "ethnic",
    "percussion",
    "sound effects",
];

#[derive(Debug, Default)]
pub(super) struct MidiClassification {
    pub musical_role: Option<String>,
    pub polyphony: Option<String>,
    pub density: Option<String>,
    pub register: Option<String>,
    pub suggested_instrument: Option<String>,
}

#[derive(Debug, Default)]
pub(super) struct MidiFeatureAccumulator {
    active_notes: [u16; 16],
    current_programs: [Option<u8>; 16],
    program_note_counts: [u32; 16],
    max_active_notes: u16,
    pitched_note_count: u32,
    percussion_note_count: u32,
    pitch_sum: u64,
    min_pitch: Option<u8>,
    max_pitch: Option<u8>,
}

impl MidiFeatureAccumulator {
    pub(super) fn begin_track(&mut self) {
        self.active_notes = [0; 16];
    }

    pub(super) fn observe(&mut self, channel: u8, message: MidiMessage) {
        let channel_index = usize::from(channel);
        match message {
            MidiMessage::ProgramChange { program } => {
                self.current_programs[channel_index] = Some(u8::from(program));
            }
            MidiMessage::NoteOn { key, vel } if u8::from(vel) > 0 => {
                self.observe_note_on(channel, u8::from(key));
            }
            MidiMessage::NoteOn { .. } | MidiMessage::NoteOff { .. } => {
                self.active_notes[channel_index] =
                    self.active_notes[channel_index].saturating_sub(1);
            }
            _ => {}
        }
    }

    pub(super) fn classify(&self, bar_count: Option<f64>) -> MidiClassification {
        let total_notes = self.pitched_note_count + self.percussion_note_count;
        if total_notes == 0 {
            return MidiClassification::default();
        }

        let average_pitch = (self.pitched_note_count > 0)
            .then(|| self.pitch_sum as f64 / f64::from(self.pitched_note_count));
        let musical_role = if self.pitched_note_count == 0 {
            "drums"
        } else if self.percussion_note_count > 0 {
            "mixed"
        } else if average_pitch.is_some_and(|pitch| pitch < 48.0) {
            "bass"
        } else if self.max_active_notes >= 3 {
            "chords"
        } else {
            "melody"
        };
        let polyphony = if self.max_active_notes > 1 {
            "polyphonic"
        } else {
            "monophonic"
        };
        let notes_per_bar = f64::from(total_notes) / bar_count.unwrap_or(1.0).max(0.25);
        let density = if notes_per_bar < 4.0 {
            "sparse"
        } else if notes_per_bar < 12.0 {
            "medium"
        } else {
            "dense"
        };
        let register = average_pitch.map(|pitch| {
            if self
                .min_pitch
                .zip(self.max_pitch)
                .is_some_and(|(low, high)| high.saturating_sub(low) >= 36)
            {
                "wide"
            } else if pitch < 48.0 {
                "low"
            } else if pitch >= 72.0 {
                "high"
            } else {
                "mid"
            }
        });

        MidiClassification {
            musical_role: Some(musical_role.to_string()),
            polyphony: Some(polyphony.to_string()),
            density: Some(density.to_string()),
            register: register.map(str::to_string),
            suggested_instrument: self.suggested_instrument(),
        }
    }

    fn observe_note_on(&mut self, channel: u8, key: u8) {
        let channel_index = usize::from(channel);
        self.active_notes[channel_index] = self.active_notes[channel_index].saturating_add(1);
        self.max_active_notes = self.max_active_notes.max(self.active_notes[channel_index]);

        if channel == PERCUSSION_CHANNEL {
            self.percussion_note_count += 1;
            return;
        }

        self.pitched_note_count += 1;
        self.pitch_sum += u64::from(key);
        self.min_pitch = Some(self.min_pitch.map_or(key, |current| current.min(key)));
        self.max_pitch = Some(self.max_pitch.map_or(key, |current| current.max(key)));
        if let Some(program) = self.current_programs[channel_index] {
            self.program_note_counts[usize::from(program / 8)] += 1;
        }
    }

    fn suggested_instrument(&self) -> Option<String> {
        if self.percussion_note_count > self.pitched_note_count {
            return Some("drums".to_string());
        }
        self.program_note_counts
            .iter()
            .enumerate()
            .max_by_key(|(_, count)| *count)
            .filter(|(_, count)| **count > 0)
            .map(|(index, _)| GM_FAMILIES[index].to_string())
    }
}
