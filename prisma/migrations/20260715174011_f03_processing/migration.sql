-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "durationSeconds" DOUBLE PRECISION,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnailPath" TEXT,
ADD COLUMN     "transcriptionText" TEXT;

-- CreateTable
CREATE TABLE "transcription_segments" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "transcription_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transcription_segments_videoId_order_idx" ON "transcription_segments"("videoId", "order");

-- AddForeignKey
ALTER TABLE "transcription_segments" ADD CONSTRAINT "transcription_segments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GIN index for full-text search (consumed by F08)
CREATE INDEX "videos_transcription_fts" ON "videos" USING GIN (to_tsvector('simple', COALESCE("transcriptionText", '')));
