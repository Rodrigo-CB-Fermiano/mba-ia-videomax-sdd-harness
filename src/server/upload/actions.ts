"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_QUOTA_BYTES = BigInt(
  process.env.MAX_QUOTA_BYTES ?? 1_073_741_824
);

export async function getQuota(): Promise<{
  usedBytes: number;
  maxBytes: number;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { storageUsedBytes: true },
  });

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    usedBytes: Number(user.storageUsedBytes),
    maxBytes: Number(MAX_QUOTA_BYTES),
  };
}
