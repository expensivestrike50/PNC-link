import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chromium" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', route => route.fulfill({status:503, body:'Unavailable'}));
  await page.goto('http://localhost:8889/#/guest');
  await page.getByLabel('Owner name', {exact:true}).fill('Guest Owner');
  await page.getByLabel('Business name', {exact:true}).fill('Guest Business');
  await page.getByLabel('Industry', {exact:true}).fill('Manufacturing');
  for (const [name, value] of [["Years until preferred transition", "3"], ["Annual revenue ($)", "1000000"], ["Annual EBITDA ($)", "100000"], ["Outstanding business debt ($)", "0"], ["Your current ownership (%)", "100"], ["Desired personal liquidity ($)", "0"], ["Desired retained ownership after transition (%)", "0"]]) await page.getByLabel(name, {exact:true}).fill(value);
  await page.locator('form[data-form="profile"] button:not([type])').click();
  await page.getByRole('heading', {name:'Guest Business', exact:true}).waitFor();
  await page.reload();
  await page.getByRole('heading', {name:'Guest Business', exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: signup bypass, local case save, and refresh with all APIs unavailable');
} finally { await browser.close(); }
