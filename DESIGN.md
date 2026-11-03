# Open Sample Manager UI Design

## Direction

Preserve the dense, dark desktop-library interface. Layout changes should
improve information legibility without reducing the number of samples visible.

## Layout

- The 1200 × 800 initial Tauri window is the primary design target.
- The left library sidebar and right detail panel remain fixed shell regions.
- The sample list owns both vertical and horizontal scrolling.
- Sample columns keep readable minimum widths. Narrow list panes scroll rather
  than collapsing the filename or allowing adjacent badges to overlap.
- The filename column keeps at least 200px and absorbs additional available
  width.

## Responsive Behavior

- Search and filter controls wrap when the sample-list pane is constrained.
- Constrained list panes keep every enabled column and expose the remaining
  information through horizontal scrolling, matching the MIDI list.
- Opening the detail panel must not reduce the filename column below its
  readable minimum.
- Column headers and virtualized rows share one width and spacing contract.

## Accessibility

- Horizontal overflow remains keyboard and trackpad accessible through the
  sample-list scroll region.
- Truncated filenames retain their full value through the existing title and
  selection behavior.

## Discovery workspace

Layout: scroll-body-shell + cluster. The application header and discovery
navigation stay above one vertically scrolling content region. Forms wrap;
sample rows become stacked rows on constrained widths. The existing library
remains reachable through a single return button.

Primary action: audition a sample. Information priority: sample names and
ranking, active filter/rule/project, per-sample secondary actions.
Required content: ranking metric/period/instrument, project name/status/note,
rule name/type/BPM/favorite conditions, rediscovery mode, similarity source,
comparison slots and normalization status, loading/empty/error feedback.

Discovery tokens extracted from the existing shell: background #080a0f,
surface #111827, rule #374151, foreground #e2e8f0, muted #aebacc,
accent #67e8f9, error #fca5a5; spacing 4/8/12/16/24px; body 14px,
small 12px, heading 20px; control height 32px, narrow-screen 44px.
Reusable primitives: wrapping toolbar, labeled field, neutral button (default,
hover, focus, disabled), tonal active navigation, sample row, inline status.
Only the existing dark theme is shipped. No animation or decorative metrics.

Ideal journey: return to a familiar sound through a ranking, audition it, and
add it to a project with a visible save result. Empty history explains when
tracking started. Errors keep editable input and provide retry.

## Library usability refinement

- Primary action: submit a sample search; scanning is the next action for an empty library.
- Information priorities: search query, applied filters, matching sample rows.
- Layout: fixed-sidenav-shell with a two-row search/filter toolbar, a scrolling
  results region and the existing optional detail panel. Settings use category
  navigation beside one independently scrolling content panel.
- Preserve all filters, metadata columns, random history, pagination, drag-out,
  keyboard selection, and the list/grid switch. Keep the logo's monospace type;
  use the system sans-serif stack for controls and library content.
- UI tokens: canvas #080a0f, surface #0f1117, raised #18202d, border #64748b,
  text #e2e8f0, secondary #b8c2d1, disabled #788496, accent #fb923c,
  focus #22d3ee. Controls use a 32px minimum height and 13px text.
- Search fills the available first-row space. Filters wrap on their own row;
  advanced license/quality filters retain their existing visibility setting.
- KEY filtering lives in the result toolbar only. Active conditions can be
  removed individually or cleared together, including sidebar conditions.
- Empty results distinguish loading, failed retrieval, an empty library, an
  empty collection, and a search/filter with no matches. Existing pagination
  behavior is preserved when a loaded page has no locally matching samples.
- Settings categories: Playback, Display (including navigation), Downloads,
  Database and About. Hidden categories are unmounted so keyboard focus remains
  within the visible controls. Escape closes and restores the opener's focus.
- No theme switch, new dependencies, or changes to audio/IPC contracts are needed.

## Verification ledger

| Gap | Acceptance check |
| --- | --- |
| Low-contrast labels | Normal text at least 4.5:1 and control edges at least 3:1 on their surfaces |
| Crowded toolbar | Search and filters occupy separate rows at 1200px and 800px |
| Duplicate KEY controls | One sample KEY filter; removing its condition updates the same filter state |
| Ambiguous empty view | Loading, failed, empty-library, empty-collection and no-match scenarios have distinct guidance |
| Long settings modal | Each category is directly reachable; existing handlers, focus trap and Escape still work |
