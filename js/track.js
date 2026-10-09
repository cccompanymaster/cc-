/* 노아 공통 — GA4 클릭 이벤트 (문의 CTA·연락 채널)
   cta_click   : 문의 링크(contact.html·#contact)와 주요 CTA 버튼 — label·cta_location 포함
   contact_call / contact_kakao / contact_naver_talk / click_blog : 연락 채널
   cta_location: header·menu·bottom_bar·float·modal·content_cta·footer, 그 밖에는 섹션 id(없으면 첫 클래스) */
(function () {
  'use strict';
  function ev(name, params) { if (typeof gtag === 'function') gtag('event', name, params); }
  function where(a) {
    var m = a.closest('.topbar,#header,.gnb,#tbNav,.bottom-bar,.bottom-banner,.float-cta,.inquiry-modal,.cta,footer,section,article');
    if (!m) return 'other';
    if (m.matches('.topbar,#header,.gnb')) return 'header';
    if (m.id === 'tbNav') return 'menu';
    if (m.matches('.bottom-bar,.bottom-banner')) return 'bottom_bar';
    if (m.matches('.float-cta')) return 'float';
    if (m.matches('.inquiry-modal')) return 'modal';
    if (m.matches('.cta')) return 'content_cta';
    if (m.tagName === 'FOOTER') return 'footer';
    return m.id || m.classList[0] || m.tagName.toLowerCase();
  }
  var CTA = '.tb-link,.tbn-cta,.tbn-shortcut,.btn-gold,.btn2,.bb-btn,.bb-cta,.company-link,.btn-ghost,#trCtaBtn';
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a,button');
    if (!a || a.closest('#noahIntro')) return;
    var href = a.getAttribute('href') || '';
    var p = { page: location.pathname, cta_location: where(a) };
    if (href.indexOf('tel:') === 0) ev('contact_call', p);
    else if (href.indexOf('pf.kakao.com') > -1) ev('contact_kakao', p);
    else if (href.indexOf('talk.naver.com') > -1) ev('contact_naver_talk', p);
    else if (href.indexOf('blog.naver.com') > -1) ev('click_blog', p);
    else if (/(^|\/)contact\.html/.test(href) || href === '#contact' || a.matches(CTA) ||
             (a.classList.contains('btn-primary') && a.getAttribute('type') !== 'submit')) {
      p.label = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      ev('cta_click', p);
    }
  }, true);
})();
