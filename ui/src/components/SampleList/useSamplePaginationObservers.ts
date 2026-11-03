import { useEffect, type RefObject } from "react";
import type { SampleListProps } from "./types";

type Params = Pick<SampleListProps, "onLoadMore" | "isLoadingMore" | "canLoadMore" | "onLoadPrevious" | "isLoadingPrevious" | "canLoadPrevious"> & {
  readonly listRef: RefObject<HTMLDivElement>;
  readonly sentinelRef: RefObject<HTMLDivElement>;
  readonly topSentinelRef: RefObject<HTMLDivElement>;
  readonly resultCount: number;
};

export function useSamplePaginationObservers({ listRef, sentinelRef, topSentinelRef, resultCount, onLoadMore, isLoadingMore, canLoadMore, onLoadPrevious, isLoadingPrevious, canLoadPrevious }: Params) {
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !onLoadMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (resultCount === 0 || isLoadingMore || canLoadMore === false) return;
            void onLoadMore();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadMore, isLoadingMore, canLoadMore, resultCount]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !onLoadPrevious) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingPrevious || canLoadPrevious === false) return;
            void onLoadPrevious();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadPrevious, isLoadingPrevious, canLoadPrevious]);
}
