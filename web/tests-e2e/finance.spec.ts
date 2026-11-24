import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

async function connectFinance(page: Page) {
  await page.goto("/connections", { waitUntil: "networkidle" });
  await page.getByRole("region", { name: "Finance Office" }).getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Allow" }).click();
  await expect(page.getByRole("region", { name: "Finance Office" }).getByText("Connected", { exact: true })).toBeVisible();
}

async function ask(page: Page, text: string) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill(text);
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  return dialog;
}

const pdfText = (path: string | null) => readFileSync(path!).toString("latin1");

test("the assistant finds an invoice in the account statement and the student downloads it as a PDF", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await connectFinance(page);
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /Post tuition instalment 2/ }).getByRole("button", { name: "Trigger" }).click();

  const dialog = await ask(page, "Find my tuition invoice for instalment 2 and download it");
  const card = dialog.getByRole("region", { name: "Documents you can download" });
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(/I found 1 matching document/)).toBeVisible();
  await expect(card.getByText("Invoice DEMO-IV-200188")).toBeVisible();
  await expect(card.getByText("Unpaid")).toBeVisible();
  await expect(dialog.getByText(/Nothing is sent anywhere/)).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Download invoice" }).click()]);
  expect(download.suggestedFilename()).toBe("invoice-DEMO-IV-200188.pdf");
  const pdf = pdfText(await download.path());
  expect(pdf.startsWith("%PDF-1.4")).toBe(true);
  expect(pdf).toContain("DEMO-IV-200188");
  expect(pdf).toContain("4,350.00");
  expect(pdf).toContain("Fictional demo document");
  expect(errors).toEqual([]);
});

test("a paid invoice comes with the receipt that paid it, and the whole statement can be downloaded", async ({ page }) => {
  await connectFinance(page);
  const dialog = await ask(page, "I need the receipt for my tuition payment");
  const card = dialog.getByRole("region", { name: "Documents you can download" });
  await expect(card.getByText("Receipt DEMO-OR-100307")).toBeVisible({ timeout: 15000 });
  const [receipt] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Download receipt" }).click()]);
  expect(receipt.suggestedFilename()).toBe("receipt-DEMO-OR-100307.pdf");
  expect(pdfText(await receipt.path())).toContain("Payment for invoice");
  const [statement] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Account statement" }).click()]);
  expect(statement.suggestedFilename()).toBe("account-statement.pdf");
  expect(pdfText(await statement.path())).toContain("Outstanding balance: RM 0.00");
});

test("without a Finance connection the assistant says so instead of guessing", async ({ page }) => {
  const dialog = await ask(page, "Find my tuition invoice and download it");
  await expect(dialog.getByText(/once the Finance Office is connected/)).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole("region", { name: "Documents you can download" })).toHaveCount(0);
});

test("a request for an email draft about an invoice still goes to the email flow, not the document finder", async ({ page }) => {
  await connectFinance(page);
  const dialog = await ask(page, "Draft an email to Finance about my invoice");
  await expect(dialog.getByText(/Subject:/).first()).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole("region", { name: "Documents you can download" })).toHaveCount(0);
});

test("the Finance page lists invoices and receipts with a PDF for each once Finance is connected", async ({ page }) => {
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(page.getByRole("list", { name: "Invoices and receipts" })).toHaveCount(0);
  await connectFinance(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  const list = page.getByRole("list", { name: "Invoices and receipts" });
  await expect(list).toContainText("Invoice DEMO-IV-200102");
  const [d] = await Promise.all([page.waitForEvent("download"), list.getByRole("button", { name: "Download invoice DEMO-IV-200102 as PDF" }).click()]);
  expect(d.suggestedFilename()).toBe("invoice-DEMO-IV-200102.pdf");
});

test("the demo student portal shows the statement, a document page and a download list, and follows the console", async ({ page, context }) => {
  await page.goto("/demo/student-portal", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/outstanding balance of/)).toContainText("RM0.00");
  await expect(page.getByText(/not issued by any university|Demo console, fictional data/).first()).toBeVisible();

  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /Post tuition instalment 2/ }).getByRole("button", { name: "Trigger" }).click();
  await expect(page.getByText(/outstanding balance of/)).toContainText("RM4,350.00", { timeout: 8000 });

  await page.getByRole("navigation", { name: "Console sections" }).first().getByRole("link", { name: "Account Status" }).click();
  await expect(page.getByRole("heading", { name: "Account Status" })).toBeVisible();
  for (const col of ["Date", "Doc No", "Description", "Debit (RM)", "Credit (RM)", "Balance (RM)"]) await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
  await expect(page.getByRole("row", { name: /DEMO-IV-200188/ })).toContainText("4,350.00");
  await page.getByRole("link", { name: "DEMO-IV-200188" }).click();
  await expect(page.getByRole("heading", { name: "Invoice DEMO-IV-200188" }).first()).toBeVisible();
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(d.suggestedFilename()).toBe("invoice-DEMO-IV-200188.pdf");

  await page.goto("/demo/student-portal/documents/DEMO-IV-999999", { waitUntil: "networkidle" });
  await expect(page.getByText("No such document")).toBeVisible();
  await page.goto("/demo/student-portal/files", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Download invoice DEMO-IV-200102" })).toBeVisible();
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("the student portal pages fit 320px", async ({ page }) => {
    for (const path of ["/demo/student-portal", "/demo/student-portal/account-status", "/demo/student-portal/files", "/demo/student-portal/documents/DEMO-IV-200102"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} should not scroll horizontally`).toBeLessThanOrEqual(320);
    }
  });
});
