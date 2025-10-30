// server/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { runJUnitByRelativePath } from './junit/runner.js';
import { runFunctionalSuite } from './functional/runner.js';

// ESM __dirname / __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---- constants / helpers ----------------------------------------------------
const app = express();

const PORT        = Number(process.env.PORT || 4000);
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

// CORS: allow list via env, mặc định echo origin (dev-friendly)
const originsFromEnv = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CORS_ORIGIN = originsFromEnv.length ? originsFromEnv : true;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
ensureDir(UPLOAD_ROOT);

// ---- middlewares ------------------------------------------------------------
app.use(morgan('dev'));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ---- Multer: luôn dump tạm vào _incoming, không quyết định folder ở đây ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const incoming = path.join(UPLOAD_ROOT, '_incoming');
    ensureDir(incoming);
    cb(null, incoming);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (/\.java$/i.test(file.originalname)) return cb(null, true);
  cb(new Error('Only .java files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// -----------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Upload: move file từ _incoming -> /<assignmentId>/<studentId>/
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file' });

    // Sau khi multer parse xong, fields có trong req.body
    const assignmentId = String(req.body?.assignmentId ?? 'default');
    const studentId    = String(req.body?.studentId ?? 'anon');

    const finalDir  = path.join(UPLOAD_ROOT, assignmentId, studentId);
    ensureDir(finalDir);

    const finalPath = path.join(finalDir, path.basename(file.path));
    fs.renameSync(file.path, finalPath); // move từ _incoming sang đúng chỗ

    const rel = path.relative(UPLOAD_ROOT, finalPath);

    return res.status(201).json({
      message: 'Uploaded',
      file: {
        originalName: file.originalname,
        savedAs: path.basename(finalPath),
        relativePath: rel,
        bytes: file.size,
        assignmentId,
        studentId,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: e?.message ?? 'Upload error' });
  }
});

// JUnit: chạy theo relativePath (tính từ UPLOAD_ROOT)
app.post('/api/test/by-path', (req, res) => {
  const rel = String(req.body?.relativePath || '');
  if (!rel) return res.status(400).json({ error: 'relativePath required' });
  const result = runJUnitByRelativePath(rel);
  return res.json(result);
});

// JUnit: lấy file .java mới nhất theo {assignmentId, studentId}
app.post('/api/test/latest', (req, res) => {
  const assignmentId = String(req.body?.assignmentId || 'default');
  const studentId    = String(req.body?.studentId || 'anon');
  const base = path.join(UPLOAD_ROOT, assignmentId, studentId);

  if (!fs.existsSync(base)) return res.status(404).json({ error: 'No uploads for this student' });

  const files = fs.readdirSync(base)
    .filter(f => f.toLowerCase().endsWith('.java'))
    .map(f => ({ f, t: fs.statSync(path.join(base, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (!files.length) return res.status(404).json({ error: 'No .java uploads found' });

  const rel    = path.relative(UPLOAD_ROOT, path.join(base, files[0].f));
  const result = runJUnitByRelativePath(rel);
  return res.json({ used: rel, ...result });
});

// ================= Instructor functional suite API ===========================
const FN_ROOT = path.resolve(__dirname, './functional');
function suitePathOf(aid) {
  return path.join(FN_ROOT, aid, 'tests.json');
}

// Load suite
app.get('/api/instructor/tests/:assignmentId', (req, res) => {
  try {
    const p = suitePathOf(req.params.assignmentId);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return res.json(json);
  } catch (e) {
    return res.status(400).json({ error: e?.message ?? String(e) });
  }
});

// Save suite
app.put('/api/instructor/tests/:assignmentId', (req, res) => {
  try {
    const aid    = req.params.assignmentId;
    const folder = path.dirname(suitePathOf(aid));
    ensureDir(folder);
    fs.writeFileSync(suitePathOf(aid), JSON.stringify(req.body, null, 2));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message ?? String(e) });
  }
});

// Delete suite
app.delete('/api/instructor/tests/:assignmentId', (req, res) => {
  try {
    const p = suitePathOf(req.params.assignmentId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message ?? String(e) });
  }
});

// Run functional suite (stdin/stdout)
app.post('/api/functional/run', (req, res) => {
  try {
    const { assignmentId, studentId, relativePath } = req.body || {};
    if (!assignmentId) return res.status(400).json({ error: 'assignmentId required' });
    const result = runFunctionalSuite({ assignmentId, studentId, relativePath });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e?.message ?? String(e) });
  }
});

// ---- error handler ----------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err?.message ?? 'Upload/Test error' });
});

// ---- start -----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`JTest backend listening on http://localhost:${PORT}`);
});