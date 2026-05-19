import { promises as fs } from "node:fs";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export async function walkFiles(root: string, matcher: (filePath: string) => boolean): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          await visit(fullPath);
        }
      } else if (entry.isFile() && matcher(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await visit(root);
  files.sort();
  return files;
}

function shouldSkipDirectory(name: string): boolean {
  return name === "vendor" || name === "node_modules" || name === ".git" || name === "storage";
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}
