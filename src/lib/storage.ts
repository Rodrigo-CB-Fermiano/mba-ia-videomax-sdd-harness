import path from "node:path";
import fs from "node:fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./storage/uploads";

export function getUploadDir(userId: string): string {
  const dir = path.resolve(UPLOAD_DIR, userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getUploadDirBase(): string {
  return path.resolve(UPLOAD_DIR);
}
