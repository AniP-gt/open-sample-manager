export const VIEW_MODES = {
  sample: "sample",
  midi: "midi",
  web: "web",
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];
