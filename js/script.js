// ===== Intro / Loading (always on) =====
const introEl = document.getElementById('intro');
document.body.classList.add('no-scroll');

const hideIntro = () => {
  introEl.classList.add('hide');
  introEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
};

// Show intro for 2.8s total (matches animation duration)
const introDuration = 2800;
const startIntroExit = () => setTimeout(hideIntro, introDuration);

if (document.readyState === 'complete') {
  startIntroExit();
} else {
  window.addEventListener('load', startIntroExit);
  // Safety fallback: if 'load' never fires (slow 3rd-party), hide anyway after 5s
  setTimeout(hideIntro, 5000);
}

// Click anywhere on intro to skip
introEl?.addEventListener('click', hideIntro);

// ===== Hero: Compass continuous rotation (direction by cursor) + Ark parallax =====
(() => {
  const hero = document.querySelector('.hero');
  const compass = document.getElementById('heroCompass');
  const needle = document.getElementById('compassNeedle');
  const ark = document.getElementById('heroArk');
  if (!hero || !compass || !needle || !ark) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let currentAngle = 0;            // current needle angle
  let targetSpeed = 0.3;           // target degrees per frame (default slow drift)
  let currentSpeed = 0.3;          // eased speed
  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;

  const hasHover = matchMedia('(hover: hover)').matches;

  const onMove = (e) => {
    const heroRect = hero.getBoundingClientRect();
    const cx = heroRect.left + heroRect.width / 2;
    const cy = heroRect.top + heroRect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Cursor X → rotation speed. Far right = fast CW, far left = fast CCW.
    const normX = dx / (heroRect.width / 2);    // -1 ~ 1
    const clampedX = Math.max(-1, Math.min(1, normX));
    // Max 2.5 deg/frame (~150°/sec). Small deadzone so center is near-still.
    const sign = Math.sign(clampedX);
    const magnitude = Math.max(0, Math.abs(clampedX) - 0.08) / 0.92;
    targetSpeed = sign * magnitude * 2.5 + (sign * 0.1 || 0.15);

    // Ark parallax based on cursor
    const maxOffset = 26;
    targetX = -(dx / heroRect.width) * maxOffset;
    targetY = -(dy / heroRect.height) * maxOffset * 0.5;
  };

  const onLeave = () => {
    targetSpeed = 0.3;              // back to idle drift
    targetX = 0; targetY = 0;
  };

  if (hasHover) {
    window.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseleave', onLeave);
  }

  const tick = () => {
    // Ease speed toward target for smooth acceleration/deceleration
    currentSpeed += (targetSpeed - currentSpeed) * 0.04;

    // Continuous rotation
    currentAngle = (currentAngle + currentSpeed) % 360;

    // Ease ark offset
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;

    needle.setAttribute('transform', `rotate(${currentAngle.toFixed(2)} 250 250)`);
    ark.style.setProperty('--ark-x', currentX.toFixed(1) + 'px');
    ark.style.setProperty('--ark-y', currentY.toFixed(1) + 'px');

    requestAnimationFrame(tick);
  };
  tick();
})();

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

// ===== Header scroll state + dynamic offset + scroll progress =====
const header = document.getElementById('header');
const topBtn = document.querySelector('.btn-top');
const scrollProgress = document.getElementById('scrollProgress');
const getHeaderHeight = () => header?.offsetHeight ?? 70;
const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 50);
  topBtn.classList.toggle('show', y > 400);
  if (scrollProgress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? (y / max) * 100 : 0;
    scrollProgress.style.setProperty('--progress', p + '%');
  }
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

// ===== Article Modal (Insights) =====
const articles = {
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
};

const modal = document.getElementById('articleModal');
const modalBody = document.getElementById('articleModalBody');
const modalClose = modal?.querySelector('.article-modal-close');
const modalBackdrop = modal?.querySelector('.article-modal-backdrop');

function openArticle(id) {
  const data = articles[id];
  if (!data || !modal) return;
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
  modalClose.focus();
}
function closeArticle() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}
document.querySelectorAll('.news-card[data-article]').forEach(card => {
  card.addEventListener('click', () => openArticle(card.dataset.article));
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openArticle(card.dataset.article); }
  });
});
modalClose?.addEventListener('click', closeArticle);
modalBackdrop?.addEventListener('click', closeArticle);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('open')) closeArticle();
});
modalBody?.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link) closeArticle();
});

// ===== Inquiry Form Modal =====
const inqModal = document.getElementById('inquiryModal');
const inqBackdrop = inqModal?.querySelector('.inquiry-modal-backdrop');
const inqClose = inqModal?.querySelector('.inquiry-modal-close');
const inqForm = document.getElementById('inquiryForm');
const inqSuccess = document.getElementById('inquirySuccess');

const openInquiry = () => {
  if (!inqModal) return;
  inqModal.classList.add('open');
  inqModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  setTimeout(() => document.getElementById('inq-name')?.focus(), 250);
};
const closeInquiry = () => {
  if (!inqModal) return;
  inqModal.classList.remove('open');
  inqModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
};

document.getElementById('openInquiry')?.addEventListener('click', openInquiry);
inqClose?.addEventListener('click', closeInquiry);
inqBackdrop?.addEventListener('click', closeInquiry);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && inqModal?.classList.contains('open')) closeInquiry();
});

// Google Apps Script Web App URL — 배포 후 생성되는 URL을 여기에 붙여넣으세요.
// 예: 'https://script.google.com/macros/s/AKfycb.../exec'
const INQUIRY_WEBHOOK_URL = '';

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

  const data = new FormData(inqForm);
  const payload = {
    name: (data.get('name') || '').toString().trim(),
    company: (data.get('company') || '').toString().trim(),
    phone: (data.get('phone') || '').toString().trim(),
    email: (data.get('email') || '').toString().trim(),
    interests: data.getAll('interest').join(', '),
    message: (data.get('message') || '').toString().trim(),
    referrer: document.referrer || '(direct)',
    userAgent: navigator.userAgent,
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
