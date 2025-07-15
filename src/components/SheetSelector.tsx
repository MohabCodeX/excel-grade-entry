
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet } from '@/types';
import { normalizeArabicText } from '@/utils/arabicUtils';

interface SheetSelectorProps {
  sheets: Sheet[];
  currentSheet: Sheet | null;
  onSheetChange: (sheetName: string) => void;
}

const SheetSelector: React.FC<SheetSelectorProps> = ({ 
  sheets, 
  currentSheet, 
  onSheetChange 
}) => {
  // Normalize sheet names to handle Arabic text variants
  const getNormalizedName = (name: string): string => {
    return normalizeArabicText(name);
  };

  // Separate empty and non-empty sheets
  const nonEmptySheets = sheets.filter(sheet => sheet.data && sheet.data.length > 0);
  const emptySheets = sheets.filter(sheet => !sheet.data || sheet.data.length === 0);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold">Select Sheet:</h3>
        <span className="text-xs text-muted-foreground">
          ({sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'} total, {nonEmptySheets.length} with data)
        </span>
      </div>
      <Select
        value={currentSheet?.name}
        onValueChange={onSheetChange}
        disabled={sheets.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={sheets.length === 0 ? "No sheets available" : "Select a sheet"} />
        </SelectTrigger>
        <SelectContent>
          {nonEmptySheets.map((sheet) => (
            <SelectItem key={sheet.name} value={sheet.name}>
              {sheet.name}
            </SelectItem>
          ))}
          {emptySheets.map((sheet) => (
            <SelectItem key={sheet.name} value={sheet.name}>
              <div className="flex items-center gap-2">
                <span>{sheet.name}</span>
                <span className="text-xs text-muted-foreground">(empty)</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sheets.length === 0 && (
        <p className="text-sm text-destructive mt-2">
          ⚠️ This file contains no sheets. Please upload a different file.
        </p>
      )}
      {nonEmptySheets.length === 0 && sheets.length > 0 && (
        <p className="text-sm text-orange-600 mt-2">
          ⚠️ All sheets are empty, but you can still select them to view their structure.
        </p>
      )}
    </div>
  );
};

export default SheetSelector;
