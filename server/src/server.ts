import { runJUnitByRelativePath } from "./junit/runner.js";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT || 4000);
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

// safer CORS origin fallback
const originsFromEnv = (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CORS_ORIGIN: any = originsFromEnv.length ? originsFromEnv : true; // true = reflect request origin

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }
ensureDir(UPLOAD_ROOT);

app.use(morgan('dev'));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ---- Multer (.java only) ----
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const assignmentId = String((req.body as any)?.assignmentId ?? 'default');
    const studentId = String((req.body as any)?.studentId ?? 'anon');
    const dest = path.join(UPLOAD_ROOT, assignmentId, studentId);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (/\.java$/i.test(file.originalname)) return cb(null, true);
  cb(new Error('Only .java files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file' });

  const body = req.body as { assignmentId?: string; studentId?: string };
  const rel = path.relative(UPLOAD_ROOT, file.path);

  res.status(201).json({
    message: 'Uploaded',
    file: {
      originalName: file.originalname,
      savedAs: path.basename(file.path),
      relativePath: rel,               
      bytes: file.size,
      assignmentId: body.assignmentId ?? 'default',
      studentId: body.studentId ?? 'anon',
    },
  });
});

// ---- test by passing a relative path from uploads ----
app.post('/api/test/by-path', (req, res) => {
  const rel = String(req.body?.relativePath || "");
  if (!rel) return res.status(400).json({ error: "relativePath required" });
  const result = runJUnitByRelativePath(rel);
  res.json(result);
});

// ---- test the latest upload for {assignmentId, studentId} ----
app.post('/api/test/latest', (req, res) => {
  const assignmentId = String(req.body?.assignmentId || 'default');
  const studentId = String(req.body?.studentId || 'anon');
  const base = path.join(UPLOAD_ROOT, assignmentId, studentId);

  if (!fs.existsSync(base)) return res.status(404).json({ error: "No uploads for this student" });

  const files = fs.readdirSync(base)
    .filter(f => f.toLowerCase().endsWith('.java'))
    .map(f => ({ f, t: fs.statSync(path.join(base, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (!files.length) return res.status(404).json({ error: "No .java uploads found" });

  const rel = path.relative(UPLOAD_ROOT, path.join(base, files[0].f));
  const result = runJUnitByRelativePath(rel);
  res.json({ used: rel, ...result });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({ error: err?.message ?? 'Upload/Test error' });
});

app.listen(PORT, () => {
  console.log(`JTest backend listening on http://localhost:${PORT}`);
});