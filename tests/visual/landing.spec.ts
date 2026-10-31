import { test, expect } from "@playwright/test";

const spiritStates = {
  oracle: ["idle", "listening", "clarification"],
  architect: ["idle", "drawing", "approval"],
  maker: ["idle", "building", "permission", "blocked", "success"],
  witness: ["idle", "scanning", "evidence", "warning", "stamp"],
} as const;

test.describe("landing", () => {
  test("wide layout, claims, and primary calls to action", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn unfinished ideas into hackathon-ready builds.");
    await expect(page.getByRole("link", { name: "Try the example" }).first()).toHaveAttribute("href", "/demo");
    await expect(page.getByRole("link", { name: "Set up locally" }).first()).toHaveAttribute("href", "#local-setup");
    await expect(page.getByRole("button", { name: "Connect OpenCode" }).first()).toBeVisible();
    await expect(page.getByText("The example is a deterministic fixture, not live inference.")).toBeVisible();
    await expect(page.getByText("No second coding harness, no copied transcript database.")).toBeVisible();
    await expect(page.getByText("The public demo runs the deterministic walkthrough")).toBeVisible();
    await expect(page.getByText("never uses a visitor's repository and rejects every mutation")).toBeVisible();

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/trusted by|10,000|award-winning|guaranteed|used by \d/i);

    await expect(page).toHaveScreenshot("landing-wide.png");
  });

  test("narrow layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

    await expect(page).toHaveScreenshot("landing-narrow.png");
  });

  test("text zoom keeps the page usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("link", { name: "Try the example" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up locally" }).first()).toBeVisible();
  });

  test("keyboard order starts with skip link and shows a visible focus ring", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim(),
      tag: document.activeElement?.tagName,
    }));
    expect(first.tag).toBe("A");
    expect(first.text).toBe("Skip to main content");

    await page.keyboard.press("Tab");
    const second = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(second).toContain("Unfinished Business");

    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineWidth);
    expect(outline).not.toBe("0px");
  });

  test("connect dialog opens and closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Connect OpenCode" }).first().click();
    const dialog = page.getByRole("dialog", { name: /Point the workshop/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("docs/LOCAL_SETUP.md")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("setup tabs expose tested commands and arrow-key navigation", async ({ page }) => {
    await page.goto("/#local-setup");
    const tabs = page.getByRole("tablist", { name: "Local setup commands" });
    await expect(tabs.getByRole("tab", { name: "Install" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("npm ci");

    await tabs.getByRole("tab", { name: "Install" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "API" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("npm run dev");

    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Interface" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("npm run dev:web");
  });

  test("reduced motion removes character animation", async ({ page }) => {
    await page.goto("/");
    const animation = await page.locator(".spirit").first().evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe("none");
  });

  test("token contrast meets WCAG AA for body and action text", async ({ page }) => {
    await page.goto("/");
    const ratios = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const parse = (value: string) => {
        const hex = value.trim().replace("#", "");
        if (/^[0-9a-f]{6}$/i.test(hex)) {
          return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
        }
        const match = value.match(/\d+(?:\.\d+)?/g) ?? [];
        return match.slice(0, 3).map(Number);
      };
      const luminance = (rgb: number[]) => {
        const channel = rgb.map((value) => {
          const s = value / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
      };
      const ratio = (foreground: string, background: string) => {
        const a = luminance(parse(foreground));
        const b = luminance(parse(background));
        const lighter = Math.max(a, b);
        const darker = Math.min(a, b);
        return (lighter + 0.05) / (darker + 0.05);
      };
      return {
        body: ratio(styles.getPropertyValue("--text"), styles.getPropertyValue("--ink-0")),
        muted: ratio(styles.getPropertyValue("--text-muted"), styles.getPropertyValue("--ink-1")),
        action: ratio(styles.getPropertyValue("--amber-ink"), styles.getPropertyValue("--amber")),
        warning: ratio(styles.getPropertyValue("--status-warning"), styles.getPropertyValue("--ink-1")),
      };
    });
    for (const value of Object.values(ratios)) expect(value).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("workshop", () => {
  test("wide workshop focuses the main task and hides empty technical panels", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    const stages = page.getByRole("navigation", { name: "Four-stage workflow" }).getByRole("listitem");
    await expect(stages).toHaveCount(4);
    await expect(stages.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(page.getByText("Project outline").first()).toBeVisible();
    await expect(page.getByText("Project memory").first()).toBeVisible();
    await expect(page.getByTestId("run-inspector")).toHaveCount(0);
    await expect(page.getByText("Activity & results")).toHaveCount(0);
    await expect(page).toHaveScreenshot("workshop-wide.png", { fullPage: true });
  });

  test("project outline is keyboard operable and one main task stays visible", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/workshop");
    const outline = page.locator("summary").filter({ hasText: "Project outline" });
    await outline.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".outline-drawer .section-list")).toBeVisible();
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
  });

  test("first-run connection setup is reachable and keeps provider keys in OpenCode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    await page.getByRole("button", { name: "Open setup" }).first().click();
    await expect(page.getByRole("heading", { name: "Connect your OpenCode workshop" })).toBeVisible();
    await expect(page.getByText(/never asks for provider API keys/i)).toBeVisible();
    await expect(page.getByText(/Provider accounts are connected inside OpenCode/i)).toBeVisible();
    await expect(page).toHaveScreenshot("onboarding-wide.png");
  });

  test("narrow workshop has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workshop");
    await expect(page.getByRole("heading", { name: /What's still haunting/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot("workshop-narrow.png", { fullPage: true });
  });
});

test.describe("deterministic demo", () => {
  test("labels the fixture and captures every spirit state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Campus Umbrella Relay" })).toBeVisible();
    await expect(page.getByText(/No OpenCode session, provider call, repository read, or model quota is used/)).toBeVisible();

    for (const [spirit, states] of Object.entries(spiritStates)) {
      for (const state of states) {
        const card = page.getByTestId(`spirit-state-${spirit}-${state}`);
        await expect(card).toBeVisible();
        await expect(card).toHaveScreenshot(`spirit-${spirit}-${state}.png`);
      }
    }

    const next = page.getByRole("button", { name: "Next step" });
    for (let step = 0; step < 7; step += 1) await next.click();
    await expect(page.getByText("Deterministic check").first()).toBeVisible();
    await expect(page.getByTestId("run-inspector")).toHaveScreenshot("run-inspector.png");
    await expect(page.getByTestId("demo-recovery")).toHaveScreenshot("recovery-unknown.png");
  });

  test("demo is keyboard operable and honest on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    const next = page.getByRole("button", { name: "Next step" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Oracle clarifies the smallest useful product" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
