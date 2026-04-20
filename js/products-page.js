// ===== Category filter =====
const filters = document.querySelectorAll('.cat-filter');
const cards = document.querySelectorAll('.product-card');
filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    cards.forEach(card => {
      const match = cat === 'all' || card.dataset.cat === cat;
      card.classList.toggle('hide', !match);
    });
  });
});

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
