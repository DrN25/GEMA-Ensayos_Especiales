import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.setContent(`
    <button id="btn">Click me</button>
    <script>
      document.getElementById('btn').onclick = () => {
        const blob = new Blob(['hello,world'], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'test.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    </script>
  `);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn')
  ]);

  console.log('Download received:', download.suggestedFilename());
  await browser.close();
})();

