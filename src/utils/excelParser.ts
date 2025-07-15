import * as XLSX from "xlsx";
import { HeaderMapping, ProcessedExcelData, Sheet } from "../types";
import { error as logError } from "./logger";

/**
 * Parses an Excel file using the xlsx library
 * Handles complex Arabic Excel formats with special structure
 */
export const parseExcelFile = async (
  file: File
): Promise<ProcessedExcelData> => {
  return new Promise((resolve, reject) => {
    try {
      // Validate file
      if (file.size <= 0) {
        logError("Excel parsing error", "File is empty");
        reject(new Error("The Excel file is empty"));
        return;
      }

      // Check for valid Excel file type
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (fileExtension !== "xlsx" && fileExtension !== "xls") {
        logError(
          "Excel parsing error",
          "Invalid file format: " + fileExtension
        );
        reject(
          new Error(
            "Invalid file format. Please upload an Excel file (.xlsx or .xls)"
          )
        );
        return;
      }

      // Use FileReader to read the file
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Parse workbook
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });

          // Check if workbook has sheets
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            logError("Excel parsing error", "No sheets found in file");
            reject(new Error("The file contains no sheets"));
            return;
          }

          // Process each sheet using specialized processing
          const sheets: Sheet[] = [];
          let globalHeaderPatterns: HeaderMapping | null = null;

          // First pass: process all sheets and collect data
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const processedData = processArabicExcelSheet(worksheet);
            const sheetHeaders = extractSheetHeaders(worksheet);

            // Always include the sheet, even if empty
            sheets.push({
              name: sheetName,
              data: processedData,
              headers: sheetHeaders,
            });
          }

          // Second pass: find header patterns from non-empty sheets
          const nonEmptySheets = sheets.filter(
            (sheet) => sheet.data && sheet.data.length > 0
          );

          if (nonEmptySheets.length > 0) {
            // Get header patterns from the first non-empty sheet
            const referenceSheet = nonEmptySheets[0];
            const referenceHeaders = Object.keys(referenceSheet.data[0]);
            globalHeaderPatterns = detectHeaders(referenceHeaders);
          }

          // Third pass: apply header patterns to empty sheets
          for (const sheet of sheets) {
            if ((!sheet.data || sheet.data.length === 0) && sheet.headers && sheet.headers.length > 0) {
              // For empty sheets, try to map their headers using the global patterns
              const enhancedMapping = enhanceHeaderMappingForEmptySheet(sheet.headers, globalHeaderPatterns);
              if (enhancedMapping) {
                // Store the enhanced mapping in the sheet for later use
                (sheet as any).enhancedMapping = enhancedMapping;
              }
            }
          }

          // Set current sheet to the first non-empty sheet if available, otherwise first sheet
          const currentSheet = nonEmptySheets.length > 0 ? nonEmptySheets[0] : sheets[0];
          const headers = currentSheet && currentSheet.data.length > 0 
            ? Object.keys(currentSheet.data[0]) 
            : currentSheet?.headers || [];

          // Auto-detect header mapping based on the processed data
          // Use enhanced mapping for empty sheets if available
          const mapping: HeaderMapping = 
            (!currentSheet?.data || currentSheet.data.length === 0) && (currentSheet as any)?.enhancedMapping
              ? (currentSheet as any).enhancedMapping
              : detectHeaders(headers);

          resolve({
            sheets: sheets, // Return all sheets including empty ones
            currentSheet,
            headers,
            mapping,
          });
        } catch (error) {
          logError("Excel parsing error", error);
          reject(
            new Error(
              "Failed to parse the Excel file. The file might be corrupted or in an unsupported format."
            )
          );
        }
      };

      reader.onerror = () => {
        logError("Excel parsing error", "FileReader error");
        reject(new Error("Error reading the file. Please try again."));
      };

      // Read the file as an array buffer
      reader.readAsArrayBuffer(file);
    } catch (error) {
      logError("Excel parsing error", error);
      reject(
        new Error(
          "An unexpected error occurred while processing the Excel file."
        )
      );
    }
  });
};

