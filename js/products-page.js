// 새로고침 시 최상단 고정 (브라우저 스크롤 복원 차단)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('pageshow', () => window.scrollTo(0, 0));

// ===== Custom cursor — 골드 도트 + 딜레이 링 + 트레일 =====
(() => {
  const cursor = document.querySelector('.cursor');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePtr = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!cursor || !finePtr || reduced) { if (cursor) cursor.style.display = 'none'; return; }
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.appendChild(ring);
  let mx = 0, my = 0, dx = 0, dy = 0, rx = 0, ry = 0, lastTrail = 0;
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    const now = performance.now();
    if (now - lastTrail > 55) {
      lastTrail = now;
      const t = document.createElement('span');
      t.className = 'cursor-trail';
      t.style.left = mx + 'px'; t.style.top = my + 'px';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 820);
    }
  });
  const tick = () => {
    dx += (mx - dx) * 0.32; dy += (my - dy) * 0.32;
    cursor.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) translate(-50%, -50%)`;
    rx += (mx - rx) * 0.13; ry += (my - ry) * 0.13;
    ring.style.transform = `translate(${rx.toFixed(1)}px, ${ry.toFixed(1)}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  tick();
  document.querySelectorAll('a, button, .product-card, .cat-filter').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hover'); ring.classList.add('hover'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hover'); ring.classList.remove('hover'); });
  });
  document.addEventListener('mousedown', () => ring.classList.add('click'));
  document.addEventListener('mouseup', () => ring.classList.remove('click'));
})();

// ===== Category filter =====
const filters = document.querySelectorAll('.cat-filter');
const cards = document.querySelectorAll('.product-card');
const applyFilter = (cat) => {
  filters.forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  cards.forEach(card => {
    const match = cat === 'all' || card.dataset.cat === cat;
    card.classList.toggle('hide', !match);
  });
};
filters.forEach(btn => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.cat));
});

// URL 해시(#cc / #lab / #db) 자동 필터 — 홈에서 서비스 허브 카드로 진입 시
const applyHashFilter = () => {
  const hash = (location.hash || '').replace('#', '').toLowerCase();
  if (['cc', 'lab', 'db'].includes(hash)) {
    applyFilter(hash);
    // 필터 영역으로 스크롤
    const filterSection = document.querySelector('.cat-filter')?.closest('section');
    if (filterSection) {
      setTimeout(() => filterSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }
};
applyHashFilter();
window.addEventListener('hashchange', applyHashFilter);

// ===== Sub-label draw-in =====
const subLabelIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('drawn');
      subLabelIO.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.sub-label').forEach(el => subLabelIO.observe(el));

// ===== Language detection toast (non-Korean browsers) =====
(() => {
  const toast = document.getElementById('langToast');
  const LT_KEY = 'noah_lang_toast_v1';
  if (!toast) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(LT_KEY) === '1'; } catch {}
  if (dismissed) return;
  const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
  const isKorean = (langs[0] || '').toLowerCase().startsWith('ko') || langs.some(l => l.toLowerCase().startsWith('ko'));
  if (isKorean) return;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('lang') === 'ko') return;
  } catch {}
  toast.removeAttribute('hidden');
  setTimeout(() => toast.classList.add('visible'), 1200);
  document.getElementById('langToastClose')?.addEventListener('click', () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('dismissed'), 500);
    try { sessionStorage.setItem(LT_KEY, '1'); } catch {}
  });
  toast.querySelector('.lt-cta')?.addEventListener('click', () => {
    try { sessionStorage.setItem(LT_KEY, '1'); } catch {}
  });
})();

// ===== Top button & scroll + Bottom banner =====
const topBtn = document.querySelector('.btn-top');
const bottomBanner = document.getElementById('bottomBanner');
const BB_DISMISSED_KEY = 'noah_bb_dismissed_v1';
const bbDismissed = (() => {
  try { return sessionStorage.getItem(BB_DISMISSED_KEY) === '1'; } catch { return false; }
})();
if (bottomBanner) {
  bottomBanner.removeAttribute('hidden');
  if (bbDismissed) bottomBanner.classList.add('dismissed');
}
let bbShown = false;

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  topBtn?.classList.toggle('show', y > 400);
  if (bottomBanner && !bbDismissed) {
    const shouldShow = y > 400;
    if (shouldShow && !bbShown) {
      bottomBanner.classList.add('visible');
      document.body.classList.add('bb-active');
      bbShown = true;
    } else if (!shouldShow && bbShown) {
      bottomBanner.classList.remove('visible');
      document.body.classList.remove('bb-active');
      bbShown = false;
    }
  }
}, { passive: true });
topBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('bbClose')?.addEventListener('click', () => {
  bottomBanner?.classList.remove('visible');
  document.body.classList.remove('bb-active');
  setTimeout(() => bottomBanner?.classList.add('dismissed'), 500);
  try { sessionStorage.setItem(BB_DISMISSED_KEY, '1'); } catch {}
});

// ===== Hamburger =====
const ham = document.querySelector('.ham');
const gnb = document.querySelector('.gnb');
const setNav = (open) => {
  document.body.classList.toggle('nav-open', open);
  ham?.setAttribute('aria-expanded', String(open));
};
ham?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
