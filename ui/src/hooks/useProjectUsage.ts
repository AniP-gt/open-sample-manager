import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectRow, ProjectSampleExportVariant } from "../types/projectUsage";
import {
  addProjectCollectionSample,
  createProject,
  getDefaultProject,
  listProjectCollectionSampleIds,
  listOtherProjectUsedSampleIds,
  listProjectUsedSampleIds,
  listProjects,
  recordProjectSampleExport,
  recordProjectSampleSelection,
  removeProjectCollectionSample,
} from "../utils/projectUsageApi";
import { getErrorMessage } from "../utils/sampleMapper";

interface UseProjectUsageParams {
  setError: (message: string | null) => void;
}

export function useProjectUsage({ setError }: UseProjectUsageParams) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null);
  const [usedSampleIds, setUsedSampleIds] = useState<number[]>([]);
  const [otherProjectUsedSampleIds, setOtherProjectUsedSampleIds] = useState<number[]>([]);
  const [collectionSampleIds, setCollectionSampleIds] = useState<number[]>([]);
  const [avoidReuse, setAvoidReuse] = useState(false);

  const refreshProjectSampleIds = useCallback(async (projectId: string) => {
    const [usedIds, otherProjectUsedIds, collectionIds] = await Promise.all([
      listProjectUsedSampleIds(projectId),
      listOtherProjectUsedSampleIds(projectId),
      listProjectCollectionSampleIds(projectId),
    ]);
    setUsedSampleIds(usedIds);
    setOtherProjectUsedSampleIds(otherProjectUsedIds);
    setCollectionSampleIds(collectionIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [loadedProjects, defaultProject] = await Promise.all([listProjects(), getDefaultProject()]);
        if (cancelled) return;
        setProjects(loadedProjects);
        setActiveProject(defaultProject);
        await refreshProjectSampleIds(defaultProject.id);
      } catch (error) {
        if (!cancelled) setError(getErrorMessage(error));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshProjectSampleIds, setError]);

  const usedSampleIdSet = useMemo(() => new Set(usedSampleIds), [usedSampleIds]);
  const otherProjectUsedSampleIdSet = useMemo(() => new Set(otherProjectUsedSampleIds), [otherProjectUsedSampleIds]);
  const collectionSampleIdSet = useMemo(() => new Set(collectionSampleIds), [collectionSampleIds]);

  const selectProject = useCallback(async (projectId: string) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    setActiveProject(project);
    try {
      await refreshProjectSampleIds(project.id);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [projects, refreshProjectSampleIds, setError]);

  const createAndSelectProject = useCallback(async (name: string) => {
    try {
      const project = await createProject(name);
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      setActiveProject(project);
      await refreshProjectSampleIds(project.id);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [refreshProjectSampleIds, setError]);

  const recordSelection = useCallback(async (sampleId: number) => {
    if (!activeProject) return;
    try {
      await recordProjectSampleSelection(activeProject.id, sampleId);
      await refreshProjectSampleIds(activeProject.id);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [activeProject, refreshProjectSampleIds, setError]);

  const recordExport = useCallback(async (sampleId: number, variant: ProjectSampleExportVariant) => {
    if (!activeProject) return;
    try {
      await recordProjectSampleExport(activeProject.id, sampleId, variant);
      await refreshProjectSampleIds(activeProject.id);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [activeProject, refreshProjectSampleIds, setError]);

  const toggleCollectionSample = useCallback(async (sampleId: number) => {
    if (!activeProject) return;
    try {
      if (collectionSampleIdSet.has(sampleId)) {
        await removeProjectCollectionSample(activeProject.id, sampleId);
      } else {
        await addProjectCollectionSample(activeProject.id, sampleId);
      }
      await refreshProjectSampleIds(activeProject.id);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [activeProject, collectionSampleIdSet, refreshProjectSampleIds, setError]);

  return {
    projects,
    activeProject,
    usedSampleIds,
    usedSampleIdSet,
    otherProjectUsedSampleIds,
    otherProjectUsedSampleIdSet,
    collectionSampleIds,
    collectionSampleIdSet,
    avoidReuse,
    setAvoidReuse,
    selectProject,
    createAndSelectProject,
    recordSelection,
    recordExport,
    toggleCollectionSample,
    refreshProjectSampleIds,
  };
}