/**
 * Enhances header mapping for empty sheets by matching their headers to patterns from non-empty sheets
 */
function enhanceHeaderMappingForEmptySheet(emptySheetHeaders: string[], globalPatterns: HeaderMapping | null): HeaderMapping | null {
  if (!globalPatterns || !emptySheetHeaders || emptySheetHeaders.length === 0) {
    return null;
  }

  // Create a new mapping specifically for this empty sheet
  const enhancedMapping: HeaderMapping = {
    id: "",
    name: "",
    grade: "",
    gradeColumns: [],
  };

  // Define patterns for matching
  const idPatterns = /id|رقم|كود|رقم الجلوس|код|编号|número|student.*id|طالب.*رقم/i;
  const namePatterns = /name|اسم|الطالب|student|طالب|имя|姓名|nombre|اسم.*طالب|طالب.*اسم/i;
  const gradePatterns = /grade|final|mark|درجة|total|مجموع|نتيجة|оценка|成绩|calificación|quiz|exam|test|امتحان|اختبار|درجة.*امتحان|امتحان.*درجة/i;

  // Try to match headers from the empty sheet to these patterns
  for (const header of emptySheetHeaders) {
    const headerLower = header.toLowerCase();
    
    // Check for ID patterns
    if (idPatterns.test(headerLower) && !enhancedMapping.id) {
      enhancedMapping.id = header;
    }
    // Check for name patterns
    else if (namePatterns.test(headerLower) && !enhancedMapping.name) {
      enhancedMapping.name = header;
    }
    // Check for grade patterns
    else if (gradePatterns.test(headerLower)) {
      if (!enhancedMapping.grade) {
        enhancedMapping.grade = header;
      } else {
        enhancedMapping.gradeColumns.push(header);
      }
    }
  }

  // If we couldn't find specific patterns, use positional matching based on global patterns
  if (!enhancedMapping.id && !enhancedMapping.name && !enhancedMapping.grade) {
    // Try to find the closest matches based on position or similarity
    if (emptySheetHeaders.length >= 2) {
      enhancedMapping.id = emptySheetHeaders[0];
      enhancedMapping.name = emptySheetHeaders[1];
      
      if (emptySheetHeaders.length >= 3) {
        enhancedMapping.grade = emptySheetHeaders[2];
        
        // Add remaining headers as additional grade columns
        if (emptySheetHeaders.length > 3) {
          enhancedMapping.gradeColumns = emptySheetHeaders.slice(3);
        }
      }
    }
  }

  return enhancedMapping;
}

/**
 * Extracts actual column headers from a worksheet, even if it's empty
 */
function extractSheetHeaders(worksheet: XLSX.WorkSheet): string[] {
  try {
    // Get the range of the sheet
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    
    // If sheet is completely empty, return empty array
    if (range.s.r > range.e.r || range.s.c > range.e.c) {
      return [];
    }

    // Arabic header patterns to look for
    const arabicHeaderPatterns = [
      'رقم الجلوس', 'اسم الطالب', 'كود الطالب', 'رقم الطالب',
      'اسم', 'رقم', 'كود', 'طالب', 'درجة', 'امتحان', 'نتيجة', 'مجموع',
      'اختبار', 'م', 'ت', 'المجموع', 'النهائي', 'الدرجة'
    ];

    // Scan all rows to find the one with Arabic headers
    let headerRowIndex = -1;
    let bestHeaderRow: string[] = [];
    let bestMatchCount = 0;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      const rowHeaders: string[] = [];
      let arabicMatchCount = 0;
      let hasContent = false;

      // Extract all cell values from this row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];

        if (cell && cell.v !== undefined && cell.v !== null) {
          const cellValue = String(cell.v).trim();
          if (cellValue) {
            hasContent = true;
            rowHeaders.push(cellValue);
            
            // Check if this cell contains Arabic header patterns
            const lowerValue = cellValue.toLowerCase();
            const hasArabicPattern = arabicHeaderPatterns.some(pattern => 
              lowerValue.includes(pattern.toLowerCase()) || 
              cellValue.includes(pattern)
            );
            
            if (hasArabicPattern) {
              arabicMatchCount++;
            }
          } else {
            rowHeaders.push(`Column ${C + 1}`);
          }
        } else {
          rowHeaders.push(`Column ${C + 1}`);
        }
      }

      // If this row has Arabic header patterns and content, it's likely our header row
      if (hasContent && arabicMatchCount > 0 && arabicMatchCount > bestMatchCount) {
        headerRowIndex = R;
        bestHeaderRow = rowHeaders;
        bestMatchCount = arabicMatchCount;
      }
    }

    // If we found a good header row, return it
    if (headerRowIndex >= 0 && bestHeaderRow.length > 0) {
      return bestHeaderRow;
    }

    // Fallback: try first row
    const firstRowHeaders: string[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C });
      const cell = worksheet[cellAddress];

      if (cell && cell.v !== undefined && cell.v !== null) {
        const headerValue = String(cell.v).trim();
        if (headerValue) {
          firstRowHeaders.push(headerValue);
        } else {
          firstRowHeaders.push(`Column ${C + 1}`);
        }
      } else {
        firstRowHeaders.push(`Column ${C + 1}`);
      }
    }

    return firstRowHeaders;
  } catch (error) {
    logError("Header extraction error", error);
    return [];
  }
}

