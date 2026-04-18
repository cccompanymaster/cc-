// ===== Intro =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('intro').classList.add('hide');
  }, 1800);
});

// ===== Custom cursor =====
const cursor = document.querySelector('.cursor');
if (cursor && matchMedia('(hover: hover)').matches) {
  let mx = 0, my = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  const tick = () => {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  tick();
  document.querySelectorAll('a, button, .company, .news-card, .client-item, .step').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

// ===== Header scroll state =====
const header = document.getElementById('header');
const topBtn = document.querySelector('.btn-top');
const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 50);
  topBtn.classList.toggle('show', y > 400);
};
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Top button =====
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== Hamburger =====
const ham = document.querySelector('.ham');
const gnb = document.querySelector('.gnb');
ham?.addEventListener('click', () => gnb.classList.toggle('open'));

// ===== Reveal on scroll =====
const revealSelector = '.sec-head, .about-points li, .company, .step, .client-item, .news-card, .kpi-item, .contact-wrap';
document.querySelectorAll(revealSelector).forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ===== Counter animation =====
const counters = document.querySelectorAll('.kpi-item b[data-count]');
const counterIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.count, 10);
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(target * ease);
      el.textContent = val.toLocaleString();
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    };
    requestAnimationFrame(step);
    counterIO.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => counterIO.observe(c));

// ===== News Swiper =====
const newsSwiper = new Swiper('.news-swiper', {
  slidesPerView: 'auto',
  spaceBetween: 24,
  navigation: { prevEl: '.news-prev', nextEl: '.news-next' },
  breakpoints: {
    0: { slidesPerView: 1.08, spaceBetween: 14 },
    600: { slidesPerView: 2, spaceBetween: 20 },
    900: { slidesPerView: 'auto', spaceBetween: 24 },
  }
});

// ===== Client filters =====
const filterBtns = document.querySelectorAll('.cf');
const clientItems = document.querySelectorAll('.client-item');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    clientItems.forEach(item => {
      const match = filter === 'all' || item.dataset.cat === filter;
      item.classList.toggle('hide', !match);
    });
  });
});

// ===== Smooth anchor scroll =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});
