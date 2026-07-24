---
slug: mcp-audio-auto-tagging
status: approved
intent: clear
review_required: false
plan_path: docs/tasks/20260723-mcp-audio-auto-tagging/task.md
plan_sha256: a1d00af623a0e7e1e36a6fbf62cb1d8dc83a40bd433766e90cc4c7f90efaae37
review_round_id: 71C91452-10FA-4215-9243-8DEC7808E03D
round_status: approved
pending-action: execute docs/tasks/20260723-mcp-audio-auto-tagging/task.md in a new implementation turn
review:
  momus:
    status: approved
    workspace_root: /Users/tk/workspace/github.com/AniP-gt/open-sample-manager
    runtime_home: null
    target: docs/tasks/20260723-mcp-audio-auto-tagging/task.md
    round_id: 71C91452-10FA-4215-9243-8DEC7808E03D
    plan_sha256: a1d00af623a0e7e1e36a6fbf62cb1d8dc83a40bd433766e90cc4c7f90efaae37
    launch_id: ses_06d926e06ffeNgqFAL4xah9WBL
    session: ses_06d926e06ffeNgqFAL4xah9WBL
    result: "OKAY"
  independent:
    status: approved
    workspace_root: /Users/tk/workspace/github.com/AniP-gt/open-sample-manager
    runtime_home: null
    target: docs/tasks/20260723-mcp-audio-auto-tagging/task.md
    round_id: 71C91452-10FA-4215-9243-8DEC7808E03D
    plan_sha256: a1d00af623a0e7e1e36a6fbf62cb1d8dc83a40bd433766e90cc4c7f90efaae37
    launch_id: ses_06d973bbeffezJIKMCcJ6uLa7O
    session: ses_06d973bbeffezJIKMCcJ6uLa7O
    result: "OKAY"
approach: Extend the existing Node stdio MCP -> authenticated localhost API -> Rust core path with a confidence-calibrated hybrid classifier, explicit abstention, provenance-aware persistence, and dataset-backed evaluation.
---

# Draft: mcp-audio-auto-tagging

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
C1 | Hybrid classification engine combines filename priors, DSP features, and local model scores into calibrated playback/instrument candidates with abstention | active | core/src/manager/analyze.rs; core/src/analysis/
C2 | Classification persistence records canonical labels, confidence, provenance, model version, and manual-override ownership without destructive overwrite | active | core/src/db/schema.rs; core/src/manager/samples.rs
C3 | Existing local API and stdio MCP expose preview/apply classification operations through current authenticated boundaries | active | src-tauri/src/http_api/; mcp-server/src/
C4 | Evaluation harness measures loop/one-shot and instrument accuracy, calibration, rejection quality, and runtime on public plus project fixtures | active | core/tests/integration_test.rs; core/tests/fixtures/
C5 | Local model assets and runtime are packaged reproducibly for macOS, Windows, and Linux without cloud upload | active | core/Cargo.toml; src-tauri/Cargo.toml; mcp-server/package.json
C6 | Instrument taxonomy reconciliation creates a missing canonical Tom type idempotently during apply and never during preview | active | core/src/db/operations/instrument_types.rs; core/src/manager/instrument_types.rs

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
MCP topology | Extend the existing stdio MCP server and localhost API rather than create a second MCP server | The repository already has lifecycle, authentication, contracts, and tests for this path | yes
Tag representation | Treat loop/one-shot as playback_type and Kick/Bass/etc as instrument_type; generic tags remain orthogonal | Matches current schema, search DSL, and manual classification UI | yes, but migration-sensitive
Tom normalization | Use canonical lowercase `tom` as one family label; retain high/mid/low evidence only in classification metadata | Existing seeded instrument names are lowercase and the current UI/search contract expects one instrument value | yes
Input scope | Classify library sample IDs, not arbitrary filesystem paths | Reuses indexed metadata and avoids broadening file access through MCP | yes
Fusion | Filename tokens are weak priors; audio evidence can override them; conflicts lower confidence | Filenames are noisy and must not become ground truth | yes
Uncertainty | Return top candidates and abstain below calibrated thresholds | Accuracy requires controlling false automatic writes, not forcing a label | yes
Remote behavior | No cloud inference or Streamable HTTP endpoint | Project is local-first and already uses stdio plus loopback HTTP internally | yes

