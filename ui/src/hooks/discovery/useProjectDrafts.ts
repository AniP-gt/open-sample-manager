import { useState } from "react";
import type { DiscoverySample, ProjectDraft } from "../../types/discovery";

export function useProjectDrafts(collectionId: number | null) {
  const [drafts, setDrafts] = useState<Readonly<Record<string, ProjectDraft>>>({});
  const keyFor = (entry: DiscoverySample) => `${collectionId}:${entry.sample.id}:${entry.path}`;
  return {
    getDraft: (entry: DiscoverySample): ProjectDraft => drafts[keyFor(entry)] ?? { status: entry.status, note: entry.note },
    updateDraft: (entry: DiscoverySample, draft: ProjectDraft) => {
      const key = keyFor(entry);
      setDrafts((current) => ({ ...current, [key]: draft }));
    },
    clearDraft: (entry: DiscoverySample) => {
      const key = keyFor(entry);
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== key)));
    },
  };
}