/**
 * Processes Arabic Excel sheets with complex formats
 * Extracts student data by finding header rows and extracting data that follows
 */
function processArabicExcelSheet(worksheet: XLSX.WorkSheet): any[] {
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

          if (value.includes("اسم الطالب") || value.includes("اسم طالب")) {
            studentNameColumnIndex = C;
            hasHeaderInfo = true;
          }

          if (
            value.includes("رقم") ||
            value.includes("كود الطالب") ||
            value.includes("رقم الجلوس")
          ) {
            studentIdColumnIndex = C;
            hasHeaderInfo = true;
          }
        }
      }

      if (hasHeaderInfo) {
        headerRowIndex = R;
        break;
      }
    }

    // If we couldn't find header info, try to find a row with ID-like and Name-like columns
    if (headerRowIndex < 0) {
      // Look for rows that might have student data
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          if (cell && typeof cell.v === "number" && cell.v > 1000) {
            // Found a potential ID
            // Check if next column has a name-like value
            const nameAddress = XLSX.utils.encode_cell({ r: R, c: C + 1 });
            const nameCell = worksheet[nameAddress];

            if (
              nameCell &&
              typeof nameCell.v === "string" &&
              nameCell.v.includes(" ")
            ) {
              // Likely found a student row with ID and name
              studentIdColumnIndex = C;
              studentNameColumnIndex = C + 1;
              headerRowIndex = R - 1; // Assume header is one row above
              break;
            }
          }
        }

        if (headerRowIndex >= 0) break;
      }
    }

    if (
      headerRowIndex < 0 ||
      studentIdColumnIndex < 0 ||
      studentNameColumnIndex < 0
    ) {
      // Try to extract using standard XLSX methods as a fallback
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      if (rawData.length > 0) {
        // Return the raw data with original column names preserved
        return rawData.map((row: any) => {
          const processed: any = {};

          // Keep all columns with their original names
          for (const key in row) {
            processed[key] = row[key];
          }

          return processed;
        });
      }

      return [];
    }

    // Extract the headers from the found header row
    const headers: Record<number, string> = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
      const cell = worksheet[cellAddress];

      if (cell && cell.v) {
        headers[C] = String(cell.v);
      }
    }

    // Extract student data from rows following the header
    const students: any[] = [];

    for (let R = headerRowIndex + 1; R <= range.e.r; ++R) {
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
        const student: any = {};
        
        // Add all data from the row using original column names
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          
          if (headers[C]) {
            if (cell && cell.v !== undefined) {
              student[headers[C]] = cell.v;
            } else {
              student[headers[C]] = "";
            }
          }
        }

        // Only add if we have meaningful data
        if (student && Object.keys(student).length > 0) {
          students.push(student);
        }
      }
    }


    return students;
  } catch (error) {
    logError("Excel sheet processing error", error);
    return [];
  }
}

