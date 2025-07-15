export interface Student {
  id: string;
  name: string;
  grade?: string | number;
  [key: string]: any; // For additional fields from Excel
}

export interface Sheet {
  name: string;
  data: any[];
  headers?: string[]; // Real column headers from the Excel sheet
  enhancedMapping?: HeaderMapping; // Enhanced mapping for empty sheets
}

export interface HeaderMapping {
  id: string;
  name: string;
  grade: string;
  gradeColumns: string[]; // Array of additional grade columns
  [key: string]: string | string[]; // For additional mappings
}

export interface GradeEntryMethod {
  id: "prefix" | "suggest" | "alpha";
  name: string;
}

export interface ProcessedExcelData {
  sheets: Sheet[];
  currentSheet: Sheet | null;
  headers: string[];
  mapping: HeaderMapping | null;
}
