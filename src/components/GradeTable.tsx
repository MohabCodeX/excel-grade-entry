import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { GradeEntryMethod, HeaderMapping, Student } from "@/types";
import { sortArabicText } from "@/utils/arabicUtils";
import { error as logError } from "@/utils/logger";
import React, { useEffect, useState } from "react";

interface GradeTableProps {
  students: Student[];
  mapping: HeaderMapping;
  filteredStudents: Student[];
}

type GradeTableRefType = {
  focusGradeInput: (studentId: string) => void;
};

interface EditHistoryEntry {
  studentId: string;
  column: string;
  oldValue: string | number;
  newValue: string | number;
  timestamp: Date;
  studentName?: string;
}

const GradeTable = React.forwardRef<any, GradeTableProps>(
  ({ students, mapping, filteredStudents }, ref) => {
    const [grades, setGrades] = useState<
      Record<string, Record<string, string | number>>
    >({});
    const [entryMethod, setEntryMethod] = useState<GradeEntryMethod>({
      id: "prefix",
      name: "Prefix Match",
    });
    const [editingCell, setEditingCell] = useState<{
      studentId: string;
      column: string;
    } | null>(null);
    const [tempGrade, setTempGrade] = useState<string>("");
    const [previousValues, setPreviousValues] = useState<
      Record<string, Record<string, string | number>>
    >({});
    const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
    const [showUndoHistory, setShowUndoHistory] = useState<boolean>(false);
    const { toast } = useToast();

    const entryMethods: GradeEntryMethod[] = [
      { id: "prefix", name: "Prefix Match" },
      { id: "suggest", name: "Auto-suggest" },
      { id: "alpha", name: "Alphabetical" },
    ];

    // Get all grade columns (primary + additional)
    const getAllGradeColumns = (): string[] => {
      const columns = [mapping.grade];
      if (Array.isArray(mapping.gradeColumns)) {
        columns.push(...mapping.gradeColumns);
      }
      return columns.filter(Boolean);
    };

    // Initialize grades from the students data
    useEffect(() => {
      const initialGrades: Record<string, Record<string, string | number>> = {};

      students.forEach((student) => {
        const studentId = student[mapping.id];
        initialGrades[studentId] = {};

        // Add primary grade column
        if (mapping.grade && student[mapping.grade] !== undefined) {
          initialGrades[studentId][mapping.grade] = student[mapping.grade];
        }

        // Add additional grade columns
        if (Array.isArray(mapping.gradeColumns)) {
          mapping.gradeColumns.forEach((column) => {
            if (column && student[column] !== undefined) {
              initialGrades[studentId][column] = student[column];
            }
          });
        }
      });

      // Load saved grades from localStorage
      const savedGrades = localStorage.getItem("gradeScribeGrades");
      if (savedGrades) {
        try {
          const parsedGrades = JSON.parse(savedGrades);
          // Merge saved grades with initial grades
          Object.keys(parsedGrades).forEach((studentId) => {
            if (initialGrades[studentId]) {
              initialGrades[studentId] = {
                ...initialGrades[studentId],
                ...parsedGrades[studentId],
              };
            }
          });
        } catch (error) {
          console.error("Error parsing saved grades:", error);
        }
      }

      setGrades(initialGrades);
    }, [students, mapping]);

    // Save grades to localStorage whenever grades change
    useEffect(() => {
      if (Object.keys(grades).length > 0) {
        localStorage.setItem("gradeScribeGrades", JSON.stringify(grades));
      }
    }, [grades]);

    // Load edit history from localStorage
    useEffect(() => {
      const savedHistory = localStorage.getItem("gradeScribeEditHistory");
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory);
          // Convert timestamp strings back to Date objects
          const historyWithDates = parsedHistory.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
          setEditHistory(historyWithDates);
          setCurrentHistoryIndex(historyWithDates.length - 1);
        } catch (error) {
          console.error("Error parsing saved edit history:", error);
        }
      }
    }, []);

    // Save edit history to localStorage whenever it changes
    useEffect(() => {
      if (editHistory.length > 0) {
        localStorage.setItem(
          "gradeScribeEditHistory",
          JSON.stringify(editHistory)
        );
      }
    }, [editHistory]);

    const handleGradeChange = (value: string) => {
      setTempGrade(value);
    };

    const addToEditHistory = (
      studentId: string,
      column: string,
      oldValue: string | number,
      newValue: string | number
    ) => {
      const student = students.find((s) => s[mapping.id] === studentId);
      const studentName = student ? student[mapping.name] : "Unknown";

      const newEntry: EditHistoryEntry = {
        studentId,
        column,
        oldValue,
        newValue,
        timestamp: new Date(),
        studentName,
      };

      setEditHistory((prev) => {
        // If we're not at the end of history (user has undone some actions),
        // remove everything after current index
        const newHistory = prev.slice(0, currentHistoryIndex + 1);
        newHistory.push(newEntry);

        // Limit history to last 50 entries to prevent memory issues
        if (newHistory.length > 50) {
          return newHistory.slice(-50);
        }

        return newHistory;
      });

      setCurrentHistoryIndex((prev) => {
        const newIndex = Math.min(prev + 1, editHistory.length);
        return newIndex;
      });
    };

    const startEditing = (studentId: string, column: string) => {
      // Save previous value for potential undo
      setPreviousValues((prev) => {
        const newPrev = { ...prev };
        if (!newPrev[studentId]) {
          newPrev[studentId] = {};
        }
        newPrev[studentId] = {
          ...newPrev[studentId],
          [column]: grades[studentId]?.[column] || "",
        };
        return newPrev;
      });

      setEditingCell({ studentId, column });
      setTempGrade(grades[studentId]?.[column]?.toString() || "");
    };

    const validateGrade = (value: string): boolean => {
      // Empty is valid (can clear a grade)
      if (value === "") return true;

      // Check if it's a valid number
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return false;

      // Optional: Add range validation if needed
      // if (numValue < 0 || numValue > 100) return false;

      return true;
    };

    const saveGrade = (studentId: string, column: string) => {
      // Validate grade
      if (!validateGrade(tempGrade)) {
        toast({
          title: "Invalid Grade",
          description: "Please enter a valid number for the grade",
          variant: "destructive",
        });
        return;
      }

      try {
        const oldValue = grades[studentId]?.[column] || "";
        const newValue = tempGrade === "" ? "" : parseFloat(tempGrade);

        // Don't save if no change
        if (oldValue === newValue) {
          setEditingCell(null);
          return;
        }

        // Add to edit history
        addToEditHistory(studentId, column, oldValue, newValue);

        // Update grade
        setGrades((prev) => {
          const newGrades = { ...prev };
          if (!newGrades[studentId]) {
            newGrades[studentId] = {};
          }
          newGrades[studentId] = {
            ...newGrades[studentId],
            [column]: newValue,
          };
          return newGrades;
        });

        setEditingCell(null);

        toast({
          title: "Grade Updated",
          description: "The grade has been saved successfully",
          variant: "default",
        });
      } catch (error) {
        logError("GradeTable", "Error saving grade", error);
        toast({
          title: "Error",
          description: "Failed to save the grade. Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleUndo = () => {
      if (currentHistoryIndex >= 0) {
        const entry = editHistory[currentHistoryIndex];
        const { studentId, column, oldValue } = entry;

        setGrades((prev) => {
          const newGrades = { ...prev };
          if (!newGrades[studentId]) {
            newGrades[studentId] = {};
          }
          newGrades[studentId] = {
            ...newGrades[studentId],
            [column]: oldValue,
          };
          return newGrades;
        });

        setCurrentHistoryIndex((prev) => (prev > 0 ? prev - 1 : -1));
        setShowUndoHistory(false);

        toast({
          title: "Undo",
          description: `Restored "${oldValue}" for column "${column}" of student "${entry.studentName}"`,
          variant: "default",
        });
      } else {
        toast({
          title: "Undo",
          description: "No more actions to undo",
          variant: "default",
        });
      }
    };

    const handleRedo = () => {
      if (currentHistoryIndex < editHistory.length - 1) {
        const entry = editHistory[currentHistoryIndex + 1];
        const { studentId, column, newValue } = entry;

        setGrades((prev) => {
          const newGrades = { ...prev };
          if (!newGrades[studentId]) {
            newGrades[studentId] = {};
          }
          newGrades[studentId] = {
            ...newGrades[studentId],
            [column]: newValue,
          };
          return newGrades;
        });

        setCurrentHistoryIndex((prev) =>
          Math.min(prev + 1, editHistory.length - 1)
        );
        setShowUndoHistory(false);

        toast({
          title: "Redo",
          description: `Re-applied change to column "${column}" for student "${entry.studentName}"`,
          variant: "default",
        });
      } else {
        toast({
          title: "Redo",
          description: "No more actions to redo",
          variant: "default",
        });
      }
    };

    const jumpToHistoryPoint = (index: number) => {
      // Apply all changes from beginning to the target index
      const targetGrades = { ...grades };

      // First, reset to initial state (from students data)
      students.forEach((student) => {
        const studentId = student[mapping.id];
        if (!targetGrades[studentId]) targetGrades[studentId] = {};

        getAllGradeColumns().forEach((column) => {
          targetGrades[studentId][column] = student[column] || "";
        });
      });

      // Then apply all changes up to the target index
      for (let i = 0; i <= index; i++) {
        const entry = editHistory[i];
        if (!targetGrades[entry.studentId]) targetGrades[entry.studentId] = {};
        targetGrades[entry.studentId][entry.column] = entry.newValue;
      }

      setGrades(targetGrades);
      setCurrentHistoryIndex(index);
      setShowUndoHistory(false);

      toast({
        title: "History Jump",
        description: `Jumped to history point ${index + 1}`,
        variant: "default",
      });
    };

    const clearHistory = () => {
      setEditHistory([]);
      setCurrentHistoryIndex(-1);
      setShowUndoHistory(false);
      localStorage.removeItem("gradeScribeEditHistory");

      toast({
        title: "History Cleared",
        description: "All edit history has been cleared",
        variant: "default",
      });
    };

    const toggleUndoHistory = () => setShowUndoHistory((prev) => !prev);
    const handleKeyDown = (
      e: React.KeyboardEvent,
      studentId: string,
      column: string
    ) => {
      if (e.key === "Enter") {
        saveGrade(studentId, column);
      } else if (e.key === "Escape") {
        setEditingCell(null);
      } else if (e.key === "Tab") {
        // Prevent default tab behavior
        e.preventDefault();

        // Save current value
        saveGrade(studentId, column);

        // Find next cell to edit
        const displayedStudents = getDisplayedStudents();
        const currentColumnIndex = gradeColumns.indexOf(column);

        // If not the last column in this row
        if (currentColumnIndex < gradeColumns.length - 1) {
          // Move to next column in same row
          const nextColumn = gradeColumns[currentColumnIndex + 1];
          startEditing(studentId, nextColumn);
        } else {
          // Move to first column of next row
          const currentStudentIndex = displayedStudents.findIndex(
            (s) => s[mapping.id] === studentId
          );
          if (currentStudentIndex < displayedStudents.length - 1) {
            const nextStudent = displayedStudents[currentStudentIndex + 1];
            const firstGradeColumn = gradeColumns[0];
            startEditing(nextStudent[mapping.id], firstGradeColumn);
          }
        }
      }
    };

    // For alphabetical entry mode
    const getNextStudentByAlpha = (currentId: string): string | null => {
      // Sort students alphabetically
      const sortedStudents = [...students].sort((a, b) =>
        sortArabicText([a[mapping.name], b[mapping.name]])[0] ===
        a[mapping.name]
          ? -1
          : 1
      );

      const currentIndex = sortedStudents.findIndex(
        (s) => s[mapping.id] === currentId
      );
      if (currentIndex !== -1 && currentIndex < sortedStudents.length - 1) {
        return sortedStudents[currentIndex + 1][mapping.id];
      }
      return null;
    };

    // For prefix entry mode
    const handlePrefixEntry = (value: string) => {
      // When the user types in a prefix mode field, we don't immediately save it
      // We just update the temp grade
      setTempGrade(value);
    };

    const getDisplayedStudents = () => {
      return filteredStudents.length > 0 ? filteredStudents : students;
    };

    // Handle keyboard shortcuts for undo/redo
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          if (editingCell) {
            // If editing, revert to the previous value for the current editing cell
            const { studentId, column } = editingCell;
            if (previousValues[studentId]?.[column] !== undefined) {
              setTempGrade(previousValues[studentId][column].toString() || "");
            }
          } else {
            // If not editing, perform global undo
            handleUndo();
          }
        }
        // Ctrl+Y or Ctrl+Shift+Z for redo
        else if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === "y" || (e.key === "z" && e.shiftKey))
        ) {
          e.preventDefault();
          if (!editingCell) {
            handleRedo();
          }
        }
        // Ctrl+H for history
        else if ((e.ctrlKey || e.metaKey) && e.key === "h") {
          e.preventDefault();
          toggleUndoHistory();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [editingCell, previousValues, currentHistoryIndex, editHistory]);

    // Expose focusGradeInput and getExportData methods via ref
    React.useImperativeHandle(ref, () => ({
      focusGradeInput: (studentId: string) => {
        const gradeColumns = getAllGradeColumns();
        const primaryGradeColumn = gradeColumns[0];
        if (primaryGradeColumn) {
          startEditing(studentId, primaryGradeColumn);
        }
      },
      getExportData: () => {
        // Create export data with only the grade table columns
        const exportData = [];
        const gradeColumns = getAllGradeColumns();

        // If we have students with data, export their current state
        if (students.length > 0) {
          students.forEach((student) => {
            const studentId = student[mapping.id];
            const exportRow: any = {
              [mapping.id]: student[mapping.id],
              [mapping.name]: student[mapping.name],
            };

            // Add grade columns with current values from the grades state
            gradeColumns.forEach((column) => {
              exportRow[column] =
                grades[studentId]?.[column] || student[column] || "";
            });

            exportData.push(exportRow);
          });
        } else {
          // If no students data, create a template row with headers
          const templateRow: any = {
            [mapping.id]: "",
            [mapping.name]: "",
          };

          gradeColumns.forEach((column) => {
            templateRow[column] = "";
          });

          exportData.push(templateRow);
        }

        return exportData;
      },
    }));

    // Get all grade columns to display
    const gradeColumns = getAllGradeColumns();

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Student Grades</h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Tab</kbd>
              <span>Next field</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Enter</kbd>
              <span>Save</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Esc</kbd>
              <span>Cancel</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Ctrl+Z</kbd>
              <span>Undo</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Ctrl+Y</kbd>
              <span>Redo</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">Ctrl+H</kbd>
              <span>History</span>
              <span className="mx-1">|</span>
              <kbd className="px-1.5 py-0.5 text-xs border rounded">F2</kbd>
              <span>Search</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Entry Method:</span>
              <Select
                value={entryMethod.id}
                onValueChange={(value: "prefix" | "suggest" | "alpha") => {
                  const method = entryMethods.find((m) => m.id === value);
                  if (method) setEntryMethod(method);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {entryMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Edit History Panel */}
        {showUndoHistory && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Edit History</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  disabled={editHistory.length === 0}
                >
                  Clear History
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleUndoHistory}>
                  ✕
                </Button>
              </div>
            </div>

            {editHistory.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {editHistory.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm cursor-pointer hover:bg-gray-200 ${
                      index <= currentHistoryIndex ? "bg-blue-100" : "bg-white"
                    }`}
                    onClick={() => jumpToHistoryPoint(index)}
                    title="Click to jump to this point in history"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{entry.studentName}</span>
                        <span className="text-gray-600 ml-2">
                          {entry.column}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {entry.oldValue} → {entry.newValue}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No edit history available.
              </p>
            )}
          </div>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mapping.id}</TableHead>
                <TableHead className="text-right">{mapping.name}</TableHead>
                {gradeColumns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getDisplayedStudents().length > 0 ? (
                getDisplayedStudents().map((student) => (
                  <TableRow key={student[mapping.id]}>
                    <TableCell className="font-medium">
                      {student[mapping.id]}
                    </TableCell>
                    <TableCell className="text-right" dir="rtl">
                      {student[mapping.name]}
                    </TableCell>

                    {gradeColumns.map((column) => (
                      <TableCell key={column}>
                        {editingCell &&
                        editingCell.studentId === student[mapping.id] &&
                        editingCell.column === column ? (
                          <Input
                            value={tempGrade}
                            onChange={(e) => handleGradeChange(e.target.value)}
                            onKeyDown={(e) =>
                              handleKeyDown(e, student[mapping.id], column)
                            }
                            onBlur={() =>
                              saveGrade(student[mapping.id], column)
                            }
                            autoFocus
                            className="w-20"
                            aria-label="Grade input"
                            // Prevent normal tab navigation
                            tabIndex={-1}
                          />
                        ) : (
                          <span
                            className="tabular-nums cursor-pointer hover:bg-muted px-2 py-1 rounded"
                            onClick={() =>
                              startEditing(student[mapping.id], column)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                startEditing(student[mapping.id], column);
                              }
                            }}
                          >
                            {grades[student[mapping.id]]?.[column] || "-"}
                          </span>
                        )}
                      </TableCell>
                    ))}

                    <TableCell>
                      <div className="flex space-x-1">
                        {/* Show undo/redo buttons only for first student to avoid clutter */}
                        {student[mapping.id] ===
                          getDisplayedStudents()[0]?.[mapping.id] && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleUndo}
                              disabled={currentHistoryIndex < 0}
                              title="Undo last change (Ctrl+Z)"
                            >
                              ↶
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRedo}
                              disabled={
                                currentHistoryIndex >= editHistory.length - 1
                              }
                              title="Redo last change (Ctrl+Y)"
                            >
                              ↷
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleUndoHistory}
                              title="Show edit history"
                            >
                              📜
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3 + gradeColumns.length}
                    className="text-center py-8"
                  >
                    <div className="text-muted-foreground">
                      <p className="mb-2">
                        No students found. This sheet is empty.
                      </p>
                      <p className="text-sm">
                        You can add student data to this sheet in your Excel
                        file and re-upload,
                      </p>
                      <p className="text-sm">
                        or use another sheet that contains student data.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
);

export default GradeTable;
