import mongoose from "mongoose";

const CandidateSchema = new mongoose.Schema({
  name: { type: String, index: true },
  email: String,
  phone: String,
  college: { type: String, index: true },
  cohort: String,
  resumeStatus: String,
  prStatus: String,
  resumeLink: String,
  beScore: Number,
  fsdScore: Number,
  feScore: Number,
  dbmsScore: Number,
  skills: [{ type: String, index: true }],
  score: { type: Number, index: true },
  status: { type: String, default: "applied", index: true },
  company: { type: String, index: true },
  sessionId: { type: String, index: true },
  rawData: Object,
  ttl: { type: Date, expires: 5 * 60 }
}, { timestamps: true });

CandidateSchema.index({ name: "text", college: "text" });
// Compound unique index — prevents duplicate records on re-upload
CandidateSchema.index({ email: 1, phone: 1, sessionId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Candidate", CandidateSchema);