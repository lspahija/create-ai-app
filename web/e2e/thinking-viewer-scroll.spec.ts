import { test, expect } from "@playwright/test";

const MOCK_JOB_ID = "test-job-123";

const MOCK_JOB = {
  job_id: MOCK_JOB_ID,
  job_type: "demo",
  status: "running",
  started_at: new Date().toISOString(),
  completed_at: null,
  error: null,
  params: { strategy: "test", variables: {} },
  progress: "Running...",
  progress_pct: 50,
  result: null,
  result_metadata: {},
  iteration_results: [],
};

function sseBody(chunks: Array<{ type: string; text: string }>): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("");
}

function makeChunks(
  count: number,
  linesPerChunk = 5,
): Array<{ type: string; text: string }> {
  return Array.from({ length: count }, (_, i) => ({
    type: "thinking",
    text: `Thinking step ${i + 1}...\n${"Analysis line that adds vertical height to the scroll container.\n".repeat(linesPerChunk)}`,
  }));
}

function mockApiRoutes(
  page: import("@playwright/test").Page,
  sseChunks: Array<{ type: string; text: string }>,
) {
  return Promise.all([
    page.route("**/api/auth/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ auth_required: false }),
      }),
    ),
    page.route("**/api/health", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      }),
    ),
    page.route("**/api/jobs", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([MOCK_JOB]),
        });
      }
      return route.continue();
    }),
    page.route(`**/api/jobs/${MOCK_JOB_ID}`, (route) => {
      if (route.request().url().endsWith("/stream")) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_JOB),
      });
    }),
    page.route(`**/api/jobs/${MOCK_JOB_ID}/stream`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: sseBody(sseChunks),
      }),
    ),
  ]);
}

async function openThinkingViewer(page: import("@playwright/test").Page) {
  await page.goto("/jobs");
  await page.getByTitle("View output").click();
  // Switch to Thinking tab (ResultViewer defaults to Result tab)
  await page.getByRole("tab", { name: "Thinking" }).click();
  const container = page.getByTestId("thinking-scroll-container");
  await expect(container).toBeVisible();
  return container;
}

test.describe("ThinkingViewer scroll behavior", () => {
  test("auto-scrolls to bottom when content overflows", async ({ page }) => {
    await mockApiRoutes(page, makeChunks(30));
    const container = await openThinkingViewer(page);

    // Wait for content to render and scroll to settle
    await expect(page.getByTestId("thinking-section").first()).toBeVisible();

    await expect
      .poll(
        async () =>
          container.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    // Scroll-to-bottom button should NOT be visible
    await expect(page.getByTestId("scroll-to-bottom-btn")).not.toBeVisible();
  });

  test("stops auto-scrolling when user scrolls up and shows button", async ({
    page,
  }) => {
    await mockApiRoutes(page, makeChunks(30));
    const container = await openThinkingViewer(page);

    // Wait for content and auto-scroll to settle
    await expect(page.getByTestId("thinking-section").first()).toBeVisible();
    await expect
      .poll(
        async () =>
          container.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    // User scrolls to top
    await container.evaluate((el) => {
      el.scrollTo({ top: 0, behavior: "instant" });
    });

    // Scroll-to-bottom button should appear
    await expect(page.getByTestId("scroll-to-bottom-btn")).toBeVisible();

    // Verify scroll position stayed near top
    const scrollTop = await container.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThan(100);
  });

  test("clicking scroll-to-bottom button returns to bottom and hides button", async ({
    page,
  }) => {
    await mockApiRoutes(page, makeChunks(30));
    const container = await openThinkingViewer(page);

    await expect(page.getByTestId("thinking-section").first()).toBeVisible();
    await expect
      .poll(
        async () =>
          container.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    // Scroll to top
    await container.evaluate((el) => {
      el.scrollTo({ top: 0, behavior: "instant" });
    });

    const btn = page.getByTestId("scroll-to-bottom-btn");
    await expect(btn).toBeVisible();

    // Click scroll-to-bottom
    await btn.click();

    // Should be back at bottom
    await expect
      .poll(
        async () =>
          container.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    // Button should disappear
    await expect(btn).not.toBeVisible();
  });

  test("no scroll button when content does not overflow", async ({ page }) => {
    await mockApiRoutes(page, [
      { type: "thinking", text: "Short thought." },
    ]);
    await openThinkingViewer(page);

    // Wait for content to render
    await expect(page.getByTestId("thinking-section").first()).toBeVisible();

    // Button should not appear
    await expect(page.getByTestId("scroll-to-bottom-btn")).not.toBeVisible();
  });

  test("re-opening dialog resets scroll state", async ({ page }) => {
    await mockApiRoutes(page, makeChunks(30));
    const container = await openThinkingViewer(page);

    await expect(page.getByTestId("thinking-section").first()).toBeVisible();
    await expect
      .poll(
        async () =>
          container.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    // Scroll up
    await container.evaluate((el) => {
      el.scrollTo({ top: 0, behavior: "instant" });
    });
    await expect(page.getByTestId("scroll-to-bottom-btn")).toBeVisible();

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(container).not.toBeVisible();

    // Re-open
    await page.getByTitle("View output").click();
    const newContainer = page.getByTestId("thinking-scroll-container");
    await expect(newContainer).toBeVisible();
    await expect(page.getByTestId("thinking-section").first()).toBeVisible();

    // Should be at bottom with no button (component re-mounts via key={jobId})
    await expect
      .poll(
        async () =>
          newContainer.evaluate(
            (el) =>
              el.scrollTop + el.clientHeight >= el.scrollHeight - 50,
          ),
        { timeout: 3000 },
      )
      .toBe(true);

    await expect(page.getByTestId("scroll-to-bottom-btn")).not.toBeVisible();
  });
});
