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

// ===== Top button & scroll =====
const topBtn = document.querySelector('.btn-top');
window.addEventListener('scroll', () => {
  if (window.scrollY > 400) topBtn.classList.add('show');
  else topBtn.classList.remove('show');
}, { passive: true });
topBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== Hamburger =====
const ham = document.querySelector('.ham');
const gnb = document.querySelector('.gnb');
const setNav = (open) => {
  document.body.classList.toggle('nav-open', open);
  ham.setAttribute('aria-expanded', String(open));
};
ham?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
