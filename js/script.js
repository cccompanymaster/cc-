// ===== Intro / Loading (매 방문마다 노출, reduced-motion은 짧게) =====
// 새로고침 시 브라우저 스크롤 복원 기능 끄고 최상단으로 고정
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
// 페이지 진입 즉시 최상단으로 (스크롤 복원되기 전에)
window.scrollTo(0, 0);

const introEl = document.getElementById('intro');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const hideIntro = () => {
  // 인트로 끝날 때 한 번 더 최상단 보장 (브라우저가 복원한 경우 대비)
  window.scrollTo(0, 0);
  introEl?.classList.add('hide');
  introEl?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
};

document.body.classList.add('no-scroll');
// 브라우저가 load 이후 스크롤 복원 시도하는 것까지 차단
window.addEventListener('pageshow', () => window.scrollTo(0, 0));

// reduced-motion은 짧게(0.8s), 일반은 2.2s
const introDuration = prefersReducedMotion ? 800 : 2200;
const startIntroExit = () => setTimeout(hideIntro, introDuration);
if (document.readyState === 'complete') {
  startIntroExit();
} else {
  window.addEventListener('load', startIntroExit);
  setTimeout(hideIntro, 4000); // safety fallback
}
introEl?.addEventListener('click', hideIntro);

// ===== Hero mini compass: initial CSS wind-up spin → after animationend, cursor controls rotation direction =====
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.hero');
  const needle = document.querySelector('.hero-mini-needle');
  if (!hero || !needle) return;
  if (!matchMedia('(hover: hover)').matches) return; // touch devices: keep CSS-only spin behavior

  let mouseControl = false;
  let currentAngle = 720;          // CSS animation ends at 720deg = visually 0
  let targetSpeed = 0.15;          // idle drift after wind-up
  let currentSpeed = 0;

  const onAnimEnd = (e) => {
    if (e.animationName !== 'heroMiniNeedleSpin') return;
    needle.removeEventListener('animationend', onAnimEnd);
    mouseControl = true;
    needle.classList.add('js-controlled');
    requestAnimationFrame(tick);
  };
  needle.addEventListener('animationend', onAnimEnd);

  hero.addEventListener('mousemove', (e) => {
    if (!mouseControl) return;
    const rect = hero.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const norm = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    const sign = Math.sign(norm) || 1;
    const magnitude = Math.max(0, Math.abs(norm) - 0.06) / 0.94;
    targetSpeed = sign * magnitude * 2.2 + sign * 0.12;
  }, { passive: true });

  hero.addEventListener('mouseleave', () => { targetSpeed = 0.15; });

  function tick() {
    currentSpeed += (targetSpeed - currentSpeed) * 0.05;
    currentAngle = (currentAngle + currentSpeed) % 360;
    needle.style.transform = `rotate(${currentAngle.toFixed(2)}deg)`;
    requestAnimationFrame(tick);
  }
})();

