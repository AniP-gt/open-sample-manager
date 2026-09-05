import { vi } from "vitest";

type Callback = (...args: unknown[]) => unknown;

function getCallback(props: Record<string, unknown>, name: string): Callback {
  return props[name] as Callback;
}

vi.mock("../..", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    FilterSidebar: (props: Record<string, unknown>) =>
      React.createElement("div", { "data-testid": "filter-sidebar" }, [
        React.createElement("button", { key: "file", onClick: () => getCallback(props, "onPathSelect")("/library/kick.wav") }, "filter file"),
        React.createElement("button", { key: "dir", onClick: () => getCallback(props, "onPathSelect")("/library/drums") }, "filter dir"),
        React.createElement("button", { key: "sample", onClick: () => getCallback(props, "onSampleSelect")({ id: 1 }) }, "sidebar sample"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.wav"]) }, "sidebar import"),
        React.createElement("button", { key: "clear", onClick: () => getCallback(props, "onClearDirectoryPath")() }, "sidebar clear"),
      ]),
    SampleList: React.forwardRef((_props: Record<string, unknown>, _ref) => {
      const props = _props;
      return React.createElement("div", { "data-testid": "sample-list" }, [
        React.createElement("button", { key: "select", onClick: () => getCallback(props, "onSampleSelect")({ id: 1 }) }, "sample select"),
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onFilterChange")({ search: "kick" }) }, "sample filter"),
        React.createElement("button", { key: "sort", onClick: () => getCallback(props, "onSortChange")({ field: "bpm", direction: "desc" }) }, "sample sort"),
        React.createElement("button", { key: "delete", onClick: () => getCallback(props, "onDeleteSample")(1) }, "sample delete"),
        React.createElement("button", { key: "trash", onClick: () => getCallback(props, "onTrashSample")(1) }, "sample trash"),
        React.createElement("button", { key: "type", onClick: () => getCallback(props, "onTypeClick")({ id: 1 }) }, "sample type"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.wav"]) }, "sample import"),
        React.createElement("button", { key: "more", onClick: () => getCallback(props, "onLoadMore")() }, "sample more"),
        React.createElement("button", { key: "prev", onClick: () => getCallback(props, "onLoadPrevious")() }, "sample prev"),
        React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlayback")() }, "sample play"),
      ]);
    }),
    MidiList: React.forwardRef((_props: Record<string, unknown>, _ref) => {
      const props = _props;
      return React.createElement("div", { "data-testid": "midi-list" }, [
        React.createElement("button", { key: "select", onClick: () => getCallback(props, "onMidiSelect")({ id: 2 }) }, "midi select"),
        React.createElement("button", { key: "tag", onClick: () => getCallback(props, "onTagBadgeClick")({ id: 2 }) }, "midi tag"),
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onTagFilterChange")(3) }, "midi filter"),
        React.createElement("button", { key: "trash", onClick: () => getCallback(props, "onTrashMidi")(2) }, "midi trash"),
        React.createElement("button", { key: "more", onClick: () => getCallback(props, "onLoadMore")() }, "midi more"),
        React.createElement("button", { key: "prev", onClick: () => getCallback(props, "onLoadPrevious")() }, "midi prev"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.mid"]) }, "midi import"),
        React.createElement("button", { key: "search", onClick: () => getCallback(props, "onMidiSearchChange")("piano") }, "midi search"),
        React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlayback")() }, "midi play"),
      ]);
    }),
    DetailPanel: (props: Record<string, unknown>) => React.createElement("div", { "data-testid": "detail-panel" }, [
      React.createElement("button", { key: "select", onClick: () => getCallback(props, "onSelect")({ id: 1 }) }, "detail select"),
      React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onFilterChange")({ filterKey: "C" }) }, "detail filter"),
      React.createElement("button", { key: "error", onClick: () => getCallback(props, "onError")("detail failed") }, "detail error"),
      typeof props.onClose === "function" ? React.createElement("button", { key: "close", onClick: () => getCallback(props, "onClose")() }, "detail close") : null,
    ]),
    MidiDetailPanel: (props: Record<string, unknown>) => React.createElement("div", { "data-testid": "midi-detail-panel" }, [
      React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onTagFilterChange")(4) }, "midi detail filter"),
      React.createElement("button", { key: "manage", onClick: () => getCallback(props, "onManageTags")() }, "midi detail manage"),
      React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlay")() }, "midi detail play"),
      typeof props.onClose === "function" ? React.createElement("button", { key: "close", onClick: () => getCallback(props, "onClose")() }, "midi detail close") : null,
    ]),
  };
});
