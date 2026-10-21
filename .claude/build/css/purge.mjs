// css/style.css(아티클·저자 56쪽)와 css/style-home.css(영문·중문 메인·상품 4쪽)를 style.full.css에서 다시 만든다.
// 실행: cd .claude/build/css && npm i purgecss@8.0.0 csso@5.0.5 && node purge.mjs
// 새 클래스를 쓰려면 style.full.css에 규칙을 넣고 이 스크립트를 다시 돌린다 (css/style*.css를 직접 고치지 않는다).
import { PurgeCSS } from 'purgecss';
import { minify } from 'csso';
import fs from 'fs';
import path from 'path';
const R = path.resolve(import.meta.dirname, '../../..') + '/';
const css = fs.readFileSync(import.meta.dirname + '/style.full.css', 'utf8');
const html = [];
(function walk(d) {
  for (const f of fs.readdirSync(R + d, { withFileTypes: true })) {
    if (f.name.startsWith('.') || ['node_modules', 'templates'].includes(f.name)) continue;
    const p = d + f.name;
    if (f.isDirectory()) walk(p + '/'); else if (p.endsWith('.html')) html.push(p);
  }
})('');
const uses = name => html.filter(p => new RegExp(`href="(\\.\\./)?css/${name}"`).test(fs.readFileSync(R + p, 'utf8')));
// 속성 선택자(a[href^="tel:"] 등)는 PurgeCSS가 값까지 못 읽어 지우므로 속성 이름째 보존
const attrs = [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\[([a-zA-Z_:-]+)\s*(?:[~|^$*]?=|\])/g)].map(m => m[1]))];
async function build(out, pages, js) {
  const [res] = await new PurgeCSS().purge({
    content: [...pages, ...js].map(p => R + p), css: [{ raw: css }],
    safelist: { standard: [/^swiper/, /^is-/, /^has-/, /^js-/], greedy: [/swiper/] },
    keyframes: true, fontFace: false, variables: false, dynamicAttributes: attrs,
  });
  let min = minify(res.css, { restructure: false, comments: false }).css;
  // PurgeCSS는 의사 클래스만으로 된 :lang(en)을 지운다 → 원래 자리(html 규칙 바로 뒤)에 되살림
  const anchor = 'max-width:100vw}body{';
  if (!min.includes(':lang(en)')) {
    if (!min.includes(anchor)) throw new Error('anchor not found');
    min = min.replace(anchor, 'max-width:100vw}:lang(en),.en-txt{word-break:normal}body{');
  }
  fs.writeFileSync(R + 'css/' + out, min);
  console.log(out, pages.length, 'pages', min.length, 'bytes');
}
await build('style.css', uses('style.css'), ['js/legacy-nav.js', 'js/track.js']);
await build('style-home.css', uses('style-home.css'), ['js/script.js', 'js/products-page.js', 'js/track.js']);
