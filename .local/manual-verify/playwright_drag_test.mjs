// Playwright simulation for drag/drop and tauri:// event handling
// Usage: install playwright (optional) and run with node: node ./.local/manual-verify/playwright_drag_test.mjs
// This script attempts to open the UI dev server and simulate both HTML5 DataTransfer drops
// and custom tauri:// drag events by dispatching them on the window. It does not perform
// OS-level Finder/Explorer drag-and-drop (requires interactive desktop).

import { chromium } from 'playwright';

const DEV_URL = process.env.DEV_URL || 'http://localhost:5174/';

async function simulate() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log('Opening', DEV_URL);
  await page.goto(DEV_URL, { waitUntil: 'networkidle' });

  // Dispatch tauri://drag-enter
  await page.evaluate(() => {
    const ev = new CustomEvent('tauri://drag-enter', { detail: { paths: ['/Users/alice/Music/sample.wav'] } });
    // @ts-ignore
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(300);

  // Simulate HTML5 dragenter + drop with DataTransfer containing text/uri-list
  await page.evaluate(() => {
    function createDataTransfer(text) {
      return {
        files: [],
        types: ['text/uri-list'],
        getData: (t) => (t === 'text/uri-list' ? text : ''),
      };
    }

    const dt = createDataTransfer('file:///Users/alice/Music/sample.wav');
    const list = document.querySelector('div[style*="position: relative"]') || document.body;
    // Node/Esm can't use TypeScript 'as' casts; just pass the object directly
    const dragenter = new DragEvent('dragenter', { dataTransfer: dt });
    list.dispatchEvent(dragenter);
    const drop = new DragEvent('drop', { dataTransfer: dt });
    list.dispatchEvent(drop);
  });

  console.log('Simulated drag events. Waiting for UI to react...');
  await page.screenshot({ path: '.local/manual-verify/import-overlay-sim.png', fullPage: true });
  console.log('Saved screenshot .local/manual-verify/import-overlay-sim.png');

  await browser.close();
}

simulate().catch((err) => {
  console.error('Playwright simulation failed:', err);
  process.exit(1);
});
