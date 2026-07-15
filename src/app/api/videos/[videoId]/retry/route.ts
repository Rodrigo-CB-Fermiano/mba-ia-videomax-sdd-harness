import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerProcessing } from "@/server/processing/trigger";

export async function POST(
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
    select: { id: true, userId: true, status: true },
  });

  if (!video) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (video.userId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (video.status !== "Failed") {
    return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
  }

  await db.video.update({
    where: { id: videoId },
    data: {
      status: "Queued",
      retryCount: 0,
      failureReason: null,
      processingStartedAt: null,
    },
  });

  triggerProcessing(videoId);

  return NextResponse.json({ success: true });
}
