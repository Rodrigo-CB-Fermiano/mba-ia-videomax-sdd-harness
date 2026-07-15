import path from "node:path";
import fs from "node:fs";

function uploadDirBase(): string {
  return process.env.UPLOAD_DIR ?? "./storage/uploads";
}

export function getUploadDir(userId: string): string {
  const dir = path.resolve(uploadDirBase(), userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getUploadDirBase(): string {
  return path.resolve(uploadDirBase());
}
