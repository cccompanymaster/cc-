// ===== Intro =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('intro').classList.add('hide');
  }, 1600);
});

// ===== Custom cursor =====
const cursor = document.querySelector('.cursor');
if (cursor && matchMedia('(hover: hover)').matches) {
  let mx = 0, my = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
  });
  const render = () => {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(render);
  };
  render();
  document.querySelectorAll('a, button, .service-card, .news-card, .client-item').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

// ===== Header scroll =====
const header = document.getElementById('header');
const onScroll = () => {
  if (window.scrollY > 50) header.classList.add('scrolled');
  else header.classList.remove('scrolled');

  const topBtn = document.querySelector('.btn-top');
  if (window.scrollY > 400) topBtn.classList.add('show');
  else topBtn.classList.remove('show');
};
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Top button =====
document.querySelector('.btn-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== Hamburger (simple toggle for mobile - shows/hides gnb) =====
const ham = document.querySelector('.ham');
const gnb = document.querySelector('.gnb');
ham.addEventListener('click', () => {
  gnb.classList.toggle('open');
});

// ===== Reveal on scroll =====
const revealEls = document.querySelectorAll('.sec-title, .service-card, .process-list li, .story-banner, .graph-wrap, .graph-text, .client-item, .news-card');
revealEls.forEach(el => el.classList.add('reveal'));

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

// ===== Graph animation =====
const graphList = document.querySelector('.graph-list');
if (graphList) {
  const graphIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        graphList.classList.add('animate');
        graphIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  graphIO.observe(graphList);
}

// ===== News Swiper =====
const newsSwiper = new Swiper('.news-swiper', {
  slidesPerView: 'auto',
  spaceBetween: 24,
  navigation: {
    prevEl: '.news-prev',
    nextEl: '.news-next',
  },
  breakpoints: {
    0: { slidesPerView: 1.1, spaceBetween: 16 },
    600: { slidesPerView: 2, spaceBetween: 20 },
    900: { slidesPerView: 'auto', spaceBetween: 24 },
  }
});

// ===== News tabs =====
const tabs = document.querySelectorAll('.news-tabs .tab');
const cards = document.querySelectorAll('.news-card');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const type = tab.dataset.tab;
    cards.forEach(card => {
      const show = type === 'all' || card.dataset.type === type;
      card.style.display = show ? '' : 'none';
    });
    newsSwiper.update();
    newsSwiper.slideTo(0);
  });
});

// ===== Smooth anchor scroll with header offset =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});
