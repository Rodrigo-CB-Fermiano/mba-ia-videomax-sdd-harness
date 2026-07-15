import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => {
  const mockFsObj = {
    mkdirSync: vi.fn(),
    mkdtempSync: vi.fn(() => "C:\\tmp\\videomax-mock"),
    createReadStream: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })),
    rmSync: vi.fn(),
  };
  return { default: mockFsObj, ...mockFsObj };
});

vi.mock("fluent-ffmpeg", () => {
  const mockFfmpeg: Record<string, unknown> = vi.fn(() => mockFfmpegInstance);
  const mockFfmpegInstance = {
    noVideo: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    format: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(),
    seekInput: vi.fn().mockReturnThis(),
    frames: vi.fn().mockReturnThis(),
  };
  mockFfmpeg.setFfmpegPath = vi.fn();
  mockFfmpeg.setFfprobePath = vi.fn();
  mockFfmpeg.ffprobe = vi.fn();
  return { default: mockFfmpeg };
});

vi.mock("@ffmpeg-installer/ffmpeg", () => ({ default: { path: "/mock/ffmpeg" } }));
vi.mock("@ffprobe-installer/ffprobe", () => ({ default: { path: "/mock/ffprobe" } }));

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn(() => ({
      audio: { transcriptions: { create: mockCreate } },
    })),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    video: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transcriptionSegment: {
      createMany: vi.fn(),
    },
  },
}));

const ffmpegModule = await import("fluent-ffmpeg");
const ffmpegMock = ffmpegModule.default as unknown as {
  (path: string): {
    noVideo: () => unknown;
    audioCodec: () => unknown;
    format: () => unknown;
    on: (event: string, cb: () => void) => { save: () => void };
    save: () => void;
    seekInput: () => unknown;
    frames: () => unknown;
  };
  setFfmpegPath: ReturnType<typeof vi.fn>;
  setFfprobePath: ReturnType<typeof vi.fn>;
  ffprobe: ReturnType<typeof vi.fn>;
};

const openaiModule = await import("openai");
const OpenAIMock = openaiModule.default as unknown as ReturnType<typeof vi.fn>;

const { db } = await import("@/lib/db");
const mockDb = db as {
  video: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  transcriptionSegment: {
    createMany: ReturnType<typeof vi.fn>;
  };
};

import {
  runProcessingJob,
  saveSegments,
  updateVideoStatus,
} from "../services";

const MOCK_VIDEO = {
  filePath: "/uploads/user1/video.mp4",
  userId: "user-1",
  retryCount: 0,
};

function mockFfmpegSuccess() {
  const instance = {
    noVideo: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    format: vi.fn().mockReturnThis(),
    seekInput: vi.fn().mockReturnThis(),
    frames: vi.fn().mockReturnThis(),
    on: vi.fn(function (
      this: { save: () => void },
      event: string,
      cb: () => void
    ) {
      if (event === "end") setTimeout(cb, 0);
      return this;
    }),
    save: vi.fn(),
  };
  (ffmpegMock as unknown as ReturnType<typeof vi.fn>).mockReturnValue(instance);
  ffmpegMock.ffprobe.mockImplementation(
    (_path: string, cb: (err: null, data: { format: { duration: number } }) => void) =>
      cb(null, { format: { duration: 10 } })
  );
}

