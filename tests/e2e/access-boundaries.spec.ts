import { expect, test } from "@playwright/test";

test("an invalid token exposes no protocol details", async ({ page }) => {
  await page.goto("/client/SP-0042/not-a-valid-token-value");
  await expect(page.getByRole("heading", { name: "This Skin Pass cannot be opened." })).toBeVisible();
  await expect(page.getByText("Microneedling")).toHaveCount(0);
  await expect(page.getByText("Makeup")).toHaveCount(0);
});
