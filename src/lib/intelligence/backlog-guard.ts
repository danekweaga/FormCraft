import { SAMPLE_GUARDS } from "./sample-guards";

/**
 * When unfinished ideas AND drafts are both high, do not recommend
 * more idea generation unless the user explicitly asks.
 */
export function shouldBlockIdeaGeneration(input: {
  unfinishedIdeas: number;
  unfinishedDrafts: number;
  ideasThreshold?: number;
  draftsThreshold?: number;
}): boolean {
  const ideas =
    input.ideasThreshold ?? SAMPLE_GUARDS.backlogIdeasThreshold;
  const drafts =
    input.draftsThreshold ?? SAMPLE_GUARDS.backlogDraftsThreshold;
  return input.unfinishedIdeas >= ideas && input.unfinishedDrafts >= drafts;
}
