import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();

const PORT = Number(process.env.PORT || 4000);
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? '').split(',').filter(Boolean) || '*';

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}
ensureDir(UPLOAD_ROOT);

app.use(morgan('dev'));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ---- Multer config (only .java files, 2MB) ----
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

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// ---- Routes ----
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

// central error handler (multer errors, etc.)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({ error: err?.message ?? 'Upload error' });
});

app.listen(PORT, () => {
  console.log(`JTest backend listening on http://localhost:${PORT}`);
});
