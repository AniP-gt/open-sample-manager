export interface ScanProgress {
  stage: "discovering" | "analyzing" | "complete";
  current: number;
  total: number;
  currentFile: string;
}
