/* 노아 차트 툴팁 — 마우스·터치·키보드 같은 내용. 값이 굵게 먼저, 이름은 아래. 글자는 textContent로만 넣는다 */
(function () {
  'use strict';
  var tip = null, KEY = { s1: '#2a78d6', s2: '#eb6834', de: '#c3c2b7' };
  function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
  function show(t, x, y) {
    if (!tip) { tip = el('div'); tip.className = 'viz-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = '';
    (t.getAttribute('data-tip-v') || '').split('|').forEach(function (v) {
      var m = /^(s1|s2|de):(.*)$/.exec(v), row = el('b');
      if (m) {   // 여러 계열이면 계열 색 짧은 선으로 구분
        var k = el('i'); k.style.cssText = 'display:inline-block;width:12px;height:2px;margin-right:6px;vertical-align:middle;background:' + KEY[m[1]];
        row.appendChild(k); v = m[2];
      }
      row.appendChild(document.createTextNode(v)); tip.appendChild(row);
    });
    tip.appendChild(el('span', t.getAttribute('data-tip-l') || ''));
    tip.style.display = 'block';
    var r = tip.getBoundingClientRect(), top = y - r.height - 12;
    tip.style.left = Math.max(8, Math.min(x + 12, innerWidth - r.width - 8)) + 'px';
    tip.style.top = (top < 8 ? y + 16 : top) + 'px';
  }
  function hide() { if (tip) tip.style.display = 'none'; }
  function on(e) {
    var t = e.target.closest && e.target.closest('.viz [data-tip-v]');
    if (t) show(t, e.clientX, e.clientY); else hide();
  }
  document.addEventListener('pointermove', on);
  document.addEventListener('pointerdown', on);
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('.viz [data-tip-v]');
    if (!t) return hide();
    var r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', hide, { passive: true });
})();
