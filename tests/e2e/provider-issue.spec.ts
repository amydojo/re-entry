import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.locator("html[data-hydrated='true']").waitFor();
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Provider email").fill("provider@example.com");
  await page.getByLabel("Password").fill("demo-password");
  await page.getByRole("button", { name: /Sign in to Skin Pass desk/ }).click();
  await expect(page.getByRole("heading", { name: "Skin Pass desk" })).toBeVisible();
}

test("provider issues a Skin Pass from the fixed Microneedling edition", async ({ page }, testInfo) => {
  await signIn(page);
  await page.getByRole("link", { name: /Issue a new Skin Pass/ }).click();
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: /Microneedling/ })).toContainText("V1 · FIXED");
  await page.getByLabel("Client name").fill("Jordan Lee");
  await page.getByLabel("Client mobile").fill("+16265550143");
  await page.getByLabel("Treatment date").fill("2026-07-20");
  await page.getByRole("button", { name: /Review exact client artifact/ }).click();
  await expect(page.getByText(/Template version 1/)).toBeVisible();
  await page.getByRole("button", { name: /^Issue Skin Pass$/ }).click();
  await expect(page.getByRole("heading", { name: /Microneedling Skin Pass is live/ })).toBeVisible();
  await expect(page.getByText(/TEMPLATE 1 · PASS 1/)).toBeVisible();
  await expect(page.getByText(/demo-protocol-token/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("provider-issued.png"), fullPage: true });
});

test("provider reviews a future-event version difference", async ({ page }) => {
  await page.goto("/desk/pass/22222222-2222-4222-8222-222222222222");
  await waitForHydration(page);
  await page.getByRole("button", { name: /Edit future return date/ }).click();
  await page.getByLabel("Return event").selectOption("55555555-5555-4555-8555-555555555552");
  await page.getByLabel("New return date").fill("2026-07-26");
  await page.getByLabel("Reason for update").fill("Provider extended the hold by one day.");
  await page.getByRole("button", { name: /Review version difference/ }).click();
  await expect(page.getByText(/Previous:/)).toBeVisible();
  await expect(page.getByText(/New:/)).toBeVisible();
  await expect(page.getByText(/protocol version 2/i)).toBeVisible();
});
