export type ProjectSampleEventType = "selected" | "exported";
export type ProjectSampleExportVariant = "raw" | "processed";

export interface ProjectRow {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectSampleEventRow {
  id: number;
  project_id: string;
  sample_id: number;
  event_type: ProjectSampleEventType;
  variant: ProjectSampleExportVariant | null;
  metadata_json: string | null;
  created_at: string;
}
