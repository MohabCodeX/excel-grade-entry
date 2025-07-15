import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeaderMapping as HeaderMappingType } from "@/types";
import { Plus, X } from "lucide-react";
import React, { useState } from "react";

interface HeaderMappingProps {
  headers: string[];
  mapping: HeaderMappingType;
  onMappingChange: (
    field: keyof HeaderMappingType,
    value: string | string[]
  ) => void;
  onConfirm: () => void;
}

const HeaderMapping: React.FC<HeaderMappingProps> = ({
  headers,
  mapping,
  onMappingChange,
  onConfirm,
}) => {
  const isComplete = mapping.id && mapping.name && mapping.grade;
  const [additionalGradeColumns, setAdditionalGradeColumns] = useState<
    string[]
  >(Array.isArray(mapping.gradeColumns) ? mapping.gradeColumns : []);

  const handleAddGradeColumn = () => {
    // Find a header that's not already been used
    const usedHeaders = [
      mapping.id,
      mapping.name,
      mapping.grade,
      ...additionalGradeColumns,
    ];
    const availableHeaders = headers.filter(
      (header) => !usedHeaders.includes(header)
    );

    if (availableHeaders.length > 0) {
      const newColumn = availableHeaders[0];
      const updatedColumns = [...additionalGradeColumns, newColumn];
      setAdditionalGradeColumns(updatedColumns);
      onMappingChange("gradeColumns", updatedColumns);
    }
  };

  const handleRemoveGradeColumn = (index: number) => {
    const updatedColumns = additionalGradeColumns.filter((_, i) => i !== index);
    setAdditionalGradeColumns(updatedColumns);
    onMappingChange("gradeColumns", updatedColumns);
  };

  const handleGradeColumnChange = (index: number, value: string) => {
    const updatedColumns = [...additionalGradeColumns];
    updatedColumns[index] = value;
    setAdditionalGradeColumns(updatedColumns);
    onMappingChange("gradeColumns", updatedColumns);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configure Column Mappings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Student ID Column
              </label>
              <Select
                value={mapping.id}
                onValueChange={(value) => onMappingChange("id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ID column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Student Name Column
              </label>
              <Select
                value={mapping.name}
                onValueChange={(value) => onMappingChange("name", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select name column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Primary Grade Column
              </label>
              <Select
                value={mapping.grade}
                onValueChange={(value) => onMappingChange("grade", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Grade Columns */}
          <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">
                Additional Grade Columns
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGradeColumn}
                className="flex items-center gap-1"
                disabled={
                  headers.length <= 3 + additionalGradeColumns.length // Disable if no more headers available
                }
              >
                <Plus size={16} />
                Add Column
              </Button>
            </div>

            {additionalGradeColumns.length > 0 ? (
              <div className="space-y-2">
                {additionalGradeColumns.map((column, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select
                        value={column}
                        onValueChange={(value) =>
                          handleGradeColumnChange(index, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers
                            .filter(
                              (header) =>
                                header === column ||
                                ![
                                  mapping.id,
                                  mapping.name,
                                  mapping.grade,
                                  ...additionalGradeColumns.filter(
                                    (_, i) => i !== index
                                  ),
                                ].includes(header)
                            )
                            .map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveGradeColumn(index)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Click "Add Column" to add more grade columns
              </p>
            )}
          </div>

          <Button
            className="w-full mt-4"
            disabled={!isComplete}
            onClick={onConfirm}
          >
            Confirm Mapping
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HeaderMapping;
