// ===== Intro (skip on repeat visits) =====
const introEl = document.getElementById('intro');
const introSeen = sessionStorage.getItem('noah_intro');
document.body.classList.add('no-scroll');

if (introSeen) {
  introEl.classList.add('hide');
  document.body.classList.remove('no-scroll');
  introEl.setAttribute('aria-hidden', 'true');
} else {
  window.addEventListener('load', () => {
    setTimeout(() => {
      introEl.classList.add('hide');
      document.body.classList.remove('no-scroll');
      sessionStorage.setItem('noah_intro', '1');
    }, 1600);
  });
}

// ===== Custom cursor =====
const cursor = document.querySelector('.cursor');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (cursor && matchMedia('(hover: hover)').matches && !reducedMotion) {
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
} else if (cursor) {
  cursor.style.display = 'none';
}

// ===== Header scroll state + dynamic offset =====
const header = document.getElementById('header');
const topBtn = document.querySelector('.btn-top');
const getHeaderHeight = () => header?.offsetHeight ?? 70;
const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 50);
  topBtn.classList.toggle('show', y > 400);
};
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Top button =====
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== Mobile Nav (hamburger + backdrop) =====
const ham = document.querySelector('.ham');
const backdrop = document.querySelector('.nav-backdrop');
const gnb = document.querySelector('.gnb');

function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  ham.setAttribute('aria-expanded', String(open));
  ham.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  document.body.classList.toggle('no-scroll', open);
}
ham?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
backdrop?.addEventListener('click', () => setNav(false));
gnb?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
});

// ===== Reveal on scroll =====
const revealSelector = '.sec-head, .about-points li, .company, .step, .client-item, .news-card, .kpi-item, .contact-wrap';
document.querySelectorAll(revealSelector).forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = Math.min(i, 4) * 80;
      setTimeout(() => entry.target.classList.add('visible'), delay);
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
    if (reducedMotion) {
      el.textContent = target.toLocaleString();
      counterIO.unobserve(el);
      return;
    }
    const duration = 1600;
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
if (typeof Swiper !== 'undefined') {
  new Swiper('.news-swiper', {
    slidesPerView: 'auto',
    spaceBetween: 24,
    navigation: { prevEl: '.news-prev', nextEl: '.news-next' },
    keyboard: { enabled: true },
    a11y: {
      prevSlideMessage: '이전 슬라이드',
      nextSlideMessage: '다음 슬라이드',
    },
    breakpoints: {
      0: { slidesPerView: 1.08, spaceBetween: 14 },
      600: { slidesPerView: 2, spaceBetween: 20 },
      900: { slidesPerView: 'auto', spaceBetween: 24 },
    }
  });
}

// ===== Client filters =====
const filterBtns = document.querySelectorAll('.cf');
const clientItems = document.querySelectorAll('.client-item');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const filter = btn.dataset.filter;
    clientItems.forEach(item => {
      const match = filter === 'all' || item.dataset.cat === filter;
      item.classList.toggle('hide', !match);
    });
  });
});

// ===== Smooth anchor scroll (dynamic header offset) =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const offset = getHeaderHeight() + 16;
    const y = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});
