// Playwright simulation for drag/drop and tauri:// event handling (UI-local copy)
import { chromium } from 'playwright';

const DEV_URL = process.env.DEV_URL || 'http://localhost:5174/';

async function simulate() {
  const executablePath = process.env.CHROME_PATH || null;
  const launchOpts = executablePath ? { executablePath } : {};
  if (executablePath) console.log('Launching chromium with executablePath=', executablePath);
  const browser = await chromium.launch(launchOpts);
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
    const dragenter = new DragEvent('dragenter', { dataTransfer: dt });
    list.dispatchEvent(dragenter);
    const drop = new DragEvent('drop', { dataTransfer: dt });
    list.dispatchEvent(drop);
  });

  console.log('Simulated drag events. Waiting for UI to react...');
  await page.screenshot({ path: '.local/manual-verify/import-overlay-sim-ui.png', fullPage: true });
  console.log('Saved screenshot ui/.local/manual-verify/import-overlay-sim-ui.png');

  await browser.close();
}

simulate().catch((err) => {
  console.error('Playwright simulation failed:', err);
  process.exit(1);
});
