// Instagram Reels kapak görseli (1080×1920): node kapak.cjs sayfa.html cikti.png
const { chromium } = require('playwright');
(async () => {
  const [page, out] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + page + '#kapak'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out }); await b.close();
})();
