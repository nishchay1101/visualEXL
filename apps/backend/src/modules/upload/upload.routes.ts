import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Candidate from "../candidate/candidate.model";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const sessionId = req.headers["x-session-id"];
  if (!sessionId) {
    return res.status(401).json({ message: "No session ID provided. Please refresh the page." });
  }

  const workbook = xlsx.readFile(req.file.path);
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('application')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawGrid: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Dynamically find the header row by looking for 'name' AND 'email'
  let headerIndex = 0;
  for (let i = 0; i < Math.min(20, rawGrid.length); i++) {
    const rowText = (rawGrid[i] || []).map(String).join(" ").toLowerCase();
    if (rowText.includes("name") && rowText.includes("email")) {
      headerIndex = i;
      break;
    }
  }

  const originalHeaders: string[] = (rawGrid[headerIndex] || []).map(h => String(h || "").trim());
  const lowerHeaders: string[] = originalHeaders.map(h => h.toLowerCase());

  const rows = rawGrid.slice(headerIndex + 1).filter(r => r && r.some(v => v !== null && v !== undefined && v !== ""));

  const formatted = rows.map((row: any[]) => {
    const getExact = (exact: string) => {
      const idx = lowerHeaders.indexOf(exact.toLowerCase());
      return idx !== -1 ? row[idx] : undefined;
    };
    const getVal = (keywords: string[]) => {
      const idx = lowerHeaders.findIndex(h => h && keywords.some(k => h.includes(k)));
      return idx !== -1 ? row[idx] : undefined;
    };

    const name = getExact("name") || getVal(["name"]) || "Unknown";
    const email = getExact("email") || getVal(["email"]) || "";
    const phone = getExact("phone") || getVal(["phone", "mobile", "contact"]) || "";
    const cohort = getExact("cohort") || getVal(["cohort"]) || "";
    const resumeStatus = getExact("resume status") || "";
    const prStatus = getExact("pr status") || getVal(["pr status"]) || "";
    const beScore = getExact("be scores") ?? getExact("be score") ?? getVal(["be scores", "be score"]);
    const fsdScore = getExact("fsd  scores") ?? getExact("fsd scores") ?? getExact("fsd score") ?? getVal(["fsd scores", "fsd score", "fsd"]);
    const feScore = getExact("fe scores") ?? getExact("fe score") ?? getVal(["fe scores", "fe score"]);
    const dbmsScore = getExact("dbms scores") ?? getExact("dbms score") ?? getVal(["dbms scores", "dbms score"]);
    const resumeLink = row.find((v: any) => typeof v === "string" && v.startsWith("http")) || "";

    const rawData: Record<string, any> = {};
    originalHeaders.forEach((header, idx) => {
      if (header && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
        rawData[header] = row[idx];
      }
    });

    const scoreVal = getVal(["be score", "fsd score", "be", "fsd"]);

    return {
      name,
      email,
      phone,
      cohort,
      resumeStatus,
      prStatus,
      beScore: Number(beScore) || 0,
      fsdScore: Number(fsdScore) || 0,
      feScore: Number(feScore) || 0,
      dbmsScore: Number(dbmsScore) || 0,
      resumeLink: typeof resumeLink === "string" && resumeLink.startsWith("http") ? resumeLink : "",
      college: getVal(["college", "university", "institution"]) || "",
      company: getVal(["company", "employer"]) || "",
      score: Number(scoreVal) || 0,
      skills: cohort ? [cohort] : [],
      sessionId,
      rawData
    };
  });

  const validCandidates = formatted.filter(c => c.name !== "Unknown" || c.email);

  const ops = validCandidates.map(candidate => ({
    updateOne: {
      filter: { email: candidate.email, phone: candidate.phone, sessionId },
      update: { $set: candidate },
      upsert: true,
    }
  }));

  const result = await Candidate.bulkWrite(ops, { ordered: false });
  await Candidate.updateMany({ sessionId }, { $set: { ttl: new Date() } })
  res.json({
    message: "Upload complete",
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
    total: validCandidates.length
  });
});
router.post("/heartbeat", async (req: any, res) => {
  const sessionId = req.headers["x-session-id"];
  await Candidate.updateMany({ sessionId }, { $set: { ttl: new Date() } })
  res.json({ message: "Heartbeat received" });
})

router.post("/close", async (req: any, res) => {
  const sessionId = req.headers["x-session-id"];
  await Candidate.deleteMany({ sessionId })
  res.json({ message: "Close received" });
})

router.get("/reset", async (req: any, res) => {
  if (!process.env.RESET_KEY || req.query.key !== process.env.RESET_KEY) {
    return res.status(401).json({ message: "Forbidden!" });
  }
  await Candidate.collection.drop()
  res.json({ message: "Reset Done" });
})

export default router;