import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust these to your actual locations
const JUNIT_JAR  = path.resolve(__dirname, "./junit-platform-console-standalone-1.10.2.jar");
const TESTS_DIR  = path.resolve(__dirname, "./test");
const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");

// ensure a path is inside uploads/
function safeUploadPath(rel: string) {
  const full = path.resolve(UPLOAD_ROOT, rel);
  if (!full.startsWith(UPLOAD_ROOT)) throw new Error("Invalid relativePath");
  return full;
}

export function runJUnitByRelativePath(relativePath: string) {
  const uploadedJava = safeUploadPath(relativePath);

  // Collect test sources explicitly (avoid fragile shell globs)
  const testSources = fs
    .readdirSync(TESTS_DIR)
    .filter(f => f.toLowerCase().endsWith(".java"))
    .map(f => path.join(TESTS_DIR, f));

  if (testSources.length === 0) {
    return { success: false, output: `No test sources found in ${TESTS_DIR}` };
  }

  // Temp working dir so .class files don’t pollute your repo/uploads
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "jtest-run-"));
  const destMain = path.join(work, "Main.java");
  fs.copyFileSync(uploadedJava, destMain);

  try {
    // 1) Compile student + tests INTO work
    //    (quotes everywhere to be safe)
    const javacCmd =
      `javac -d "${work}" -cp "${JUNIT_JAR}" ` +
      `"${destMain}" ` +
      testSources.map(s => `"${s}"`).join(" ");
    execSync(javacCmd, { stdio: "pipe" });

    // Sanity: confirm classes exist
    const compiled = fs.readdirSync(work).filter(f => f.endsWith(".class"));
    if (compiled.length === 0) {
      return { success: false, output: `No .class files produced in ${work}` };
    }

    // 2) Run JUnit scanning ONLY the work dir (where classes are)
    const runCmd = [
      `java`,
      `-jar`, `"${JUNIT_JAR}"`,
      `execute`,                       // <- important with newer console launcher
      `--class-path`, `"${work}"`,     // where compiled classes live
      `--scan-class-path`, `"${work}"`,
      `--details`, `tree`,
      `--details-theme`, `ascii`,
      `--fail-if-no-tests`
    ].join(' ');
    
    const output = execSync(runCmd, { encoding: "utf-8" });

    return { success: true, output };
  } catch (err: any) {
    const msg = err?.stdout?.toString?.() || err?.stderr?.toString?.() || String(err?.message || err);
    return { success: false, output: msg };
  } finally {
    // Optional: clean up
    // fs.rmSync(work, { recursive: true, force: true });
  }
}