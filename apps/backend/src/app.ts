import express from "express";
import cors from "cors";
import candidateRoutes from "./modules/candidate/candidate.routes";

import uploadRoutes from "./modules/upload/upload.routes";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/candidates", candidateRoutes);
app.use("/upload", uploadRoutes);

app.get("/", (req, res) => {
  res.json({ message: "VisualEXL Backend is alive 🚀" });
});