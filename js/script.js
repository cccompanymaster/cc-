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
    title: '맘카페 바이럴, 진짜 효과 있는 집행 방식은?',
    body: `
      <p class="lead">대한민국 여성 타깃 마케팅에서 맘카페의 영향력은 여전히 절대적입니다. 그러나 "돈만 쓰고 반응이 없다"는 광고주의 호소가 늘고 있습니다. 효과 있는 맘카페 바이럴의 실제 작동 원리를 공개합니다.</p>
      <h3>1. "후기"가 아닌 "경험담" 형식</h3>
      <p>상품을 홍보하는 후기는 카페 회원들이 5초 만에 간파합니다. 제품 이름보다 본인의 상황과 고민에서 시작하는 스토리 구조가 전환율을 3~5배 높입니다.</p>
      <h3>2. 타깃 카페 선정의 기준</h3>
      <ul>
        <li>회원 수보다 <b>일 활성 사용자(DAU) 비율</b>이 중요</li>
        <li>지역 맘카페 > 전국 맘카페 (타깃이 지역 비즈니스일 경우)</li>
        <li>운영 기간 3년 이상 + 중간 관리자 활동 활발</li>
      </ul>
      <h3>3. 콘텐츠 주기와 분산</h3>
      <p>한 카페에 집중하기보다 5~7개 카페에 분산, 1~2주 간격으로 업로드해야 자연스럽게 노출됩니다. 동시다발적 업로드는 카페 운영진에게 적발당합니다.</p>
      <h3>4. 댓글 설계</h3>
      <p>원글보다 <b>댓글</b>이 전환에 결정적입니다. 원글 작성자가 추가 질문에 답변하는 흐름과, 다른 사용자의 공감 댓글이 붙는 구조가 효과를 증폭시킵니다.</p>
      <h3>5. 측정 가능한 성과</h3>
      <p>맘카페 바이럴은 직접 클릭 수보다 <b>브랜드 검색량·매장 방문·후기 언급</b> 등 간접 지표로 측정해야 합니다. UTM 링크는 카페 정책상 차단되는 경우가 많습니다.</p>
      <div class="article-cta">
        <p>CC컴퍼니는 맘카페 바이럴에 필요한 콘텐츠 설계부터 운영, 성과 측정까지 제공합니다.</p>
        <a href="#contact" class="btn btn-primary">상담 문의하기 →</a>
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
