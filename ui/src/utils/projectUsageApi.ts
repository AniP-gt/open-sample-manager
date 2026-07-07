import { invoke } from "@tauri-apps/api/core";
import type { ProjectRow, ProjectSampleEventRow, ProjectSampleExportVariant } from "../types/projectUsage";

export function listProjects() {
  return invoke<ProjectRow[]>("list_projects");
}

export function getDefaultProject() {
  return invoke<ProjectRow>("get_default_project");
}

export function createProject(name: string) {
  return invoke<ProjectRow>("create_project", { name });
}

export function recordProjectSampleSelection(projectId: string, sampleId: number) {
  return invoke<number>("record_project_sample_selection", { projectId, sampleId });
}

export function recordProjectSampleExport(
  projectId: string,
  sampleId: number,
  variant: ProjectSampleExportVariant,
) {
  return invoke<number>("record_project_sample_export", { projectId, sampleId, variant });
}

export function addProjectCollectionSample(projectId: string, sampleId: number) {
  return invoke<number>("add_project_collection_sample", { projectId, sampleId });
}

export function removeProjectCollectionSample(projectId: string, sampleId: number) {
  return invoke<number>("remove_project_collection_sample", { projectId, sampleId });
}

export function listProjectCollectionSampleIds(projectId: string) {
  return invoke<number[]>("list_project_collection_sample_ids", { projectId });
}

export function listProjectUsageEvents(projectId: string) {
  return invoke<ProjectSampleEventRow[]>("list_project_usage_events", { projectId });
}

export function listProjectUsedSampleIds(projectId: string) {
  return invoke<number[]>("list_project_used_sample_ids", { projectId });
}

export function listOtherProjectUsedSampleIds(projectId: string) {
  return invoke<number[]>("list_other_project_used_sample_ids", { projectId });
}
