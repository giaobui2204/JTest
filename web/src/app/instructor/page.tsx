'use client';
import { useState } from 'react';
import '../style.css'; // xài style.css hiện tại

type Suite = {
  assignmentId: string;
  version: number;
  cases: Array<{
    name: string;
    stdin: string;
    expected: string;
    timeoutMs?: number;
    normalize?: { trim?: boolean; collapseWs?: boolean };
  }>;
};

export default function InstructorPage() {
  const [assignmentId, setAssignmentId] = useState('hw1');
  const [jsonText, setJsonText] = useState<string>(`{
  "assignmentId": "hw1",
  "version": 1,
  "cases": [
    { "name": "Echo", "stdin": "hello\\n", "expected": "hello\\n", "timeoutMs": 2000, "normalize": { "trim": false } },
    { "name": "Add", "stdin": "2 3\\n", "expected": "5\\n", "timeoutMs": 2000, "normalize": { "trim": true, "collapseWs": true } }
  ]
}`);
  const [msg, setMsg] = useState('');
  const [runnerMsg, setRunnerMsg] = useState('');

  const saveSuite = async () => {
    setMsg('');
    try {
      const payload: Suite = JSON.parse(jsonText);
      const res = await fetch(`/api/instructor/tests/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to save suite');
      setMsg(`✅ Saved suite for ${assignmentId}`);
    } catch (e: any) {
      setMsg(`❌ ${e.message ?? String(e)}`);
    }
  };

  const loadSuite = async () => {
    setMsg('');
    try {
      const res = await fetch(`/api/instructor/tests/${assignmentId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load suite');
      setJsonText(JSON.stringify(j, null, 2));
      setMsg(`📥 Loaded suite for ${assignmentId}`);
    } catch (e: any) {
      setMsg(`❌ ${e.message ?? String(e)}`);
    }
  };

  const deleteSuite = async () => {
    if (!confirm(`Are you sure you want to delete suite "${assignmentId}"?`)) return;
    setMsg('');
    try {
      const res = await fetch(`/api/instructor/tests/${assignmentId}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to delete suite');
      setMsg(`🗑️ Deleted suite ${assignmentId}`);
      setJsonText('');
    } catch (e: any) {
      setMsg(`❌ ${e.message ?? String(e)}`);
    }
  };

  const runOnStudent = async () => {
    setRunnerMsg('');
    try {
      const studentId = prompt('Student ID to run? (default: anon)') || 'anon';
      const res = await fetch('/api/functional/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, studentId }),
      });
      const j = await res.json();
      setRunnerMsg(JSON.stringify(j, null, 2));
    } catch (e: any) {
      setRunnerMsg(`❌ ${e.message ?? String(e)}`);
    }
  };

  return (
    <main>
      <div className="container">
        <h1>Instructor Dashboard</h1>
        <p className="subtitle">Upload, load, delete & manage functional test suites</p>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label>
              <span>Assignment ID</span>
              <input
                type="text"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
              />
            </label>

            <label>
              <span>Suite JSON</span>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '280px',
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontFamily: 'ui-monospace, monospace',
                }}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
              />
            </label>

            {/* Buttons row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={saveSuite}>💾 Save</button>
              <button className="btn-blue" onClick={runOnStudent}>▶️ Run</button>
              <button className="btn-good" onClick={loadSuite}>📥 Load</button>
              <button
                className="btn"
                style={{ background: '#9B1C1C', color: 'white' }}
                onClick={deleteSuite}
              >
                🗑️ Delete
              </button>
            </div>

            {msg && (
              <div className="alert alert-ok" style={{ marginTop: '0.75rem' }}>
                {msg}
              </div>
            )}
          </div>

          <div>
            <div className="result" style={{ minHeight: '340px' }}>
              {runnerMsg || 'Run a suite on a student to see the report…'}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}