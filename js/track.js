/* 노아 측정 허브 — 광고 픽셀·Clarity는 아래 TAG_IDS에 ID만 넣으면 켜짐 (빈 값 = 꺼짐, 아무것도 불러오지 않음).
   ID를 바꾼 뒤: python3 .claude/build/tags/sync_tags.py → 보안 설정(CSP 메타)과 개인정보처리방침 8항이 같이 바뀜.
   (자동 배포 워크플로가 --check 로 확인하고, 어긋나면 배포를 멈춤)
   GA4는 각 페이지 <head>의 gtag가 그대로 담당하고, 페이지의 gtag('event', …) 중 아래 표에 있는 이벤트는
   켜진 광고 도구에도 그 도구의 이벤트 이름으로 같이 보냄. 이름·연락처·문의 내용은 어떤 도구로도 보내지 않음. */
(function () {
  'use strict';
  var TAG_IDS = {
    naver: '', // 네이버 공통키 wa: 검색광고 프리미엄 로그분석 AccountId 또는 네이버 애널리틱스 ID — 둘 중 하나만
    meta: '', // Meta 픽셀 ID
    kakao: '', // 카카오 픽셀 & SDK Track ID
    karrot: '', // 당근 전환 추적 코드 ID
    clarity: '' // Microsoft Clarity 프로젝트 ID
  };
  var CONTACT = { naver: 'custom001', meta: 'Contact' };
  var MAP = {
    generate_lead: { naver: 'lead', meta: 'Lead', kakao: 'participation', karrot: 'Lead' },
    purchase: { naver: 'purchase', meta: 'Purchase', kakao: 'purchase', karrot: 'Purchase' },
    contact_call: CONTACT, contact_kakao: CONTACT, contact_naver_talk: CONTACT
  };

  function load(src, onload) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    if (onload) s.onload = onload;
    document.head.appendChild(s);
  }
  function safely(run) { try { run(); } catch (e) { /* 태그 오류가 페이지를 멈추면 안 됨 */ } }

  var naverReady = false, naverQueue = [], kakaoQueue = [], karrotQueue = [];
  if (TAG_IDS.naver) load('https://wcs.naver.net/wcslog.js', function () {
    window.wcs_add = window.wcs_add || {};
    window.wcs_add.wa = TAG_IDS.naver;
    if (!window.wcs) return;
    window.wcs.inflow('noahgroup.co.kr');
    window.wcs_do();
    naverReady = true;
    while (naverQueue.length) window.wcs.trans(naverQueue.shift());
  });
  if (TAG_IDS.meta) {
    var fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    fbq('init', TAG_IDS.meta);
    fbq('track', 'PageView');
    load('https://connect.facebook.net/en_US/fbevents.js');
  }
  if (TAG_IDS.kakao) load('https://t1.daumcdn.net/kas/static/kp.js', function () {
    if (!window.kakaoPixel) return;
    window.kakaoPixel(TAG_IDS.kakao).pageView();
    while (kakaoQueue.length) kakaoQueue.shift()();
  });
  if (TAG_IDS.karrot) load('https://karrot-pixel.business.daangn.com/0.2/karrot-pixel.umd.js', function () {
    if (!window.karrotPixel) return;
    window.karrotPixel.init(TAG_IDS.karrot);
    window.karrotPixel.track('ViewPage');
    while (karrotQueue.length) karrotQueue.shift()();
  });
  if (TAG_IDS.clarity) {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    load('https://www.clarity.ms/tag/' + encodeURIComponent(TAG_IDS.clarity));
  }

  function fanOut(name, params) {
    var map = MAP[name];
    params = params || {};
    var value = Number(params.value) || 0;
    if (TAG_IDS.clarity && window.clarity) safely(function () { window.clarity('event', name); });
    if (!map) return;
    if (TAG_IDS.naver && map.naver) {
      var conv = { type: map.naver };
      if (value) conv.value = String(value);
      safely(function () { naverReady ? window.wcs.trans(conv) : naverQueue.push(conv); });
    }
    if (TAG_IDS.meta && map.meta) safely(function () { window.fbq('track', map.meta, value ? { value: value, currency: 'KRW' } : {}); });
    if (TAG_IDS.kakao && map.kakao) {
      var k = function () { var px = window.kakaoPixel(TAG_IDS.kakao); if (map.kakao === 'purchase') px.purchase({ total_price: String(value), currency: 'KRW' }); else px[map.kakao](); };
      safely(function () { window.kakaoPixel ? k() : kakaoQueue.push(k); });
    }
    if (TAG_IDS.karrot && map.karrot) {
      var c = function () { window.karrotPixel.track(map.karrot, map.karrot === 'Purchase' ? { total_price: String(value) } : undefined); };
      safely(function () { window.karrotPixel ? c() : karrotQueue.push(c); });
    }
  }

  // 페이지의 gtag('event', 이름, 값)을 감싸서, GA4로 보내는 그대로 광고 도구에도 전달
  var original = window.gtag;
  window.gtag = function () {
    if (typeof original === 'function') original.apply(this, arguments);
    if (arguments[0] === 'event') fanOut(arguments[1], arguments[2]);
  };
  window.noahTrack = function (name, params) { window.gtag('event', name, params || {}); };
})();

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