// ===== Custom cursor — 골드 도트 + 딜레이 링 + 트레일 (방주/나침반 브랜드) =====
const cursor = document.querySelector('.cursor');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (cursor && hasFinePointer && !reducedMotion) {
  // Ring element (lazy create)
  let ring = document.querySelector('.cursor-ring');
  if (!ring) {
    ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(ring);
  }

  let mx = 0, my = 0;
  let dotX = 0, dotY = 0;        // 즉시 따라감
  let ringX = 0, ringY = 0;      // 느리게 따라감 (lag 효과)
  let lastTrailTime = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;

    // 트레일 스폰 — 너무 자주 찍히지 않게 throttle(50ms)
    const now = performance.now();
    if (now - lastTrailTime > 55) {
      lastTrailTime = now;
      const t = document.createElement('span');
      t.className = 'cursor-trail';
      t.style.left = mx + 'px';
      t.style.top = my + 'px';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 820);
    }
  });

  const tick = () => {
    // 도트: 빠른 추종
    dotX += (mx - dotX) * 0.32;
    dotY += (my - dotY) * 0.32;
    cursor.style.transform = `translate(${dotX.toFixed(1)}px, ${dotY.toFixed(1)}px) translate(-50%, -50%)`;
    // 링: 느린 추종 — 나침반 링처럼 지연
    ringX += (mx - ringX) * 0.13;
    ringY += (my - ringY) * 0.13;
    ring.style.transform = `translate(${ringX.toFixed(1)}px, ${ringY.toFixed(1)}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  tick();

  // 호버·클릭 인터랙션
  document.querySelectorAll('a, button, .company, .news-card, .client-item, .step, .product-card, .faq-item summary').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('hover');
      ring.classList.add('hover');
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('hover');
      ring.classList.remove('hover');
    });
  });
  document.addEventListener('mousedown', () => ring.classList.add('click'));
  document.addEventListener('mouseup', () => ring.classList.remove('click'));

  // 창 이탈 시 숨김
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    ring.style.opacity = '1';
  });
} else if (cursor) {
  cursor.style.display = 'none';
}

// ===== Header scroll state + dynamic offset + scroll progress =====
const header = document.getElementById('header');
const topBtn = document.querySelector('.btn-top');
const scrollProgress = document.getElementById('scrollProgress');
const getHeaderHeight = () => header?.offsetHeight ?? 70;

// ===== Bottom Sticky Banner (show after scroll past hero, session-dismissible) =====
// ===== Language detection toast (non-Korean browsers — EN / ZH suggestion) =====
(() => {
  const toast = document.getElementById('langToast');
  const LT_KEY = 'noah_lang_toast_v1';
  if (!toast) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(LT_KEY) === '1'; } catch {}
  if (dismissed) return;

  // navigator.languages[0] 또는 navigator.language 체크
  const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
  const firstLang = (langs[0] || '').toLowerCase();
  const isKorean = firstLang.startsWith('ko') || langs.some(l => l.toLowerCase().startsWith('ko'));
  if (isKorean) return;

  // 중문 감지 → 토스트 카피/CTA 교체
  const isChinese = firstLang.startsWith('zh') || langs.some(l => l.toLowerCase().startsWith('zh'));
  const currentPath = location.pathname.toLowerCase();
  const isProducts = currentPath.includes('products');
  if (isChinese) {
    const zhHref = isProducts ? 'products-zh.html' : 'index-zh.html';
    const msg = toast.querySelector('.lt-msg');
    const cta = toast.querySelector('.lt-cta');
    if (msg) msg.innerHTML = '<b>查看中文版本?</b><span>本页面有中文版本可供浏览。</span>';
    if (cta) { cta.textContent = '查看中文版本 →'; cta.setAttribute('href', zhHref); }
  }

  // URL 파라미터로 강제 한국어(?lang=ko) 접근 시 토스트 띄우지 않음
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('lang') === 'ko') return;
  } catch {}

  toast.removeAttribute('hidden');
  // 살짝 지연 후 노출 (페이지 초기 렌더링 방해 X)
  setTimeout(() => toast.classList.add('visible'), 1200);

  document.getElementById('langToastClose')?.addEventListener('click', () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('dismissed'), 500);
    try { sessionStorage.setItem(LT_KEY, '1'); } catch {}
  });
  // CTA 클릭 후에도 dismiss로 마킹
  toast.querySelector('.lt-cta')?.addEventListener('click', () => {
    try { sessionStorage.setItem(LT_KEY, '1'); } catch {}
  });
})();

// 하단 상담 배너 — 진입 시점부터 고정 노출 (스크롤 임계값 제거)
const bottomBanner = document.getElementById('bottomBanner');
const BB_DISMISSED_KEY = 'noah_bb_dismissed_v1';
const bbDismissed = (() => {
  try { return sessionStorage.getItem(BB_DISMISSED_KEY) === '1'; } catch { return false; }
})();
if (bottomBanner) {
  bottomBanner.removeAttribute('hidden');
  if (bbDismissed) {
    bottomBanner.classList.add('dismissed');
  } else {
    bottomBanner.classList.add('visible');
    document.body.classList.add('bb-active');
  }
}
// 스크롤에 따른 노출 토글 제거 — 고정값 처리
const updateBottomBanner = () => {};
document.getElementById('bbClose')?.addEventListener('click', () => {
  bottomBanner?.classList.remove('visible');
  document.body.classList.remove('bb-active');
  setTimeout(() => bottomBanner?.classList.add('dismissed'), 500);
  try { sessionStorage.setItem(BB_DISMISSED_KEY, '1'); } catch {}
});
document.getElementById('bbOpenInquiry')?.addEventListener('click', () => {
  if (typeof openInquiry === 'function') openInquiry();
});

const onScroll = () => {
  const y = window.scrollY;
  header?.classList.toggle('scrolled', y > 50);
  topBtn?.classList.toggle('show', y > 400);
  if (scrollProgress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? (y / max) * 100 : 0;
    scrollProgress.style.setProperty('--progress', p + '%');
  }
  updateBottomBanner(y);
};
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Button ripple position tracking =====
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--rx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--ry', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });
});

// ===== Sub-label underline draw on view =====
const subLabelIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('drawn');
      subLabelIO.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.sub-label:not(.center)').forEach(el => subLabelIO.observe(el));

// ===== Hero sparkle particles =====
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const spawn = () => {
    const s = document.createElement('span');
    s.className = 'sparkle';
    const size = 2 + Math.random() * 4;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = (10 + Math.random() * 80) + '%';
    s.style.top = (30 + Math.random() * 55) + '%';
    s.style.setProperty('--sx', ((Math.random() - 0.5) * 80) + 'px');
    s.style.setProperty('--sy', (-30 - Math.random() * 40) + 'px');
    hero.appendChild(s);
    requestAnimationFrame(() => s.classList.add('animate'));
    setTimeout(() => s.remove(), 2400);
  };
  setInterval(spawn, 700);
  for (let i = 0; i < 3; i++) setTimeout(spawn, i * 300);
})();

// ===== Top button =====
topBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== Mobile Nav (hamburger + backdrop) =====
const ham = document.querySelector('.ham');
const backdrop = document.querySelector('.nav-backdrop');
const gnb = document.querySelector('.gnb');
const gnbLinks = gnb ? Array.from(gnb.querySelectorAll('a')) : [];

function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  ham?.setAttribute('aria-expanded', String(open));
  ham?.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  document.body.classList.toggle('no-scroll', open);
  // 모바일 네비 링크 포커스 관리 — 닫힘 상태에서 Tab으로 숨은 링크 접근 방지
  if (window.matchMedia('(max-width: 900px)').matches) {
    gnbLinks.forEach(a => a.setAttribute('tabindex', open ? '0' : '-1'));
  } else {
    gnbLinks.forEach(a => a.removeAttribute('tabindex'));
  }
}
// 초기 상태 셋팅
if (gnbLinks.length && window.matchMedia('(max-width: 900px)').matches) {
  gnbLinks.forEach(a => a.setAttribute('tabindex', '-1'));
}
window.addEventListener('resize', () => {
  if (!window.matchMedia('(max-width: 900px)').matches) {
    gnbLinks.forEach(a => a.removeAttribute('tabindex'));
  } else if (!document.body.classList.contains('nav-open')) {
    gnbLinks.forEach(a => a.setAttribute('tabindex', '-1'));
  }
});
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

// ===== Article Modal (Insights) — 다국어 지원 =====
// 언어 감지: <html lang> 값으로 ko/en/zh 선택 (fallback: ko)
function getArticleLang_() {
  const l = (document.documentElement.lang || 'ko').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('en')) return 'en';
  return 'ko';
}
const articlesByLang = {
  ko: {
  '1': {
    tag: 'LAB · REPORT',
    date: '2026.04.10',
    title: '의료광고 심의 2026 개정안, 실무자가 꼭 알아야 할 5가지',
    body: `
      <p class="lead">2026년 2월부터 시행된 의료법 시행령 개정안으로 의료광고 심의 대상이 확대되고 기준이 강화됐습니다. 병원 마케팅 실무자가 반드시 숙지해야 할 핵심 5가지를 정리했습니다.</p>
      <h3>1. 심의 대상 매체 확대</h3>
      <p>기존 홈페이지·블로그 중심이던 심의 대상이 인스타그램·틱톡·쇼츠 등 숏폼 콘텐츠까지 확대됐습니다. 월 평균 10만 뷰 이상 계정은 의무 심의 대상입니다.</p>
      <h3>2. 비교·최상급 표현 전면 금지</h3>
      <p>"최고의", "국내 유일", "No.1" 등 객관적 근거 없는 표현은 위반 시 최대 1년 광고 정지 처분이 가능합니다. 수치·출처가 있어도 심의를 거쳐야 합니다.</p>
      <h3>3. 치료 전후 사진 사용 기준</h3>
      <p>환자 동의서 외에 촬영 조건(조명·각도·보정 여부) 명시가 의무화됐습니다. 성형·피부과 분야 필수 확인 사항입니다.</p>
      <h3>4. 유튜브 협찬 콘텐츠 표기</h3>
      <p>의사·병원 협찬 유튜브 영상은 "협찬" 또는 "광고" 표기를 영상 시작 3초 이내 삽입해야 합니다. 누락 시 허위광고로 간주됩니다.</p>
      <h3>5. 체험단·후기 관리</h3>
      <p>맘카페·블로그 체험단 후기도 사전 심의 권장 영역으로 편입됐습니다. 실제 경험 여부와 대가성 표기 검증이 강화됩니다.</p>
      <div class="article-cta">
        <p>노아마케팅랩은 의료광고 사전심의 법률자문을 포함한 원스톱 광고 서비스를 제공합니다.</p>
        <a href="#contact" class="btn btn-primary">상담 문의하기 →</a>
      </div>
    `
  },
  '2': {
    tag: 'CC · INSIGHT',
    date: '2026.03.28',
    title: '블로그 상위노출 로직 변화 — 2026 네이버 검색 업데이트 분석',
    body: `
      <p class="lead">2026년 1분기 네이버는 VIEW 탭 검색 로직을 대대적으로 개편했습니다. 이전 C-RANK·D.I.A. 방식에서 한 단계 진화한 "의미 기반 검색(SMART BLOCK)"의 실체를 분석합니다.</p>
      <h3>1. 키워드 매칭 → 의도 매칭</h3>
      <p>단순 키워드 반복이 아닌, 검색자의 실제 의도와 부합하는 글이 상위 노출됩니다. 병원 키워드라도 '추천', '가격', '후기' 등 세부 의도별 노출 로직이 다릅니다.</p>
      <h3>2. 체류 시간의 중요성 급증</h3>
      <p>글 체류 시간 60초 이상이 상위 노출의 최소 기준으로 작동합니다. 이미지·동영상 삽입 위치와 단락 길이가 결정적 요인입니다.</p>
      <h3>3. 최적화 지수보다 "최근 활동성"</h3>
      <p>블로그 지수가 아무리 높아도 최근 30일 내 활동이 부족하면 노출에서 누락됩니다. 꾸준한 포스팅이 절대적입니다.</p>
      <h3>4. AI 생성 콘텐츠 패널티</h3>
      <p>ChatGPT 등 AI 생성 글의 패턴이 탐지되면 노출 순위가 급격히 하락합니다. 개인화된 경험·감정 표현이 있는 글이 유리합니다.</p>
      <h3>5. 카페·지식인 연계 노출</h3>
      <p>블로그 단독이 아닌 카페·지식인과 동일 키워드로 교차 노출될 때 신뢰도가 올라가는 것으로 확인됐습니다.</p>
      <div class="article-cta">
        <p>CC컴퍼니는 블로그·카페·지식iN 통합 운영으로 2026 로직에 최적화된 바이럴 솔루션을 제공합니다.</p>
        <a href="#contact" class="btn btn-primary">상담 문의하기 →</a>
      </div>
    `
  },
  '3': {
    tag: 'DB · GUIDE',
    date: '2026.03.15',
    title: 'CPA vs CPS, 우리 비즈니스에 맞는 성과형 광고 고르는 법',
    body: `
      <p class="lead">광고비를 성과에 따라 지불하는 CPA(Cost Per Action)와 CPS(Cost Per Sale)는 각각 다른 상황에 적합합니다. 우리 비즈니스에 맞는 선택 기준을 정리합니다.</p>
      <h3>CPA란?</h3>
      <p>사용자의 특정 행동(회원가입·견적문의·앱설치)당 과금되는 방식입니다. 신규 고객 DB 확보에 최적화되어 있으며, 보험·대출·병원·법률 업종에서 널리 사용됩니다.</p>
      <h3>CPS란?</h3>
      <p>실제 구매·결제가 발생해야 과금되는 방식입니다. 광고주 입장에서 리스크가 가장 적지만, 매체사 쪽에서 적극적이지 않아 물량이 제한될 수 있습니다.</p>
      <h3>언제 CPA를 선택해야 할까</h3>
      <ul>
        <li>영업 전환이 사람(콜센터·상담사) 중심인 경우</li>
        <li>LTV가 높고 한 번 유입된 고객 가치가 큰 경우</li>
        <li>상품이 고관여(장기 의사결정)라 즉시 구매가 어려운 경우</li>
      </ul>
      <h3>언제 CPS를 선택해야 할까</h3>
      <ul>
        <li>커머스·구독·앱 결제 등 온라인에서 전환 완결되는 비즈니스</li>
        <li>객단가가 명확하고 마진율이 공개 가능한 경우</li>
        <li>파트너사에게 성과 분배가 명확한 경우</li>
      </ul>
      <h3>하이브리드 구조</h3>
      <p>최근은 CPA + CPS 혼합 단가 구조가 주류입니다. 1차 유입(CPA) + 2차 전환(CPS)으로 리스크를 분산합니다.</p>
      <div class="article-cta">
        <p>노아데이터베이스는 업종별 최적 단가 설계부터 DB 품질 검수·전환 트래킹까지 제공합니다.</p>
        <a href="#contact" class="btn btn-primary">상담 문의하기 →</a>
      </div>
    `
  },
  '4': {
    tag: 'GROUP · NEWS',
    date: '2026.02.20',
    title: '노아마케팅그룹, 2025 마케팅어워드 대상 수상',
    body: `
      <p class="lead">노아마케팅그룹이 한국마케팅학회·한국광고학회 공동 주관 "2025 마케팅어워드" 종합대행사 부문 대상을 수상했습니다.</p>
      <h3>수상 배경</h3>
      <p>이번 수상은 2025년 한 해 동안 그룹 3개 계열사가 함께 진행한 통합 캠페인 사례가 "업종별 전문성과 데이터 기반 실행력의 결합"이라는 평가를 받으며 이뤄졌습니다.</p>
      <h3>대표 수상 사례</h3>
      <ul>
        <li>강남권 대형 피부과 네트워크 통합 마케팅 — 신규 환자 유입 전년 대비 +318%</li>
        <li>법무법인 브랜드 캠페인 — 키워드 상위노출 98% 달성</li>
        <li>D2C 뷰티 브랜드 CPS 파트너십 — 월 거래액 12억 달성</li>
      </ul>
      <h3>대표 인터뷰</h3>
      <blockquote>"3개 계열사 구조는 단순한 분업이 아니라, 각 영역의 깊이를 지키면서 필요할 때 하나로 움직이는 시스템입니다. 앞으로도 클라이언트가 흔들리지 않고 성장할 수 있도록 방주의 역할을 하겠습니다."</blockquote>
      <p>이번 수상으로 노아마케팅그룹은 3년 연속 주요 마케팅 시상식 본상 이상을 수상한 유일한 그룹사가 되었습니다.</p>
      <div class="article-cta">
        <p>수상 실적 기반의 검증된 마케팅 서비스를 경험해보세요.</p>
        <a href="#contact" class="btn btn-primary">프로젝트 문의 →</a>
      </div>
    `
  },
  '5': {
    tag: 'LAB · CASE',
    date: '2026.02.05',
    title: '병원 신규 개원 마케팅, 오픈 D-90일 전부터 해야 하는 이유',
    body: `
      <p class="lead">신규 병원 개원 후 "예약이 안 찬다"는 고민의 90%는 오픈 직전 마케팅을 시작한 경우 발생합니다. 성공하는 개원 마케팅의 시간표를 공개합니다.</p>
      <h3>D-90 ~ D-60 : 기반 구축 단계</h3>
      <ul>
        <li>홈페이지 제작 완료 + 네이버·구글 SEO 기초 작업</li>
        <li>블로그 개설 + 지수 관리 시작 (최소 60일 선행 필요)</li>
        <li>플레이스 등록 및 최적화 시작</li>
      </ul>
      <h3>D-60 ~ D-30 : 인지도 형성 단계</h3>
      <ul>
        <li>블로그 콘텐츠 20~30개 누적 (키워드별 분산)</li>
        <li>인스타그램·유튜브 채널 오픈 + 프리뷰 콘텐츠</li>
        <li>지역 맘카페·커뮤니티 초기 진입</li>
      </ul>
      <h3>D-30 ~ D-Day : 수요 전환 단계</h3>
      <ul>
        <li>네이버 SA / 구글 SA 광고 집행 시작</li>
        <li>체험단 모집 및 리얼 후기 콘텐츠 발행</li>
        <li>이벤트·오픈 프로모션 전사적 노출</li>
      </ul>
      <h3>실제 사례</h3>
      <p>강남권 A 정형외과는 D-120부터 마케팅 시작 → 오픈 첫 주 예약 100% 마감, 3개월 내 지역 상위 3위권 진입.<br>반면 D-14에 급하게 시작한 B 피부과는 오픈 후 3개월간 하루 평균 환자 6명. 차이는 "시간"에 있었습니다.</p>
      <div class="article-cta">
        <p>노아마케팅랩은 개원 예정일 90일 전부터 단계별 마케팅 설계를 지원합니다.</p>
        <a href="#contact" class="btn btn-primary">개원 마케팅 상담 →</a>
      </div>
    `
  },
  '6': {
    tag: 'CC · INSIGHT',
    date: '2026.01.18',
    title: '격이 다른 바이럴 — 왜 "노출"이 아닌 "매출 전환"이 답인가',
    body: `
      <p class="lead">블로그 상위노출 100건이 있어도 매출이 안 나오는 이유는 간단합니다. 지금까지의 바이럴은 "보여주기"에 집중했기 때문입니다. CC컴퍼니가 추구하는 "격이 다른 마케팅"의 실체를 공개합니다.</p>

      <h3>보여주기 바이럴의 한계</h3>
      <p>대부분의 바이럴 대행사는 "블로그 몇 건 상위노출" 같은 아웃풋 지표만 보장합니다. 문제는 노출된 글이 <b>구매로 이어지지 않는다</b>는 것. 클릭률이 낮거나, 클릭해도 이탈하거나, 재방문이 없습니다.</p>

      <h3>매출 전환 중심 바이럴의 3가지 원칙</h3>
      <ul>
        <li><b>검색자 의도 역설계</b>: "가격 비교", "후기", "추천" 등 구매 직전 단계 키워드부터 장악</li>
        <li><b>통합 채널 운영</b>: 블로그 단일 X → 카페·지식인·뉴스·유튜브 교차 노출로 신뢰도 증폭</li>
        <li><b>전환 트래킹</b>: UTM + GA4 + 콜트래킹으로 바이럴→문의→계약 전환율 측정</li>
      </ul>

      <h3>실제 사례 — 수도권 A 피부과</h3>
      <p>블로그 상위노출 위주로 진행하던 기존 대행사와 계약 종료 후 CC컴퍼니 이관.</p>
      <ul>
        <li>첫 달 블로그 게시글 수는 <b>30% 감소</b>시킴 (불필요한 노출 정리)</li>
        <li>대신 카페·지식iN에 <b>질문-답변 시리즈</b> 전개</li>
        <li>유튜브 Short 7개 + 네이버 뉴스 1건 교차 배치</li>
        <li>결과: 3개월 후 <b>신규 예약 +218%</b>, 광고비는 동일</li>
      </ul>

      <h3>"격이 다른" 의 의미</h3>
      <p>CC컴퍼니는 단순 포스팅 대행이 아닙니다. 업종 분석 → 키워드 설계 → 콘텐츠 기획 → 다채널 집행 → 전환 측정까지 하나의 시스템으로 운영합니다. 결과가 숫자로 증명되지 않으면, 마케팅이 아닙니다.</p>

      <blockquote>"우리는 상위노출이 목표가 아니라, 매출이 올라가는 것이 목표입니다. 매출이 오르지 않았다면, 저희가 실패한 겁니다."</blockquote>

      <div class="article-cta">
        <p>CC컴퍼니 공식 블로그에서 더 많은 실제 사례를 확인하세요.</p>
        <a href="https://blog.naver.com/cccompanyad" target="_blank" rel="noopener" class="btn btn-primary">블로그 방문하기 →</a>
      </div>
    `
  }
  },
  en: {
    '1': {
      tag: 'LAB · REPORT',
      date: '2026.04.10',
      title: 'Medical Ad Review 2026 — 5 Essentials for Practitioners',
      body: `
      <p class="lead">Korea's amended Medical Act Enforcement Decree, effective Feb 2026, expanded the scope and tightened the criteria for medical advertising review. Here are the 5 must-know points for hospital marketers.</p>
      <h3>1. Wider media coverage</h3>
      <p>Review used to focus on websites and blogs. Now Instagram, TikTok, and Shorts are also in scope. Accounts averaging over 100k monthly views are subject to mandatory review.</p>
      <h3>2. Total ban on comparative / superlative expressions</h3>
      <p>Unsubstantiated phrases such as "the best", "only in Korea", or "No.1" can result in up to a 1-year advertising suspension. Even with numbers and sources, review is required.</p>
      <h3>3. New standards for before/after photos</h3>
      <p>In addition to patient consent, conditions of the shoot (lighting, angle, retouching) must now be disclosed. Essential for cosmetic surgery and dermatology clinics.</p>
      <h3>4. YouTube sponsored content labelling</h3>
      <p>Sponsored videos featuring doctors or clinics must display "Sponsored" or "Ad" within the first 3 seconds. Omission is treated as false advertising.</p>
      <h3>5. Review expanded to experiential content</h3>
      <p>Reviews on mom-cafés and blog review programs are now strongly recommended for pre-review. Verification of actual experience and compensation disclosure has been strengthened.</p>
      <div class="article-cta">
        <p>Noah Marketing Lab offers one-stop medical advertising including pre-review and legal counsel.</p>
        <a href="#contact" class="btn btn-primary">Request consultation →</a>
      </div>
    `
    },
    '2': {
      tag: 'CC · INSIGHT',
      date: '2026.03.28',
      title: 'Blog Top-Ranking Logic Shift — 2026 Naver Search Update Analysis',
      body: `
      <p class="lead">In Q1 2026, Naver overhauled its VIEW tab search logic. We analyse the "SMART BLOCK" semantic-search engine that evolved beyond the prior C-RANK · D.I.A. model.</p>
      <h3>1. Keyword matching → intent matching</h3>
      <p>Pure keyword repetition no longer wins. Posts that truly match the searcher's intent rank first. Even a single clinic keyword now has different exposure logic for "recommendation", "pricing", and "reviews".</p>
      <h3>2. Dwell time matters dramatically more</h3>
      <p>60+ seconds of on-page time is now a minimum threshold for top ranking. Placement of images/videos and paragraph length are decisive factors.</p>
      <h3>3. Recent activity outweighs optimization score</h3>
      <p>No matter how high your blog's optimization index, missing activity in the last 30 days means exclusion from results. Consistent posting is absolute.</p>
      <h3>4. AI-generated content penalties</h3>
      <p>When ChatGPT-style generation patterns are detected, ranking drops sharply. Posts with personal experience and emotional expression win.</p>
      <h3>5. Cross-exposure with Cafés and Knowledge-iN</h3>
      <p>Credibility rises when the same keyword is cross-exposed on blogs, cafés, and Knowledge-iN — not blog alone.</p>
      <div class="article-cta">
        <p>CC Company runs integrated blog + café + Knowledge-iN operation optimized for 2026 logic.</p>
        <a href="#contact" class="btn btn-primary">Request consultation →</a>
      </div>
    `
    },
    '3': {
      tag: 'DB · GUIDE',
      date: '2026.03.15',
      title: 'CPA vs CPS — Choosing the Right Performance Model for Your Business',
      body: `
      <p class="lead">CPA (Cost Per Action) and CPS (Cost Per Sale) both charge by outcome, but fit different situations. Here's how to pick the right one.</p>
      <h3>What is CPA?</h3>
      <p>Charged per user action (signup, quote request, app install). Optimized for acquiring new-customer DB. Widely used in insurance, loans, medical, and legal sectors.</p>
      <h3>What is CPS?</h3>
      <p>Charged only when an actual purchase / payment occurs. Lowest risk for the advertiser, but media-side enthusiasm (and thus volume) can be limited.</p>
      <h3>When to choose CPA</h3>
      <ul>
        <li>Sales conversion runs through humans (call center / consultants)</li>
        <li>High LTV — a single acquired customer is valuable</li>
        <li>High-involvement products where immediate purchase is unlikely</li>
      </ul>
      <h3>When to choose CPS</h3>
      <ul>
        <li>Commerce, subscription, or app purchase — conversion completes online</li>
        <li>Clear AOV and a margin that can be shared</li>
        <li>Partners have a transparent revenue share</li>
      </ul>
      <h3>Hybrid structure</h3>
      <p>Modern deals typically mix CPA + CPS: first-touch acquisition (CPA) + second-stage conversion (CPS) to distribute risk.</p>
      <div class="article-cta">
        <p>Noah Database handles pricing design, DB QA, and conversion tracking across industries.</p>
        <a href="#contact" class="btn btn-primary">Request consultation →</a>
      </div>
    `
    },
    '4': {
      tag: 'GROUP · NEWS',
      date: '2026.02.20',
      title: 'Noah Marketing Group Wins the 2025 Marketing Awards Grand Prize',
      body: `
      <p class="lead">Noah Marketing Group has been awarded the Grand Prize in the Full-Service Agency category at the "2025 Marketing Awards" hosted jointly by the Korean Marketing Association and the Korean Advertising Society.</p>
      <h3>Why we won</h3>
      <p>The award recognises the integrated campaigns run across our three companies in 2025, acclaimed for "combining vertical expertise with data-driven execution".</p>
      <h3>Featured cases</h3>
      <ul>
        <li>Gangnam dermatology network integrated marketing — new patient acquisition +318% YoY</li>
        <li>Law-firm brand campaign — 98% top-ranking on target keywords</li>
        <li>D2C beauty brand CPS partnership — KRW 1.2B monthly GMV achieved</li>
      </ul>
      <h3>Executive comment</h3>
      <blockquote>"Our three-company structure isn't just division of labour. It protects the depth of each domain while moving as one when needed. We'll keep playing the role of an ark so our clients can grow without being shaken."</blockquote>
      <p>With this award, Noah Marketing Group becomes the only agency group to have received a top-tier award three years in a row at major Korean marketing ceremonies.</p>
      <div class="article-cta">
        <p>Experience the proven services behind our awards.</p>
        <a href="#contact" class="btn btn-primary">Project inquiry →</a>
      </div>
    `
    },
    '5': {
      tag: 'LAB · CASE',
      date: '2026.02.05',
      title: 'New Clinic Marketing — Why You Must Start D-90 Days Before Launch',
      body: `
      <p class="lead">90% of "why aren't appointments filling?" complaints come from clinics that start marketing right before opening. Here's the timetable behind successful launches.</p>
      <h3>D-90 ~ D-60 : Foundation</h3>
      <ul>
        <li>Website build complete + baseline Naver / Google SEO</li>
        <li>Blog set up + index management (needs at least 60 days lead time)</li>
        <li>Naver Place registered and optimized</li>
      </ul>
      <h3>D-60 ~ D-30 : Awareness</h3>
      <ul>
        <li>20~30 blog posts accumulated across keywords</li>
        <li>Instagram / YouTube channels opened with preview content</li>
        <li>Early penetration into local mom-cafés and communities</li>
      </ul>
      <h3>D-30 ~ D-Day : Demand conversion</h3>
      <ul>
        <li>Naver SA / Google SA campaigns live</li>
        <li>Reviewer recruitment + real-experience content published</li>
        <li>Event and launch promotion across all channels</li>
      </ul>
      <h3>Real example</h3>
      <p>Orthopaedic Clinic A in Gangnam started at D-120 → 100% appointment fill in the first week, top-3 local ranking within 3 months.<br>Dermatology B started at D-14 and averaged 6 patients per day for 3 months after opening. The difference was time, not budget.</p>
      <div class="article-cta">
        <p>Noah Marketing Lab supports stage-by-stage marketing design starting 90 days before launch.</p>
        <a href="#contact" class="btn btn-primary">Launch consultation →</a>
      </div>
    `
    },
    '6': {
      tag: 'CC · INSIGHT',
      date: '2026.01.18',
      title: 'Viral of a Different Class — Why "Conversion" Beats "Impressions"',
      body: `
      <p class="lead">Even with 100 top-ranked blog posts, revenue doesn't follow if the viral strategy only shows off. That's the gap CC Company's "marketing of a different class" closes.</p>
      <h3>The limit of "display" viral</h3>
      <p>Most viral agencies guarantee output metrics — "X blog posts on top". The problem: those posts <b>don't lead to purchase</b>. Low CTR, high bounce, no return.</p>
      <h3>Three principles of conversion-centric viral</h3>
      <ul>
        <li><b>Reverse-engineered searcher intent</b>: start from near-purchase keywords — "price comparison", "reviews", "recommendation"</li>
        <li><b>Cross-channel operation</b>: blog alone ✗ → blog + café + Knowledge-iN + news + YouTube for amplified trust</li>
        <li><b>Conversion tracking</b>: UTM + GA4 + call tracking to measure viral → inquiry → contract rate</li>
      </ul>
      <h3>Case — Capital-area Dermatology A</h3>
      <p>After ending the prior top-ranking-only agency, they switched to CC Company.</p>
      <ul>
        <li>Month 1: blog post count <b>cut 30%</b> (removed noise)</li>
        <li>Expanded into <b>Q&amp;A series</b> on Cafés and Knowledge-iN</li>
        <li>Cross-placed 7 YouTube Shorts + 1 Naver News article</li>
        <li>Result: 3 months later, <b>+218% new bookings</b> at the same spend</li>
      </ul>
      <h3>What "a different class" means</h3>
      <p>CC Company is not a posting vendor. One system runs industry analysis → keyword design → content planning → multi-channel execution → conversion measurement. If results aren't proved by numbers, it isn't marketing.</p>
      <blockquote>"Our goal isn't top ranking — it's revenue. If revenue didn't grow, we failed."</blockquote>
      <div class="article-cta">
        <p>Browse more real cases on CC Company's official blog.</p>
        <a href="https://blog.naver.com/cccompanyad" target="_blank" rel="noopener" class="btn btn-primary">Visit blog →</a>
      </div>
    `
    },
  },
  zh: {
    '1': {
      tag: 'LAB · REPORT',
      date: '2026.04.10',
      title: '医疗广告审查 2026 修订 — 实务者必知的 5 个要点',
      body: `
      <p class="lead">自 2026 年 2 月起施行的韩国医疗法施行令修正案,扩大了医疗广告审查范围并强化了标准。整理了医院营销实务者必须掌握的 5 个核心要点。</p>
      <h3>1. 审查媒体范围扩大</h3>
      <p>以往以官网、博客为主的审查,现在扩展至 Instagram、TikTok、Shorts 等短视频内容。月均浏览量 10 万以上的账号为强制审查对象。</p>
      <h3>2. 比较/最高级表达全面禁止</h3>
      <p>"最好的"、"国内唯一"、"第一名"等缺乏客观依据的表述,违反时最高可处 1 年广告停播。即使有数据与出处,仍需经审查。</p>
      <h3>3. 治疗前后照片使用标准</h3>
      <p>除患者同意书外,拍摄条件(光线·角度·是否修图)的标注成为强制项。整形、皮肤科领域必须检视。</p>
      <h3>4. YouTube 赞助内容标识</h3>
      <p>医生/医院赞助的 YouTube 视频,必须在开头 3 秒内标注"赞助"或"广告"。遗漏即视为虚假广告。</p>
      <h3>5. 体验/评论管理</h3>
      <p>妈妈咖啡厅、博客体验团评论也纳入事前审查建议范围。是否真实体验与对价关系的核实加强。</p>
      <div class="article-cta">
        <p>Noah Marketing Lab 提供包含医疗广告事前审查与法律咨询在内的一站式广告服务。</p>
        <a href="#contact" class="btn btn-primary">咨询预约 →</a>
      </div>
    `
    },
    '2': {
      tag: 'CC · INSIGHT',
      date: '2026.03.28',
      title: '博客上位曝光逻辑变化 — 2026 Naver 搜索更新分析',
      body: `
      <p class="lead">2026 年 Q1,Naver 对 VIEW 标签的搜索逻辑进行了大规模改版。从原先的 C-RANK·D.I.A. 模式升级到"语义搜索(SMART BLOCK)",我们分析其实际运作。</p>
      <h3>1. 关键字匹配 → 意图匹配</h3>
      <p>单纯关键字堆砌不再奏效,能匹配搜索者真实意图的内容才会上榜。同一医院关键字下,"推荐""价格""评价"等细分意图各有不同的曝光逻辑。</p>
      <h3>2. 停留时间重要性急剧上升</h3>
      <p>页面停留 60 秒以上已成为上位曝光的最低门槛。图片/视频插入位置与段落长度为决定性因素。</p>
      <h3>3. 活跃度胜过优化指数</h3>
      <p>博客指数再高,若近 30 天无更新则会掉出曝光。持续发文是绝对条件。</p>
      <h3>4. AI 生成内容降权</h3>
      <p>一旦检测到 ChatGPT 等 AI 生成特征,排名急剧下降。含个人化经历与情感表达的文章更具优势。</p>
      <h3>5. 与咖啡厅/知识 iN 联动曝光</h3>
      <p>博客单打独斗不如跨平台(咖啡厅、知识 iN)同关键字交叉曝光,信任度明显提升。</p>
      <div class="article-cta">
        <p>CC Company 以博客·咖啡厅·知识 iN 整合运营,提供针对 2026 新逻辑的口碑营销方案。</p>
        <a href="#contact" class="btn btn-primary">咨询预约 →</a>
      </div>
    `
    },
    '3': {
      tag: 'DB · GUIDE',
      date: '2026.03.15',
      title: 'CPA vs CPS — 为业务选对效果型广告的方法',
      body: `
      <p class="lead">按效果付费的 CPA(Cost Per Action)与 CPS(Cost Per Sale),适用于不同场景。介绍挑选标准。</p>
      <h3>什么是 CPA</h3>
      <p>以用户特定行动(注册、询价、APP 安装)计费。最适合获取新客 DB,广泛用于保险、信贷、医院、法律行业。</p>
      <h3>什么是 CPS</h3>
      <p>只有实际购买/付款发生时才计费。广告主风险最低,但媒体方动力有限,量可能受限。</p>
      <h3>何时选 CPA</h3>
      <ul>
        <li>销售转化以人工(电销、咨询师)为主</li>
        <li>LTV 高,单客价值大</li>
        <li>高介入商品(决策周期长),难以立即购买</li>
      </ul>
      <h3>何时选 CPS</h3>
      <ul>
        <li>电商、订阅、APP 付费等线上完成转化的业务</li>
        <li>客单价清晰、毛利可共享</li>
        <li>对合作伙伴的分润透明</li>
      </ul>
      <h3>混合结构</h3>
      <p>近年主流为 CPA + CPS 混合单价:一级引流(CPA)+ 二级转化(CPS),分散风险。</p>
      <div class="article-cta">
        <p>Noah Database 提供按行业优化的单价设计、DB 品质审核、转化追踪全链路服务。</p>
        <a href="#contact" class="btn btn-primary">咨询预约 →</a>
      </div>
    `
    },
    '4': {
      tag: 'GROUP · NEWS',
      date: '2026.02.20',
      title: 'Noah Marketing Group 荣获 2025 营销大奖 大奖',
      body: `
      <p class="lead">Noah Marketing Group 在韩国营销学会·韩国广告学会共同主办的"2025 营销大奖"综合代理公司组别荣获大奖。</p>
      <h3>获奖背景</h3>
      <p>本次获奖基于 2025 年集团三家子公司共同推进的整合营销案例,评审盛赞"兼顾行业专业深度与数据驱动执行力的结合"。</p>
      <h3>代表案例</h3>
      <ul>
        <li>江南大型皮肤科网络整合营销 — 新患到诊同比 +318%</li>
        <li>律师事务所品牌营销 — 目标关键字上位曝光率 98%</li>
        <li>D2C 美妆品牌 CPS 合作 — 单月 GMV 达 12 亿韩元</li>
      </ul>
      <h3>代表访谈</h3>
      <blockquote>"三家子公司架构并非简单分工,而是各守领域深度,需要时合而为一的系统。未来我们仍会担任方舟的角色,让客户在风浪中稳步成长。"</blockquote>
      <p>至此,Noah Marketing Group 成为连续三年获得韩国主要营销颁奖典礼主奖以上的唯一集团公司。</p>
      <div class="article-cta">
        <p>体验获奖实力背后的经验证营销服务。</p>
        <a href="#contact" class="btn btn-primary">项目咨询 →</a>
      </div>
    `
    },
    '5': {
      tag: 'LAB · CASE',
      date: '2026.02.05',
      title: '新医院开业营销 — 为何 D-90 天前就要启动',
      body: `
      <p class="lead">新医院开业后"预约不满"的烦恼,90% 发生在临开业才启动营销的案例。公开成功开业营销的时间表。</p>
      <h3>D-90 ~ D-60:基础搭建阶段</h3>
      <ul>
        <li>官网建置完成 + Naver/Google SEO 基础作业</li>
        <li>博客开设 + 指数管理启动(至少需 60 天前置)</li>
        <li>Naver Place 注册与优化开始</li>
      </ul>
      <h3>D-60 ~ D-30:认知塑造阶段</h3>
      <ul>
        <li>博客内容累计 20~30 篇(按关键字分散)</li>
        <li>Instagram / YouTube 频道开通 + 预告内容</li>
        <li>进入本地妈妈咖啡厅与社群</li>
      </ul>
      <h3>D-30 ~ D-Day:需求转化阶段</h3>
      <ul>
        <li>启动 Naver SA / Google SA 广告</li>
        <li>招募体验团并产出真实评价内容</li>
        <li>活动/开业促销全渠道曝光</li>
      </ul>
      <h3>真实案例</h3>
      <p>江南 A 骨科从 D-120 开始营销 → 开业首周预约 100% 满档,3 个月内进入本地前三。<br>反之 B 皮肤科于 D-14 才仓促启动,开业后三个月平均日诊仅 6 人。差距在"时间"。</p>
      <div class="article-cta">
        <p>Noah Marketing Lab 从开业预定日前 90 天起,分阶段设计您的营销路径。</p>
        <a href="#contact" class="btn btn-primary">开业营销咨询 →</a>
      </div>
    `
    },
    '6': {
      tag: 'CC · INSIGHT',
      date: '2026.01.18',
      title: '不一样的口碑营销 — 为何答案是"转化"而非"曝光"',
      body: `
      <p class="lead">博客 100 条上位曝光仍拉不动营收,原因很简单:过往的口碑营销只在乎"被看到"。介绍 CC Company 坚持的"不一样的营销"的实质。</p>
      <h3>展示型口碑的极限</h3>
      <p>多数代理公司只保证"博客上位 N 条"等产出指标。问题是,这些曝光 <b>并未带来购买</b> — 点击率低、跳出率高、不再回访。</p>
      <h3>以转化为核心的口碑三原则</h3>
      <ul>
        <li><b>搜索意图反向设计</b>:从"价格比较""评价""推荐"等临购阶段关键字切入</li>
        <li><b>整合渠道运营</b>:不做博客单点,跨博客/咖啡厅/知识 iN/新闻/YouTube 交叉曝光,放大信任</li>
        <li><b>转化追踪</b>:UTM + GA4 + 来电追踪,测量 口碑 → 咨询 → 合约 的转化率</li>
      </ul>
      <h3>真实案例 — 首都圈 A 皮肤科</h3>
      <p>以博客上位为主的原代理到期后转入 CC Company。</p>
      <ul>
        <li>首月博客发文数 <b>减少 30%</b>(清理无效曝光)</li>
        <li>在咖啡厅/知识 iN 上部署 <b>问答系列</b></li>
        <li>交叉投放 7 条 YouTube Short + 1 篇 Naver 新闻</li>
        <li>结果:3 个月后 <b>新增预约 +218%</b>,广告预算不变</li>
      </ul>
      <h3>"不一样"的含义</h3>
      <p>CC Company 不是单纯代发博文,而是把行业分析 → 关键字设计 → 内容策划 → 多渠道执行 → 转化测量整合为一套系统。结果无法以数字证明,就不叫营销。</p>
      <blockquote>"我们的目标不是上位曝光,而是营收增长。营收没上,就是我们失败了。"</blockquote>
      <div class="article-cta">
        <p>欢迎前往 CC Company 官方博客查看更多真实案例。</p>
        <a href="https://blog.naver.com/cccompanyad" target="_blank" rel="noopener" class="btn btn-primary">访问博客 →</a>
      </div>
    `
    },
  },
};
// 편의 조회: 현재 페이지 언어에 해당하는 사전 반환 (없으면 ko 폴백)
function getArticles_() {
  return articlesByLang[getArticleLang_()] || articlesByLang.ko;
}

const modal = document.getElementById('articleModal');
const modalBody = document.getElementById('articleModalBody');
const modalClose = modal?.querySelector('.article-modal-close');
const modalBackdrop = modal?.querySelector('.article-modal-backdrop');

let _prevFocusedArticle = null;
function openArticle(id) {
  const data = getArticles_()[id];
  if (!data || !modal) return;
  _prevFocusedArticle = document.activeElement;
  modalBody.innerHTML = `
    <div class="article-header">
      <span class="article-tag">${data.tag}</span>
      <time>${data.date}</time>
    </div>
    <h2 class="article-title" id="article-modal-title">${data.title}</h2>
    <div class="article-content">${data.body}</div>
  `;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  lockBackground(true);
  modalClose?.focus();
}
function closeArticle() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  lockBackground(false);
  _prevFocusedArticle?.focus?.();
}
document.querySelectorAll('.news-card[data-article]').forEach(card => {
  const url = card.dataset.articleUrl;
  const handler = () => {
    if (url) { window.location.href = url; }
    else { openArticle(card.dataset.article); }
  };
  card.addEventListener('click', handler);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', url ? 'link' : 'button');
  if (url) { card.setAttribute('aria-label', card.querySelector('h4')?.textContent || ''); }
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
  });
});
modalClose?.addEventListener('click', closeArticle);
modalBackdrop?.addEventListener('click', closeArticle);
document.addEventListener('keydown', (e) => {
  if (modal?.classList.contains('open')) {
    if (e.key === 'Escape') { closeArticle(); return; }
    trapFocus(modal, e);
  }
});
modalBody?.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link) closeArticle();
});

// ===== Modal focus trap utility =====
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const bgLayers = () => [document.getElementById('header'), document.getElementById('main-content'), document.getElementById('footer')].filter(Boolean);
let _prevFocused = null;

function trapFocus(modalEl, e) {
  if (e.key !== 'Tab') return;
  const focusables = Array.from(modalEl.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function lockBackground(locked) {
  // 헤더/푸터에만 inert를 적용 — main-content는 모달의 부모이므로 inert를 걸면 모달 자체가 비활성화됨
  // (결제/문의 모달의 X 버튼이 안 눌리던 버그 원인)
  [document.getElementById('header'), document.getElementById('footer')].filter(Boolean).forEach(el => {
    if (locked) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

// ===== Inquiry Form Modal =====
const inqModal = document.getElementById('inquiryModal');
const inqBackdrop = inqModal?.querySelector('.inquiry-modal-backdrop');
const inqClose = inqModal?.querySelector('.inquiry-modal-close');
const inqForm = document.getElementById('inquiryForm');
const inqSuccess = document.getElementById('inquirySuccess');

const openInquiry = () => {
  if (!inqModal) return;
  _prevFocused = document.activeElement;
  inqModal.classList.add('open');
  inqModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  lockBackground(true);
  setTimeout(() => document.getElementById('inq-name')?.focus(), 250);
};
const closeInquiry = () => {
  if (!inqModal) return;
  inqModal.classList.remove('open');
  inqModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  lockBackground(false);
  _prevFocused?.focus?.();
};

document.getElementById('openInquiry')?.addEventListener('click', openInquiry);
inqClose?.addEventListener('click', closeInquiry);
inqBackdrop?.addEventListener('click', closeInquiry);
document.addEventListener('keydown', (e) => {
  if (inqModal?.classList.contains('open')) {
    if (e.key === 'Escape') { closeInquiry(); return; }
    trapFocus(inqModal, e);
  }
});

// Google Apps Script Web App URL — 배포 후 생성되는 URL을 여기에 붙여넣으세요.
// 예: 'https://script.google.com/macros/s/AKfycb.../exec'
const INQUIRY_WEBHOOK_URL = '';

// ===== 공용 보안 유틸: formOpenedAt 주입 · IP 조회 · UUID 생성 · 허니팟 읽기 =====
document.querySelectorAll('input.form-opened-at').forEach(el => {
  el.value = new Date().toISOString();
});
let _cachedClientIp = null;
async function fetchClientIp_() {
  if (_cachedClientIp !== null) return _cachedClientIp;
  try {
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); _cachedClientIp = String(j.ip || '').slice(0, 45); return _cachedClientIp; }
  } catch(_) {}
  _cachedClientIp = '';
  return '';
}
function makeUUID_() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  // fallback (RFC4122 v4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function readHoneypot_(form) {
  return (form?.querySelector('input[name="website"]')?.value || '').trim();
}
function readFormOpenedAt_(form) {
  return form?.querySelector('input.form-opened-at')?.value || '';
}

inqForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = inqForm.querySelector('button[type="submit"]');
  const originalHTML = submitBtn?.innerHTML;

  // Manual validation (form has novalidate)
  const required = [
    { id: 'inq-name', label: '이름' },
    { id: 'inq-phone', label: '연락처' },
    { id: 'inq-message', label: '문의 내용' },
  ];
  for (const { id, label } of required) {
    const el = document.getElementById(id);
    if (!el?.value.trim()) {
      el?.focus();
      alert(`${label}을(를) 입력해주세요.`);
      return;
    }
  }
  const privacy = document.getElementById('inq-privacy');
  if (!privacy?.checked) {
    privacy?.focus();
    alert('개인정보 수집 및 이용에 동의해주세요.');
    return;
  }

  // 허니팟 — 값 있으면 봇으로 간주(조용히 차단)
  if (readHoneypot_(inqForm)) { return; }

  const clientIp = await fetchClientIp_();
  const data = new FormData(inqForm);
  const payload = {
    type: 'inquiry',
    name: (data.get('name') || '').toString().trim(),
    company: (data.get('company') || '').toString().trim(),
    phone: (data.get('phone') || '').toString().trim(),
    email: (data.get('email') || '').toString().trim(),
    interests: data.getAll('interest').join(', '),
    message: (data.get('message') || '').toString().trim(),
    referrer: (document.referrer || '(direct)').slice(0, 200),
    userAgent: (navigator.userAgent || '').slice(0, 200),
    clientIp,
    origin: location.origin,
    formOpenedAt: readFormOpenedAt_(inqForm),
    submittedAt: new Date().toISOString(),
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '전송 중…';
  }

  try {
    if (!INQUIRY_WEBHOOK_URL) {
      console.warn('[Inquiry] Webhook URL이 설정되지 않았습니다. js/script.js의 INQUIRY_WEBHOOK_URL을 설정하세요.', payload);
      throw new Error('Webhook URL not configured');
    }
    const res = await fetch(INQUIRY_WEBHOOK_URL, {
      method: 'POST',
      // text/plain → CORS preflight(OPTIONS) 회피. Apps Script는 OPTIONS를 기본 처리하지 않음.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    inqForm.style.display = 'none';
    inqSuccess.hidden = false;
    setTimeout(() => {
      closeInquiry();
      setTimeout(() => {
        inqForm.reset();
        inqForm.style.display = '';
        inqSuccess.hidden = true;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
        }
      }, 400);
    }, 2400);
  } catch (err) {
    console.error('[Inquiry] 전송 실패:', err);
    alert('문의 전송 중 오류가 발생했습니다.\n잠시 후 다시 시도해주시거나 010-6658-6482로 연락 부탁드립니다.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
    }
  }
});

// ===== FAQ 섹션 CTA → 문의 모달 열기 =====
document.getElementById('faqOpenInquiry')?.addEventListener('click', () => openInquiry());

// ===== Smooth anchor scroll (dynamic header offset) =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    // 빈/placeholder 앵커는 페이지 점프 방지
    if (href === '#' || href.length < 2) { e.preventDefault(); return; }
    const target = document.querySelector(href);
    if (!target) { e.preventDefault(); return; }
    e.preventDefault();
    const offset = getHeaderHeight() + 16;
    const y = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});

// ============================================================
// ===== PortOne (포트원) 결제 연동 =====
// ============================================================
// ⚠️ 배포 전 아래 3개 상수를 실제 PortOne 계정에서 발급받은 값으로 교체하세요.
// 발급 방법: apps-script/Code.gs 상단 주석 참조
const PORTONE_STORE_ID = '';                // 예: 'store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
const PORTONE_CHANNEL_KEY = '';             // 결제 채널 키 (PG사별로 발급)
const PAYMENT_VERIFY_URL = '';              // Apps Script 웹앱 URL (INQUIRY_WEBHOOK_URL과 같은 배포면 동일 URL)

const payModal = document.getElementById('paymentModal');
const payForm = document.getElementById('paymentForm');
const payClose = payModal?.querySelector('.payment-modal-close');
const payBackdrop = payModal?.querySelector('.payment-modal-backdrop');
const paySuccess = document.getElementById('paymentSuccess');
const paySummaryAmount = document.getElementById('paySummaryAmount');
const paySubmitBtn = document.getElementById('paySubmitBtn');
const paySubmitLabel = document.getElementById('paySubmitLabel');
const payCustomWrap = document.getElementById('payCustomWrap');
const payCustomInput = document.getElementById('pay-custom-amount');

const formatWon = (n) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(n) || 0))) + ' 원';

const getSelectedAmount = () => {
  const sel = payForm?.querySelector('input[name="pay-preset"]:checked');
  if (!sel) return { amount: 0, name: '' };
  const name = sel.getAttribute('data-name') || '결제';
  if (sel.value === 'custom') {
    const custom = parseInt(payCustomInput?.value || '0', 10) || 0;
    return { amount: custom, name };
  }
  return { amount: parseInt(sel.value, 10), name };
};
const refreshPaySummary = () => {
  const { amount } = getSelectedAmount();
  if (paySummaryAmount) paySummaryAmount.textContent = formatWon(amount);
};

payForm?.querySelectorAll('input[name="pay-preset"]').forEach(el => {
  el.addEventListener('change', () => {
    const isCustom = el.value === 'custom' && el.checked;
    if (payCustomWrap) payCustomWrap.hidden = !isCustom;
    refreshPaySummary();
    if (isCustom) payCustomInput?.focus();
  });
});
payCustomInput?.addEventListener('input', refreshPaySummary);

let _prevFocusedPay = null;
const openPayment = () => {
  if (!payModal) return;
  _prevFocusedPay = document.activeElement;
  payModal.classList.add('open');
  payModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  lockBackground(true);
  refreshPaySummary();
  setTimeout(() => document.getElementById('pay-name')?.focus(), 250);
};
const closePayment = () => {
  if (!payModal) return;
  payModal.classList.remove('open');
  payModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  lockBackground(false);
  _prevFocusedPay?.focus?.();
};
document.getElementById('openPayment')?.addEventListener('click', openPayment);
payClose?.addEventListener('click', closePayment);
payBackdrop?.addEventListener('click', closePayment);
document.addEventListener('keydown', (e) => {
  if (payModal?.classList.contains('open')) {
    if (e.key === 'Escape') { closePayment(); return; }
    trapFocus(payModal, e);
  }
});

payForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // 필수 필드 검증
  const name = document.getElementById('pay-name')?.value.trim();
  const phone = document.getElementById('pay-phone')?.value.trim();
  const email = document.getElementById('pay-email')?.value.trim();
  const memo = document.getElementById('pay-memo')?.value.trim();
  const privacy = document.getElementById('pay-privacy')?.checked;
  if (!name) { alert('이름을 입력해주세요.'); return; }
  if (!phone) { alert('연락처를 입력해주세요.'); return; }
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { alert('유효한 이메일을 입력해주세요.'); return; }
  if (!privacy) { alert('약관·개인정보 수집에 동의해주세요.'); return; }

  const { amount, name: itemName } = getSelectedAmount();
  if (!amount || amount < 100) { alert('결제 금액을 확인해주세요.'); return; }

  if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
    alert('결제 시스템이 아직 활성화되지 않았습니다. 관리자에게 문의하거나 카카오채널/전화로 연락 주세요.');
    return;
  }
  if (!window.PortOne) {
    alert('결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  // 허니팟 체크
  if (readHoneypot_(payForm)) { return; }

  // 서버에서 paymentId 포맷 검증에 쓸 UUID 생성 (brute-force 저항)
  const paymentId = 'noah_' + makeUUID_();
  const clientIp = await fetchClientIp_();

  paySubmitBtn.disabled = true;
  const originalLabel = paySubmitLabel.textContent;
  paySubmitLabel.textContent = '결제창 여는 중…';

  try {
    const rsp = await window.PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: itemName,
      totalAmount: amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      customer: {
        fullName: name,
        phoneNumber: phone.replace(/-/g, ''),
        email,
      },
      customData: { memo: (memo || '').slice(0, 500) },
    });

    if (rsp?.code !== undefined) {
      // 사용자 취소 또는 오류
      throw new Error(rsp.message || '결제가 취소됐습니다.');
    }

    // 서버 검증 — 응답이 {ok:true}일 때만 성공 처리 (F17 수정)
    if (!PAYMENT_VERIFY_URL) {
      throw new Error('서버 검증이 구성되지 않았습니다. 관리자에게 문의해주세요.');
    }
    const verifyRes = await fetch(PAYMENT_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'payment',
        paymentId,
        expectedAmount: amount,
        orderName: itemName,
        customer: { name, phone, email, memo: (memo || '').slice(0, 500) },
        clientIp,
        origin: location.origin,
        userAgent: (navigator.userAgent || '').slice(0, 200),
        formOpenedAt: readFormOpenedAt_(payForm),
        submittedAt: new Date().toISOString(),
      }),
    });
    let verifyJson = {};
    try { verifyJson = await verifyRes.json(); } catch(_) {}
    if (!verifyRes.ok || !verifyJson.ok) {
      throw new Error('결제 검증에 실패했습니다. 결제는 진행됐을 수 있으니 영수증 확인 후 010-6658-6482로 연락주세요.');
    }

    // 성공 UI
    payForm.style.display = 'none';
    paySuccess.hidden = false;
    setTimeout(() => {
      closePayment();
      setTimeout(() => {
        payForm.reset();
        payForm.style.display = '';
        paySuccess.hidden = true;
        paySubmitBtn.disabled = false;
        paySubmitLabel.textContent = originalLabel;
        refreshPaySummary();
      }, 400);
    }, 3000);
  } catch (err) {
    console.error('[Payment] 결제 실패:', err);
    alert(`결제 중 오류가 발생했습니다.\n${err.message || ''}\n\n문제가 계속되면 010-6658-6482로 연락 부탁드립니다.`);
    paySubmitBtn.disabled = false;
    paySubmitLabel.textContent = originalLabel;
  }
});

// ===== ROI Calculator =====
(() => {
  const indSel = document.getElementById('roi-industry');
  const budRange = document.getElementById('roi-budget');
  const budDisplay = document.getElementById('roi-budget-display');
  const leadsEl = document.getElementById('roi-leads');
  const roasEl = document.getElementById('roi-roas');
  const revEl = document.getElementById('roi-revenue');
  const ctaBtn = document.getElementById('roiOpenInquiry');
  if (!indSel || !budRange) return;

  // 업종별 데이터 (자사 374건 운영 평균 기준)
  // leadsPerMillion: 100만원당 월간 핵심 지표 수, roas(월 평균 ROAS%), sixMonthMin/Max(6개월 누적 매출 = 월 예산 × 배수)
  // 업계 통상 8~15배 범위 — 의료/B2B는 다소 낮고 D2C/뷰티는 높은 편
  const data = {
    medical:    { leadsPerMillion: 0.6,  roasMin: 220, roasMax: 320, sixMonthMin: 8,  sixMonthMax: 12, leadLabel: '월 신규 문의 (예상)' },
    legal:      { leadsPerMillion: 0.4,  roasMin: 240, roasMax: 360, sixMonthMin: 8,  sixMonthMax: 13, leadLabel: '월 신규 상담 (예상)' },
    commerce:   { leadsPerMillion: 8.0,  roasMin: 200, roasMax: 290, sixMonthMin: 10, sixMonthMax: 15, leadLabel: '월 신규 주문 (예상)' },
    restaurant: { leadsPerMillion: 28,   roasMin: 220, roasMax: 320, sixMonthMin: 9,  sixMonthMax: 14, leadLabel: '월 신규 방문 (예상)' },
    b2b:        { leadsPerMillion: 0.6,  roasMin: 180, roasMax: 260, sixMonthMin: 6,  sixMonthMax: 10, leadLabel: '월 신규 리드 (예상)' },
    education:  { leadsPerMillion: 1.4,  roasMin: 200, roasMax: 290, sixMonthMin: 8,  sixMonthMax: 12, leadLabel: '월 신규 문의 (예상)' },
    beauty:     { leadsPerMillion: 6.5,  roasMin: 220, roasMax: 320, sixMonthMin: 10, sixMonthMax: 14, leadLabel: '월 신규 주문 (예상)' },
  };

  const fmtWon = (n) => {
    if (n >= 100000000) {
      const eok = n / 100000000;
      return eok.toFixed(eok >= 10 ? 0 : 1).replace(/\.0$/,'') + '억';
    }
    if (n >= 10000) return Math.round(n/10000).toLocaleString('ko-KR') + '만';
    return new Intl.NumberFormat('ko-KR').format(n);
  };

  const update = () => {
    const ind = data[indSel.value] || data.medical;
    const budManwon = parseInt(budRange.value, 10); // 단위: 만원
    const budgetWon = budManwon * 10000;
    const leads = Math.round(ind.leadsPerMillion * (budManwon / 1));
    // 6개월 누적 매출 = 월 예산 × 8~15배 (업종별 sixMonthMin/Max)
    const sixMonthLow = budgetWon * ind.sixMonthMin;
    const sixMonthHigh = budgetWon * ind.sixMonthMax;

    budDisplay.textContent = '₩' + budManwon.toLocaleString('ko-KR') + '만';
    // slider gradient
    const pct = ((budManwon - 100) / (5000 - 100)) * 100;
    budRange.style.setProperty('--val', pct + '%');

    leadsEl.textContent = leads.toLocaleString('ko-KR');
    roasEl.textContent = ind.roasMin + '~' + ind.roasMax;
    revEl.textContent = fmtWon(sixMonthLow) + '~' + fmtWon(sixMonthHigh);

    // 업종별 lead 라벨 동적 변경 (식당/이커머스/뷰티 등)
    const leadLabelEl = document.querySelector('#roi-leads')?.parentElement?.querySelector('.roi-stat-label');
    if (leadLabelEl) leadLabelEl.textContent = ind.leadLabel;
  };

  indSel.addEventListener('change', update);
  budRange.addEventListener('input', update);
  ctaBtn?.addEventListener('click', () => {
    if (typeof openInquiry === 'function') {
      openInquiry();
      // 메모란에 ROI 시뮬 결과 자동 입력
      setTimeout(() => {
        const memo = document.getElementById('inq-message') || document.getElementById('inq-memo');
        if (memo) {
          const ind = indSel.options[indSel.selectedIndex].text;
          memo.value = `[ROI 시뮬레이션] 업종: ${ind} / 월 예산: ₩${budRange.value}만원 / 예상 ROAS: ${roasEl.textContent}% / 6개월 누적: ${revEl.textContent}원\n\n맞춤 견적 요청드립니다.`;
        }
      }, 300);
    }
  });

  update(); // 초기 계산
})();

// ===== Sound FX (Web Audio synthesis, no audio files) =====
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SOUND_KEY = 'noah_sound_v1';
  const stored = (() => { try { return localStorage.getItem(SOUND_KEY); } catch { return null; } })();
  let enabled = stored === '1';   // 기본 OFF — 사용자가 켤 때만 활성

  let ctx = null;
  const ensureCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const play = (freq, dur, type='sine', gain=0.05, sweep=null) => {
    if (!enabled) return;
    try {
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, c.currentTime + dur/1000);
      g.gain.setValueAtTime(gain, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur/1000);
      o.connect(g); g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur/1000);
    } catch {}
  };

  // 사운드 프리셋
  const sfx = {
    click:    () => play(720, 40, 'square', 0.04),
    hover:    () => play(1400, 18, 'sine', 0.025),
    open:     () => { play(420, 90, 'sine', 0.05, 880); },
    close:    () => { play(880, 90, 'sine', 0.04, 420); },
    success:  () => { play(660, 60, 'sine', 0.05); setTimeout(()=>play(990, 80, 'sine', 0.05), 80); },
    toggle:   () => play(540, 50, 'triangle', 0.04),
  };
  window.__noahSfx = sfx;

  // 토글 버튼 생성
  const tBtn = document.createElement('button');
  tBtn.type = 'button';
  tBtn.className = 'sound-toggle ' + (enabled ? 'on' : 'off');
  tBtn.setAttribute('aria-label', enabled ? '사운드 끄기' : '사운드 켜기');
  tBtn.title = enabled ? '사운드 ON (클릭해서 끄기)' : '사운드 OFF (클릭해서 켜기)';
  const renderIcon = () => {
    tBtn.innerHTML = enabled
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  };
  renderIcon();
  document.body.appendChild(tBtn);
  tBtn.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(SOUND_KEY, enabled ? '1' : '0'); } catch {}
    tBtn.className = 'sound-toggle ' + (enabled ? 'on' : 'off');
    tBtn.setAttribute('aria-label', enabled ? '사운드 끄기' : '사운드 켜기');
    tBtn.title = enabled ? '사운드 ON (클릭해서 끄기)' : '사운드 OFF (클릭해서 켜기)';
    renderIcon();
    if (enabled) sfx.toggle();
  });

  // 핵심 인터랙션에 사운드 바인딩 (이미 enabled 체크는 play() 내부에서 함)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, .btn, a.btn, .news-card, .product, .company, .ar-card, .article-card');
    if (t) sfx.click();
  });
  // 모달 open/close hooks
  const _openInq = window.openInquiry; const _closeInq = window.closeInquiry;
  // openInquiry/closeInquiry는 const라 직접 wrap 어려움 — 대신 modal 클래스 변경 감지로 대응
  const obs = new MutationObserver((muts) => {
    muts.forEach(m => {
      if (m.attributeName === 'class') {
        const el = m.target;
        if (el.classList.contains('open') && !el.dataset.sfxPlayed) {
          el.dataset.sfxPlayed = '1';
          sfx.open();
        } else if (!el.classList.contains('open') && el.dataset.sfxPlayed === '1') {
          el.dataset.sfxPlayed = '0';
          sfx.close();
        }
      }
    });
  });
  ['inquiryModal','paymentModal','articleModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  // 폼 제출 성공 시 success 사운드
  document.querySelectorAll('#inquiryForm, #paymentForm').forEach(f => {
    f.addEventListener('submit', () => {
      // 성공은 비동기 — 추정으로 1.5초 후 재생
      setTimeout(() => sfx.success(), 1400);
    });
  });
})();

// ===== Demo dashboard counter animation (30s loop) =====
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const counters = document.querySelectorAll('.demo-counter');
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseFloat(el.dataset.target || '0');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const raw = target * eased;
      let val;
      if (decimals > 0) {
        const fixed = raw.toFixed(decimals);
        const [intPart, decPart] = fixed.split('.');
        val = parseInt(intPart, 10).toLocaleString('ko-KR') + '.' + decPart;
      } else {
        val = Math.floor(raw).toLocaleString('ko-KR');
      }
      el.textContent = prefix + val + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // 1. 데모 진입(viewport)에 들어왔을 때 1회 + 30초마다 반복
  const demoSec = document.getElementById('demo');
  if (!demoSec) return;
  let played = false;
  const playAll = () => counters.forEach(animate);
  new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !played) { played = true; playAll(); setInterval(playAll, 30000); }
    });
  }, { threshold: 0.3 }).observe(demoSec);
})();

// ===== Demo dashboard — 사이드바 고객사 사례 자동 순환 (30초마다 전환) =====
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const demoSec = document.getElementById('demo');
  if (!demoSec) return;

  // 6개 고객사 사례 데이터 — KPI/그래프/활동피드 모두 변경
  // 업계 평균 매출 수준에 맞춘 현실적 수치 (월 단위, 단위: 만원)
  const cases = [
    {
      name: '강남 피부과 A · 14개월차 운영',
      kpis: { leads: 142, leadsLabel: '월 신규 문의', roas: 312, revenue: 6800, revenueLabel: '월 매출' },
      growth: '+128%',
      feed: [
        '⚡ Naver Smart Block 진입 — "강남 피부과 추천" 키워드 <tspan fill="#f4d9a8" font-weight="700">3위</tspan>',
        '💬 KakaoTalk 채널 친구 추가 <tspan fill="#f4d9a8" font-weight="700">+147명</tspan> (지난 24시간)',
        '📋 신규 내원 예약 <tspan fill="#f4d9a8" font-weight="700">+38건</tspan> · ROAS <tspan fill="#f4d9a8" font-weight="700">312%</tspan>'
      ]
    },
    {
      name: '건강기능식품 D2C B · 8개월차 운영',
      kpis: { leads: 642, leadsLabel: '월 신규 주문', roas: 286, revenue: 3200, revenueLabel: '월 매출' },
      growth: '+186%',
      feed: [
        '🔥 스마트스토어 "유산균 추천" 카테고리 <tspan fill="#f4d9a8" font-weight="700">1페이지 2위</tspan>',
        '📝 체험단 30건 발행 완료 — 평점 평균 <tspan fill="#f4d9a8" font-weight="700">4.8/5</tspan>',
        '⚖ MFDS 기능성 표시 사전심의 <tspan fill="#f4d9a8" font-weight="700">통과</tspan> (피부보습 + 면역기능)'
      ]
    },
    {
      name: '송파 한의원 C · 6개월차 운영',
      kpis: { leads: 92, leadsLabel: '월 신규 내원 예약', roas: 268, revenue: 3400, revenueLabel: '월 매출' },
      growth: '+94%',
      feed: [
        '🌸 환절기 비염 시즌 콘텐츠 <tspan fill="#f4d9a8" font-weight="700">+12건</tspan> 선제 발행',
        '📍 네이버 플레이스 "송파 한의원" <tspan fill="#f4d9a8" font-weight="700">TOP 3 진입</tspan>',
        '📞 신규 예약 <tspan fill="#f4d9a8" font-weight="700">+38건</tspan> (이번 주)'
      ]
    },
    {
      name: '강남 법무법인 D · 18개월차 운영',
      kpis: { leads: 48, leadsLabel: '월 신규 상담', roas: 348, revenue: 14200, revenueLabel: '월 매출' },
      growth: '+76%',
      feed: [
        '📚 "이혼 소송 절차" 블로그 시리즈 <tspan fill="#f4d9a8" font-weight="700">9개 상위 진입</tspan>',
        '🔎 Naver 파워링크 CPC <tspan fill="#f4d9a8" font-weight="700">-22%</tspan> 최적화',
        '📋 신규 수임 <tspan fill="#f4d9a8" font-weight="700">+18건/월</tspan>'
      ]
    },
    {
      name: '부산 디저트 카페 · 4개월차 운영',
      kpis: { leads: 318, leadsLabel: '월 신규 방문 (테이블)', roas: 240, revenue: 2200, revenueLabel: '월 매출' },
      growth: '+162%',
      feed: [
        '📸 인스타 릴스 <tspan fill="#f4d9a8" font-weight="700">조회수 124만</tspan> 달성 (시그니처 메뉴)',
        '🗺 Naver 플레이스 "부산 디저트" <tspan fill="#f4d9a8" font-weight="700">1페이지 1위</tspan>',
        '☕ 주말 평균 대기 <tspan fill="#f4d9a8" font-weight="700">22팀</tspan> · 월 매출 +1.6배'
      ]
    },
    {
      name: 'D2C 뷰티 브랜드 E · 10개월차 운영',
      kpis: { leads: 1240, leadsLabel: '월 신규 주문', roas: 296, revenue: 18000, revenueLabel: '월 매출' },
      growth: '+148%',
      feed: [
        '🛒 스마트스토어 신규 SKU 5개 <tspan fill="#f4d9a8" font-weight="700">동시 1페이지</tspan>',
        '⭐ 누적 리뷰 <tspan fill="#f4d9a8" font-weight="700">8,420건</tspan> · 평점 4.7',
        '💎 KakaoTalk 단골 회원 <tspan fill="#f4d9a8" font-weight="700">+1,840명</tspan> (지난 분기)'
      ]
    }
  ];

  let idx = 0;
  const headerEl = demoSec.querySelector('svg text[fill="#f4d9a8"][font-size="13"]');
  const counters = demoSec.querySelectorAll('.demo-counter');
  const activeRect = demoSec.querySelector('.demo-nav-active');
  const feed = demoSec.querySelector('.demo-feed');
  const dotsTextGrowth = demoSec.querySelector('.demo-dots text');
  const navItems = demoSec.querySelectorAll('.demo-nav-item');
  // KPI 라벨 — SVG 내 text 셀렉터로 잡기 (1번째: leads label, 3번째: revenue label)
  const allKpiLabels = demoSec.querySelectorAll('.demo-kpis text[font-size="9.5"]');

  // 사이드바 active rect Y — HTML의 wrapper rect 위치와 동일
  const navYPositions = [64, 108, 150, 192, 234, 276];

  const setActive = (newIdx) => {
    idx = ((newIdx % cases.length) + cases.length) % cases.length;
    const c = cases[idx];

    // header 텍스트
    if (headerEl) headerEl.textContent = c.name;

    // sidebar active 위치 이동
    if (activeRect) activeRect.setAttribute('y', navYPositions[idx]);

    // sidebar 강조 색 변경 (각 .demo-nav-item 내의 .dni-title / .dni-sub)
    navItems.forEach((g, i) => {
      const title = g.querySelector('.dni-title');
      const sub = g.querySelector('.dni-sub');
      if (i === idx) {
        title?.setAttribute('fill', '#f4d9a8'); title?.setAttribute('font-weight', '700');
        sub?.setAttribute('fill', 'rgba(244,217,168,0.65)');
      } else {
        title?.setAttribute('fill', 'rgba(255,255,255,0.7)'); title?.setAttribute('font-weight', '600');
        sub?.setAttribute('fill', 'rgba(255,255,255,0.4)');
      }
    });

    // KPI 라벨 업데이트
    if (allKpiLabels[0]) allKpiLabels[0].textContent = c.kpis.leadsLabel;
    if (allKpiLabels[2]) allKpiLabels[2].textContent = c.kpis.revenueLabel;

    // KPI 카운터 새 target 적용
    if (counters[0]) { counters[0].dataset.target = c.kpis.leads; counters[0].dataset.suffix = ''; counters[0].textContent = '0'; }
    if (counters[1]) { counters[1].dataset.target = c.kpis.roas; counters[1].textContent = '0'; }
    if (counters[2]) { counters[2].dataset.target = c.kpis.revenue; counters[2].dataset.decimals = '0'; counters[2].textContent = '0'; }

    // 그래프 endpoint 라벨
    if (dotsTextGrowth) dotsTextGrowth.textContent = c.growth;

    // 활동 피드
    if (feed) {
      const texts = feed.querySelectorAll('text');
      c.feed.forEach((html, i) => { if (texts[i]) texts[i].innerHTML = html; });
    }

    // 카운터 재애니메이션
    counters.forEach(el => {
      const target = parseFloat(el.dataset.target || '0');
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const duration = 1300;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const raw = target * eased;
        let val;
        if (decimals > 0) {
          const fixed = raw.toFixed(decimals);
          const [intPart, decPart] = fixed.split('.');
          val = parseInt(intPart, 10).toLocaleString('ko-KR') + '.' + decPart;
        } else {
          val = Math.floor(raw).toLocaleString('ko-KR');
        }
        el.textContent = prefix + val + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  // 클릭 인터랙션 — 6개 사이드바 항목
  let autoTimer = null;
  const startAuto = () => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => setActive(idx + 1), 30000);
  };
  navItems.forEach(g => {
    g.addEventListener('click', () => {
      const i = parseInt(g.dataset.idx || '0', 10);
      setActive(i);
      startAuto(); // 사용자 클릭 후 자동 순환 타이머 리셋
    });
    // 키보드 접근성
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.dispatchEvent(new Event('click')); }
    });
  });

  // viewport 진입 시 자동 순환 시작
  let started = false;
  new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting && !started) { started = true; startAuto(); } });
  }, { threshold: 0.3 }).observe(demoSec);
})();
