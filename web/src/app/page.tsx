'use client';

import { useState } from 'react';
import './style.css';

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

type TestResponse = {
  success: boolean;
  output?: string;
  used?: string;
  summary?: {
    total: number;
    passed: number;
    failed: number;
  };
  results?: {
    name: string;
    pass: boolean;
    stdout?: string;
    expected?: string;
  }[];
  error?: string;
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [assignmentId, setAssignmentId] = useState('hw1');
  const [studentId, setStudentId] = useState('anon');
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUpload(null);
    setResult(null);
    if (!file) return setError('Please choose a .java file.');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('assignmentId', assignmentId);
    fd.append('studentId', studentId);

    try {
      setBusy(true);
      const res = await fetch(`/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setUpload(json);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const runJUnit = async () => {
    if (!upload?.file?.relativePath) return setError('No uploaded file to test.');
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/test/by-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: upload.file.relativePath }),
      });
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const runFunctional = async () => {
    setError(''); setRunning(true); setResult(null);
    try {
      const payload: any = { assignmentId, studentId };
      if (upload?.file?.relativePath) {
        payload.relativePath = upload.file.relativePath;
      }
      const res = await fetch('/api/functional/run', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setResult(json);
    } catch (e:any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };


  return (
    <main className="min-h-screen bg-brand-beige/50">
      <div className="max-w-3xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-brand-ink">
            JTest — <span className="text-brand-terracotta">Student Dashboard</span>
          </h1>
          <p className="text-brand-soft mt-1">
            Upload Java, run instructor unit tests or functional stdin/stdout tests.
          </p>
        </header>

        <section className="section">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span>Assignment ID</span>
                <input
                  className="field mt-1"
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                  disabled={busy || running}
                />
              </label>
              <label className="block">
                <span>Student ID</span>
                <input
                  className="field mt-1"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={busy || running}
                />
              </label>
            </div>

            <label className="block">
              <span>.java file</span>
              <input
                type="file"
                accept=".java"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="field mt-1"
                disabled={busy || running}
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="submit" disabled={busy || running} className="btn btn-primary">
                {busy ? 'Uploading…' : 'Upload'}
              </button>

              <button
                type="button"
                onClick={runJUnit}
                disabled={!upload?.file?.relativePath || running}
                className="btn btn-blue"
              >
                {running ? 'Running…' : 'Run JUnit Tests'}
              </button>

              <button
                type="button"
                onClick={runFunctional}
                disabled={running}
                className="btn btn-good"
              >
                {running ? 'Running…' : 'Run Functional Tests'}
              </button>
            </div>
          </form>

          {error && <div className="alert alert-error mt-4">{error}</div>}

          {upload && (
            <div className="alert alert-ok mt-4">
              <div className="font-medium">Upload successful</div>
              <div className="text-brand-ink/80">
                Saved as{' '}
                <code className="font-mono text-xs">{upload.file.relativePath}</code>
              </div>
            </div>
          )}
        </section>

        {result && (
          <section className="section mt-6">
            <div className="flex items-center justify-between border-b border-brand-line pb-2">
              <div className="font-medium text-brand-ink">Test Results</div>
              {result.success ? (
                <span className="badge-pass">PASS</span>
              ) : (
                <span className="badge-fail">FAIL</span>
              )}
            </div>
            <pre className="mt-3 p-3 rounded-lg bg-brand-beige/60 text-sm text-brand-ink overflow-auto whitespace-pre-wrap">
              {result.summary ? JSON.stringify(result.summary, null, 2) : null}
              {result.results ? '\n\n' + JSON.stringify(result.results, null, 2) : null}
              {result.output ? result.output : null}
              {result.error ? `Error: ${result.error}` : null}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}