// excelAnalyzer.js - A helper script to debug Excel parsing issues
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

// Path to your Excel file
const filePath = path.resolve("./حاسب (3).xls");

try {
  // Read the file
  const fileData = fs.readFileSync(filePath);

  // Parse workbook
  const workbook = XLSX.read(fileData, { type: "buffer" });

  console.log("Workbook information:");
  console.log("Sheet names:", workbook.SheetNames);

  // Process first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Get the range of the sheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  console.log("Sheet range:", worksheet["!ref"]);

  // Scan all rows to find potential student data
  console.log("\nScanning for student data...");
  let studentDataRow = -1;

  // Look for rows that might contain column headers (like "الاسم" or "رقم الطالب")
  for (let R = range.s.r; R <= range.e.r; ++R) {
    let rowHasNameOrId = false;
    let rowContent = [];

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      const value = cell ? cell.v : undefined;
      rowContent.push(value);

      if (
        value &&
        typeof value === "string" &&
        (value.includes("اسم") ||
          value.includes("رقم") ||
          value.includes("الطالب") ||
          value.includes("الكود"))
      ) {
        rowHasNameOrId = true;
      }
    }

    if (rowHasNameOrId) {
      console.log(
        `Potential header row found at row ${R}:`,
        rowContent.filter(Boolean).join(", ")
      );
      studentDataRow = R + 1; // Data typically starts one row after headers
    }

    // If we found a name or ID in a cell and have found some content, show the next few rows too
    if (studentDataRow > 0 && R >= studentDataRow && R < studentDataRow + 5) {
      console.log(`Data row ${R}:`, rowContent.filter(Boolean).join(", "));
    }
  }

  if (studentDataRow > 0) {
    console.log(`\nAssuming student data starts at row ${studentDataRow}`);

    // Extract just the student data rows
    const studentData = [];
    for (let R = studentDataRow; R <= range.e.r; ++R) {
      const row = {};
      let hasData = false;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (cell) {
          const headerAddress = XLSX.utils.encode_cell({
            r: studentDataRow - 1,
            c: C,
          });
          const headerCell = worksheet[headerAddress];
          const headerValue = headerCell ? headerCell.v : `Column_${C}`;

          row[headerValue] = cell.v;
          hasData = true;
        }
      }

      if (hasData) {
        studentData.push(row);
      }
    }

    console.log("\nExtracted student data:");
    console.log(JSON.stringify(studentData.slice(0, 5), null, 2));
  } else {
    console.log("Could not identify student data rows");

    // Try using headers and range extraction
    console.log("\nAttempting alternative extraction approach...");

    // Extract all data and look for patterns
    const allData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });

    // Look for rows with student IDs (typically numeric values in one column)
    const potentialRows = allData.filter((row) => {
      const nonEmptyCells = row.filter((cell) => cell !== null);
      return (
        nonEmptyCells.length > 3 &&
        nonEmptyCells.some(
          (cell) =>
            (typeof cell === "number" && cell > 1000) || // Looking for ID-like numbers
            (typeof cell === "string" && /^\d{5,}$/.test(cell)) // Or ID-like strings
        )
      );
    });

    if (potentialRows.length > 0) {
      console.log("Found potential student rows:");
      console.log(JSON.stringify(potentialRows.slice(0, 5), null, 2));
    }
  }
} catch (error) {
  console.error("Error analyzing Excel file:", error);
}
