import xlsx from "xlsx";

export const parseExcel = (filePath: string) => {
  const workbook = xlsx.readFile(filePath);
  const data: any = {};

  workbook.SheetNames.forEach((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    data[sheetName] = xlsx.utils.sheet_to_json(sheet);
  });

  return data;
};
