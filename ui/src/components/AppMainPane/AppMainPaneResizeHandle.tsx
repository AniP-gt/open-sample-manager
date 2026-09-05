type AppMainPaneResizeHandleProps = {
  readonly isResizing: boolean;
  readonly onMouseDown: () => void;
};

export function AppMainPaneResizeHandle({ isResizing, onMouseDown }: AppMainPaneResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{ width: "4px", background: isResizing ? "#f97316" : "#1f2937", cursor: "col-resize", transition: "background 0.2s", flexShrink: 0 }}
      onMouseEnter={(event) => {
        if (!isResizing) event.currentTarget.style.background = "#374151";
      }}
      onMouseLeave={(event) => {
        if (!isResizing) event.currentTarget.style.background = "#1f2937";
      }}
    />
  );
}
