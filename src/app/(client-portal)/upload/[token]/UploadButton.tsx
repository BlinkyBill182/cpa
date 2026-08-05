"use client";

import { useRef, useState } from "react";

type ValidationError = { field: string; message: string };

type AIResult = {
  formType?: string | null;
  formYear?: number | null;
  isValid?: boolean;
  confidence?: number;
  errors?: ValidationError[];
  warnings?: ValidationError[];
} | null;

type UploadedFile = {
  id: string;
  original_filename: string;
  file_size_kb: number | null;
  uploaded_at: string;
  upload_status: "in_drive" | "failed";
  ai_status: "pending" | "valid" | "invalid";
  ai_notes: string | null;
  ai_result: AIResult;
};

type Props = {
  clientYearDocumentId: string;
  token: string;
  allowedFormats: string[]; // e.g. ['pdf', 'jpg', 'png']
  initialUploads: UploadedFile[];
};

// Map format names → file extensions for the <input accept> attribute
const FORMAT_TO_EXT: Record<string, string> = {
  pdf: ".pdf",
  jpg: ".jpg,.jpeg",
  jpeg: ".jpg,.jpeg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
  xlsx: ".xlsx",
  xls: ".xls",
  docx: ".docx",
  doc: ".doc",
  csv: ".csv",
  zip: ".zip",
};

function formatsToAccept(formats: string[]): string {
  if (formats.length === 0) return "*";
  const exts = [...new Set(formats.flatMap((f) => (FORMAT_TO_EXT[f.toLowerCase()] ?? `.${f}`).split(",")))];
  return exts.join(",");
}

function formatBytes(kb: number | null): string {
  if (kb === null) return "";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function UploadButton({ clientYearDocumentId, token, allowedFormats, initialUploads }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>(initialUploads);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = formatsToAccept(allowedFormats);

  async function handleFiles(files: FileList) {
    setError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clientYearDocumentId", clientYearDocumentId);
      fd.append("token", token);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "שגיאה בהעלאה");
        setUploading(false);
        return;
      }

      setUploads((prev) => [json.file as UploadedFile, ...prev]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Existing uploads */}
              {uploads.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {uploads.map((u) => {
                    const result = u.ai_result;
                    const errors: ValidationError[] = result?.errors ?? [];
                    const warnings: ValidationError[] = result?.warnings ?? [];
                    const formLabel = result?.formType
                      ? `${result.formType}${result.formYear ? ` (${result.formYear})` : ""}`
                      : null;

                    return (
                      <li key={u.id} className="flex flex-col gap-1">
                        {/* File row */}
                        <div
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                            u.ai_status === "invalid"
                              ? "bg-red-50 text-red-800"
                              : u.ai_status === "valid"
                                ? "bg-green-50 text-green-800"
                                : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          <span className="leading-none">
                            {u.ai_status === "valid" ? "✓" : u.ai_status === "invalid" ? "⚠️" : "⏳"}
                          </span>
                          <span className="flex-1 truncate font-medium">{u.original_filename}</span>
                          {formLabel && (
                            <span className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold">
                              {formLabel}
                            </span>
                          )}
                          {u.file_size_kb !== null && (
                            <span className="shrink-0 opacity-70">{formatBytes(u.file_size_kb)}</span>
                          )}
                        </div>

                        {/* Errors */}
                        {errors.length > 0 && (
                          <ul className="flex flex-col gap-0.5 px-1">
                            {errors.map((e, i) => (
                              <li key={i} className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                                <span className="shrink-0 font-bold">✗</span>
                                <span><span className="font-semibold">{e.field}:</span> {e.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Warnings */}
                        {warnings.length > 0 && (
                          <ul className="flex flex-col gap-0.5 px-1">
                            {warnings.map((w, i) => (
                              <li key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                                <span className="shrink-0">⚠</span>
                                <span><span className="font-semibold">{w.field}:</span> {w.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Fallback: plain notes when no structured result */}
                        {!result && u.ai_status === "invalid" && u.ai_notes && (
                          <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-700">
                            {u.ai_notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

      {/* Error message */}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
      )}

      {/* Upload trigger */}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-600 active:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <span>מעלה...</span>
          </>
        ) : (
          <>
            <span className="text-base leading-none">📎</span>
            <span>{uploads.length > 0 ? "הוסף קובץ נוסף" : "בחר קובץ להעלאה"}</span>
          </>
        )}
      </button>

      {allowedFormats.length > 0 && (
        <p className="text-center text-xs text-gray-400">
          פורמטים מותרים: {allowedFormats.join(", ")} · עד 10MB
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
