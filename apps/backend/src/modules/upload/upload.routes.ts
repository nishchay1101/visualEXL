import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Candidate from "../candidate/candidate.model";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ── Helpers ────────────────────────────────────────────────────────────────

/** Detect columns where ≥60% of non-empty values are numeric */
function detectNumericColumns(headers: string[], rows: any[][]): string[] {
  return headers.filter((header, idx) => {
    const vals = rows.map(r => r[idx]).filter(v => v !== undefined && v !== null && v !== "");
    if (!vals.length) return false;
    const numCount = vals.filter(v => !isNaN(Number(v))).length;
    return numCount / vals.length >= 0.6;
  });
}

/** Look up a column by its exact lowercase header */
function getExact(lowerHeaders: string[], row: any[], exact: string) {
  const idx = lowerHeaders.indexOf(exact.toLowerCase());
  return idx !== -1 ? row[idx] : undefined;
}

/** Look up the first column whose header contains one of the given keywords */
function getByKw(lowerHeaders: string[], row: any[], keywords: string[]) {
  const idx = lowerHeaders.findIndex(h => h && keywords.some(k => h.includes(k)));
  return idx !== -1 ? row[idx] : undefined;
}

/** Try exact first, then keyword fallback */
function getField(lowerHeaders: string[], row: any[], exact: string, keywords: string[]) {
  return getExact(lowerHeaders, row, exact) ?? getByKw(lowerHeaders, row, keywords);
}

/** Coerce a value to a number, returning 0 on failure */
function toScore(v: any): number {
  return Number(v) || 0;
}

// ── Upload Route ───────────────────────────────────────────────────────────

router.post("/", upload.single("file"), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const sessionId = req.headers["x-session-id"];
  if (!sessionId) {
    return res.status(401).json({ message: "No session ID provided. Please refresh the page." });
  }

  const workbook = xlsx.readFile(req.file.path);
  const sheetName =
    workbook.SheetNames.find(n => n.toLowerCase().includes("application")) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawGrid: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Dynamically locate the header row (first row containing both "name" and "email")
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
  const dataRows = rawGrid.slice(headerIndex + 1).filter(r => r && r.some(v => v !== null && v !== undefined && v !== ""));

  // Auto-detect which columns are numeric (scores)
  const numericColumns = detectNumericColumns(originalHeaders, dataRows);

  const formatted = dataRows.map((row: any[]) => {
    const name        = getField(lowerHeaders, row, "name",    ["name"])                         || "Unknown";
    const email       = getField(lowerHeaders, row, "email",   ["email"])                        || "";
    const phone       = getField(lowerHeaders, row, "phone",   ["phone", "mobile", "contact"])   || "";
    const cohort      = getField(lowerHeaders, row, "cohort",  ["cohort"])                       || "";
    const resumeStatus = getExact(lowerHeaders, row, "resume status")                            || "";
    const prStatus    = getField(lowerHeaders, row, "pr status", ["pr status"])                  || "";

    // Legacy hardcoded score fields (kept for backwards compat)
    const beScore   = getExact(lowerHeaders, row, "be scores")   ?? getExact(lowerHeaders, row, "be score")   ?? getByKw(lowerHeaders, row, ["be scores", "be score"]);
    const fsdScore  = getExact(lowerHeaders, row, "fsd  scores") ?? getExact(lowerHeaders, row, "fsd scores") ?? getExact(lowerHeaders, row, "fsd score") ?? getByKw(lowerHeaders, row, ["fsd scores", "fsd score", "fsd"]);
    const feScore   = getExact(lowerHeaders, row, "fe scores")   ?? getExact(lowerHeaders, row, "fe score")   ?? getByKw(lowerHeaders, row, ["fe scores", "fe score"]);
    const dbmsScore = getExact(lowerHeaders, row, "dbms scores") ?? getExact(lowerHeaders, row, "dbms score") ?? getByKw(lowerHeaders, row, ["dbms scores", "dbms score"]);

    const resumeLink = row.find((v: any) => typeof v === "string" && v.startsWith("http")) || "";

    // Build rawData from all headers
    const rawData: Record<string, any> = {};
    originalHeaders.forEach((header, idx) => {
      if (header && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
        rawData[header] = row[idx];
      }
    });

    // Compute overall score as average across all auto-detected numeric columns
    const numericVals = numericColumns
      .map(col => {
        const idx = originalHeaders.indexOf(col);
        return idx !== -1 ? Number(row[idx]) : NaN;
      })
      .filter(v => !isNaN(v));
    const score = numericVals.length
      ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length
      : 0;

    return {
      name,
      email,
      phone,
      cohort,
      resumeStatus,
      prStatus,
      beScore:   toScore(beScore),
      fsdScore:  toScore(fsdScore),
      feScore:   toScore(feScore),
      dbmsScore: toScore(dbmsScore),
      resumeLink: typeof resumeLink === "string" && resumeLink.startsWith("http") ? resumeLink : "",
      college: getByKw(lowerHeaders, row, ["college", "university", "institution"]) || "",
      company: getByKw(lowerHeaders, row, ["company", "employer"]) || "",
      score,
      skills: cohort ? [cohort] : [],
      sessionId,
      rawData,
    };
  });

  const validCandidates = formatted.filter(c => c.name !== "Unknown" || c.email);

  const ops = validCandidates.map(candidate => ({
    updateOne: {
      filter: { email: candidate.email, phone: candidate.phone, sessionId },
      update: { $set: candidate },
      upsert: true,
    },
  }));

  const result = await Candidate.bulkWrite(ops, { ordered: false });
  await Candidate.updateMany({ sessionId }, { $set: { ttl: new Date() } });

  res.json({
    message: "Upload complete",
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
    total: validCandidates.length,
    detectedColumns: originalHeaders,
    numericColumns,
  });
});

// ── Heartbeat / Close / Reset ──────────────────────────────────────────────

router.post("/heartbeat", async (req: any, res) => {
  const sessionId = req.headers["x-session-id"];
  await Candidate.updateMany({ sessionId }, { $set: { ttl: new Date() } });
  res.json({ message: "Heartbeat received" });
});

router.post("/close", async (req: any, res) => {
  const sessionId = req.headers["x-session-id"];
  await Candidate.deleteMany({ sessionId });
  res.json({ message: "Close received" });
});

router.get("/reset", async (req: any, res) => {
  if (!process.env.RESET_KEY || req.query.key !== process.env.RESET_KEY) {
    return res.status(401).json({ message: "Forbidden!" });
  }
  await Candidate.collection.drop();
  res.json({ message: "Reset Done" });
});

export default router;
