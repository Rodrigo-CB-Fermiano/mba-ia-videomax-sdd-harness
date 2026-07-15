import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { getUploadDir } from "@/lib/storage";
import { db } from "@/lib/db";

const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "video/mpeg": "mpeg",
  "video/3gpp": "3gp",
  "video/x-ms-wmv": "wmv",
};

export function generateStoredFilename(mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? mimeType.split("/")[1] ?? "bin";
  return `${randomUUID()}.${ext}`;
}

export async function saveFileToDisk(
  userId: string,
  file: File
): Promise<{ storedFilename: string; filePath: string }> {
  const storedFilename = generateStoredFilename(file.type);
  const dir = getUploadDir(userId);
  const filePath = path.join(dir, storedFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return { storedFilename, filePath };
}

export function deleteFileFromDisk(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // silently ignore missing files
  }
}

export async function incrementQuota(
  userId: string,
  bytes: bigint
): Promise<void> {
  await db.$executeRaw`
    UPDATE "users"
    SET "storageUsedBytes" = "storageUsedBytes" + ${bytes}
    WHERE "id" = ${userId}
  `;
}

export async function decrementQuota(
  userId: string,
  bytes: bigint
): Promise<void> {
  await db.$executeRaw`
    UPDATE "users"
    SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - ${bytes})
    WHERE "id" = ${userId}
  `;
}
