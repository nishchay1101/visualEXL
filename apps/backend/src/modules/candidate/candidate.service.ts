import { findCandidates } from "./candidate.repository";

export const getCandidates = async (filters: any) => {
  const query: any = {};

  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  if (filters.minScore) {
    query.score = { $gte: Number(filters.minScore) };
  }

  return findCandidates(query, { score: -1 });
};