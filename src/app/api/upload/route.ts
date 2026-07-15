import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  saveFileToDisk,
  incrementQuota,
} from "@/server/upload/services";
import { triggerProcessing } from "@/server/processing/trigger";

export const maxDuration = 60;

const MAX_FILE_SIZE = Number(
  process.env.MAX_FILE_SIZE_BYTES ?? 314_572_800
);
const MAX_QUOTA = BigInt(
  process.env.MAX_QUOTA_BYTES ?? 1_073_741_824
);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 });
  }

  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "INVALID_MIME" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { storageUsedBytes: true },
  });

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const fileSizeBigInt = BigInt(file.size);
  const remainingBytes = MAX_QUOTA - user.storageUsedBytes;

  if (fileSizeBigInt > remainingBytes) {
    return NextResponse.json(
      {
        error: "QUOTA_EXCEEDED",
        remainingBytes: remainingBytes.toString(),
      },
      { status: 400 }
    );
  }

  let storedFilename: string;
  let filePath: string;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    ({ storedFilename, filePath } = await saveFileToDisk(userId, file.name, file.type, buffer));
  } catch {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }

  const video = await db.video.create({
    data: {
      userId,
      originalFilename: file.name,
      storedFilename,
      filePath,
      mimeType: file.type,
      fileSizeBytes: fileSizeBigInt,
      status: "Queued",
    },
  });

  await incrementQuota(userId, fileSizeBigInt);

  triggerProcessing(video.id);

  return NextResponse.json(
    {
      videoId: video.id,
      originalFilename: video.originalFilename,
      fileSizeBytes: video.fileSizeBytes.toString(),
      uploadedAt: video.uploadedAt.toISOString(),
    },
    { status: 201 }
  );
}
