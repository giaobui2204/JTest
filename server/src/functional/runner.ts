// server/src/functional/runner.ts
import { spawnSync, execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

type Case = {
  name: string;
  stdin: string;
  expected: string;
  timeoutMs?: number;
  normalize?: { trim?: boolean; collapseWs?: boolean };
};
type Suite = { assignmentId: string; version: number; cases: Case[] };

// uploads nằm ở server/uploads (server/src/functional -> ../../uploads)
const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");

// chuẩn hoá so sánh output
function norm(s: string, opt?: Case["normalize"]) {
  let t = s ?? "";
  if (opt?.collapseWs) t = t.replace(/\s+/g, " ");
  if (opt?.trim) t = t.trim();
  return t;
}

// đọc suite: server/src/functional/<assignmentId>/tests.json
function readSuite(assignmentId: string): Suite {
  const suitePath = path.resolve(__dirname, `./${assignmentId}/tests.json`);
  if (!fs.existsSync(suitePath)) throw new Error(`No tests.json for ${assignmentId}`);
  return JSON.parse(fs.readFileSync(suitePath, "utf-8"));
}

function latestJavaPath(assignmentId: string, studentId: string) {
  const base = path.join(UPLOAD_ROOT, assignmentId, studentId);
  if (!fs.existsSync(base)) throw new Error("No uploads for this student");
  const files = fs.readdirSync(base)
    .filter(f => f.toLowerCase().endsWith(".java"))
    .map(f => ({ f, t: fs.statSync(path.join(base, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error("No .java uploads found");
  return path.join(base, files[0].f);
}

export function runFunctionalSuite(params: {
  assignmentId: string;
  studentId?: string;
  relativePath?: string;
}) {
  const { assignmentId, studentId = "anon", relativePath } = params;
  const suite = readSuite(assignmentId);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "jtest-fn-"));
  try {
    const studentJavaAbs = relativePath
      ? path.resolve(UPLOAD_ROOT, relativePath)
      : latestJavaPath(assignmentId, studentId);

    if (!studentJavaAbs.startsWith(UPLOAD_ROOT)) {
      throw new Error("Invalid upload path");
    }

    const mainJava = path.join(work, "Main.java");
    fs.copyFileSync(studentJavaAbs, mainJava);
    execSync(`javac Main.java`, { cwd: work });

    const results = suite.cases.map((c) => {
      const r = spawnSync("java", ["Main"], {
        cwd: work,
        input: c.stdin,
        encoding: "utf-8",
        timeout: c.timeoutMs ?? 3000
      });

      const stdout = r.stdout ?? "";
      const stderr = r.stderr ?? "";
      const status = r.status ?? 0;

      const got = norm(stdout, c.normalize);
      const exp = norm(c.expected, c.normalize);
      const pass = status === 0 && got === exp;

      return {
        name: c.name,
        pass,
        status,
        stdout,
        stderr,
        expected: c.expected
      };
    });

    const summary = {
      assignmentId,
      studentId,
      total: results.length,
      passed: results.filter(x => x.pass).length,
      failed: results.filter(x => !x.pass).length
    };

    return { success: true, summary, results };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
