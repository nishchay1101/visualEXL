import express from "express";
import Candidate from "./candidate.model";

const router = express.Router();

router.get("/", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const { search } = req.query;

  if (!sessionId) return res.json([]);

  let query: any = { sessionId };

  if (search) {
    query.$and = [
      { sessionId },
      {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { skills: { $regex: search, $options: "i" } }
        ]
      }
    ];
  }

  const data = await Candidate.find(query).sort({ score: -1 });
  res.json(data);
});

export default router;