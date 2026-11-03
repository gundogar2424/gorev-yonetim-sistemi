// Kareleri paralel işçilerle PNG olarak çizer: node video_par.js sayfa.html outdir T fps workerIndex workerCount
const { chromium } = require('playwright');
(async () => {
  const [page, out, T, fps, wi, wn] = process.argv.slice(2);
  const n = Math.round(+T * +fps);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + page + '#capture');
  for (let i = +wi; i < n; i += +wn) {
    await pg.evaluate(t => render(t), i / +fps);
    await pg.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.png` });
  }
  await b.close();
})();
