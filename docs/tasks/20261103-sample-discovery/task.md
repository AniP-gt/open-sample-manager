# Sample discovery workspace

Branch: `feat/sample-discovery`. Base: `d73f6d3`.

Implement the six approved features together: usage ranking, project shelves,
saved rule collections, rediscovery, level-matched A/B playback, and similar
sample lookup. Existing library, MIDI, and provider behavior stays available.

Usage is recorded on actual playback and completed external drops, never on
selection. A five-second per-sample/per-kind cooldown suppresses repeated starts.
Adoption counts current adopted project memberships, not button presses.
The history starts with this version; absence of history means unplayed since
tracking began, not never used in another application.

Persistence: SQLite events, collection member annotations, saved rule JSON.
Project shelves reuse ordinary collections. Candidate/adopted status and notes
are saved per membership. Rule results query the entire database, not the
currently loaded page. Similarity is metadata distance, not semantic audio AI.

Acceptance: real SQL roundtrips, restart-safe records, time/type filters,
collection notes/status and removal, saved rules including favorites, unplayed
and old favorites, paired playback with gain normalization and clipping ceiling,
similar lookup excluding the source, accessible dense UI, existing tests/build.

QA evidence and limitations are recorded in `docs/reviews/20261103-sample-discovery/`.
