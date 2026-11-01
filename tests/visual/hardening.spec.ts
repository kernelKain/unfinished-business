import { test, expect } from "@playwright/test";

test.describe("responsive and resilience hardening", () => {
  test("tablet layouts keep all three product surfaces usable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("landing-tablet.png");

    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    await expect(page).toHaveScreenshot("workshop-tablet.png", { fullPage: true });

    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
    await expect(page).toHaveScreenshot("demo-tablet.png");
  });

  test("tablet onboarding remains readable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    await page.getByRole("button", { name: "Open setup" }).first().click();
    await expect(page.getByRole("heading", { name: "Connect your OpenCode workshop" })).toBeVisible();
    await expect(page).toHaveScreenshot("onboarding-tablet.png", { fullPage: true });
  });

  test("200% text zoom and hostile long content do not create horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Driftwatch" })).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.goto("/");
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "hardening-content";
      host.style.width = "320px";
      const inline = document.createElement("span");
      inline.id = "hardening-model";
      inline.className = "header-model-inline";
      inline.style.display = "block";
      inline.textContent = `${"provider-".repeat(20)}/${"model-".repeat(40)}#reasoning-variant-with-a-long-name`;
      const prose = document.createElement("div");
      prose.id = "hardening-prose";
      prose.className = "prose";
      prose.textContent = "z".repeat(8_000);
      const markdown = document.createElement("div");
      markdown.id = "hardening-markdown";
      markdown.className = "markdown";
      const paragraph = document.createElement("p");
      paragraph.textContent = "y".repeat(8_000);
      markdown.append(paragraph);
      host.append(inline, prose, markdown);
      document.body.append(host);
    });
    const result = await page.evaluate(() => {
      const model = document.getElementById("hardening-model") as HTMLElement;
      const host = document.getElementById("hardening-content") as HTMLElement;
      return {
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
        modelStyle: getComputedStyle(model),
        modelClipped: model.scrollWidth > model.clientWidth,
        hostOverflow: host.scrollWidth - host.clientWidth,
      };
    });
    expect(result.documentOverflow).toBeLessThanOrEqual(1);
    expect(result.modelStyle.textOverflow).toBe("ellipsis");
    expect(result.modelClipped).toBe(true);
    expect(result.hostOverflow).toBeLessThanOrEqual(1);
  });

  test("a lost API connection shows an alert and a reload path", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.route("**/api/project", (route) => route.abort());
    await page.goto("/workshop");
    await expect(page.getByRole("alert")).toContainText(/lost its connection/i);
    await expect(page.getByRole("button", { name: "Reload the workshop" })).toBeVisible();
    await expect(page).toHaveScreenshot("workshop-offline.png", { fullPage: true });
  });

  test("the loading state is labeled while project data is pending", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.route("**/api/project", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await page.goto("/workshop");
    await expect(page.getByText("Waking the workshop")).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/Reading the saved project/);
    await expect(page.getByRole("heading", { name: "Unfinished Business" })).toBeVisible();
  });

  test("workshop primary actions expose a visible keyboard focus ring", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/workshop");
    const action = page.getByRole("button", { name: "Begin discovery" });
    await action.focus();
    const outline = await action.evaluate((element) => getComputedStyle(element).outlineWidth);
    expect(outline).not.toBe("0px");
    await page.keyboard.press("Tab");
    const next = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(next).not.toBe("BODY");
  });
});
