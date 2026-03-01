const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // Take screenshot of default UI (Lv 1)
  await page.evaluate(() => {
     appSettings.elfExp = 0;
     updateWorkSprite();
  });
  await page.screenshot({ path: '/Users/jazzxx/.gemini/antigravity/brain/acd09d9c-1ee1-457e-a5d9-7af80b6b41e1/elf_lv1.webp' });

  // Test Lv 4 (Pulsar) -> needs level 30 -> formula: L = floor(sqrt(EXP/10)) + 1
  // If L=30, sqrt(E/10) = 29 -> E/10 = 841 -> EXP = 8410. Let's use 9000.
  await page.evaluate(() => {
     appSettings.elfExp = 9000;
     updateWorkSprite();
  });
  await page.screenshot({ path: '/Users/jazzxx/.gemini/antigravity/brain/acd09d9c-1ee1-457e-a5d9-7af80b6b41e1/elf_lv4_pulsar.webp' });

  // Test Lv 7 (Cosmos) -> needs level 100 -> EXP = 98010. Let's use 100000.
  await page.evaluate(() => {
     appSettings.elfExp = 100000;
     updateWorkSprite();
  });
  await page.screenshot({ path: '/Users/jazzxx/.gemini/antigravity/brain/acd09d9c-1ee1-457e-a5d9-7af80b6b41e1/elf_lv7_cosmos.webp' });

  // Open settings to verify Calendar Integration UI
  await page.click('[onclick="openSettings()"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/jazzxx/.gemini/antigravity/brain/acd09d9c-1ee1-457e-a5d9-7af80b6b41e1/calendar_sync_ui.webp' });

  await browser.close();
  console.log("Screenshots captured successfully.");
})();