## Findings (cited - path:lines)
- Production analysis is assembled in `core/src/manager/analyze.rs:4-17`; it uses BPM, kick, loop, key, quality, and filename inference rather than the dormant classifier module.
- Current instrument filename inference maps to seeded values including kick, snare, hihat, bass, synth, fx, vocal, percussion, and other (`core/src/manager/analyze.rs:15-17`).
- Current loop/one-shot and kick behavior is covered at signal level, but not with calibrated confidence or abstention (`core/tests/integration_test.rs:1-72`).
- Canonical editable fields are `playback_type` and `instrument_type`; manual updates preserve omitted values (`core/src/manager/samples.rs:220-238`).
- Persistence currently inserts playback/instrument labels and DSP features but has no verified classification provenance/model-version contract (`core/src/db/operations/samples.rs:21-24`; `core/src/db/schema.rs`).
- The MCP server currently exposes six typed tools through a single `Operation` contract (`mcp-server/src/server.ts:32-52`).
- The local API is fixed to `127.0.0.1:37421`, applies request-size and security middleware, and must remain the MCP-to-core boundary (`src-tauri/src/http_api/router.rs:24-37`; `src-tauri/src/http_api/router/security.rs`).
- Existing classification persistence tests prove manual label replacement, not preservation of explicit manual ownership against later rescans (`core/tests/update_classification_by_id.rs:56-90`).
- HTMOneShotLoopClassification supplies 5,561 loop/one-shot samples with eight stem labels and fixed splits, but is genre-biased toward house/tech-house/minimal techno.
- Freesound Loop Dataset adds 9,455 real loops and metadata but cannot evaluate one-shot recall by itself.
- Generic AudioSet models such as YAMNet/PANNs provide useful coarse audio priors but do not directly solve this project's exact taxonomy; a domain head and calibration set are required.
- `instrument_types.name` is unique but not case-normalized; Tom is not currently seeded (`core/src/db/schema.rs:88-92,351-366`).
- The normal custom-type insert is a plain `INSERT`, and duplicate insertion is expected to fail (`core/src/db/operations/instrument_types.rs:5-8`; `core/src/db/operations/instrument_types/tests.rs:42-49`).
- Neither MCP nor the local API currently has a classify operation (`mcp-server/src/contracts.ts:36-43`; `src-tauri/src/http_api/requests.rs:12-18`).
- StemGMD provides kick and high/mid/low tom-family stems under CC BY 4.0; STAR Drums provides richer mixed-context drum classes but requires per-asset license handling.

