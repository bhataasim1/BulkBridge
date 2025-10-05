"use client";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, File, Loader2, Upload, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type PresignResponse = {
  url: string[];
};

type CompleteUploadReq = {
  uploadId: string;
  key: string;
  parts: { ETag: string; PartNumber: number }[];
};

type ChunkStatus = {
  partNumber: number;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  size: number;
};

const CHUNK_SIZE = 5 * 1024 * 1024;

export default function UploadDropzone() {
  // const [overallProgress, setOverallProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [chunks, setChunks] = useState<ChunkStatus[]>([]);
  const [fileName, setFileName] = useState("");

  const uploadFile = async (file: File) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      }
    );
    if (!res.ok) throw new Error("Failed to initialize upload");
    return res.json();
  };

  const initUpload = useMutation({
    mutationFn: uploadFile,
    mutationKey: ["uploadFile"],
  });

  const getPresignedUrls = async ({
    uploadId,
    key,
    partsCount,
  }: {
    uploadId: string;
    key: string;
    partsCount: number;
  }): Promise<PresignResponse> => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generate-presigned-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, key, parts: partsCount }),
      }
    );

    if (!res.ok) throw new Error("Failed to get presigned URLs");
    return res.json();
  };

  const uploadPart = (
    url: string,
    blob: Blob,
    partNumber: number,
    onProgress: (percent: number) => void
  ) => {
    return new Promise<{ ETag: string; PartNumber: number }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            onProgress(percent);

            // Update chunk status
            setChunks((prev) =>
              prev.map((chunk) =>
                chunk.partNumber === partNumber
                  ? { ...chunk, progress: percent, status: "uploading" as const }
                  : chunk
              )
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const ETag = xhr.getResponseHeader("ETag");
            if (!ETag) {
              setChunks((prev) =>
                prev.map((chunk) =>
                  chunk.partNumber === partNumber
                    ? { ...chunk, status: "error" as const }
                    : chunk
                )
              );
              return reject(new Error("Missing ETag"));
            }

            // Mark chunk as completed
            setChunks((prev) =>
              prev.map((chunk) =>
                chunk.partNumber === partNumber
                  ? { ...chunk, progress: 100, status: "completed" as const }
                  : chunk
              )
            );

            resolve({ ETag: ETag.replaceAll('"', ""), PartNumber: partNumber });
          } else {
            setChunks((prev) =>
              prev.map((chunk) =>
                chunk.partNumber === partNumber
                  ? { ...chunk, status: "error" as const }
                  : chunk
              )
            );
            reject(new Error(`Upload part ${partNumber} failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          setChunks((prev) =>
            prev.map((chunk) =>
              chunk.partNumber === partNumber
                ? { ...chunk, status: "error" as const }
                : chunk
            )
          );
          reject(new Error(`Network error during part ${partNumber}`));
        };

        xhr.send(blob);
      }
    );
  };

  const completeUpload = async (req: CompleteUploadReq) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/complete-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }
    );
    if (!res.ok) throw new Error("Failed to complete upload");
    return res.json();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setFileName(file.name);
    setStatus("uploading");
    // setOverallProgress(0);

    // Initialize chunks
    const parts: Blob[] = [];
    const initialChunks: ChunkStatus[] = [];

    for (let start = 0; start < file.size; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      parts.push(blob);
      initialChunks.push({
        partNumber: initialChunks.length + 1,
        progress: 0,
        status: "pending",
        size: blob.size,
      });
    }

    setChunks(initialChunks);

    try {
      const init = await initUpload.mutateAsync(file);
      console.log("Upload initialized:", init);

      const presignData = await getPresignedUrls({
        uploadId: init.uploadId,
        key: init.key,
        partsCount: parts.length,
      });

      const urls = presignData.url
        .sort((a: any, b: any) => a.partNumber - b.partNumber)
        .map((p: any) => p.url);

      if (urls.length !== parts.length)
        throw new Error("Presigned URLs count does not match file chunks");

      const uploadPromises = parts.map((blob, index) => {
        return uploadPart(urls[index], blob, index + 1, () => {
        });
      });

      const uploadedParts = await Promise.all(uploadPromises);

      // setOverallProgress(100);

      await completeUpload({
        uploadId: init.uploadId,
        key: init.key,
        parts: uploadedParts,
      });

      setStatus("success");
      console.log("Upload complete!");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("error");
      // setOverallProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const completedChunks = chunks.filter((c) => c.status === "completed").length;
  const totalChunks = chunks.length;

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
          <h2 className="text-2xl font-bold text-white mb-1">File Upload</h2>
          <p className="text-indigo-100 text-sm">Multipart upload with real-time chunk tracking</p>
        </div>

        <div className="p-8">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer
              ${isDragActive
                ? "border-indigo-500 bg-indigo-50 scale-[1.02]"
                : status === "idle"
                  ? "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50"
                  : status === "error"
                    ? "border-red-400 bg-red-50"
                    : "border-green-400 bg-green-50"
              }
            `}
          >
            <input {...getInputProps()} />

            <div className={`p-4 rounded-full transition-all duration-300 ${isDragActive ? "bg-indigo-100 scale-110" : "bg-slate-100"
              }`}>
              {status === "idle" ? (
                <Upload className="w-10 h-10 text-indigo-600" />
              ) : status === "uploading" ? (
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              ) : (
                <XCircle className="w-10 h-10 text-red-600" />
              )}
            </div>

            <div className="text-center">
              <p className="font-semibold text-xl text-slate-800 mb-1">
                {status === "idle"
                  ? "Drop your file here"
                  : status === "uploading"
                    ? "Uploading..."
                    : status === "success"
                      ? "Upload Complete!"
                      : "Upload Failed"}
              </p>
              <p className="text-sm text-slate-500">
                {status === "idle"
                  ? "or click to browse • Files are split into 5MB chunks"
                  : fileName}
              </p>
            </div>

            {status === "uploading" && (
              <div className="w-full mt-4">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span className="font-medium">Overall Progress</span>
                  <span className="font-mono">{completedChunks}/{totalChunks} chunks</span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    style={{ width: `${(completedChunks / totalChunks) * 100}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chunks Grid */}
          {chunks.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <File className="w-5 h-5" />
                  Upload Chunks
                </h3>
                <span className="text-sm text-slate-500 font-mono">
                  {chunks.filter(c => c.status === "completed").length} / {chunks.length} completed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.partNumber}
                    className={`relative bg-white rounded-lg p-4 shadow-sm border-2 transition-all duration-300 ${chunk.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : chunk.status === "uploading"
                          ? "border-indigo-400 bg-indigo-50"
                          : chunk.status === "error"
                            ? "border-red-400 bg-red-50"
                            : "border-slate-200"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Chunk {chunk.partNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(chunk.size)}
                        </p>
                      </div>
                      <div>
                        {chunk.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : chunk.status === "uploading" ? (
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                        ) : chunk.status === "error" ? (
                          <XCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                    </div>

                    {/* Chunk Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${chunk.progress}%` }}
                          className={`h-full transition-all duration-300 ${chunk.status === "completed"
                              ? "bg-green-500"
                              : chunk.status === "uploading"
                                ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                                : chunk.status === "error"
                                  ? "bg-red-500"
                                  : "bg-slate-300"
                            }`}
                        />
                      </div>
                      {chunk.status === "uploading" && (
                        <p className="text-xs text-slate-500 font-mono text-right">
                          {Math.round(chunk.progress)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}