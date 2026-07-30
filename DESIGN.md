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
- Below 900px of list width, secondary KEY, LIC, and QC columns are hidden so
  filename, classification, tempo, duration, and row actions remain visible.
- Opening the detail panel must not reduce the filename column below its
  readable minimum.
- Column headers and virtualized rows share one width and spacing contract.

## Accessibility

- Horizontal overflow remains keyboard and trackpad accessible through the
  sample-list scroll region.
- Truncated filenames retain their full value through the existing title and
  selection behavior.
