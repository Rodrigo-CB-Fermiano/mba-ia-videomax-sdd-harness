import path from "node:path";
import fs from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import OpenAI from "openai";
import { db } from "@/lib/db";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const MAX_RETRIES = 3;

function getThumbnailDir(userId: string): string {
  const base = process.env.THUMBNAIL_DIR ?? "./storage/thumbnails";
  const dir = path.resolve(base, userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function extractAudioAndMeta(
  filePath: string,
  outputAudioPath: string
): Promise<{ durationSeconds: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("end", () => {
        ffmpeg.ffprobe(filePath, (err: Error | null, metadata: ffmpeg.FfprobeData) => {
          if (err) return reject(err);
          const durationSeconds = metadata.format.duration ?? 0;
          resolve({ durationSeconds });
        });
      })
      .on("error", reject)
      .save(outputAudioPath);
  });
}

export async function generateThumbnail(
  filePath: string,
  userId: string,
  videoId: string
): Promise<string> {
  const dir = getThumbnailDir(userId);
  const filename = `${videoId}.jpg`;
  const thumbnailPath = path.join(dir, filename);

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .seekInput(5)
      .frames(1)
      .on("end", () => resolve(thumbnailPath))
      .on("error", reject)
      .save(thumbnailPath);
  });
}

export async function transcribeAudio(audioPath: string): Promise<{
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  language: string;
}> {
  if (process.env.WHISPER_STUB === "true") {
    return {
      segments: [{ startMs: 0, endMs: 5000, text: "stub transcription" }],
      language: "pt",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const audioStream = fs.createReadStream(audioPath);

  const response = await client.audio.transcriptions.create({
    file: audioStream,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const language = response.language ?? "pt";
  const segments = (response.segments ?? []).map((seg) => ({
    startMs: Math.round((seg.start ?? 0) * 1000),
    endMs: Math.round((seg.end ?? 0) * 1000),
    text: seg.text,
  }));

  return { segments, language };
}

export async function saveSegments(
  videoId: string,
  segments: Array<{ startMs: number; endMs: number; text: string }>
): Promise<void> {
  await db.transcriptionSegment.createMany({
    data: segments.map((seg, index) => ({
      videoId,
      startMs: seg.startMs,
      endMs: seg.endMs,
      text: seg.text,
      order: index,
    })),
  });
}

export async function indexFullText(
  videoId: string,
  segments: Array<{ text: string }>
): Promise<void> {
  const transcriptionText = segments.map((s) => s.text).join(" ");
  await db.video.update({
    where: { id: videoId },
    data: { transcriptionText },
  });
}

export async function updateVideoStatus(
  videoId: string,
  data: Parameters<typeof db.video.update>[0]["data"]
): Promise<void> {
  await db.video.update({ where: { id: videoId }, data });
}

export async function runProcessingJob(videoId: string): Promise<void> {
  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { filePath: true, userId: true, retryCount: true },
  });

  if (!video) return;

  await updateVideoStatus(videoId, {
    status: "Processing",
    processingStartedAt: new Date(),
  });

  const os = await import("node:os");
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "videomax-"));
    const audioPath = path.join(tmpDir, "audio.wav");

    try {
      const { durationSeconds } = await extractAudioAndMeta(
        video.filePath,
        audioPath
      );

      const thumbnailPath = await generateThumbnail(
        video.filePath,
        video.userId,
        videoId
      );

      const { segments, language } = await transcribeAudio(audioPath);

      await saveSegments(videoId, segments);
      await indexFullText(videoId, segments);

      await updateVideoStatus(videoId, {
        status: "Ready",
        durationSeconds,
        thumbnailPath,
        language,
      });

      return;
    } catch (err) {
      attempt++;

      if (attempt > MAX_RETRIES) {
        await updateVideoStatus(videoId, {
          status: "Failed",
          retryCount: MAX_RETRIES,
          failureReason:
            err instanceof Error ? err.message : "Unknown processing error",
        });
        return;
      }

      await updateVideoStatus(videoId, {
        status: "Processing",
        retryCount: attempt,
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
