/* 구형 헤더(.gnb + .ham) 페이지용 모바일 내비 — articles/, authors/ 등 script.js를 싣지 않는 페이지에서 사용 */
(function () {
  var ham = document.querySelector('.ham');
  var gnb = document.querySelector('.gnb');
  if (!ham || !gnb) return;
  var backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);
  }
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    ham.setAttribute('aria-expanded', String(open));
    ham.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }
  ham.setAttribute('aria-expanded', 'false');
  ham.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')); });
  backdrop.addEventListener('click', function () { setNav(false); });
  gnb.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) { if (e.matches) setNav(false); });
})();
