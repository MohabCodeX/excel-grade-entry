// testExcelParser.js - Test our Excel parsing function directly
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

/**
 * Processes Arabic Excel sheets with complex formats
 * Extracts student data by finding header rows and extracting data that follows
 */
function processArabicExcelSheet(worksheet) {
  try {
    // Get the range of the sheet
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    // First pass: scan for row with student header information (like "اسم الطالب" or "رقم الطالب")
    let headerRowIndex = -1;
    let studentIdColumnIndex = -1;
    let studentNameColumnIndex = -1;

    // First scan for headers
    for (let R = range.s.r; R <= range.e.r; ++R) {
      let hasHeaderInfo = false;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];

        if (cell && cell.v) {
          const value = String(cell.v).toLowerCase();

          if (
            value.includes("اسم الطالب") ||
            value.includes("اسم طالب") ||
            value.includes("اسم")
          ) {
            studentNameColumnIndex = C;
            hasHeaderInfo = true;
            console.log(`Found name column at (${R},${C}): ${value}`);
          }

          if (
            (value.includes("رقم") ||
              value.includes("كود") ||
              value.includes("جلوس")) &&
            !value.includes("مقرر")
          ) {
            studentIdColumnIndex = C;
            hasHeaderInfo = true;
            console.log(`Found ID column at (${R},${C}): ${value}`);
          }
        }
      }

      if (hasHeaderInfo) {
        headerRowIndex = R;
        break;
      }
    }

    // Special handling if we couldn't find the header info on first pass
    if (
      headerRowIndex < 0 ||
      studentIdColumnIndex < 0 ||
      studentNameColumnIndex < 0
    ) {
      console.log(
        "Could not find standard headers, doing more aggressive search..."
      );
      // Look for specific text that might indicate student data
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          if (cell && cell.v) {
            const value = String(cell.v);

            // Special case check for row 19 in your specific file
            if (value.includes("اسم الطالب") || value.includes("رقم الجلوس")) {
              console.log(`Found header row at R=${R}, C=${C}: ${value}`);
              // Look in this row for column positions
              for (let C2 = range.s.c; C2 <= range.e.c; ++C2) {
                const headerCell =
                  worksheet[XLSX.utils.encode_cell({ r: R, c: C2 })];
                if (headerCell && headerCell.v) {
                  const headerValue = String(headerCell.v);
                  if (
                    headerValue.includes("اسم الطالب") ||
                    headerValue.includes("اسم")
                  ) {
                    studentNameColumnIndex = C2;
                    console.log(`Found name column at C=${C2}: ${headerValue}`);
                  }
                  if (
                    headerValue.includes("رقم الجلوس") ||
                    headerValue.includes("كود الطالب")
                  ) {
                    studentIdColumnIndex = C2;
                    console.log(`Found ID column at C=${C2}: ${headerValue}`);
                  }
                }
              }

              headerRowIndex = R;
              break;
            }
          }
        }
        if (headerRowIndex >= 0) break;
      }
    }

    // If we still couldn't find columns, look for student data patterns directly
    if (studentIdColumnIndex < 0 || studentNameColumnIndex < 0) {
      console.log("Still no headers found, looking for data patterns...");

      // Look for rows that might have student data - Arabic name and a numeric ID
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const nameAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const nameCell = worksheet[nameAddress];

          // Check for cell with Arabic text that looks like a name (contains spaces)
          if (
            nameCell &&
            typeof nameCell.v === "string" &&
            /[\u0600-\u06FF]/.test(nameCell.v) &&
            nameCell.v.includes(" ")
          ) {
            // Look for nearby cells that might be IDs
            for (let offsetC = -2; offsetC <= 2; offsetC++) {
              if (offsetC === 0) continue; // Skip the name cell itself

              const idC = C + offsetC;
              if (idC >= range.s.c && idC <= range.e.c) {
                const idAddress = XLSX.utils.encode_cell({ r: R, c: idC });
                const idCell = worksheet[idAddress];

                if (
                  idCell &&
                  ((typeof idCell.v === "number" && idCell.v > 1000) ||
                    (typeof idCell.v === "string" && /^\d{4,}$/.test(idCell.v)))
                ) {
                  console.log(
                    `Found student data pattern at R=${R}: ID at C=${idC}, Name at C=${C}`
                  );
                  studentIdColumnIndex = idC;
                  studentNameColumnIndex = C;
                  headerRowIndex = R - 1; // Assume the row before contains headers
                  break;
                }
              }
            }

            if (studentIdColumnIndex >= 0 && studentNameColumnIndex >= 0) break;
          }
        }
        if (studentIdColumnIndex >= 0 && studentNameColumnIndex >= 0) break;
      }
    }

    if (
      headerRowIndex < 0 ||
      studentIdColumnIndex < 0 ||
      studentNameColumnIndex < 0
    ) {
      console.log(
        "FALLBACK: Could not identify student data structure. Using row 19 as probable header row."
      );

      // For this specific file, we know row 19 has headers based on our previous analysis
      headerRowIndex = 19;

      // Search for student ID and name in this row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        const cell = worksheet[cellAddress];

        if (cell && cell.v) {
          const value = String(cell.v);
          if (value.includes("اسم")) {
            studentNameColumnIndex = C;
          } else if (value.includes("رقم") || value.includes("كود")) {
            studentIdColumnIndex = C;
          }
        }
      }

      // If still not found, use hardcoded values based on our analysis
      if (studentNameColumnIndex < 0) studentNameColumnIndex = 5; // Column F
      if (studentIdColumnIndex < 0) studentIdColumnIndex = 6; // Column G
    }

    // Extract student data
    console.log(
      `Using header row ${headerRowIndex}, ID column ${studentIdColumnIndex}, Name column ${studentNameColumnIndex}`
    );

    // Extract the headers from the found header row
    const headers = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
      const cell = worksheet[cellAddress];

      if (cell && cell.v) {
        headers[C] = String(cell.v);
      }
    }

    // Extract student data from rows following the header
    const students = [];

    for (let R = headerRowIndex + 1; R <= range.e.r; ++R) {
      const student = {};
      let hasData = false;

      // Get student ID and name first
      const idAddress = XLSX.utils.encode_cell({
        r: R,
        c: studentIdColumnIndex,
      });
      const idCell = worksheet[idAddress];

      const nameAddress = XLSX.utils.encode_cell({
        r: R,
        c: studentNameColumnIndex,
      });
      const nameCell = worksheet[nameAddress];

      if (idCell && nameCell) {
        student.id = String(idCell.v).trim();
        student.name = String(nameCell.v).trim();
        hasData = true;

        // Add any other data from the row
        for (let C = range.s.c; C <= range.e.c; ++C) {
          if (
            C !== studentIdColumnIndex &&
            C !== studentNameColumnIndex &&
            headers[C]
          ) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];

            if (cell) {
              student[headers[C]] = cell.v;
            }
          }
        }

        // Add a grade column we can edit
        student.grade = "";

        if (hasData && student.id && student.name) {
          students.push(student);
        }
      }
    }

    return students;
  } catch (error) {
    console.error("Excel sheet processing error", error);
    return [];
  }
}

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

  // Process the sheet
  const students = processArabicExcelSheet(worksheet);

  console.log(`Extracted ${students.length} students`);
  console.log("First 5 students:");
  console.log(JSON.stringify(students.slice(0, 5), null, 2));
} catch (error) {
  console.error("Error analyzing Excel file:", error);
}
