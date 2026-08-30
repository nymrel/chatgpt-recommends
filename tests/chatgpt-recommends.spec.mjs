import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const toolPath = "/tools/chatgpt-recommends/";
const businessName = "Nymrel Local Only 8675309";
const pastedAnswer = `${businessName} is the leading studio in Portland. Another option is Example Works.`;

test.beforeEach(async ({ page }) => {
  await page.goto(toolPath, { waitUntil: "domcontentloaded" });
});

test("scores and persists inputs without putting them on the network", async ({ page }) => {
  const leakedRequests = [];
  page.on("request", (request) => {
    const requestText = `${request.url()}\n${request.postData() ?? ""}`.toLowerCase();
    if (
      requestText.includes("nymrel%20local%20only%208675309") ||
      requestText.includes(businessName.toLowerCase())
    ) {
      leakedRequests.push({ method: request.method(), url: request.url() });
    }
  });

  await page.locator("#bizName").fill(businessName);
  await page.locator("#bizCity").fill("Portland");
  await page.locator("#bizCat").fill("software studio");
  await expect(page.locator("#copy1")).toBeEnabled();

  await page.locator("#paste1").fill(pastedAnswer);
  await expect(page.locator("#verdictResult")).toBeVisible();
  await expect(page.locator("#vbScore")).toContainText("100");
  await expect(page.locator("#scoreMeta")).toContainText("1 of 3 answers");
  expect(leakedRequests).toEqual([]);

  const stored = await page.evaluate(() => ({
    inputs: localStorage.getItem("jbt.recommends.inputs"),
    answers: localStorage.getItem("jbt.recommends.answers"),
  }));
  expect(stored.inputs).toContain(businessName);
  expect(stored.answers).toContain(businessName);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#bizName")).toHaveValue(businessName);
  await expect(page.locator("#paste1")).toHaveValue(pastedAnswer);
  await expect(page.locator("#vbScore")).toContainText("100");

  await page.locator("#resetBtn").click();
  await expect(page.locator("#bizName")).toHaveValue("");
  await expect(page.locator("#paste1")).toHaveValue("");
  const cleared = await page.evaluate(() => ({
    inputs: localStorage.getItem("jbt.recommends.inputs"),
    answers: localStorage.getItem("jbt.recommends.answers"),
  }));
  expect(cleared).toEqual({ inputs: null, answers: null });
});

test("has no serious accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking).toEqual([]);
});

test("stays operable without horizontal overflow", async ({ page }) => {
  await page.locator("#bizName").fill("Example Studio");
  await page.locator("#bizCity").fill("Tacoma");
  await page.locator("#bizCat").fill("design studio");
  await page.locator("#paste1").fill("Example Studio is the leading design studio in Tacoma.");
  await expect(page.locator("#verdictResult")).toBeVisible();
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
});
