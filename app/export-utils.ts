"use client";

export type ExportTask = {
  activity: string;
  link: string;
  results: string;
  status: string;
  remark: string;
};

export type ExportDay = {
  enabled: boolean;
  workMode: string;
  tasks: ExportTask[];
};

export type ExportPayload = {
  month: Date;
  period: "month" | "day";
  day: number;
  includeDashboard: boolean;
  includeEntries: boolean;
  days: Record<number, ExportDay>;
  statuses: readonly string[];
};

const PALETTE: Record<string, { fg: string; bg: string }> = {
  Open: { fg: "A7611A", bg: "FBECD4" },
  "In Progress": { fg: "1E6785", bg: "DFEEF2" },
  Passed: { fg: "356643", bg: "E2EFE2" },
  Fail: { fg: "A13E35", bg: "F5DFDC" },
  Stopper: { fg: "684A8B", bg: "ECE4F5" },
  Cancel: { fg: "61646B", bg: "E9E8E5" },
  Done: { fg: "286B65", bg: "DCEEEA" },
};

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthName = (date: Date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const selectedDays = (payload: ExportPayload) => {
  if (payload.period === "day") return [payload.day];
  return Object.keys(payload.days).map(Number).sort((a, b) => a - b);
};

const fileStem = (payload: ExportPayload) => {
  if (payload.period === "day") {
    return `Submission-Center_${isoDate(new Date(payload.month.getFullYear(), payload.month.getMonth(), payload.day))}`;
  }
  return `Submission-Center_${monthName(payload.month).replace(" ", "-")}_exported-${isoDate(new Date())}`;
};

const entryRows = (payload: ExportPayload) =>
  selectedDays(payload).flatMap((dayNumber) => {
    const record = payload.days[dayNumber];
    if (!record?.enabled) return [];
    return record.tasks
      .filter((task) => Object.values(task).some((value) => value.trim()))
      .map((task, index) => ({
        day: dayNumber,
        date: isoDate(new Date(payload.month.getFullYear(), payload.month.getMonth(), dayNumber)),
        workMode: record.workMode || "-",
        no: index + 1,
        ...task,
      }));
  });

const summary = (payload: ExportPayload) => {
  const days = selectedDays(payload);
  const counts = Object.fromEntries(payload.statuses.map((status) => [status, 0])) as Record<string, number>;
  let total = 0;
  const daily = days.map((dayNumber) => {
    const record = payload.days[dayNumber];
    const tasks = record?.enabled ? record.tasks.filter((task) => task.link.trim()) : [];
    total += tasks.length;
    tasks.forEach((task) => {
      if (task.status) counts[task.status] = (counts[task.status] || 0) + 1;
    });
    return {
      day: dayNumber,
      date: isoDate(new Date(payload.month.getFullYear(), payload.month.getMonth(), dayNumber)),
      workMode: record?.enabled ? record.workMode || "-" : "Not Use",
      total: tasks.length,
    };
  });
  return { total, counts, daily };
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export async function exportExcel(payload: ExportPayload) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Submission Center";
  workbook.created = new Date();
  const overview = summary(payload);

  if (payload.includeDashboard) {
    const sheet = workbook.addWorksheet("Dashboard", {
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
      },
      views: [{ state: "frozen", ySplit: 5 }],
    });
    sheet.mergeCells("A1:E2");
    const title = sheet.getCell("A1");
    title.value = "SUBMISSION CENTER - DASHBOARD";
    title.font = { name: "Tahoma", size: 20, bold: true, color: { argb: "FFFDF8" } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "25251F" } };
    title.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getCell("A4").value = payload.period === "day" ? "Date" : "Month";
    sheet.getCell("B4").value = payload.period === "day"
      ? isoDate(new Date(payload.month.getFullYear(), payload.month.getMonth(), payload.day))
      : monthName(payload.month);
    sheet.getCell("D4").value = "Total items";
    sheet.getCell("E4").value = overview.total;
    ["A4", "D4"].forEach((ref) => {
      sheet.getCell(ref).font = { name: "Tahoma", bold: true, color: { argb: "777568" } };
    });
    sheet.getCell("E4").font = { name: "Tahoma", size: 18, bold: true, color: { argb: "25251F" } };

    sheet.getRow(6).values = ["Status", "Count", "", "Day", "Date", "Work mode", "Items"];
    sheet.getRow(6).height = 24;
    sheet.getRow(6).eachCell((cell) => {
      cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFDF8" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "667461" } };
      cell.alignment = { vertical: "middle" };
    });

    payload.statuses.forEach((status, index) => {
      const row = 7 + index;
      sheet.getCell(row, 1).value = status;
      sheet.getCell(row, 2).value = overview.counts[status];
      const colors = PALETTE[status];
      [1, 2].forEach((column) => {
        const cell = sheet.getCell(row, column);
        cell.font = { name: "Tahoma", color: { argb: colors.fg }, bold: column === 2 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.bg } };
        cell.border = { bottom: { style: "thin", color: { argb: "D9D3C7" } } };
      });
    });

    overview.daily.forEach((item, index) => {
      const row = 7 + index;
      sheet.getCell(row, 4).value = item.day;
      sheet.getCell(row, 5).value = item.date;
      sheet.getCell(row, 6).value = item.workMode;
      sheet.getCell(row, 7).value = item.total;
      for (let column = 4; column <= 7; column += 1) {
        const cell = sheet.getCell(row, column);
        cell.font = { name: "Tahoma", color: { argb: "25251F" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFFDF8" : "F6F1E7" } };
        cell.border = { bottom: { style: "thin", color: { argb: "D9D3C7" } } };
      }
    });
    sheet.columns = [
      { width: 18 }, { width: 12 }, { width: 3 }, { width: 10 }, { width: 15 }, { width: 17 }, { width: 12 },
    ];
    sheet.printArea = `A1:G${Math.max(14, overview.daily.length + 6)}`;
  }

  if (payload.includeEntries) {
    const rows = entryRows(payload);
    const sheet = workbook.addWorksheet("Work Entries", {
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        printTitlesRow: "4:4",
      },
      views: [{ state: "frozen", ySplit: 4 }],
    });
    sheet.mergeCells("A1:I2");
    const title = sheet.getCell("A1");
    title.value = `WORK ENTRIES - ${payload.period === "day" ? rows[0]?.date || "Selected day" : monthName(payload.month)}`;
    title.font = { name: "Tahoma", size: 19, bold: true, color: { argb: "FFFDF8" } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "25251F" } };
    title.alignment = { vertical: "middle" };
    sheet.getRow(4).values = ["Day", "Date", "Work Mode", "No.", "Activity", "Link Plane", "Results", "Status", "Remark"];
    sheet.getRow(4).height = 26;
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFDF8" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "667461" } };
      cell.alignment = { vertical: "middle" };
    });
    rows.forEach((item, index) => {
      const row = sheet.addRow([
        item.day, item.date, item.workMode, item.no, item.activity || "-", item.link, item.results, item.status || "-", item.remark,
      ]);
      row.height = 30;
      row.eachCell((cell) => {
        cell.font = { name: "Tahoma", size: 10, color: { argb: "25251F" } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFFDF8" : "F6F1E7" } };
        cell.border = { bottom: { style: "thin", color: { argb: "D9D3C7" } } };
      });
      if (item.link) {
        row.getCell(6).value = { text: item.link, hyperlink: item.link };
        row.getCell(6).font = { name: "Tahoma", size: 10, color: { argb: "356D78" }, underline: true };
      }
      if (item.status && PALETTE[item.status]) {
        const colors = PALETTE[item.status];
        row.getCell(8).font = { name: "Tahoma", bold: true, color: { argb: colors.fg } };
        row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.bg } };
      }
    });
    if (!rows.length) {
      sheet.mergeCells("A5:I7");
      sheet.getCell("A5").value = "No work entries for this selection.";
      sheet.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell("A5").font = { name: "Tahoma", italic: true, color: { argb: "777568" } };
    }
    sheet.columns = [
      { width: 8 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 19 },
      { width: 37 }, { width: 27 }, { width: 16 }, { width: 29 },
    ];
    sheet.printArea = `A1:I${Math.max(7, rows.length + 4)}`;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileStem(payload)}.xlsx`,
  );
}

async function loadThaiFont(doc: import("jspdf").jsPDF) {
  const fontBuffer = await fetch("/Tahoma.ttf").then((response) => response.arrayBuffer());
  const bytes = new Uint8Array(fontBuffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  doc.addFileToVFS("Tahoma.ttf", btoa(binary));
  doc.addFont("Tahoma.ttf", "Tahoma", "normal");
  doc.setFont("Tahoma");
}

export async function exportPdf(payload: ExportPayload) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  await loadThaiFont(doc);
  const overview = summary(payload);
  const periodLabel = payload.period === "day"
    ? isoDate(new Date(payload.month.getFullYear(), payload.month.getMonth(), payload.day))
    : monthName(payload.month);
  const pageWidth = doc.internal.pageSize.getWidth();

  const header = (title: string, subtitle: string) => {
    doc.setFillColor("#25251f");
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor("#fffdf8");
    doc.setFont("Tahoma", "normal");
    doc.setFontSize(17);
    doc.text(title, 12, 10);
    doc.setFontSize(9);
    doc.text(subtitle, 12, 16);
    doc.setTextColor("#25251f");
  };

  if (payload.includeDashboard) {
    header("SUBMISSION CENTER - DASHBOARD", periodLabel);
    doc.setFontSize(9);
    doc.setTextColor("#777568");
    doc.text("TOTAL ITEMS", 12, 34);
    doc.setFontSize(28);
    doc.setTextColor("#25251f");
    doc.text(String(overview.total), 12, 45);

    const cardWidth = 34;
    payload.statuses.forEach((status, index) => {
      const x = 54 + index * cardWidth;
      const colors = PALETTE[status];
      doc.setFillColor(`#${colors.bg}`);
      doc.setDrawColor(`#${colors.fg}`);
      doc.rect(x, 29, cardWidth - 2, 19, "FD");
      doc.setTextColor(`#${colors.fg}`);
      doc.setFontSize(7);
      doc.text(status.toUpperCase(), x + 3, 35);
      doc.setFontSize(15);
      doc.text(String(overview.counts[status]), x + 3, 44);
    });

    autoTable(doc, {
      startY: 56,
      head: [["Day", "Date", "Work mode", "Items"]],
      body: overview.daily.map((item) => [String(item.day), item.date, item.workMode, String(item.total)]),
      theme: "grid",
      styles: { font: "Tahoma", fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
      headStyles: { fillColor: "#667461", textColor: "#fffdf8", fontStyle: "normal" },
      alternateRowStyles: { fillColor: "#f6f1e7" },
      rowPageBreak: "avoid",
      margin: { left: 12, right: 12, top: 28, bottom: 12 },
    });
  }

  if (payload.includeEntries) {
    if (payload.includeDashboard) doc.addPage("a4", "landscape");
    header("SUBMISSION CENTER - WORK ENTRIES", periodLabel);
    const rows = entryRows(payload);
    autoTable(doc, {
      startY: 28,
      head: [["Day", "Date", "Mode", "No.", "Activity", "Link Plane", "Results", "Status", "Remark"]],
      body: rows.length
        ? rows.map((item) => [
            String(item.day), item.date, item.workMode, String(item.no), item.activity || "-", item.link,
            item.results, item.status || "-", item.remark,
          ])
        : [["-", "-", "-", "-", "No work entries for this selection.", "", "", "", ""]],
      theme: "grid",
      styles: { font: "Tahoma", fontSize: 6.7, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: "#667461", textColor: "#fffdf8", fontStyle: "normal", fontSize: 7 },
      alternateRowStyles: { fillColor: "#f6f1e7" },
      columnStyles: {
        0: { cellWidth: 9 }, 1: { cellWidth: 19 }, 2: { cellWidth: 17 }, 3: { cellWidth: 9 },
        4: { cellWidth: 24 }, 5: { cellWidth: 54 }, 6: { cellWidth: 42 }, 7: { cellWidth: 21 }, 8: { cellWidth: 64 },
      },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      margin: { left: 8, right: 8, top: 28, bottom: 12 },
      didDrawPage: () => {
        doc.setFont("Tahoma");
        doc.setFontSize(7);
        doc.setTextColor("#777568");
        doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 22, doc.internal.pageSize.getHeight() - 5);
      },
    });
  }

  doc.save(`${fileStem(payload)}.pdf`);
}
