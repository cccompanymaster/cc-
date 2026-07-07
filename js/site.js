/* 노아 공통 — 모바일 내비 · 스크롤 탑바 · GA4 클릭 이벤트 */
(function () {
  'use strict';
  var ham = document.querySelector('.ham');
  if (ham) {
    ham.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      ham.setAttribute('aria-expanded', open ? 'true' : 'false');
      ham.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });
    document.querySelectorAll('.tb-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
        ham.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        ham.setAttribute('aria-expanded', 'false');
        ham.focus();
      }
    });
  }
  var topbar = document.querySelector('.topbar');
  if (topbar) {
    var ticking = false;
    var onScroll = function () {
      topbar.classList.toggle('scrolled', window.scrollY > 60);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }
  function ev(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a,button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) ev('contact_call', { page: location.pathname });
    else if (href.indexOf('pf.kakao.com') > -1) ev('contact_kakao', { page: location.pathname });
    else if (a.classList.contains('tb-link') || a.classList.contains('btn-gold') || a.classList.contains('btn2') || a.id === 'trCtaBtn')
      ev('cta_click', { label: (a.textContent || '').trim().slice(0, 40), page: location.pathname });
  }, true);
})();
