import { parseExcel } from "../../utils/excelParser";
import { bulkInsert } from "../candidate/candidate.repository";

export const handleUpload = async (filePath: string) => {
  const data = parseExcel(filePath);
  const applications = data["Applications"] || [];

  const formatted = applications.map((row: any) => ({
    name: row.Name,
    email: row.Email,
    college: row.College,
    skills: row.Skills?.split(",") || [],
    score: Number(row.Score || 0),
    company: row.Company,
    rawData: row
  }));

  return bulkInsert(formatted);
};