## Decisions (with rationale)
- Preserve the existing three-layer boundary: MCP TypeScript contracts -> authenticated local API -> Rust `SampleManager`.
- Centralize authoritative classification in Rust so scan/import, rescan, local API, and MCP cannot diverge.
- Use a two-head result: playback (`loop`, `oneshot`) and instrument candidate set (`kick`, `bass`, etc.), each with independent confidence and abstention.
- Keep filename evidence explainable and low-weight; use duration, periodicity, onset density, attack/decay, low-band ratio, harmonic continuity, and model logits as audio evidence.
- Evaluate by macro-F1, balanced accuracy, confusion matrices, expected calibration error, abstention coverage/risk, manual override rate, p95 latency, and peak memory.
- Expose separate MCP preview/apply behavior; apply only calibrated high-confidence results and never overwrite manual ownership.
- Bundle a versioned project-specific two-head ONNX model and run inference locally from Rust; do not add a Python sidecar.
- Use TDD for schema, override ownership, classifier contracts, local API contracts, and MCP contracts; run model-quality benchmarking separately.
- Include Tom as an explicit instrument class and treat Kick-vs-Tom as a dedicated confusion-risk slice rather than relying on low-frequency energy alone.
- Use filename evidence as a corroborating prior for Kick/Tom, while audio evidence includes pitch trajectory, attack/decay, low-to-mid band distribution, and harmonic/modal structure; conflicting evidence must lower confidence or abstain.
- In `apply` mode only, ensure the selected canonical instrument type exists before assignment; creation must be normalized, idempotent, and transaction-safe. `preview` must report `would_create_instrument_type` without mutating the database.
- Keep the model architecture as two semantic heads: playback (`loop|oneshot`) and multi-class instrument (`kick|tom|bass|...`). Kick-vs-Tom receives dedicated loss weighting, calibration thresholds, and evaluation slices rather than a third production head.
- Collapse training labels `tom_high|tom_mid|tom_low` to canonical `tom` for assignment; preserve subtype logits/evidence only for diagnostics and future expansion.
- Restrict automatic taxonomy creation to the classifier's closed, normalized allowlist. MCP input cannot supply an arbitrary instrument name for creation.
- Implement taxonomy reconciliation inside the same SQLite transaction as auto-classification apply: normalize to lowercase, `INSERT OR IGNORE`, select the row, verify manual ownership again, then update classification metadata and canonical sample fields.
- Gate accepted Kick/Tom writes by selective risk: target less than 2% Kick<->Tom confusion among automatically applied results, allowing abstention to increase when needed.
- Review round 1 fixes: replaced non-audio HTM training use with audio-bearing qualified sources; froze tensor/preprocessing/features/metric denominators/support counts; added atomic versioned migration, FNV/SHA handling, all writer ownership rules, NOCASE taxonomy merge, Tauri-to-core runtime injection, read-only preview connection, bounded concurrency/deadlines, 16-ID/64-KiB response limits, 200-LOC modules, immutable base SHA, and literal QA/final-verifier commands.
- Review round 2 fixes: froze resampler/STFT/mel/window/24-feature formulas and metric edge cases; fixed licenses, ambiguous labels, loss masks, segments, and source groups; covered AnalysisPool and sample_type synchronization; added request-scoped cancellation plus retained-file-descriptor stale checks; unified duplicate/safe-integer validation; emitted prediction/e2e commands; scoped LOC checks to new files and legacy deltas; and fixed immutable ORT init/hash wiring plus all remaining QA invocations.
- Review round 3 fixes: unified ECE at 20 bins; grouped StemGMD by kit and STAR by track with explicit masks/mappings; added pre/post metadata plus second descriptor SHA for in-place mutation; made exactly-once ORT initialization lazy and nonfatal; and froze DSP frame alignment, aggregation, zero-vector, gap, percentile, timestamp, and tie rules with independent golden vectors.
- Review round 4 fixes: removed preprocessing/training dependency cycle by separating qualification/reference vectors from Rust parity and model export; delayed production trust hashes until deterministic artifacts exist; fixed the weighted ECE equation; added leakage and missing-key fixtures for every source; froze resampler chunk/delay/tail/length, YIN selection/interpolation, exact mel construction, band boundaries, silence behavior, and normalized flux; removed draft authority.
- Review round 5 fixes: unified seal-before-tune and one-time sealed-test evaluation sequence; added source-controlled pre-use hashes for model, manifest/scalers, policy, and target runtime library; fixed decay threshold, harmonic denominator/bin/overlap/Nyquist, full-file duration/onset semantics, and final_probability ECE stage; made Blocks consistently direct-and-transitive.
- Review round 6 fixes: used rubato 4 process_all with deterministic tail drain and edge-case tests; defined TP/FP/FN, coverage, support, Wilson, and replacement-seal rules; pinned Cargo dependency versions/features and feature-tree guard; froze exhaustive head/axis/item statuses, precedence, and Serde/Zod mappings.
- Review round 8 fixes: added not_evaluated/not_attempted response records and operational shapes; required explicit preprocessing bin target/build/SHA; propagated cancellation/deadline into preview with boundary tests; fixed literal CC0/CC-BY/project-owned training, cache, fixture, attribution, and derived-model redistribution rules.
- Review round 9 fixes: synchronized Todo 7 with canonical exhaustive enums; added literal qualification, permitted-audio acquisition, checksum, split-seal, and license verification commands; defined grant proof and CC-BY notice fields and final machine-verification flags.
- Review round 10 fixes: distinguished cancellation before transaction from committed current-item status after cancellation during transaction; expanded ECE/Wilson formulas and edge bins inline; replaced prose golden-vector step with exact input/output/expected-SHA command.
- Review round 11 fixes: split pre-BEGIN and in-transaction cancellation QA/statuses; defined head/overall/Kick-Tom coverage and micro-precision numerators/denominators; enumerated literal success/fault/final package commands for all four targets.
- Review round 13 fixes: moved overpermissive-policy negative evaluation to synthetic fixtures that cannot read sealed production assets; fully expanded ECE population, final_probability stage, bin ownership, empty-bin behavior, equation, tie rule, and hand-calculated boundary tests.
- Review round 14 fixes: added atomic consume-once seal ledger/receipt/crash-burn/rerun rejection; strict probability-vector and manifest-bijection validation; exact temperature-log-prior fusion and shared Rust/Python fixtures; unified support counts; added portable same-file-based Unix/Windows FileIdentity and mutation tests.
- Review round 15 fixes: made mean-logit temperature/log-prior fusion use one f64 softmax; removed caller-selected consumption stores; derived consume-once state from the immutable seal; added same-file/fs4 locking from final hash through commit.
- Review round 16 fixes: replaced the undefined signed-seal claim with a fixed hash-sealed descriptor contract; defined the precommit filesystem/SQLite linearization gate and advisory-lock scope; added literal native Unix/Windows lock-race commands and made packaging depend on apply safety. Momus and Oracle both returned unconditional OKAY for SHA `099151b661c8c084891d59fc796b5c26a4642926b6dee69d38ed4bf428e16e18`.
- Review round 17 fixes: made Todo 1 preserve the committed plan while proving the product tree still matches base `39bddb0`; removed stale approval waits; root-qualified pytest paths; corrected every transitive Blocks declaration; expanded Todo 13 into literal release commands and automated final gates. Momus and Oracle both returned unconditional OKAY for SHA `36bd48e8e28e9ab8e2acacad364c90da5f4dac06c34e0fe435b299a5d8d9f859`.
- Review round 18 fixes: moved the implementation task and integrated approval record into the repository's `docs/tasks` and `docs/reviews` workflow; moved execution evidence under `docs/issues`; made all Todo `References:` fields machine-detectable; fully specified 64,000-sample windowing and 400-frame STFT/Hann/DFT/HTK-mel/log preprocessing. Momus and Oracle both returned unconditional OKAY for SHA `e3c4bd1f0388a4ea34abfffdba9c5c7b09637bea363698813e406dcce46ab9c1`.
- Review round 19 fixes: replaced obsolete rubato `SincFixedIn` with compile-verified rubato 4.0.0 `Async::new_sinc`/`FixedAsync::Input`; evaluated active PR #16/#18 conflicts; fixed merge order so auto-tagging lands first; added disposable upstream DB fixtures, lossless upgrade tests, overlap reporting, and explicit downstream-rebase ownership. Momus and Oracle both returned unconditional OKAY for SHA `bba62d4550824ca756821b59b81150859be481f3d3c847ee5faa1ebddfa13222`.
- Review round 20 fixes: made Todo 1 executable from either the reviewed task branch or merged main using origin/main ancestry plus exact docs-only exclusions; fixed downstream order to auto-tag, #16, then #18; corrected rubato `process_all()` from ceil output to explicit round-length truncation with a 44.1 kHz/1023-frame boundary test. Momus and Oracle both returned unconditional OKAY for SHA `e6154c5ffe7d16c1f0e309cf1adcc85da6fb9dfcd6b4d1c8dea4e9b21be7f901`.
- Review round 21 fixes: made the origin/main fetch update its explicit remote-tracking ref and fail closed; replaced execution of open-PR code with full-OID/SHA-bound static SQL fixtures built by trusted current-branch tests; fixed ort rc.12 Result handling; made Todo 1 and Todo 10 QA outcomes machine-executable. Momus and Oracle both returned unconditional OKAY for SHA `a597a52c49f02b9e0dfaf82da97fdd0693db78d7022e4632d1fa7db9af50c27f`.
- Review round 22 fixes: installed MCP dependencies before its baseline; bound fetched PR refs to current GitHub `headRefOid` values before branch creation; corrected ort rc.12 `commit()` handling to check its boolean and fail closed when ORT is already initialized; added zero-write subprocess coverage for that failure.
- Review round 23 fixes: closed the bootstrap race by re-fetching both PR refs immediately before branch creation and requiring each original recorded OID, current GitHub `headRefOid`, and freshly fetched remote-tracking OID to remain identical.
- Review round 24 fixes: made the existing accidental-PR-head-ancestry rejection executable both initially and immediately before branch creation for PR #16 and PR #18. Momus and Oracle both returned unconditional OKAY for SHA `629d6fa8e5afe0b40ed50f71f4aed09b55c4e1a9ee590352bad9c1995695305f`.
- Review round 25 fixes: added a first-operation immutable handoff gate that receives task and approval SHA-256 values outside the repository, verifies both document byte hashes plus all recorded plan hashes, and rejects drift before network, dependency installation, evidence, or branch creation. Momus and Oracle both returned unconditional OKAY for SHA `a1d00af623a0e7e1e36a6fbf62cb1d8dc83a40bd433766e90cc4c7f90efaae37`.

