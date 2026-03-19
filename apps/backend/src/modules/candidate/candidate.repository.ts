import Candidate from "./candidate.model";

export const findCandidates = async (query: any, sort: any) => {
  return Candidate.find(query).sort(sort);
};

export const bulkInsert = async (data: any[]) => {
  return Candidate.insertMany(data);
};