/**
 * Detects possible column headers for student ID, name, and grade
 */
export const detectHeaders = (headers: string[]): HeaderMapping => {
  const mapping: HeaderMapping = {
    id: "",
    name: "",
    grade: "",
    gradeColumns: [],
  };

  // Potential grade column patterns
  const gradePatterns = [
    /grade|final|mark|درجة|total|مجموع|نتيجة|оценка|成绩|calificación|quiz|exam|test|امتحان|اختبار/i,
  ];

  // First pass: find ID and name columns
  for (const header of headers) {
    const headerLower = header.toLowerCase();

    if (
      /id|رقم|كود|رقم الجلوس|код|编号|número/i.test(headerLower) &&
      !mapping.id
    ) {
      mapping.id = header;
    } else if (
      /name|اسم|الطالب|student|طالب|имя|姓名|nombre/i.test(headerLower) &&
      !mapping.name
    ) {
      mapping.name = header;
    }
  }

  // Second pass: find grade columns
  const potentialGradeColumns: string[] = [];

  for (const header of headers) {
    const headerLower = header.toLowerCase();

    // Skip ID and name columns
    if (header === mapping.id || header === mapping.name) continue;

    // Check if it looks like a grade column
    if (gradePatterns.some((pattern) => pattern.test(headerLower))) {
      potentialGradeColumns.push(header);
    }
  }

  // Set primary grade column and additional columns
  if (potentialGradeColumns.length > 0) {
    mapping.grade = potentialGradeColumns[0]; // First match as primary

    // Additional columns (skip the first one as it's the primary)
    if (potentialGradeColumns.length > 1) {
      mapping.gradeColumns = potentialGradeColumns.slice(1);
    }
  }

  // If we have headers but couldn't find matches, make some guesses
  if (headers.length > 0) {
    // If 'id' is not detected but we have a number-like column, use that
    if (!mapping.id) {
      for (const header of headers) {
        if (/^\d+$/.test(header) || header.includes("__EMPTY")) {
          mapping.id = header;
          break;
        }
      }
    }

    // If name is not detected but we have a column that might be a name
    if (!mapping.name) {
      for (const header of headers) {
        if (/[أ-ي]/.test(header) && !mapping.name) {
          mapping.name = header;
          break;
        }
      }
    }

    // If still no id or name, use the first two columns as a fallback
    if ((!mapping.id || !mapping.name) && headers.length >= 2) {
      if (!mapping.id) mapping.id = headers[0];
      if (!mapping.name) mapping.name = headers[1];
    }

    // If no grade column detected and we have a third column, use that
    if (!mapping.grade && headers.length >= 3) {
      mapping.grade = headers[2];

      // If we have more columns, add them as additional grade columns
      if (headers.length > 3) {
        mapping.gradeColumns = headers
          .slice(3)
          .filter((h) => h !== mapping.id && h !== mapping.name);
      }
    }
  }

  return mapping;
};

/**
 * Gets a list of student names for auto-suggestion
 */
export const getStudentNames = (data: any[], nameField: string): string[] => {
  return data.map((item) => item[nameField]).filter(Boolean);
};

/**
 * Validates that columns contain the expected data types
 * @param data The sheet data
 * @param columnName The name of the column to validate
 * @param expectedType The expected data type ('number', 'string', etc.)
 * @returns True if the column data is valid, false otherwise
 */
export const validateColumnDataType = (
  data: any[],
  columnName: string,
  expectedType: "number" | "string" = "number"
): boolean => {
  if (!data || data.length === 0 || !columnName) return false;

  // Check if the column exists
  if (!data[0].hasOwnProperty(columnName)) return false;

  // Check if the data type is as expected
  for (const row of data) {
    const value = row[columnName];

    if (value === null || value === undefined) continue; // Skip null/undefined values

    if (expectedType === "number") {
      // Check if the value can be converted to a number
      const numValue = Number(value);
      if (isNaN(numValue)) return false;
    } else if (typeof value !== expectedType) {
      return false;
    }
  }

  return true;
};
