'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type UploadResponse = {
  message: string;
  file: {
    originalName: string;
    savedAs: string;
    relativePath: string;
    bytes: number;
    assignmentId: string;
    studentId: string;
  };
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [assignmentId, setAssignmentId] = useState('hw1');
  const [studentId, setStudentId] = useState('giao.bui');
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError('');

    if (!file) return setError('Please choose a .java file.');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('assignmentId', assignmentId);
    fd.append('studentId', studentId);

    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setResult(json as UploadResponse);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">JTest — Upload Java File</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-gray-700">Assignment ID</span>
              <input
                className="mt-1 w-full border rounded-lg p-2"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Student ID</span>
              <input
                className="mt-1 w-full border rounded-lg p-2"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-gray-700">.java file</span>
            <input
              type="file"
              accept=".java"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full border rounded-lg p-2"
            />
          </label>

          <button type="submit" className="w-full rounded-xl bg-black text-white py-2 hover:opacity-90">
            Upload
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-600 border border-red-200 rounded-lg p-3 bg-red-50">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 text-sm border rounded-lg p-3 bg-green-50 border-green-200">
            <div className="font-medium text-green-700 mb-1">Upload successful</div>
            <pre className="whitespace-pre-wrap text-gray-800">
{JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}