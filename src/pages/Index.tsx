import FileUpload from "@/components/FileUpload";
import GradeTable from "@/components/GradeTable";
import HeaderMapping from "@/components/HeaderMapping";
import SearchBar from "@/components/SearchBar";
import SheetSelector from "@/components/SheetSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  HeaderMapping as HeaderMappingType,
  ProcessedExcelData,
  Student,
} from "@/types";
import { filterStudentsByName } from "@/utils/arabicUtils";
import {
  detectHeaders,
  getStudentNames,
  parseExcelFile,
  validateColumnDataType,
} from "@/utils/excelParser";
import { error as logError, info as logInfo } from "@/utils/logger";
import {
  Database,
  FileSpreadsheet,
  HelpCircle,
  Save,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<
    "upload" | "configure" | "grades"
  >("upload");
  const [excelData, setExcelData] = useState<ProcessedExcelData>({
    sheets: [],
    currentSheet: null,
    headers: [],
    mapping: null,
  });
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();
  const gradeTableRef = React.useRef<any>(null);
  const searchBarRef = React.useRef<any>(null);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      logInfo(
        "FileProcessing",
        `Processing file: ${file.name} (${file.size} bytes)`
      );
      const data = await parseExcelFile(file);

      // Validate that we have sheets and a current sheet
      if (!data.sheets || data.sheets.length === 0) {
        throw new Error("The file contains no sheets or is empty.");
      }

      // Allow empty sheets, but set appropriate state
      if (
        !data.currentSheet ||
        !data.currentSheet.data ||
        data.currentSheet.data.length === 0
      ) {
        // If all sheets are empty, still set the data but show appropriate message
        const hasNonEmptySheets = data.sheets.some(
          (sheet) => sheet.data && sheet.data.length > 0
        );
        if (!hasNonEmptySheets) {
          toast({
            title: "All Sheets Are Empty",
            description:
              "This file contains only empty sheets. You can still view their structure.",
            variant: "default",
          });
        }
      }

      setExcelData(data);
      setActiveStep("configure");
      toast({
        title: "File Uploaded",
        description: `Successfully processed ${file.name}`,
        variant: "default",
      });
    } catch (error) {
      let errorMessage = "Failed to process the Excel file";

      if (error instanceof Error) {
        errorMessage = error.message;
        logError(
          "FileProcessing",
          `Error processing file: ${error.message}`,
          error
        );
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Reset state since we encountered an error
      setExcelData({
        sheets: [],
        currentSheet: null,
        headers: [],
        mapping: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    const selectedSheet =
      excelData.sheets.find((sheet) => sheet.name === sheetName) || null;
    if (selectedSheet) {
      // Get headers from sheet data or from extracted headers
      const headers =
        selectedSheet.data.length > 0
          ? Object.keys(selectedSheet.data[0])
          : selectedSheet.headers || [];

      // Use enhanced mapping for empty sheets if available, otherwise detect headers
      const mapping =
        (!selectedSheet.data || selectedSheet.data.length === 0) &&
        selectedSheet.enhancedMapping
          ? selectedSheet.enhancedMapping
          : detectHeaders(headers);

      setExcelData({
        ...excelData,
        currentSheet: selectedSheet,
        headers,
        mapping,
      });

      setMappingConfirmed(false);

      // Show info message for empty sheets
      if (!selectedSheet.data || selectedSheet.data.length === 0) {
        const mappingInfo = selectedSheet.enhancedMapping
          ? `Enhanced mapping applied: ID="${selectedSheet.enhancedMapping.id}", Name="${selectedSheet.enhancedMapping.name}", Grade="${selectedSheet.enhancedMapping.grade}"`
          : `Basic structure: ${headers.length} columns found`;

        toast({
          title: "Empty Sheet Selected",
          description: `Selected sheet "${sheetName}" is empty. ${mappingInfo}`,
          variant: "default",
        });
      }
    }
  };
  const handleMappingChange = (
    field: keyof HeaderMappingType,
    value: string | string[]
  ) => {
    if (excelData.mapping) {
      setExcelData({
        ...excelData,
        mapping: {
          ...excelData.mapping,
          [field]: value,
        },
      });
    }
  };

  const confirmMapping = () => {
    if (!excelData.mapping || !excelData.currentSheet) {
      toast({
        title: "Error",
        description: "Cannot confirm mapping without data.",
        variant: "destructive",
      });
      return;
    }

    // Check if the current sheet has data
    if (
      !excelData.currentSheet.data ||
      excelData.currentSheet.data.length === 0
    ) {
      toast({
        title: "Empty Sheet",
        description:
          "This sheet is empty. Mapping confirmed but no data to display.",
        variant: "default",
      });
      setMappingConfirmed(true);
      setActiveStep("grades");
      return;
    }

    // Validate that the grade column contains numeric data
    if (
      excelData.mapping.grade &&
      !validateColumnDataType(
        excelData.currentSheet.data,
        excelData.mapping.grade
      )
    ) {
      toast({
        title: "Warning",
        description:
          "Selected grade column contains invalid or non-numeric data.",
        variant: "destructive",
      });
      // We'll still continue but with a warning
    }

    setMappingConfirmed(true);
    setActiveStep("grades");
    toast({
      title: "Mapping Confirmed",
      description: "Column mapping has been set successfully",
      variant: "default",
    });
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleSelectSuggestion = (selectedName: string) => {
    setSearchTerm(selectedName);
    // Find the student ID for the selected name
    if (
      excelData.currentSheet?.data &&
      excelData.mapping?.name &&
      excelData.mapping?.id
    ) {
      const student = excelData.currentSheet.data.find(
        (s: any) => s[excelData.mapping.name] === selectedName
      );
      if (student && gradeTableRef.current) {
        const studentId = student[excelData.mapping.id];
        gradeTableRef.current.focusGradeInput(studentId);
      }
    }
  };

  useEffect(() => {
    if (excelData.currentSheet?.data && excelData.mapping && searchTerm) {
      const filtered = filterStudentsByName(
        excelData.currentSheet.data,
        searchTerm,
        excelData.mapping.name
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents([]);
    }
  }, [searchTerm, excelData.currentSheet?.data, excelData.mapping]);

  const getStudentSuggestions = (): string[] => {
    if (!excelData.currentSheet?.data || !excelData.mapping?.name) return [];
    return getStudentNames(excelData.currentSheet.data, excelData.mapping.name);
  };

  const resetToUpload = () => {
    setActiveStep("upload");
    setExcelData({
      sheets: [],
      currentSheet: null,
      headers: [],
      mapping: null,
    });
    setMappingConfirmed(false);
    setFilteredStudents([]);
    setSearchTerm("");

    // Clear localStorage
    localStorage.removeItem("gradeScribeExcelData");
    localStorage.removeItem("gradeScribeSearchTerm");
    localStorage.removeItem("gradeScribeFilteredStudents");
    localStorage.removeItem("gradeScribeMappingConfirmed");
    localStorage.removeItem("gradeScribeActiveStep");
    localStorage.removeItem("gradeScribeGrades");
    localStorage.removeItem("gradeScribeEditHistory");
    localStorage.removeItem("gradeScribeLastSaved");
  };

  // Save state to localStorage
  useEffect(() => {
    if (excelData) {
      localStorage.setItem("gradeScribeExcelData", JSON.stringify(excelData));
    }
    if (searchTerm) {
      localStorage.setItem("gradeScribeSearchTerm", searchTerm);
    }
    if (filteredStudents) {
      localStorage.setItem(
        "gradeScribeFilteredStudents",
        JSON.stringify(filteredStudents)
      );
    }
    localStorage.setItem(
      "gradeScribeMappingConfirmed",
      JSON.stringify(mappingConfirmed)
    );
    localStorage.setItem("gradeScribeActiveStep", activeStep);

    // Update last saved timestamp
    const now = new Date();
    setLastSaved(now);
    localStorage.setItem("gradeScribeLastSaved", now.toISOString());
  }, [excelData, searchTerm, filteredStudents, mappingConfirmed, activeStep]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedExcelData = localStorage.getItem("gradeScribeExcelData");
    if (savedExcelData) {
      try {
        setExcelData(JSON.parse(savedExcelData));
      } catch (error) {
        console.error("Error parsing saved excel data:", error);
      }
    }
    const savedSearchTerm = localStorage.getItem("gradeScribeSearchTerm");
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
    const savedFilteredStudents = localStorage.getItem(
      "gradeScribeFilteredStudents"
    );
    if (savedFilteredStudents) {
      try {
        setFilteredStudents(JSON.parse(savedFilteredStudents));
      } catch (error) {
        console.error("Error parsing saved filtered students:", error);
      }
    }
    const savedMappingConfirmed = localStorage.getItem(
      "gradeScribeMappingConfirmed"
    );
    if (savedMappingConfirmed) {
      try {
        setMappingConfirmed(JSON.parse(savedMappingConfirmed));
      } catch (error) {
        console.error("Error parsing saved mapping confirmed:", error);
      }
    }
    const savedActiveStep = localStorage.getItem("gradeScribeActiveStep");
    if (savedActiveStep) {
      setActiveStep(savedActiveStep as "upload" | "configure" | "grades");
    }
    const savedLastSaved = localStorage.getItem("gradeScribeLastSaved");
    if (savedLastSaved) {
      setLastSaved(new Date(savedLastSaved));
    }
  }, []);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to focus and clear search bar
      if (e.key === "F2") {
        e.preventDefault();
        if (searchBarRef.current) {
          searchBarRef.current.focusAndClear();
        }
      }
      // Ctrl+S for save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // Implement save functionality here
        if (mappingConfirmed && excelData.currentSheet && excelData.mapping) {
          // Get grades from GradeTable ref if available
          let exportData;
          if (gradeTableRef.current && gradeTableRef.current.getExportData) {
            exportData = gradeTableRef.current.getExportData();
          } else {
            // Fallback: use currentSheet.data
            exportData = excelData.currentSheet.data || [];
          }

          // If there's no data, create a template with headers
          if (!exportData || exportData.length === 0) {
            console.log("Creating template data (keyboard)");
            console.log(
              "Grade columns (keyboard):",
              excelData.mapping.gradeColumns
            );

            const templateRow = {
              [excelData.mapping.id]: "",
              [excelData.mapping.name]: "",
              [excelData.mapping.grade]: "",
            };

            // Add additional grade columns if they exist
            if (Array.isArray(excelData.mapping.gradeColumns)) {
              excelData.mapping.gradeColumns.forEach((col) => {
                if (col && col !== excelData.mapping.grade) {
                  templateRow[col] = "";
                }
              });
            }

            exportData = [templateRow];
            console.log("Template row created (keyboard):", templateRow);
          }

          try {
            console.log("Export data (keyboard):", exportData);
            console.log(
              "Current sheet (keyboard):",
              excelData.currentSheet.name
            );
            console.log("Mapping (keyboard):", excelData.mapping);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(
              wb,
              ws,
              excelData.currentSheet.name || "Sheet1"
            );
            const timestamp = new Date()
              .toISOString()
              .replace(/[:.]/g, "-")
              .slice(0, 19);
            const filename = `grades_export_${timestamp}.xlsx`;

            console.log("About to write file (keyboard):", filename);
            XLSX.writeFile(wb, filename);

            toast({
              title: "Export Successful",
              description: `Data exported to ${filename}`,
              variant: "default",
            });
          } catch (error) {
            console.error("Export error (keyboard):", error);
            toast({
              title: "Export Failed",
              description: `Failed to export: ${
                error.message || "Unknown error"
              }`,
              variant: "destructive",
            });
          }
        }
      }

      // Ctrl+Z for undo (if implemented)
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        // Implement undo functionality here
        toast({
          title: "Undo",
          description: "Undo functionality will be implemented.",
          variant: "default",
        });
      }

      // F1 for help
      if (e.key === "F1") {
        e.preventDefault();
        // Show help dialog
        toast({
          title: "Keyboard Shortcuts",
          description: "Ctrl+O: Open file, Ctrl+S: Save, Ctrl+Z: Undo",
          variant: "default",
          duration: 5000,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mappingConfirmed, excelData.currentSheet, toast]);

  return (
    <div className="container py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Grade Entry System</h1>
        <p className="text-muted-foreground">
          Upload Excel files, map columns, and manage student grades efficiently
        </p>
        {lastSaved && (
          <div className="mt-2 text-sm text-green-600">
            <span className="inline-flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Auto-saved at {lastSaved.toLocaleTimeString()}
            </span>
          </div>
        )}
      </header>

      <Tabs defaultValue="process" className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="process" className="flex items-center gap-2">
            <FileSpreadsheet size={16} />
            <span>Process</span>
          </TabsTrigger>
          <TabsTrigger value="configure" className="flex items-center gap-2">
            <Database size={16} />
            <span>Configure</span>
          </TabsTrigger>
          <TabsTrigger value="grades" className="flex items-center gap-2">
            <Users size={16} />
            <span>Grades</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process">
          <Card>
            <CardHeader>
              <CardTitle>Upload Excel File</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                onFileUpload={handleFileUpload}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configure">
          <Card>
            <CardHeader>
              <CardTitle>Configure Data</CardTitle>
            </CardHeader>
            <CardContent>
              {excelData.sheets.length > 0 ? (
                <div>
                  <SheetSelector
                    sheets={excelData.sheets}
                    currentSheet={excelData.currentSheet}
                    onSheetChange={handleSheetChange}
                  />

                  {excelData.currentSheet && excelData.mapping && (
                    <HeaderMapping
                      headers={excelData.headers}
                      mapping={excelData.mapping}
                      onMappingChange={handleMappingChange}
                      onConfirm={confirmMapping}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Please upload an Excel file first to configure data mapping
                  </p>
                  <Button
                    onClick={() => setActiveStep("upload")}
                    className="mt-4"
                  >
                    Go to Upload
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <CardTitle>Manage Grades</CardTitle>
            </CardHeader>
            <CardContent>
              {mappingConfirmed &&
              excelData.currentSheet &&
              excelData.mapping ? (
                <div>
                  <div className="mb-6">
                    <SearchBar
                      ref={searchBarRef}
                      onSearch={handleSearch}
                      onSelectSuggestion={handleSelectSuggestion}
                      suggestions={getStudentSuggestions()}
                    />
                  </div>

                  {excelData.currentSheet.data &&
                  excelData.currentSheet.data.length > 0 ? (
                    <GradeTable
                      ref={gradeTableRef}
                      students={excelData.currentSheet.data}
                      mapping={excelData.mapping}
                      filteredStudents={filteredStudents}
                    />
                  ) : (
                    <div>
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold mb-2 text-blue-800">
                          Empty Sheet - Ready for Data Entry
                        </h4>
                        <p className="text-sm text-blue-700 mb-2">
                          Sheet "{excelData.currentSheet.name}" is empty. You
                          can start adding student data below.
                        </p>
                        <p className="text-xs text-blue-600">
                          Headers:{" "}
                          {excelData.headers.length > 0
                            ? excelData.headers.join(", ")
                            : "None"}
                        </p>
                        <p className="text-xs text-blue-600">
                          Mapping: ID="{excelData.mapping.id}", Name="
                          {excelData.mapping.name}", Grade="
                          {excelData.mapping.grade}"
                        </p>
                      </div>

                      <GradeTable
                        ref={gradeTableRef}
                        students={[]}
                        mapping={excelData.mapping}
                        filteredStudents={[]}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Please configure column mappings first to manage grades
                  </p>
                  <Button
                    onClick={() => setActiveStep("configure")}
                    className="mt-4"
                  >
                    Go to Configure
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center mt-12">
        <Button variant="outline" onClick={resetToUpload}>
          Start Over with New File
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              toast({
                title: "Keyboard Shortcuts",
                description: "Ctrl+O: Open file, Ctrl+S: Save, Ctrl+Z: Undo",
                variant: "default",
                duration: 5000,
              });
            }}
          >
            <HelpCircle size={16} className="mr-1" />
            Help
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              // Clear all localStorage
              localStorage.removeItem("gradeScribeExcelData");
              localStorage.removeItem("gradeScribeSearchTerm");
              localStorage.removeItem("gradeScribeFilteredStudents");
              localStorage.removeItem("gradeScribeMappingConfirmed");
              localStorage.removeItem("gradeScribeActiveStep");
              localStorage.removeItem("gradeScribeGrades");
              localStorage.removeItem("gradeScribeEditHistory");
              localStorage.removeItem("gradeScribeLastSaved");

              toast({
                title: "Session Cleared",
                description: "All saved session data has been cleared.",
                variant: "default",
              });

              // Reset to initial state
              resetToUpload();
            }}
          >
            Clear Session
          </Button>

          <Button
            disabled={!mappingConfirmed}
            onClick={() => {
              if (!excelData.currentSheet || !excelData.mapping) {
                toast({
                  title: "Error",
                  description:
                    "No data to export. Please upload and configure a sheet first.",
                  variant: "destructive",
                });
                return;
              }

              // Get grades from GradeTable ref if available
              let exportData;
              if (
                gradeTableRef.current &&
                gradeTableRef.current.getExportData
              ) {
                exportData = gradeTableRef.current.getExportData();
              } else {
                // Fallback: use currentSheet.data
                exportData = excelData.currentSheet.data || [];
              }

              // If there's no data, create a template with headers
              if (!exportData || exportData.length === 0) {
                console.log("Creating template data");
                console.log("Grade columns:", excelData.mapping.gradeColumns);

                const templateRow = {
                  [excelData.mapping.id]: "",
                  [excelData.mapping.name]: "",
                  [excelData.mapping.grade]: "",
                };

                // Add additional grade columns if they exist
                if (Array.isArray(excelData.mapping.gradeColumns)) {
                  excelData.mapping.gradeColumns.forEach((col) => {
                    if (col && col !== excelData.mapping.grade) {
                      templateRow[col] = "";
                    }
                  });
                }

                exportData = [templateRow];
                console.log("Template row created:", templateRow);
              }

              try {
                console.log("Export data:", exportData);
                console.log("Current sheet:", excelData.currentSheet.name);
                console.log("Mapping:", excelData.mapping);

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(
                  wb,
                  ws,
                  excelData.currentSheet.name || "Sheet1"
                );
                const timestamp = new Date()
                  .toISOString()
                  .replace(/[:.]/g, "-")
                  .slice(0, 19);
                const filename = `grades_export_${timestamp}.xlsx`;

                console.log("About to write file:", filename);
                XLSX.writeFile(wb, filename);

                toast({
                  title: "Export Successful",
                  description: `Data exported to ${filename}`,
                  variant: "default",
                });
              } catch (error) {
                console.error("Export error:", error);
                toast({
                  title: "Export Failed",
                  description: `Failed to export: ${
                    error.message || "Unknown error"
                  }`,
                  variant: "destructive",
                });
              }
            }}
          >
            <Save size={16} className="mr-1" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
