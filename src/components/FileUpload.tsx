
import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileSpreadsheet } from 'lucide-react';
import { error as logError } from '@/utils/logger';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Check if file is empty
      if (file.size <= 0) {
        logError('FileUpload', 'Empty file uploaded');
        toast({
          title: "Error",
          description: "The Excel file is empty. Please upload a valid file.",
          variant: "destructive"
        });
        return;
      }

      // Simulate progress for better UX
      simulateProgress();
      onFileUpload(file);
    } else {
      logError('FileUpload', `Invalid file type: ${fileExtension}`);
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive"
      });
    }
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 100);

    // Clear interval after completion or error
    setTimeout(() => {
      clearInterval(interval);
      setUploadProgress(100);
      // Reset after showing 100%
      setTimeout(() => setUploadProgress(0), 500);
    }, 1500);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  React.useEffect(() => {
    // Add keyboard shortcut (Ctrl+O) for opening file
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      className={`file-drop-area ${isDragging ? 'active animate-pulse-border' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <FileSpreadsheet className="w-16 h-16 mb-4 text-primary" />
        <h3 className="text-xl font-semibold mb-2">Upload Excel File</h3>
        <p className="text-muted-foreground mb-4">
          Drag and drop your Excel file here, or click to select
        </p>
        <Button 
          onClick={handleButtonClick}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Upload size={18} />
          Choose File
        </Button>
        <div className="text-xs text-muted-foreground mt-2">
          <span>Shortcut: Ctrl+O</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        {(isLoading || uploadProgress > 0) && (
          <div className="mt-4 w-full max-w-xs">
            <Progress value={uploadProgress} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoading ? "Processing..." : "Uploading..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
