// 가로 넘침 점검 — 360·768·1280px에서 페이지 너비가 화면보다 넓은지 본다
// 사용: (저장소 루트에서 python3 -m http.server 8796 --bind 127.0.0.1 를 띄운 뒤) node overflow.js column/a.html column/b.html ...
const { chromium } = require('playwright');
(async () => {
  const paths = process.argv.slice(2);
  const b = await chromium.launch();
  let bad = 0;
  for (const w of [360, 768, 1280]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    for (const path of [...paths, 'column/index.html']) {
      await p.goto(`http://127.0.0.1:8796/${path}`, { waitUntil: 'load' });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      const ok = sw <= w;
      if (!ok) bad++;
      console.log(w, path, ok ? 'OK' : 'OVERFLOW ' + sw);
    }
    await p.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
