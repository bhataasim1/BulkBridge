"use client";
import UploadDropzone from "../components/UploadDropzone";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-8">
      <div className="w-full max-w-5xl">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            BulkBridge
          </h1>
          <p className="text-indigo-200 text-lg">
            Test your multipart S3 uploads with presigned URLs
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-sm text-indigo-100">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Server: <span className="font-mono">{process.env.NEXT_PUBLIC_API_BASE_URL}</span>
          </div>
        </header>

        <main>
          <UploadDropzone />
          
          <div className="mt-8 text-center">
            <div className="inline-flex flex-col gap-2 px-6 py-4 bg-white/5 backdrop-blur rounded-xl border border-white/10">
              <p className="text-sm font-medium text-indigo-200">How it works</p>
              <ul className="text-xs text-indigo-300 space-y-1 text-left">
                <li>• Files are split into 5MB chunks for parallel upload</li>
                <li>• Each chunk is uploaded independently to S3</li>
                <li>• Watch real-time progress for each chunk</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}