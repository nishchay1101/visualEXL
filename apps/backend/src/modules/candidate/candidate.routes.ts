import express from "express";
import Candidate from "./candidate.model";

const router = express.Router();

router.get("/", async (req, res) => {
  const { search } = req.query;

  let query: any = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { skills: { $regex: search, $options: "i" } }
    ];
  }

  const data = await Candidate.find(query).sort({ score: -1 });
  res.json(data);
});

export default router;