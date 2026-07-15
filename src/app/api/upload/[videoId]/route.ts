import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFileFromDisk, decrementQuota } from "@/server/upload/services";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { videoId } = params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, userId: true, filePath: true, fileSizeBytes: true },
  });

  if (!video) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (video.userId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  deleteFileFromDisk(video.filePath);

  await db.video.delete({ where: { id: videoId } });

  await decrementQuota(video.userId, video.fileSizeBytes);

  return NextResponse.json({ success: true });
}