function mockWhisperSuccess() {
  const instance = OpenAIMock.mock.results[OpenAIMock.mock.results.length - 1]?.value;
  if (instance) {
    instance.audio.transcriptions.create.mockResolvedValue({
      language: "pt",
      segments: [
        { start: 0, end: 5, text: "Hello" },
        { start: 5, end: 10, text: "World" },
      ],
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHISPER_STUB = "true";
  mockDb.video.findUnique.mockResolvedValue(MOCK_VIDEO);
  mockDb.video.update.mockResolvedValue({});
  mockDb.transcriptionSegment.createMany.mockResolvedValue({ count: 1 });
  mockFfmpegSuccess();
});

describe("runProcessingJob — caminho feliz", () => {
  it("transiciona para Processing ao iniciar e Ready ao concluir", async () => {
    await runProcessingJob("video-1");

    const calls = mockDb.video.update.mock.calls;
    expect(calls[0][0].data).toMatchObject({
      status: "Processing",
      processingStartedAt: expect.any(Date),
    });
    const lastCall = calls[calls.length - 1][0].data;
    expect(lastCall.status).toBe("Ready");
    expect(lastCall.durationSeconds).toBe(10);
    expect(lastCall.thumbnailPath).toBeTruthy();
    expect(lastCall.language).toBe("pt");
  });

  it("chama createMany para segmentos de transcricao", async () => {
    await runProcessingJob("video-1");
    expect(mockDb.transcriptionSegment.createMany).toHaveBeenCalledOnce();
    const { data } = mockDb.transcriptionSegment.createMany.mock.calls[0][0];
    expect(data[0]).toMatchObject({ videoId: "video-1", order: 0 });
  });
});

describe("runProcessingJob — define Processing ao iniciar", () => {
  it("primeira atualizacao do db inclui status Processing e processingStartedAt", async () => {
    await runProcessingJob("video-1");
    const firstUpdate = mockDb.video.update.mock.calls[0][0].data;
    expect(firstUpdate.status).toBe("Processing");
    expect(firstUpdate.processingStartedAt).toBeInstanceOf(Date);
  });
});

describe("runProcessingJob — falha de ffmpeg", () => {
  it("define status Failed com failureReason quando ffmpeg lanca erro", async () => {
    const badInstance = {
      noVideo: vi.fn().mockReturnThis(),
      audioCodec: vi.fn().mockReturnThis(),
      format: vi.fn().mockReturnThis(),
      seekInput: vi.fn().mockReturnThis(),
      frames: vi.fn().mockReturnThis(),
      on: vi.fn(function (
        this: { save: () => void },
        event: string,
        cb: (err?: Error) => void
      ) {
        if (event === "error") setTimeout(() => cb(new Error("ffmpeg failed")), 0);
        return this;
      }),
      save: vi.fn(),
    };
    (ffmpegMock as unknown as ReturnType<typeof vi.fn>).mockReturnValue(badInstance);

    await runProcessingJob("video-1");

    const calls = mockDb.video.update.mock.calls;
    const failedCall = calls.find((c) => c[0].data.status === "Failed");
    expect(failedCall).toBeDefined();
    expect(failedCall![0].data.failureReason).toBeTruthy();
  });
});

describe("runProcessingJob — falha de Whisper", () => {
  it("define status Failed quando chamada OpenAI rejeita", async () => {
    delete process.env.WHISPER_STUB;
    const openaiInstance = { audio: { transcriptions: { create: vi.fn().mockRejectedValue(new Error("Whisper error")) } } };
    OpenAIMock.mockReturnValue(openaiInstance);

    await runProcessingJob("video-1");

    const calls = mockDb.video.update.mock.calls;
    const failedCall = calls.find((c) => c[0].data.status === "Failed");
    expect(failedCall).toBeDefined();
    expect(failedCall![0].data.failureReason).toContain("Whisper error");
  });
});

describe("runProcessingJob — esgota retries", () => {
  it("chama update com Failed e retryCount 3 apos 3 falhas", async () => {
    const alwaysFailInstance = {
      noVideo: vi.fn().mockReturnThis(),
      audioCodec: vi.fn().mockReturnThis(),
      format: vi.fn().mockReturnThis(),
      seekInput: vi.fn().mockReturnThis(),
      frames: vi.fn().mockReturnThis(),
      on: vi.fn(function (
        this: { save: () => void },
        event: string,
        cb: (err?: Error) => void
      ) {
        if (event === "error") setTimeout(() => cb(new Error("persistent failure")), 0);
        return this;
      }),
      save: vi.fn(),
    };
    (ffmpegMock as unknown as ReturnType<typeof vi.fn>).mockReturnValue(alwaysFailInstance);

    await runProcessingJob("video-1");

    const calls = mockDb.video.update.mock.calls;
    const failedCall = calls.find(
      (c) => c[0].data.status === "Failed" && c[0].data.retryCount === 3
    );
    expect(failedCall).toBeDefined();
  });
});

describe("saveSegments — cria todos os segmentos", () => {
  it("mapeia corretamente os dados para createMany", async () => {
    const segments = [
      { startMs: 0, endMs: 1000, text: "seg1" },
      { startMs: 1000, endMs: 2000, text: "seg2" },
      { startMs: 2000, endMs: 3000, text: "seg3" },
    ];
    await saveSegments("v-1", segments);

    const { data } = mockDb.transcriptionSegment.createMany.mock.calls[0][0];
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ videoId: "v-1", startMs: 0, endMs: 1000, text: "seg1", order: 0 });
    expect(data[2]).toEqual({ videoId: "v-1", startMs: 2000, endMs: 3000, text: "seg3", order: 2 });
  });
});

describe("updateVideoStatus — grava campos corretos", () => {
  it("chama db.video.update com os campos esperados para Ready", async () => {
    await updateVideoStatus("v-2", {
      status: "Ready",
      durationSeconds: 42.5,
      thumbnailPath: "/thumbs/v-2.jpg",
      language: "en",
    });

    expect(mockDb.video.update).toHaveBeenCalledWith({
      where: { id: "v-2" },
      data: {
        status: "Ready",
        durationSeconds: 42.5,
        thumbnailPath: "/thumbs/v-2.jpg",
        language: "en",
      },
    });
  });
});
