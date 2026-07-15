import { runProcessingJob } from "./services";

export function triggerProcessing(videoId: string): void {
  runProcessingJob(videoId).catch((err) => {
    console.error(`[processing] unhandled error for video ${videoId}:`, err);
  });
}
