"use client";

export type ImportedRow = {
  sourceRow: number;
  day: number | null;
  date: string;
  enabled: boolean;
  workMode: string;
  activity: string;
  link: string;
  results: string;
  status: string;
  remark: string;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const textValue = (value: unknown) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const objectValue = value as { text?: string; hyperlink?: string; result?: unknown };
    return String(objectValue.text ?? objectValue.hyperlink ?? objectValue.result ?? "").trim();
  }
  return String(value).trim();
};

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = textValue(value);
  const iso = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const boolValue = (value: unknown) => {
  const text = normalize(value);
  return !["false", "no", "notuse", "disabled", "0"].includes(text);
};

const aliases: Record<string, string[]> = {
  day: ["day", "dayno", "daynumber"],
  date: ["date", "workdate", "วันที่"],
  enabled: ["useday", "enabled", "use", "daystatus"],
  workMode: ["workmode", "mode", "location"],
  activity: ["activity", "type", "tasktype"],
  link: ["linkplane", "link", "url"],
  results: ["results", "result", "evidence"],
  status: ["status", "resultsstatus"],
  remark: ["remark", "remarks", "note", "notes"],
};

const findHeader = (headers: unknown[], field: keyof typeof aliases) => {
  const accepted = aliases[field];
  return headers.findIndex((header) => accepted.includes(normalize(header)));
};

const rowsFromMatrix = (matrix: unknown[][]) => {
  const headerIndex = matrix.findIndex((row) => {
    const values = row.map(normalize);
    return values.some((value) => aliases.activity.includes(value)) && values.some((value) => aliases.link.includes(value));
  });
  if (headerIndex < 0) throw new Error("ไม่พบหัวคอลัมน์ Activity และ Link Plane");
  const headers = matrix[headerIndex];
  const columns = Object.fromEntries(Object.keys(aliases).map((field) => [field, findHeader(headers, field as keyof typeof aliases)])) as Record<keyof typeof aliases, number>;
  return matrix.slice(headerIndex + 1).map((row, index): ImportedRow | null => {
    const get = (field: keyof typeof aliases) => columns[field] >= 0 ? row[columns[field]] : "";
    const date = parseDate(get("date"));
    const rawDay = Number(textValue(get("day")));
    const day = Number.isInteger(rawDay) && rawDay > 0 ? rawDay : date ? Number(date.slice(-2)) : null;
    const imported = {
      sourceRow: headerIndex + index + 2,
      day,
      date,
      enabled: boolValue(get("enabled")),
      workMode: textValue(get("workMode")),
      activity: textValue(get("activity")),
      link: textValue(get("link")),
      results: textValue(get("results")),
      status: textValue(get("status")),
      remark: textValue(get("remark")),
    };
    return [imported.activity, imported.link, imported.results, imported.status, imported.remark].some(Boolean) ? imported : null;
  }).filter((row): row is ImportedRow => Boolean(row));
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(value); value = ""; }
    else value += character;
  }
  cells.push(value);
  return cells;
};

export async function parseImportFile(file: File) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    return rowsFromMatrix(text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine));
  }
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet("Work Entries") || workbook.worksheets[0];
  if (!worksheet) throw new Error("ไม่พบ Worksheet ในไฟล์");
  const matrix: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => matrix.push((row.values as unknown[]).slice(1)));
  return rowsFromMatrix(matrix);
}

export async function downloadImportTemplate(month: Date) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Work Entries", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(["Day", "Date", "Use Day", "Work Mode", "No.", "Activity", "Link Plane", "Results", "Status", "Remark"]);
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = sheet.addRow([day, date, "Use", "", 1, "", "", "", "", ""]);
    row.getCell(3).dataValidation = { type: "list", allowBlank: false, formulae: ['"Use,Not Use"'] };
    row.getCell(4).dataValidation = { type: "list", allowBlank: true, formulae: ['"Office,Onsite,WFH"'] };
    row.getCell(6).dataValidation = { type: "list", allowBlank: true, formulae: ['"Retest,Open,Meeting,Create Testcase,Smoke Test,E2E,Review"'] };
    row.getCell(9).dataValidation = { type: "list", allowBlank: true, formulae: ['"Open,In Progress,Passed,Fail,Stopper,Cancel,Done"'] };
  }
  sheet.getRow(1).height = 27;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFDF8" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "667461" } };
  });
  for (let rowNumber = 2; rowNumber <= totalDays + 1; rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell((cell) => {
      cell.font = { name: "Tahoma", color: { argb: "25251F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 ? "FFFDF8" : "F6F1E7" } };
    });
  }
  sheet.columns = [10, 15, 13, 15, 8, 20, 38, 28, 18, 34].map((width) => ({ width }));
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Submission-Center_Import-Template_${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
