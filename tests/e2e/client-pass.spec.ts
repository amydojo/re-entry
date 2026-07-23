import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.locator("html[data-hydrated='true']").waitFor();
}

async function openPass(page: import("@playwright/test").Page) {
  await page.goto("/client/SP-0042/demo-secure-token");
  await waitForHydration(page);
  await page.getByRole("button", { name: /Open Skin Pass/ }).click();
  await expect(page.getByRole("heading", { name: "Re-entry in progress" })).toBeVisible();
}

async function check(page: import("@playwright/test").Page, query: string, expected: string) {
  await page.getByRole("button", { name: /Check a product or activity/ }).click();
  await page.getByLabel("Product or activity").fill(query);
  await page.getByRole("button", { name: /Check this item/ }).click();
  await expect(page.getByRole("dialog").getByText(expected, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Back to pass/ }).click();
}

test("Day 2 state exposes the exact four answer outcomes without invention", async ({ page }, testInfo) => {
  await openPass(page);
  await expect(page.getByText("Makeup returns tomorrow", { exact: false })).toBeVisible();
  await expect(page.getByText("3 items available now. 2 remain held.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("client-day-2.png"), fullPage: true });
  await check(page, "Gentle cleanser", "AVAILABLE NOW");
  await check(page, "Retinoid", "NOT YET");
  await check(page, "Makeup", "RETURNS NEXT");
  await check(page, "Vitamin C", "NOT LISTED");
  await check(page, "My skin is burning", "CONTACT PROVIDER");
});

test("inventory, provider guidance, keyboard focus, and 402px viewport remain usable", async ({ page }) => {
  await openPass(page);
  await page.getByRole("button", { name: /AVAILABLE NOW/ }).click();
  await expect(page.getByRole("dialog").getByText("Gentle cleanser", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /PROVIDER GUIDANCE/ }).click();
  await expect(page.getByText(/does not diagnose/i)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("reduced motion uses an immediate state swap", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await openPass(page);
  const durationMs = await page.locator(".skin-pass").evaluate((element) => {
    const duration = getComputedStyle(element).animationDuration;
    return duration.endsWith("ms") ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000;
  });
  expect(durationMs).toBeLessThanOrEqual(0.001);
  await context.close();
});
