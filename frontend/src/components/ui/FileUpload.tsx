import React, { useRef, useState } from "react";
import { UploadCloud, X, FileText } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  id?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = ".xlsx, .xls, .pdf, image/*",
  maxSizeMB = 10,
  label = "Upload file",
  id,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size exceeds limit of ${maxSizeMB}MB.`);
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelect(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
          dragActive
            ? "border-primary-500 bg-primary-50/20 dark:bg-primary-950/10"
            : selectedFile
              ? "border-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/5"
              : "border-slate-300 dark:border-slate-800 hover:border-primary-400 dark:hover:border-slate-700"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        id={id}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
        />

        {selectedFile ? (
          <div className="flex items-center justify-between w-full p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="p-1 text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/20 rounded-md transition-colors"
              id={`${id}-remove-btn`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Drag & drop file or{" "}
              <span className="text-primary-600 dark:text-primary-400">
                browse
              </span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Supports {accept.replace(/\./g, "").toUpperCase()} (Max{" "}
              {maxSizeMB}MB)
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-danger-500 mt-1.5 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
