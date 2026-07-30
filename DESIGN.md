# Open Sample Manager UI Design

## 1. Direction

Preserve the existing dense, dark desktop-library interface. New controls and
metadata must look native to the current MIDI and sample tables rather than
introducing a separate visual language.

## 2. Tokens

- Canvas: `#0a0c12`
- Raised surface: `#0f1117`
- Selected surface: `#111827`
- Hairline border: `#1f2937`
- Primary text: `#d1d5db`
- Secondary text: `#9ca3af`
- Muted text: `#374151`
- Accent: `#f97316`
- Cyan metadata: `#22d3ee`
- Violet metadata: `#a78bfa`
- Green metadata: `#34d399`
- Amber metadata: `#fbbf24`
- UI type: `'Courier New', monospace`
- Control radius: `4px`; badge radius: `2px`

## 3. Layout

- App surfaces own their scrolling; dense lists scroll horizontally when their
  resizable columns exceed the viewport.
- Table rows remain 48px high.
- Filter controls wrap as a group on narrow panes without changing their height.

## 4. Interaction

- Orange indicates the primary action or selected edge.
- Cyan, violet, green, and amber distinguish metadata without implying actions.
- Keyboard sorting, column resizing, row navigation, and visible focus behavior
  remain available.

## 5. Primitives

- Dense filter control: 26px high dark input/select with a hairline border.
- Metadata cell: compact 14px value, muted em dash when unavailable.
- Classification badge: uppercase 11px text, 2px radius, subtle tinted border.
- Resizable table header: uppercase 13px label with keyboard-operable separator.

## 6. Accessibility

- Every filter has an accessible label.
- Color is never the sole indication of an unavailable value.
- Horizontal overflow is intentional for the desktop data table.

## 7. Responsive Behavior

- Filters wrap below the filename search at constrained widths.
- The table keeps readable minimum column widths and scrolls horizontally.

## 8. Accepted Debt

- Existing components use inline style objects and emoji action icons. New MIDI
  classification work follows nearby patterns and does not broaden this task
  into a visual refactor.
