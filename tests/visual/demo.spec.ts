import { test, expect } from "@playwright/test";

test.describe("guided demo", () => {
  test("wide guided example is the canonical capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
    await expect(page).toHaveScreenshot("demo-guided-wide.png");
  });

  test("narrow layout has no overflow and the playback controls work", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");

    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
    await page.locator(".demo-honesty-details summary").click();
    await expect(page.getByText(/Every run, diff, check, and finding is recorded sample data/)).toBeVisible();
    await expect(page.getByText(/No OpenCode session, provider call, repository read, or model quota is used/)).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();

    await page.getByRole("button", { name: "Inspect Maker" }).click();
    await expect(page.getByRole("heading", { name: "Maker tab" })).toBeVisible();
    await expect(page.getByText(/Playback paused so you can inspect Maker/)).toBeVisible();

    await page.getByRole("button", { name: "Reset demo" }).first().click();
    await expect(page.getByText(/Step 1 of 10/).first()).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      document.querySelector(".stage-strip")?.scrollTo({ left: 0 });
    });
    await page.waitForTimeout(100);
    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
    await expect(page).toHaveScreenshot("demo-guided-narrow.png");
  });

  test("90-second presentation mode is reachable and labeled", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/demo?presentation=1");

    await expect(page.getByText("90-second presentation").first()).toBeVisible();
    await expect(page.getByText(/90s recording path/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
    await expect(page.getByText("Guided callout.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Representative diff and recorded check" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Findings, readiness, and the next honest step" })).toBeVisible();
    await expect(page).toHaveScreenshot("demo-presentation-wide.png");

    await page.reload();
    await expect(page.getByText("90-second presentation").first()).toBeVisible();

    await page.getByRole("button", { name: "Exit presentation" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
  });

  test("the demo makes no API or provider request", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await page.goto("/demo");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Witness" }).click();
    await page.waitForTimeout(300);

    for (const url of requests) {
      expect(url).not.toContain("/api/");
      expect(url).not.toMatch(/opencode\.ai|api\.openai\.com|anthropic\.com|generativelanguage/i);
    }
  });

  test("keyboard users can reach the skip link, tabs, and playback controls", async ({ page }) => {
    await page.goto("/demo");
    const skip = page.getByRole("link", { name: "Skip to the guided example" });
    await skip.focus();
    await expect(skip).toBeFocused();

    const inspectMaker = page.getByRole("button", { name: "Inspect Maker" });
    await inspectMaker.focus();
    await expect(inspectMaker).toBeFocused();
    const outline = await inspectMaker.evaluate((element) => getComputedStyle(element).outlineWidth);
    expect(outline).not.toBe("0px");
  });
});
