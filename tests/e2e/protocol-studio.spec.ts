import { expect, test, type Page } from "@playwright/test";

async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated='true']").waitFor();
}

async function openClientLink(page: Page, url: string) {
  await page.goto(url);
  await waitForHydration(page);
  const openButton = page.getByRole("button", { name: "Open Skin Pass" });
  if (await openButton.isVisible().catch(() => false)) await openButton.click();
}

test("Protocol Studio publishes immutable Light Chemical Peel editions", async ({ page }, testInfo) => {
  await page.goto("/protocols/new");
  await waitForHydration(page);

  await expect(page.getByRole("heading", { name: "Light Chemical Peel" })).toBeVisible();
  await expect(page.getByLabel("Client lookup aliases").first()).toHaveValue("cleanser, face wash");
  await expect(page.getByText("Place each return in time.")).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("The real Skin Pass engine is running against unsaved draft data.")).toBeVisible();
  await page.getByLabel("Test client lookup").fill("foundation");
  await expect(page.getByText("Returns next", { exact: true })).toBeVisible();
  await page.getByLabel("Test client lookup").fill("vitamin c");
  await expect(page.getByText("Not listed", { exact: true })).toBeVisible();
  await page.getByLabel("Test client lookup").fill("my skin is burning");
  await expect(page.getByText("Contact provider", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("protocol-client-preview.png"), fullPage: true });

  await page.getByRole("button", { name: "Author" }).click();
  await page.getByRole("button", { name: "Review publication" }).click();
  await expect(page.getByRole("heading", { name: "Publication review" })).toBeVisible();
  await expect(page.getByText("Enabled items")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("protocol-publish-review.png"), fullPage: true });
  await page.getByLabel("Publication note").fill("Initial provider-authored Light Chemical Peel edition.");
  await page.getByRole("button", { name: "Publish edition 1" }).click();
  await expect(page.getByRole("heading", { name: "The protocol is fixed." })).toBeVisible();

  await page.getByRole("link", { name: "Issue from edition 1" }).click();
  await waitForHydration(page);
  await page.getByLabel("Client name").fill("Edition One Client");
  await page.getByLabel("Treatment date").fill("2026-07-20");
  await page.getByRole("button", { name: "Review exact client artifact" }).click();
  await page.getByRole("button", { name: /^Issue Skin Pass$/ }).click();
  const versionOneUrl = await page.locator(".copy-code").innerText();
  await expect(page.getByText(/TEMPLATE 1 · PASS 1/)).toBeVisible();

  await page.goto("/protocols");
  await page.getByRole("link", { name: "Open instrument" }).filter({ has: page.locator("text=Light Chemical Peel") }).click().catch(async () => {
    await page.getByRole("link", { name: "Light Chemical Peel" }).click();
  });
  await waitForHydration(page);
  const retinoidGroup = page.getByRole("group", { name: /Item 07 · Retinoid/ });
  await retinoidGroup.getByLabel("Return day").selectOption("9");
  await page.getByRole("button", { name: "Review publication" }).click();
  await page.getByLabel("Publication note").fill("Move retinoid return to Day 9.");
  await page.getByRole("button", { name: "Publish edition 2" }).click();
  await expect(page.getByText(/EDITION 02/)).toBeVisible();

  await page.getByRole("button", { name: "Open version history" }).click();
  await expect(page.getByText("Move retinoid return to Day 9.")).toBeVisible();
  await expect(page.getByText("Initial provider-authored Light Chemical Peel edition.")).toBeVisible();

  await page.goto("/issue");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: /Light Chemical Peel/ })).toContainText("V2 · FIXED");
  await page.getByLabel("Client name").fill("Edition Two Client");
  await page.getByLabel("Treatment date").fill("2026-07-20");
  await page.getByRole("button", { name: "Review exact client artifact" }).click();
  await page.getByRole("button", { name: /^Issue Skin Pass$/ }).click();
  const versionTwoUrl = await page.locator(".copy-code").innerText();
  await expect(page.getByText(/TEMPLATE 2 · PASS 1/)).toBeVisible();

  await openClientLink(page, versionOneUrl);
  await page.getByRole("button", { name: /Check a product or activity/ }).click();
  await page.getByLabel("Product or activity").fill("retinol");
  await page.getByRole("button", { name: "Check this item" }).click();
  await expect(page.getByText(/Returns in 8 days/)).toBeVisible();

  await openClientLink(page, versionTwoUrl);
  await page.getByRole("button", { name: /Check a product or activity/ }).click();
  await page.getByLabel("Product or activity").fill("retinol");
  await page.getByRole("button", { name: "Check this item" }).click();
  await expect(page.getByText(/Returns in 7 days/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("light-chemical-peel-client.png"), fullPage: true });

  await page.goto("/protocols");
  await page.getByRole("link", { name: "Light Chemical Peel" }).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await expect(page.getByRole("heading", { name: "Light Chemical Peel" })).toBeVisible();
  await expect(page.getByText("New issuance is closed.")).toBeVisible();

  await page.goto("/issue");
  await expect(page.getByRole("button", { name: /Light Chemical Peel/ })).toHaveCount(0);
  await openClientLink(page, versionOneUrl);
  await expect(page.getByText("Light Chemical Peel").first()).toBeVisible();
});

test("Protocol Studio remains operable at a narrow provider width and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/protocols/new");
  await waitForHydration(page);
  await expect(page.getByLabel("Internal protocol name")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  await expect(page.getByText("Place each return in time.")).toBeVisible();
});
