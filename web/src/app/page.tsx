'use client';
import './style.css';
import { useState } from 'react';

type UploadResponse = {
  message: string;
  file: { originalName: string; savedAs: string; relativePath: string; bytes: number; assignmentId: string; studentId: string; };
};
type TestResponse = { success: boolean; output: string; used?: string };

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [assignmentId, setAssignmentId] = useState('hw1');
  const [studentId, setStudentId] = useState('giao.bui');
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [error, setError] = useState(''); const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setUpload(null); setResult(null);
    if (!file) return setError('Please choose a .java file.');
    const fd = new FormData();
    fd.append('file', file); fd.append('assignmentId', assignmentId); fd.append('studentId', studentId);
    try {
      setBusy(true);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      setUpload(json as UploadResponse);
    } catch (err: any) { setError(err.message ?? String(err)); }
    finally { setBusy(false); }
  };

  const run = async (path?: string) => {
    try {
      setError(''); setRunning(true); setResult(null);
      const url = path ? '/api/test/by-path' : '/api/test/latest';
      const body = path ? { relativePath: path } : { assignmentId, studentId };
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = (await res.json()) as TestResponse & { used?: string };
      setResult(json);
    } catch (e:any) { setError(e?.message ?? String(e)); }
    finally { setRunning(false); }
  };

  return (
    <main className="min-h-screen bg-brand-beige/50">
      <div className="max-w-3xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-brand-ink">
            <span className="align-middle">JTest</span>
            <span className="ml-3 rounded-full px-2 py-1 text-xs font-semibold text-white" style={{background:'#D97D55'}}>Student</span>
          </h1>
          <p className="text-brand-soft mt-1">Upload Java, run instructor tests, get instant feedback.</p>
        </header>

        <section className="section">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span>Assignment ID</span>
                <input className="field mt-1" value={assignmentId} onChange={(e)=>setAssignmentId(e.target.value)} disabled={busy || running}/>
              </label>
              <label className="block">
                <span>Student ID</span>
                <input className="field mt-1" value={studentId} onChange={(e)=>setStudentId(e.target.value)} disabled={busy || running}/>
              </label>
            </div>

            <label className="block">
              <span>.java file</span>
              <input type="file" accept=".java"
                onChange={(e)=>setFile(e.target.files?.[0] ?? null)}
                className="field mt-1 file:mr-4 file:rounded file:border-0 file:bg-brand-terracotta file:text-white file:px-3 file:py-2 file:hover:opacity-95"
                disabled={busy || running}/>
            </label>

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="submit" disabled={busy || running} className="btn btn-primary">
                {busy ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" onClick={()=>upload && run(upload.file.relativePath)}
                disabled={!upload?.file?.relativePath || running}
                className="btn btn-good text-brand-ink">
                {running ? 'Running…' : 'Run Tests (uploaded)'}
              </button>
              <button type="button" onClick={()=>run()}
                disabled={running} className="btn btn-blue">
                {running ? 'Running…' : 'Run Latest'}
              </button>
            </div>
          </form>

          {error && <div className="alert alert-error mt-4">{error}</div>}

          {upload && (
            <div className="alert alert-ok mt-4">
              <div className="font-medium">Upload successful</div>
              <div className="text-brand-ink/80">Saved as <code className="font-mono text-xs">{upload.file.relativePath}</code></div>
            </div>
          )}
        </section>

        {result && (
          <section className="section mt-6">
            <div className="flex items-center justify-between border-b border-brand-line pb-2">
              <div className="font-medium text-brand-ink">Test Result</div>
              {result.success
                ? <span className="badge-pass">PASS</span>
                : <span className="badge-fail">FAIL</span>}
            </div>
            <pre className="mt-3 p-3 rounded-lg bg-brand-beige/60 text-sm text-brand-ink overflow-auto whitespace-pre-wrap">
              {result.used ? `File: ${result.used}\n\n` : null}
              {result.output}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}