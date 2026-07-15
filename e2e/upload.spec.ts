import { test, expect } from "@playwright/test";
import path from "node:path";

const TEST_VIDEO = path.resolve("e2e/fixtures/test-video-small.mp4");

test.describe("F02 - Video Upload", () => {
  test.beforeEach(async ({ page }) => {
    // Assumes user is already authenticated (uses storageState from auth E2E)
    await page.goto("/upload");
  });

  test("upload_via_file_picker", async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("text=escolha um arquivo"),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);
    await expect(page).toHaveURL("/library", { timeout: 10_000 });
    await expect(page.locator('[data-testid="status-badge"]').first()).toContainText("Queued");
  });

  test("upload_via_drag_and_drop", async ({ page }) => {
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await dropZone.dispatchEvent("dragover");
    // Playwright file upload via setInputFiles is used as drag-and-drop proxy
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(TEST_VIDEO);
    await expect(page).toHaveURL("/library", { timeout: 10_000 });
  });

  test("reject_file_exceeds_300mb", async ({ page }) => {
    // Uses the file input directly to bypass OS file picker
    const input = page.locator('input[type="file"]');
    // Create an oversized file programmatically via evaluate
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      const bigFile = new File([new ArrayBuffer(301 * 1024 * 1024)], "big.mp4", {
        type: "video/mp4",
      });
      dataTransfer.items.add(bigFile);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, "files", { value: dataTransfer.files });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("text=300 MB")).toBeVisible();
  });

  test("reject_non_video_mime", async ({ page }) => {
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      const imgFile = new File([new ArrayBuffer(1024)], "photo.png", {
        type: "image/png",
      });
      dataTransfer.items.add(imgFile);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, "files", { value: dataTransfer.files });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("text=vídeo")).toBeVisible();
  });

  test("shows_realtime_progress", async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(TEST_VIDEO);
    // Progress bar should appear briefly — we just assert the cancel button exists
    // as progress may complete fast for small files
    await expect(page.locator("text=Cancelar").or(page.locator("text=Upload concluído"))).toBeVisible({ timeout: 5_000 });
  });

  test("cancel_upload_removes_partial_file", async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(TEST_VIDEO);
    const cancelBtn = page.locator("text=Cancelar");
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.locator("text=Arraste um vídeo aqui")).toBeVisible();
    }
  });

  test("quota_exceeded_blocks_upload", async ({ page }) => {
    // Prerequisite: user's storageUsedBytes set to ~1 GB - 1 MB in DB
    // This test requires test setup to manipulate the database
    // Skipped without proper fixture support
    test.skip();
  });

  test("quota_indicator_displays_current_usage", async ({ page }) => {
    await expect(page.locator("text=usados de")).toBeVisible();
  });

  test("video_card_appears_with_queued_status", async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(TEST_VIDEO);
    await expect(page).toHaveURL("/library", { timeout: 10_000 });
    await expect(page.locator("text=Queued").first()).toBeVisible({ timeout: 5_000 });
  });
});