## Scope IN
- Rust classification domain types, feature extraction, fusion, calibration, and manual-override-safe persistence.
- Migration and model/version provenance needed to reclassify safely.
- Local API request/response/validation/handler additions.
- MCP tool definitions, Zod contracts, dispatch, structured errors, and documentation.
- Public/internal benchmark fixtures, model evaluation reports, and cross-layer contract tests.
- Local model packaging and deterministic versioning if approved.
- Tom taxonomy support, missing-type reconciliation, and a dedicated Kick-vs-Tom benchmark/confusion gate.

## Scope OUT (Must NOT have)
- Cloud inference, audio upload, telemetry, or a remote MCP endpoint.
- Unconditional classification writes when confidence is low or labels were manually overridden.
- UI redesign or unrelated tagging/search refactors.
- Treating filenames as authoritative labels.
- Shipping Essentia under AGPL without a separate licensing decision.

## Open questions
None. User selected threshold-gated preview/apply, bundled ONNX inference, and TDD.

## Approval gate
status: approved
approach: Extend the existing MCP/local API/core pipeline. Rust produces two-head candidate scores from filename priors, DSP features, and a bundled ONNX model; calibrated fusion may abstain. Kick-vs-Tom uses a dedicated evidence path and validation slice. Persistence stores provenance, confidence, model version, and manual ownership. MCP exposes preview and threshold-gated apply semantics; apply idempotently creates a missing canonical Tom instrument type before assignment, while preview remains read-only. TDD locks contracts and override protection; dataset benchmarks gate accuracy and runtime.
next-action: Execute `docs/tasks/20260723-mcp-audio-auto-tagging/task.md` from immutable reviewed SHA `a1d00af623a0e7e1e36a6fbf62cb1d8dc83a40bd433766e90cc4c7f90efaae37` in a new implementation turn; the trusted external handoff must also supply the final approval-document SHA, and Todo 1 must stop before network or installation if either value is absent or mismatched.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
