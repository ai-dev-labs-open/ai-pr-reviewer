import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("security posture", () => {
  it("does not import shell execution modules in the action source", async () => {
    const sourceDir = path.join(process.cwd(), "src");
    const sourceFiles = await collectTypeScriptFiles(sourceDir);
    const contents = await Promise.all(
      sourceFiles.map((filePath) => readFile(filePath, "utf8"))
    );
    const combined = contents.join("\n");

    expect(combined).not.toMatch(/node:child_process|child_process/);
    expect(combined).not.toMatch(/\bspawn\(/);
    expect(combined).not.toMatch(/\bexec\(/);
    expect(combined).not.toMatch(/\bexecFile\(/);
  });
});

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}
