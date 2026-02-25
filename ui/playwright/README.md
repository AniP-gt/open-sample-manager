Playwright integration instructions

This directory contains an example Playwright E2E test for capturing the
IMPORT overlay and testing a drop flow. The repository does not include
Playwright as a devDependency by default to avoid adding browser drivers to
every developer's environment.

To run the Playwright test locally:

1. Install Playwright and browsers:

   npm install -D @playwright/test && npx playwright install

2. Start the Vite dev server (Tauri dev uses the same dev URL):

   npm run dev --prefix ui

3. Run the Playwright test in this directory:

   npx playwright test ui/playwright/overlay.spec.ts --project=chromium

The test simulates a dragenter and drop event with a text/uri-list payload
and captures a screenshot named `playwright-overlay-screenshot.png` in the
repo root. If your environment is headless or the selector fails, run the
test in headed mode with `--headed`.

Notes:
- The test assumes the dev server is reachable at http://localhost:5173.
- Playwright cannot emulate OS-level Finder/Explorer drag payloads exactly;
  it uses text/uri-list for cross-platform compatibility.
