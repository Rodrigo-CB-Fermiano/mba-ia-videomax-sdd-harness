import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
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
    select: {
      id: true,
      userId: true,
      status: true,
      failureReason: true,
      thumbnailPath: true,
      durationSeconds: true,
      language: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (video.userId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({
    id: video.id,
    status: video.status,
    failureReason: video.failureReason,
    thumbnailPath: video.thumbnailPath,
    durationSeconds: video.durationSeconds,
    language: video.language,
  });
}
