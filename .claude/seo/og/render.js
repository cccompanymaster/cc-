// 공유 이미지(OG) 생성기 — 사이트 폰트(Pretendard)로 PNG를 다시 만든다.
//   준비: Playwright(Chromium)와 'Pretendard Variable' 폰트가 시스템에 설치돼 있어야 함
//         (예: npm pack pretendard → dist/public/variable/PretendardVariable.ttf 를 ~/.local/share/fonts 에 복사 후 fc-cache -f)
//   사용: node .claude/seo/og/render.js            → cards.json 전체 + 메인 배너·정사각 로고
//         node .claude/seo/og/render.js blog-ad     → out 경로에 'blog-ad'가 들어간 것만
//   새 칼럼을 추가하면 cards.json에 {out(.jpg), lang(ko|en|zh), kicker, title, foot} 항목을 넣고 실행
//   (제목의 ' — ' 뒤는 부제로 작게, 중국어는 \u200b로 줄바꿈 위치 지정, 직접 나누려면 lines+breaks:true)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../../..');
const filter = process.argv[2] || '';
(async () => {
  const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + path.join(__dirname, 'card.html'));
  await p.evaluate(() => document.fonts.ready);
  for (const c of cards) {
    if (filter && !c.out.includes(filter)) continue;
    const r = await p.evaluate((c) => window.renderCard(c), c);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(ROOT, c.out), ...(c.out.endsWith('.jpg') ? { type: 'jpeg', quality: 90 } : {}) });
    console.log(c.out, `${r.fontSize}px·${r.lines}줄` + (r.subLines ? ` + 부제 ${r.subLines}줄` : ''));
  }
  // 메인 공유 배너(1200x630)·정사각 로고(1024x1024)
  for (const [q, out, w, h] of [['', 'og-noah-glass.png', 1200, 630], ['?sq=1', 'og-logo-square.png', 1024, 1024]]) {
    if (filter && !out.includes(filter)) continue;
    const m = await b.newPage({ viewport: { width: w, height: h } });
    await m.goto('file://' + path.join(__dirname, 'main.html') + q);
    await m.evaluate(() => document.fonts.ready);
    await m.waitForTimeout(200);
    await m.screenshot({ path: path.join(ROOT, out) });
    console.log(out);
    await m.close();
  }
  await b.close();
})();
