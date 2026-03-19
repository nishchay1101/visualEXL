import { Request, Response } from "express";
import { getCandidates } from "./candidate.service";

export const fetchCandidates = async (req: Request, res: Response) => {
  const data = await getCandidates(req.query);
  res.json(data);
};