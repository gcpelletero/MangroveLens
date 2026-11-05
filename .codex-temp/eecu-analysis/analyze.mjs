import fs from "node:fs/promises";
import { Workbook } from "@oai/artifact-tool";

const inputPath = "D:/Downloads/Completed_EECU-seconds_[SUM].csv";
const csvText = await fs.readFile(inputPath, "utf8");
const workbook = await Workbook.fromCSV(csvText, { sheetName: "EECU Usage" });

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 4000,
  tableMaxRows: 8,
  tableMaxCols: 8,
  tableMaxCellChars: 120,
});
console.log(overview.ndjson);

const sheet = workbook.worksheets.getItem("EECU Usage");
const used = sheet.getUsedRange(true);
const values = used.values;
const headers = values[0] ?? [];

const summaries = headers.map((header, col) => {
  let numericCount = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const row of values.slice(1)) {
    const raw = row[col];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) continue;
    numericCount += 1;
    sum += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return {
    header,
    numericCount,
    sum,
    min: numericCount ? min : null,
    max: numericCount ? max : null,
  };
});

console.log(JSON.stringify({
  rowCountIncludingHeader: values.length,
  headers,
  firstRows: values.slice(0, 6),
  summaries,
}, null, 2));
