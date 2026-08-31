import { execFile } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "../..");
const committedDirectory = path.join(projectRoot, "drizzle");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "logos-drizzle-"));
const generatedDirectory = path.join(temporaryRoot, "drizzle");

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relativePath)),
      );
    } else {
      files.push(relativePath);
    }
  }
  return files.sort();
}

try {
  await cp(committedDirectory, generatedDirectory, { recursive: true });
  await execFileAsync("pnpm", ["exec", "drizzle-kit", "generate"], {
    cwd: projectRoot,
    env: { ...process.env, DRIZZLE_OUT: generatedDirectory },
  });

  const committedFiles = await listFiles(committedDirectory);
  const generatedFiles = await listFiles(generatedDirectory);
  if (committedFiles.join("\n") !== generatedFiles.join("\n")) {
    throw new Error(
      "Drizzle migrations are not synchronized with db/schema.ts",
    );
  }

  for (const relativePath of committedFiles) {
    const [committed, generated] = await Promise.all([
      readFile(path.join(committedDirectory, relativePath)),
      readFile(path.join(generatedDirectory, relativePath)),
    ]);
    if (!committed.equals(generated)) {
      throw new Error(
        "Drizzle migrations are not synchronized with db/schema.ts",
      );
    }
  }

  console.log("Committed Drizzle migrations match the schema.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
