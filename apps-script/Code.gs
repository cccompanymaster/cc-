/**
 * 노아마케팅그룹 — 문의·결제·웹훅 통합 엔드포인트 (Google Apps Script)
 * 보안 하드닝: OWASP Top 10 + PortOne/PCI-DSS + 한국 개인정보보호법 대응
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                           📦 배포 절차                               │
 * └─────────────────────────────────────────────────────────────────────┘
 *  1) Google Sheets 새 스프레드시트 → 확장프로그램 → Apps Script
 *  2) Code.gs에 이 파일 전체 붙여넣기 → 저장
 *  3) Apps Script 좌측 톱니(⚙️) → 스크립트 속성 에 아래 값 등록 (하드코딩 금지):
 *       • PORTONE_V2_API_SECRET     = 포트원 V2 API Secret
 *       • PORTONE_STORE_ID          = 스토어 ID (store-xxx)
 *       • PORTONE_WEBHOOK_SECRET    = (선택) 포트원 웹훅 서명키 — 설정하면 재검증만 수행
 *       • NOTIFY_EMAIL              = 관리자 알림 이메일
 *       • ADMIN_EMAIL_CC            = (선택) 추가 수신자
 *       • RECAPTCHA_SECRET          = (선택) reCAPTCHA v3 서버 시크릿
 *       • ALLOWED_ORIGINS           = 쉼표구분: https://cccompanymaster.github.io,https://your-domain.kr
 *  4) 배포 → 새 배포 → 웹 앱 → 실행 "나", 액세스 "모든 사용자"
 *  5) 발급 URL → js/script.js 의 INQUIRY_WEBHOOK_URL / PAYMENT_VERIFY_URL 양쪽
 *  6) 코드 수정 후에는 "배포 관리 → 편집 → 새 버전" 으로 재배포 필수
 *
 *  포트원 웹훅(선택): 콘솔 → 웹훅 → URL 입력 + 시크릿 복사해서 속성에 저장
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │        💳 나이스페이 결제 (2026-11 전환 · 포트원은 비활성 보관)        │
 * └─────────────────────────────────────────────────────────────────────┘
 *  흐름: 상점 결제창 → nicepay-prepare(서버가 가격표로 금액 확정·주문 READY 기록)
 *        → 나이스페이 결제창(AUTHNICE.requestPay) → returnUrl(이 웹앱 ?action=nicepay-return, 폼 POST)
 *        → 주문·금액·clientId·signature 대조 → 승인 API → Orders 기록 + 알림·영수증 메일
 *        → 사이트 pay-result.html 로 이동
 *  스크립트 속성(대표님이 직접 입력 — 코드·저장소에 절대 넣지 않음):
 *       • NICEPAY_MODE                 = off | sandbox | live   (기본 off = 결제 닫힘, 주문서로 대체)
 *       • NICEPAY_SANDBOX_SECRET_KEY   = 테스트 상점 시크릿 키
 *       • NICEPAY_LIVE_SECRET_KEY      = 운영 상점 시크릿 키
 *       • NICEPAY_TEST_TOKEN           = sandbox 모드 시험용 암호(아무 문자열). shop.html?paytest=값 으로 연 브라우저만 결제창 사용
 *       • (선택) NICEPAY_SANDBOX_CLIENT_KEY / NICEPAY_LIVE_CLIENT_KEY — 아래 NICEPAY_CLIENT_KEYS 대신 쓸 때
 *  가격표: apps-script/shop-catalog.json → python3 .claude/build/catalog/build_catalog.py 가 아래 SHOP_CATALOG를 갱신
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                      🛡️ 적용된 보안 조치                             │
 * └─────────────────────────────────────────────────────────────────────┘
 *  • PropertiesService로 Secret 분리 (하드코딩 금지)
 *  • LockService로 동시성 race 방지
 *  • Sheet Formula Injection 방어 (=,+,-,@ prefix escape)
 *  • Email Header Injection 방어 (CRLF 제거·길이제한)
 *  • 서버 권위적 가격 카탈로그 (클라이언트 금액 신뢰 X)
 *  • paymentId UUID 포맷 검증 + 중복(replay) 차단
 *  • Origin/Referer 검증 (화이트리스트)
 *  • Rate Limiting (CacheService: IP·이메일·UA 복합)
 *  • 허니팟 필드 + 시간 기반 봇 탐지 (form open < 3s)
 *  • reCAPTCHA v3 검증 (시크릿 설정 시 자동 활성)
 *  • PII 마스킹 (휴대폰 중간 4자리, 카드 BIN 제거)
 *  • 에러 응답 정적화 (스택/내부 경로 노출 금지)
 *  • UrlFetchApp SSRF 방지 (PortOne 도메인 allowlist)
 *  • 금액 범위 검증 (50,000 ~ 10,000,000원)
 */

// ═══════════════════════════════════════════════════════════════════════
//  설정 (PropertiesService 우선, 없으면 안전한 기본값)
// ═══════════════════════════════════════════════════════════════════════
function CFG_() {
  const p = PropertiesService.getScriptProperties();
  return {
    PORTONE_V2_API_SECRET: p.getProperty('PORTONE_V2_API_SECRET') || '',
    PORTONE_STORE_ID:      p.getProperty('PORTONE_STORE_ID') || '',
    PORTONE_WEBHOOK_SECRET:p.getProperty('PORTONE_WEBHOOK_SECRET') || '',
    NOTIFY_EMAIL:          p.getProperty('NOTIFY_EMAIL') || '',
    ADMIN_EMAIL_CC:        p.getProperty('ADMIN_EMAIL_CC') || '',
    RECAPTCHA_SECRET:      p.getProperty('RECAPTCHA_SECRET') || '',
    ALLOWED_ORIGINS:       (p.getProperty('ALLOWED_ORIGINS') ||
      'https://cccompanymaster.github.io,https://noahgroup.co.kr,https://www.noahgroup.co.kr').split(',').map(s => s.trim()).filter(Boolean),
    NICEPAY_MODE:          String(p.getProperty('NICEPAY_MODE') || 'off').trim().toLowerCase(),
    NICEPAY_TEST_TOKEN:    String(p.getProperty('NICEPAY_TEST_TOKEN') || '').trim(),
    NICEPAY_KEYS: {
      sandbox: {
        clientId: String(p.getProperty('NICEPAY_SANDBOX_CLIENT_KEY') || NICEPAY_CLIENT_KEYS.sandbox).trim(),
        secret:   String(p.getProperty('NICEPAY_SANDBOX_SECRET_KEY') || '').trim(),
      },
      live: {
        clientId: String(p.getProperty('NICEPAY_LIVE_CLIENT_KEY') || NICEPAY_CLIENT_KEYS.live).trim(),
        secret:   String(p.getProperty('NICEPAY_LIVE_SECRET_KEY') || '').trim(),
      },
    },
  };
}

// ── 나이스페이 고정값 ─────────────────────────────────────────────────────
// 클라이언트 키는 공개값(결제창 호출용)이라 코드에 둡니다. 시크릿 키는 스크립트 속성에만.
const NICEPAY_CLIENT_KEYS = {
  sandbox: 'S2_dc3522bf4f84454e8da9e9f23e9a07ca',   // 테스트 상점 '노아' (Server 승인·Basic, 2026-11-06 발급)
  live:    '',   // 운영 상점 클라이언트 키 (R…) — 운영 전환 때 입력
};
// JS SDK는 한 주소(pay.nicepay.co.kr/v1/js/)이고, 클라이언트 키 앞자리로 테스트/운영을 스스로 나눈다
// (S1_·S2_ → sandbox-pay, R1_·R2_ → pay / 1 = Client 승인, 2 = Server 승인 — SDK 소스 확인 2026-11-06).
// sandbox-pay.nicepay.co.kr/v1/js/ 는 404. API 도메인만 모드별로 다르다.
const NICEPAY_ENV = {
  sandbox: { api: 'https://sandbox-api.nicepay.co.kr', js: 'https://pay.nicepay.co.kr/v1/js/' },
  live:    { api: 'https://api.nicepay.co.kr',         js: 'https://pay.nicepay.co.kr/v1/js/' },
};
const NICEPAY_METHODS = ['cardAndEasyPay', 'card', 'bank'];
const SITE_URL = 'https://noahgroup.co.kr';
const ORDER_ID_RE = /^NOAH-\d{14}-[0-9a-f]{8}$/;

// >>> SHOP_CATALOG — 자동 생성(apps-script/shop-catalog.json → .claude/build/catalog/build_catalog.py). 직접 고치지 마세요.
const SHOP_CATALOG = {
  "brand-run": {
    "name": "브랜드 블로그 운영",
    "goods": "브랜드 블로그 운영",
    "unit": "개월",
    "maxQty": 12,
    "options": {
      "standard": {
        "label": "STANDARD",
        "price": 149000,
        "minQty": 1
      },
      "deluxe": {
        "label": "DELUXE",
        "price": 299000,
        "minQty": 1
      },
      "premium": {
        "label": "PREMIUM",
        "price": 499000,
        "minQty": 1
      }
    },
    "extras": {
      "skin": {
        "label": "블로그 디자인 (위젯 없이)",
        "price": 50000
      },
      "home-skin": {
        "label": "홈페이지형 블로그 디자인",
        "price": 150000
      },
      "thumb": {
        "label": "콘텐츠 썸네일 제작",
        "price": 10000
      },
      "cardnews": {
        "label": "카드뉴스 제작",
        "price": 20000
      }
    }
  },
  "blog-dist": {
    "name": "블로그 배포",
    "goods": "블로그 배포",
    "unit": "건",
    "maxQty": 100,
    "options": {
      "standard": {
        "label": "준최적",
        "price": 11000,
        "minQty": 1
      },
      "deluxe": {
        "label": "고지수 준최적",
        "price": 22000,
        "minQty": 1
      },
      "premium": {
        "label": "최적",
        "price": 38000,
        "minQty": 1
      }
    },
    "extras": {
      "fast": {
        "label": "빠른 작업",
        "price": 10000
      }
    }
  },
  "rank": {
    "name": "블로그 상위노출 보장",
    "goods": "블로그 상위노출",
    "unit": "키워드",
    "maxQty": 20,
    "options": {
      "standard": {
        "label": "24시간",
        "price": 49000,
        "minQty": 1
      },
      "deluxe": {
        "label": "25일 프리미엄",
        "price": 198000,
        "minQty": 1
      },
      "premium": {
        "label": "25일 도배형",
        "price": 999000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "influencer": {
    "name": "공식 인플루언서 블로그 배포",
    "goods": "인플루언서 배포",
    "unit": "건",
    "maxQty": 50,
    "options": {
      "standard": {
        "label": "준최적",
        "price": 77000,
        "minQty": 1
      },
      "deluxe": {
        "label": "고품질 준최적",
        "price": 165000,
        "minQty": 1
      },
      "premium": {
        "label": "최적화",
        "price": 220000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "neighbor": {
    "name": "블로그 이웃 늘리기",
    "goods": "블로그 이웃관리",
    "unit": "회",
    "maxQty": 10,
    "options": {
      "standard": {
        "label": "STANDARD",
        "price": 20000,
        "minQty": 1
      },
      "deluxe": {
        "label": "DELUXE",
        "price": 50000,
        "minQty": 1
      },
      "premium": {
        "label": "PREMIUM",
        "price": 100000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "write": {
    "name": "블로그용 원고 작성",
    "goods": "블로그 원고 작성",
    "unit": "건",
    "maxQty": 100,
    "options": {
      "standard": {
        "label": "STANDARD",
        "price": 8000,
        "minQty": 1
      },
      "deluxe": {
        "label": "DELUXE",
        "price": 12000,
        "minQty": 1
      },
      "premium": {
        "label": "PREMIUM",
        "price": 15000,
        "minQty": 1
      }
    },
    "extras": {
      "fast": {
        "label": "빠른 작업",
        "price": 1000
      }
    }
  },
  "cafe": {
    "name": "카페 게시글 배포",
    "goods": "카페 바이럴 배포",
    "unit": "건",
    "maxQty": 100,
    "options": {
      "standard": {
        "label": "대량 배포",
        "price": 11000,
        "minQty": 10
      },
      "deluxe": {
        "label": "카테고리 맞춤",
        "price": 22000,
        "minQty": 1
      },
      "premium": {
        "label": "노출 최적화",
        "price": 44000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "exp": {
    "name": "블로그 체험단",
    "goods": "블로그 체험단",
    "unit": "회",
    "maxQty": 20,
    "options": {
      "standard": {
        "label": "배송형",
        "price": 16000,
        "minQty": 1
      },
      "deluxe": {
        "label": "방문형",
        "price": 45000,
        "minQty": 1
      },
      "premium": {
        "label": "프리미엄",
        "price": 55000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "daangn-ad": {
    "name": "당근마켓 광고대행",
    "goods": "당근마켓 광고대행",
    "unit": "개월",
    "maxQty": 12,
    "options": {
      "single": {
        "label": "단일 상품",
        "price": 100000,
        "minQty": 1
      }
    },
    "extras": {}
  },
  "homepage": {
    "name": "템플릿형 홈페이지 제작",
    "goods": "템플릿형 홈페이지",
    "unit": "개",
    "maxQty": 1,
    "options": {
      "single": {
        "label": "단일 상품",
        "price": 199000,
        "minQty": 1
      }
    },
    "extras": {}
  }
};
// <<< SHOP_CATALOG

// 서버 권위적 가격 카탈로그 — 클라이언트의 expectedAmount는 참조만, 금액은 여기서 확정
const PRICE_CATALOG = {
  '상담 예약금':       { price: 50000,    fixed: true  },
  '기본 진단 패키지':  { price: 300000,   fixed: true  },
  '표준 월간 패키지':  { price: 1500000,  fixed: true  },
  '맞춤 견적 결제':    { price: null,     fixed: false, min: 50000, max: 10000000 },
  // ── shop.html 상품 (크몽 검증 상품 · fixed 가격 서버 검증) ──
  '브랜드 블로그 운영 STANDARD':   { price: 149000, fixed: true },
  '브랜드 블로그 운영 DELUXE':     { price: 299000, fixed: true },
  '브랜드 블로그 운영 PREMIUM':    { price: 499000, fixed: true },
  '블로그 포스팅 배포 STANDARD':   { price: 11000,  fixed: true },
  '블로그 포스팅 배포 DELUXE':     { price: 22000,  fixed: true },
  '블로그 포스팅 배포 PREMIUM':    { price: 38000,  fixed: true },
  '블로그 원고 작성 STANDARD':     { price: 8000,   fixed: true },
  '블로그 원고 작성 DELUXE':       { price: 12000,  fixed: true },
  '블로그 원고 작성 PREMIUM':      { price: 15000,  fixed: true },
  '블로그 이웃관리 STANDARD':      { price: 20000,  fixed: true },
  '블로그 이웃관리 DELUXE':        { price: 50000,  fixed: true },
  '블로그 이웃관리 PREMIUM':       { price: 100000, fixed: true },
  '블로그 최적화 노출 STANDARD':   { price: 49000,  fixed: true },
  '블로그 최적화 노출 DELUXE':     { price: 198000, fixed: true },
  '블로그 최적화 노출 PREMIUM':    { price: 999000, fixed: true },
  '블로그 체험단 배송형':          { price: 16000,  fixed: true },
  '블로그 체험단 방문형':          { price: 45000,  fixed: true },
  '블로그 체험단 프리미엄':        { price: 55000,  fixed: true },
  '당근마켓 광고대행':             { price: 100000, fixed: true },
  '템플릿형 홈페이지 제작':        { price: 199000, fixed: true },
};

const SHEET_INQUIRIES = 'Inquiries';
const SHEET_ORDERS    = 'Orders';
const SHEET_LOGS      = 'Logs';
const MIN_SUBMIT_MS   = 3000;          // 3초 미만 제출 = 봇
const RL_WINDOW_SEC   = 60;            // rate limit 윈도우
const RL_MAX_PER_MIN  = 5;             // 1분당 최대 시도
const RL_MAX_PER_DAY  = 50;            // 1일당 최대 시도
const UUID_RE         = /^noah_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE        = /^[\d\-+() ]{9,20}$/;
const EMAIL_RE        = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ═══════════════════════════════════════════════════════════════════════
//  엔트리 포인트
// ═══════════════════════════════════════════════════════════════════════
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse_({ ok: false, error: 'busy' });

  try {
    // 나이스페이 결제창 → returnUrl (브라우저 폼 POST, x-www-form-urlencoded). 서명·금액으로 검증하므로 아래 봇 필터는 건너뜀.
    if (e && e.parameter && e.parameter.action === 'nicepay-return') {
      return handleNicepayReturn_(e.parameter, CFG_());
    }

    const raw = (e && e.postData && e.postData.contents) || '{}';
    if (raw.length > 50000) return jsonResponse_({ ok: false, error: 'payload too large' });
    const data = JSON.parse(raw);

    // 허니팟 — 값이 차 있으면 봇, 조용히 성공 가장
    if (data.website || data.honey) {
      logEvent_('honeypot', data);
      return jsonResponse_({ ok: true });
    }

    // 시간 체크 — 3초 미만 제출은 봇
    if (data.formOpenedAt) {
      const opened = new Date(data.formOpenedAt).getTime();
      const now = Date.now();
      if (Number.isFinite(opened) && (now - opened) < MIN_SUBMIT_MS) {
        logEvent_('too-fast', data);
        return jsonResponse_({ ok: true });
      }
    }

    // Origin 화이트리스트 (클라이언트 자진 보고, 최소 방어선)
    const cfg = CFG_();
    if (data.origin && cfg.ALLOWED_ORIGINS.length > 0) {
      const ok = cfg.ALLOWED_ORIGINS.some(o => data.origin.startsWith(o));
      if (!ok) { logEvent_('bad-origin', data); return jsonResponse_({ ok: false, error: 'origin' }); }
    }

    // Rate Limiting — IP + 이메일 + UA 해시 조합
    const fp = fingerprint_(data);
    if (!checkRate_(fp, RL_MAX_PER_MIN, RL_WINDOW_SEC)) {
      logEvent_('rate-limit-min', data);
      return jsonResponse_({ ok: false, error: 'too many requests' });
    }
    if (!checkRate_('day_' + fp, RL_MAX_PER_DAY, 86400)) {
      logEvent_('rate-limit-day', data);
      return jsonResponse_({ ok: false, error: 'daily limit exceeded' });
    }

    // reCAPTCHA v3 (시크릿 설정 시에만 요구)
    if (cfg.RECAPTCHA_SECRET && !verifyRecaptcha_(data.recaptchaToken, cfg.RECAPTCHA_SECRET)) {
      logEvent_('captcha-fail', data);
      return jsonResponse_({ ok: false, error: 'captcha' });
    }

    // 라우팅
    switch (data.type) {
      case 'nicepay-prepare': return handleNicepayPrepare_(data, cfg);
      case 'payment':  return handlePayment_(data, cfg);   // 포트원(비활성) — 키가 없어 'verification disabled'로 끝남
      case 'webhook':  return handleWebhook_(data, cfg);
      default:         return handleInquiry_(data, cfg);
    }
  } catch (err) {
    // 스택/내부 경로 노출 금지 — 정적 응답만
    try { Logger.log('doPost error: ' + (err && err.stack || err)); } catch(_) {}
    return jsonResponse_({ ok: false, error: 'internal' });
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

function doGet(e) {
  // 상점 화면이 결제창을 열지, 주문서로 받을지 정할 때 묻는 값 (키·금액 정보 없음)
  if (e && e.parameter && e.parameter.action === 'pay-status') {
    const cfg = CFG_();
    const mode = nicepayActiveMode_(cfg);
    return jsonResponse_({ ok: true, mode: mode, testOnly: mode === 'sandbox' });
  }
  return ContentService.createTextOutput('OK');
}

// ═══════════════════════════════════════════════════════════════════════
//  입력 검증 / 정제
// ═══════════════════════════════════════════════════════════════════════
function sanitizeCell_(v) {
  const s = String(v == null ? '' : v);
  // CSV/Sheet formula injection 차단: =, +, -, @, TAB, CR prefix
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return safe.slice(0, 2000);
}
function sanitizeHeader_(v) {
  return String(v == null ? '' : v).replace(/[\r\n]/g, ' ').slice(0, 120);
}
function maskPhone_(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return phone || '';
  return digits.slice(0,3) + '-****-' + digits.slice(-4);
}
function maskEmail_(email) {
  const s = String(email || '');
  const [u, d] = s.split('@');
  if (!u || !d) return s;
  const masked = u.length <= 2 ? u[0] + '*' : u.slice(0,2) + '*'.repeat(Math.max(1, u.length-2));
  return masked + '@' + d;
}
function validateInquiry_(d) {
  const e = [];
  if (!d.name || d.name.length > 60) e.push('name');
  if (!d.phone || !PHONE_RE.test(d.phone)) e.push('phone');
  if (d.email && (!EMAIL_RE.test(d.email) || d.email.length > 80)) e.push('email');
  if (!d.message || d.message.length > 5000) e.push('message');
  if (d.company && d.company.length > 100) e.push('company');
  return e;
}
function validatePayment_(d) {
  const e = [];
  if (!d.paymentId || !UUID_RE.test(d.paymentId)) e.push('paymentId');
  if (!d.orderName || d.orderName.length > 80) e.push('orderName');
  const amt = Number(d.expectedAmount);
  if (!Number.isFinite(amt) || amt < 100 || amt > 10000000) e.push('amount');
  const c = d.customer || {};
  if (!c.name || c.name.length > 60) e.push('cust.name');
  if (!c.phone || !PHONE_RE.test(c.phone)) e.push('cust.phone');
  if (!c.email || !EMAIL_RE.test(c.email) || c.email.length > 80) e.push('cust.email');
  if (c.memo && c.memo.length > 500) e.push('cust.memo');
  return e;
}

// ═══════════════════════════════════════════════════════════════════════
//  Rate limit / fingerprint / 로그
// ═══════════════════════════════════════════════════════════════════════
function fingerprint_(data) {
  const parts = [
    (data.clientIp || '').slice(0, 45),
    (data.email || data.customer?.email || '').toLowerCase().slice(0, 80),
    (data.userAgent || '').slice(0, 120),
  ].join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, parts);
  return Utilities.base64EncodeWebSafe(digest).slice(0, 20);
}
function checkRate_(key, limit, windowSec) {
  const cache = CacheService.getScriptCache();
  const count = parseInt(cache.get(key) || '0', 10);
  if (count >= limit) return false;
  cache.put(key, String(count + 1), windowSec);
  return true;
}
function getLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOGS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOGS);
    sh.appendRow(['시각', '이벤트', '타입', 'FP', 'IP', 'UA', 'Origin', '메모']);
    sh.setFrozenRows(1);
    sh.getRange('A1:H1').setFontWeight('bold').setBackground('#3a2d1c').setFontColor('#fff');
  }
  return sh;
}
function logEvent_(event, data) {
  try {
    getLogSheet_().appendRow([
      new Date(),
      sanitizeCell_(event),
      sanitizeCell_(data.type || 'inquiry'),
      fingerprint_(data),
      sanitizeCell_((data.clientIp || '').slice(0,45)),
      sanitizeCell_((data.userAgent || '').slice(0,120)),
      sanitizeCell_((data.origin || '').slice(0,80)),
      sanitizeCell_(JSON.stringify({ paymentId: data.paymentId, amount: data.expectedAmount }).slice(0,200)),
    ]);
  } catch(_) {}
}

// ═══════════════════════════════════════════════════════════════════════
//  문의 접수
// ═══════════════════════════════════════════════════════════════════════
function handleInquiry_(data, cfg) {
  const errors = validateInquiry_(data);
  if (errors.length) return jsonResponse_({ ok: false, error: 'invalid input' });

  // 첨부 파일 처리 — Drive 저장 + 메일 첨부용 Blob 동시 생성
  const att = saveAttachmentSafe_(data);  // { url, blob, info } | null

  const sheet = getOrCreateInquirySheet_();
  sheet.appendRow([
    new Date(),
    sanitizeCell_(data.name),
    sanitizeCell_(data.company),
    sanitizeCell_(data.phone),
    sanitizeCell_(data.email),
    sanitizeCell_(data.interests),
    sanitizeCell_((data.message || '').slice(0, 5000)),
    sanitizeCell_(att ? att.info : ''),
    sanitizeCell_(att ? att.url : ''),
    sanitizeCell_((data.referrer || '').slice(0,120)),
    sanitizeCell_((data.userAgent || '').slice(0,120)),
    sanitizeCell_((data.clientIp || '').slice(0,45)),
  ]);
  if (cfg.NOTIFY_EMAIL) sendInquiryMail_(data, cfg, att);
  return jsonResponse_({ ok: true });
}

// 첨부 저장: Drive 폴더에 업로드 + 메일 첨부용 Blob 반환
// 30MB 까지 허용. 25MB 초과 시 Gmail 첨부 한도 때문에 Drive 링크만 메일에 첨부 (blob=null).
function saveAttachmentSafe_(data) {
  try {
    const a = data.attachment;
    if (!a || !a.dataBase64 || !a.name) return null;
    const MAX_BYTES = 30 * 1024 * 1024;          // 30MB upload limit
    const GMAIL_ATTACH_LIMIT = 25 * 1024 * 1024; // Gmail 첨부 한도
    if (a.size > MAX_BYTES) return null;

    const allowedExt = ['pdf','doc','docx','ppt','pptx','xls','xlsx','zip','hwp','hwpx','txt'];
    const ext = (a.name.split('.').pop() || '').toLowerCase();
    if (!allowedExt.includes(ext)) return null;

    const folderName = '노아마케팅 — 상담 첨부 (RFP)';
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) folder = folders.next();
    else folder = DriveApp.createFolder(folderName);

    const decoded = Utilities.base64Decode(a.dataBase64);
    const inquirer = sanitizeCell_(data.name || 'unknown').replace(/[^\w가-힣 _-]/g, '').slice(0, 30);
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
    const safeName = `${timestamp}_${inquirer}_${a.name.slice(0, 80).replace(/[\\/:*?"<>|]/g, '_')}`;
    const blob = Utilities.newBlob(decoded, a.type || 'application/octet-stream', safeName);
    const file = folder.createFile(blob);

    return {
      url: file.getUrl(),
      blob: a.size <= GMAIL_ATTACH_LIMIT ? blob : null,  // 25MB 초과면 메일 첨부 생략
      info: `${a.name} (${(a.size/1024/1024).toFixed(2)} MB)`,
      oversize: a.size > GMAIL_ATTACH_LIMIT,
    };
  } catch (e) {
    try { Logger.log('saveAttachmentSafe_ error: ' + e); } catch(_) {}
    return null;
  }
}

function getOrCreateInquirySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_INQUIRIES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_INQUIRIES);
    sh.appendRow(['제출시각','이름','회사/브랜드','연락처','이메일','관심항목','문의내용','첨부파일','첨부 Drive URL','유입경로','UserAgent','IP']);
    sh.setFrozenRows(1);
    sh.getRange('A1:L1').setFontWeight('bold').setBackground('#0f1a3a').setFontColor('#fff');
  }
  return sh;
}
function sendInquiryMail_(data, cfg, att) {
  const subject = sanitizeHeader_(`[노아마케팅] 신규 문의 — ${data.name || '(이름없음)'}${att ? ' [📎 첨부]' : ''}`);
  const body = [
    `이름: ${sanitizeHeader_(data.name)}`,
    `회사: ${sanitizeHeader_(data.company) || '-'}`,
    `연락처: ${sanitizeHeader_(data.phone) || '-'}`,
    `이메일: ${sanitizeHeader_(data.email) || '-'}`,
    `관심항목: ${sanitizeHeader_(data.interests) || '-'}`,
    '',
    '───── 문의 내용 ─────',
    String(data.message || '-').slice(0, 2000),
    '─────────────────',
    att ? `\n📎 첨부파일: ${att.info}${att.oversize ? ' [25MB 초과 — Drive 링크만 첨부]' : ''}\n   Drive: ${att.url}` : '',
    '',
    `시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `유입: ${sanitizeHeader_(data.referrer) || '(direct)'}`,
  ].filter(Boolean).join('\n');
  const opts = { to: cfg.NOTIFY_EMAIL, cc: cfg.ADMIN_EMAIL_CC, subject, body };
  if (att && att.blob) opts.attachments = [att.blob];
  MailApp.sendEmail(opts);
}

// ═══════════════════════════════════════════════════════════════════════
//  결제 검증 & 주문 기록 (포트원 V2)
// ═══════════════════════════════════════════════════════════════════════
function handlePayment_(data, cfg) {
  // 1) 입력 검증
  const errors = validatePayment_(data);
  if (errors.length) return jsonResponse_({ ok: false, error: 'invalid input' });

  // 2) 서버 권위적 가격 카탈로그 — 클라이언트 금액 신뢰 금지
  const catalog = PRICE_CATALOG[data.orderName];
  if (!catalog) return jsonResponse_({ ok: false, error: 'unknown product' });
  let authoritativeAmount;
  if (catalog.fixed) {
    authoritativeAmount = catalog.price;
  } else {
    const amt = Number(data.expectedAmount);
    if (amt < catalog.min || amt > catalog.max) {
      return jsonResponse_({ ok: false, error: 'amount out of range' });
    }
    authoritativeAmount = amt;
  }

  // 3) paymentId 중복 체크 (replay)
  if (isDuplicatePaymentId_(data.paymentId)) {
    logEvent_('duplicate-payment', data);
    return jsonResponse_({ ok: false, error: 'duplicate' });
  }

  // 4) 포트원 API secret 필수
  if (!cfg.PORTONE_V2_API_SECRET) {
    recordOrder_(data, { status: 'UNVERIFIED', amount: authoritativeAmount, note: 'api-secret not set' });
    return jsonResponse_({ ok: false, error: 'verification disabled' });
  }

  // 5) PortOne V2 REST로 실제 결제 조회 (SSRF 방어: 도메인 고정)
  const url = 'https://api.portone.io/payments/' + encodeURIComponent(data.paymentId);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'PortOne ' + cfg.PORTONE_V2_API_SECRET },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    recordOrder_(data, { status: 'VERIFY_ERROR', amount: authoritativeAmount, note: 'HTTP ' + code });
    return jsonResponse_({ ok: false, error: 'verify failed' });
  }

  const info = JSON.parse(res.getContentText());
  const paid = info.status === 'PAID';
  const realAmount = Number(info.amount?.total || info.amount?.paid || 0);
  const amountMatches = paid && realAmount === authoritativeAmount;

  if (!amountMatches) {
    recordOrder_(data, {
      status: paid ? 'AMOUNT_MISMATCH' : (info.status || 'FAILED'),
      amount: realAmount,
      note: 'expected ' + authoritativeAmount,
      raw: info,
    });
    notifyAdminAlert_(cfg, '결제 검증 실패', {
      paymentId: data.paymentId,
      expected: authoritativeAmount,
      actual: realAmount,
      status: info.status,
    });
    return jsonResponse_({ ok: false, error: paid ? 'amount mismatch' : 'not paid' });
  }

  // 6) 정상 — 시트 기록 + 양측 이메일
  recordOrder_(data, { status: 'PAID', amount: realAmount, raw: info });
  sendOrderMail_(data, info, authoritativeAmount, cfg);
  if (data.customer?.email) sendReceiptMail_(data.customer.email, data, info, authoritativeAmount);

  return jsonResponse_({ ok: true, status: 'PAID' });
}

function isDuplicatePaymentId_(paymentId) {
  const sheet = getOrCreateOrderSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const ids = sheet.getRange(2, 3, last - 1, 1).getValues();
  return ids.some(r => r[0] === paymentId);
}

function getOrCreateOrderSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ORDERS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ORDERS);
    sh.appendRow(['결제시각','상태','주문ID','상품명','금액(서버)','이름','연락처(마스킹)','이메일(마스킹)','메모','PG거래ID','결제수단','비고']);
    sh.setFrozenRows(1);
    sh.getRange('A1:L1').setFontWeight('bold').setBackground('#8a5e2e').setFontColor('#fff');
    sh.setColumnWidth(3, 280);
  }
  return sh;
}

function recordOrder_(data, result) {
  const sheet = getOrCreateOrderSheet_();
  const cust = data.customer || {};
  const raw = result.raw || {};
  // Raw에서 카드정보(PCI scope) 제거
  const rawSafe = JSON.parse(JSON.stringify(raw));
  if (rawSafe.method) {
    if (rawSafe.method.card) {
      delete rawSafe.method.card.number;
      delete rawSafe.method.card.bin;
    }
  }
  sheet.appendRow([
    new Date(),
    sanitizeCell_(result.status || 'UNKNOWN'),
    sanitizeCell_(data.paymentId || ''),
    sanitizeCell_(data.orderName || ''),
    Number(result.amount) || 0,
    sanitizeCell_(cust.name || ''),
    sanitizeCell_(maskPhone_(cust.phone)),
    sanitizeCell_(maskEmail_(cust.email)),
    sanitizeCell_((cust.memo || '').slice(0, 500)),
    sanitizeCell_(raw.pgTxId || raw.pg?.pgTxId || ''),
    sanitizeCell_(raw.method?.type || ''),
    sanitizeCell_((result.note || '') + ' ' + JSON.stringify(rawSafe).slice(0, 800)),
  ]);
}

function sendOrderMail_(data, info, amount, cfg) {
  if (!cfg.NOTIFY_EMAIL) return;
  const cust = data.customer || {};
  const amt = new Intl.NumberFormat('ko-KR').format(amount);
  const subject = sanitizeHeader_(`[노아마케팅] 결제완료 — ${data.orderName || ''} · ${amt}원`);
  const body = [
    `상품: ${sanitizeHeader_(data.orderName)}`,
    `금액: ${amt}원`,
    `주문ID: ${sanitizeHeader_(data.paymentId)}`,
    `결제수단: ${sanitizeHeader_(info.method?.type) || '-'}`,
    '',
    '──── 고객 정보 ────',
    `이름: ${sanitizeHeader_(cust.name)}`,
    `연락처: ${sanitizeHeader_(cust.phone)}`,
    `이메일: ${sanitizeHeader_(cust.email)}`,
    `메모: ${sanitizeHeader_(cust.memo) || '-'}`,
    '',
    `시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
  ].join('\n');
  MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, cc: cfg.ADMIN_EMAIL_CC, subject, body });
}

function sendReceiptMail_(email, data, info, amount) {
  const amt = new Intl.NumberFormat('ko-KR').format(amount);
  const subject = sanitizeHeader_(`[노아마케팅그룹] 결제 영수증 — ${data.orderName || ''}`);
  const body = [
    `안녕하세요, ${sanitizeHeader_(data.customer?.name) || '고객'}님.`,
    '',
    '노아마케팅그룹 결제가 정상 완료되었습니다.',
    '',
    `• 상품: ${sanitizeHeader_(data.orderName)}`,
    `• 결제금액: ${amt}원`,
    `• 주문번호: ${sanitizeHeader_(data.paymentId)}`,
    `• 결제수단: ${sanitizeHeader_(info.method?.type) || '-'}`,
    `• 결제일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    '',
    '영업일 내 담당자가 프로젝트 진행 안내를 드립니다.',
    '세금계산서·현금영수증이 필요하시면 회신해 주세요.',
    '',
    '— 노아마케팅그룹 · 010-6658-6482',
  ].join('\n');
  MailApp.sendEmail({ to: sanitizeHeader_(email), subject, body });
}

function notifyAdminAlert_(cfg, title, payload) {
  if (!cfg.NOTIFY_EMAIL) return;
  MailApp.sendEmail({
    to: cfg.NOTIFY_EMAIL,
    subject: sanitizeHeader_(`[노아마케팅·보안알림] ${title}`),
    body: '다음 주문/이벤트에 주의가 필요합니다.\n\n' + JSON.stringify(payload, null, 2).slice(0, 2000),
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  웹훅 (포트원 결제 상태 변경)
// ═══════════════════════════════════════════════════════════════════════
function handleWebhook_(data, cfg) {
  // 웹훅 시크릿 서명 검증은 Apps Script에서 header 접근 제한으로 어려움
  // → API로 직접 재조회해서 검증 (double-confirm)
  if (!cfg.PORTONE_V2_API_SECRET || !data.paymentId) {
    return jsonResponse_({ ok: false, error: 'invalid' });
  }
  const url = 'https://api.portone.io/payments/' + encodeURIComponent(data.paymentId);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'PortOne ' + cfg.PORTONE_V2_API_SECRET },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return jsonResponse_({ ok: false });
  const info = JSON.parse(res.getContentText());
  // 이미 처리된 주문인지 확인
  if (isDuplicatePaymentId_(data.paymentId) && info.status === 'PAID') {
    return jsonResponse_({ ok: true, note: 'already recorded' });
  }
  // 최종 기록 (클라이언트 검증 누락된 경우 대비)
  recordOrder_({
    paymentId: data.paymentId,
    orderName: info.orderName || '',
    customer: info.customer ? {
      name: info.customer.fullName || info.customer.name,
      phone: info.customer.phoneNumber,
      email: info.customer.email,
    } : {},
  }, (function () {
    // 카탈로그 금액 대조 — fixed 상품이 다른 금액으로 결제되면 플래그
    const cat = PRICE_CATALOG[info.orderName];
    const paid = (info.amount && info.amount.total) || 0;
    const mismatch = cat && cat.fixed && cat.price !== paid;
    return { status: info.status, amount: paid, raw: info, note: mismatch ? 'webhook:PRICE_MISMATCH' : 'webhook' };
  })());
  return jsonResponse_({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════
//  나이스페이 결제 (Server 승인 모델 · Basic 인증)
//  근거: github.com/nicepayments/nicepay-manual — api/payment-window-server.md, api/cancel.md
// ═══════════════════════════════════════════════════════════════════════
const SHOP_MAX_AMOUNT = 10000000;
const NP_COLS = 14;   // Orders 시트: 기존 12칸 + 주문정보(JSON) + 모드

// 지금 결제를 받을 수 있는 모드. 키가 모자라면 'off'(화면은 주문서로 대체).
function nicepayActiveMode_(cfg) {
  const m = cfg.NICEPAY_MODE;
  if (m !== 'sandbox' && m !== 'live') return 'off';
  const k = cfg.NICEPAY_KEYS[m];
  if (!k || !k.clientId || !k.secret) return 'off';
  if (m === 'sandbox' && !cfg.NICEPAY_TEST_TOKEN) return 'off';
  return m;
}

function has_(obj, k) { return obj != null && Object.prototype.hasOwnProperty.call(obj, k); }

// 서버 권위 견적 — 금액은 가격표(SHOP_CATALOG)로만 만든다. 화면이 보낸 금액은 받지도 않는다.
function computeQuote_(productKey, optionKey, qty, extras) {
  const p = has_(SHOP_CATALOG, productKey) ? SHOP_CATALOG[productKey] : null;
  if (!p) return { error: 'product' };
  const o = has_(p.options, optionKey) ? p.options[optionKey] : null;
  if (!o) return { error: 'option' };
  const q = Number(qty);
  if (!Number.isInteger(q) || q < (o.minQty || 1) || q > p.maxQty) return { error: 'qty' };
  const ex = Array.isArray(extras) ? extras : [];
  if (ex.length > 10) return { error: 'extras' };
  const seen = {};
  let extraSum = 0;
  const extraLabels = [];
  for (const k of ex) {
    if (typeof k !== 'string' || seen[k] || !has_(p.extras, k)) return { error: 'extras' };
    seen[k] = true;
    extraSum += p.extras[k].price;
    extraLabels.push(p.extras[k].label);
  }
  const amount = o.price * q + extraSum;
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > SHOP_MAX_AMOUNT) return { error: 'amount' };
  return {
    amount: amount, unitPrice: o.price, qty: q, extras: ex.slice(), extraLabels: extraLabels, extraSum: extraSum,
    productName: p.name, optionLabel: o.label, unit: p.unit,
    goods: trimBytes_(p.goods + ' ' + o.label + (q > 1 ? ' x' + q : ''), 40),
  };
}

// 나이스페이 goodsName 40byte 제한 — 한글 2byte로 계산해 자른다.
function trimBytes_(s, max) {
  let out = '', n = 0;
  for (const ch of String(s).replace(/["|]/g, '-')) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (n + w > max) break;
    out += ch; n += w;
  }
  return out.trim();
}

function describeIntent_(it) {
  const p = SHOP_CATALOG[it.product] || { name: it.product, options: {}, extras: {}, unit: '' };
  const o = p.options[it.option] || { label: it.option };
  const ex = (it.extras || []).map(k => (p.extras[k] ? p.extras[k].label : k));
  return `${p.name} · ${o.label} × ${it.qty}${p.unit}` + (ex.length ? ` + 추가옵션: ${ex.join(', ')}` : '');
}

function validateBuyer_(b) {
  b = b || {};
  const buyer = {
    name:  String(b.name || '').trim(),
    tel:   String(b.phone || '').replace(/\D/g, ''),
    email: String(b.email || '').trim(),
    memo:  String(b.memo || '').trim(),
  };
  const errors = [];
  if (!buyer.name || buyer.name.length > 20) errors.push('name');
  if (!/^01[016789]\d{7,8}$/.test(buyer.tel)) errors.push('phone');
  if (!EMAIL_RE.test(buyer.email) || buyer.email.length > 60) errors.push('email');
  if (buyer.memo.length > 500) errors.push('memo');
  return { errors: errors, buyer: buyer };
}

// 1단계: 결제창 열기 전 — 금액 확정 + 주문 READY 기록
function handleNicepayPrepare_(data, cfg) {
  const mode = nicepayActiveMode_(cfg);
  if (mode === 'off') return jsonResponse_({ ok: false, error: 'closed' });
  if (mode === 'sandbox' && !safeEqual_(String(data.testToken || ''), cfg.NICEPAY_TEST_TOKEN)) {
    logEvent_('np-closed-sandbox', data);
    return jsonResponse_({ ok: false, error: 'closed' });
  }
  const ag = data.agree || {};
  if (ag.privacy !== true || ag.refund !== true || ag.order !== true) return jsonResponse_({ ok: false, error: 'agree' });
  const v = validateBuyer_(data.buyer);
  if (v.errors.length) return jsonResponse_({ ok: false, error: 'invalid input', fields: v.errors });
  const method = NICEPAY_METHODS.indexOf(data.method) >= 0 ? data.method : NICEPAY_METHODS[0];
  const q = computeQuote_(String(data.product || ''), String(data.option || ''), data.qty, data.extras);
  if (q.error) return jsonResponse_({ ok: false, error: 'invalid order', field: q.error });

  const keys = cfg.NICEPAY_KEYS[mode];
  const orderId = 'NOAH-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss') + '-' +
                  Utilities.getUuid().replace(/-/g, '').slice(0, 8).toLowerCase();
  const intent = {
    v: 1, mode: mode, product: String(data.product), option: String(data.option), qty: q.qty, extras: q.extras,
    amount: q.amount, goods: q.goods, method: method, clientId: keys.clientId,
  };
  const sh = getOrCreateOrderSheet_();
  ensureNicepayColumns_(sh);
  sh.appendRow([
    new Date(), 'READY', orderId, sanitizeCell_(describeIntent_(intent)), q.amount,
    sanitizeCell_(v.buyer.name), sanitizeCell_(maskPhone_(v.buyer.tel)), sanitizeCell_(maskEmail_(v.buyer.email)),
    sanitizeCell_(v.buyer.memo), '', sanitizeCell_(method), 'nicepay:prepare', JSON.stringify(intent), mode,
  ]);
  // 영수증 메일용 연락처(마스킹 전)는 시트 대신 캐시에 6시간만 둔다.
  CacheService.getScriptCache().put('np_' + orderId, JSON.stringify({ buyer: v.buyer }), 21600);
  return jsonResponse_({
    ok: true, orderId: orderId, amount: q.amount, goodsName: q.goods, clientId: keys.clientId,
    jsUrl: NICEPAY_ENV[mode].js, method: method, mode: mode,
  });
}

function ensureNicepayColumns_(sh) {
  if (sh.getMaxColumns() < NP_COLS) sh.insertColumnsAfter(sh.getMaxColumns(), NP_COLS - sh.getMaxColumns());
  if (!sh.getRange(1, 13).getValue()) {
    sh.getRange(1, 13, 1, 2).setValues([['주문정보(JSON)', '모드']])
      .setFontWeight('bold').setBackground('#8a5e2e').setFontColor('#fff');
  }
}

function findNicepayOrder_(orderId) {
  const sh = getOrCreateOrderSheet_();
  const cell = sh.getRange('C:C').createTextFinder(orderId).matchEntireCell(true).findNext();
  if (!cell) return null;
  const row = cell.getRow();
  const vals = sh.getRange(row, 1, 1, NP_COLS).getValues()[0];
  let intent = null;
  try { intent = JSON.parse(String(vals[12] || '')); } catch (_) {}
  return { sh: sh, row: row, status: String(vals[1]), intent: intent };
}

function updateNicepayOrder_(o, f) {
  if (f.paidAt)       o.sh.getRange(o.row, 1).setValue(f.paidAt);
  if (f.status)       o.sh.getRange(o.row, 2).setValue(sanitizeCell_(f.status));
  if (f.tid != null)  o.sh.getRange(o.row, 10).setValue(sanitizeCell_(f.tid));
  if (f.method != null) o.sh.getRange(o.row, 11).setValue(sanitizeCell_(f.method));
  if (f.note != null) o.sh.getRange(o.row, 12).setValue(sanitizeCell_(f.note));
  o.status = f.status || o.status;
}

function sha256Hex_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function safeEqual_(a, b) {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// 나이스페이 API 호출 (도메인 고정 — SSRF 방지)
function nicepayPost_(mode, path, body, keys) {
  const res = UrlFetchApp.fetch(NICEPAY_ENV[mode].api + path, {
    method: 'post',
    contentType: 'application/json;charset=utf-8',
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(keys.clientId + ':' + keys.secret, Utilities.Charset.UTF_8) },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  let json = null;
  try { json = JSON.parse(res.getContentText()); } catch (_) {}
  return { code: res.getResponseCode(), json: json };
}
function safeNetCancel_(mode, orderId, keys) {
  try {
    const r = nicepayPost_(mode, '/v1/payments/netcancel', { orderId: orderId }, keys);
    return 'netcancel ' + r.code + ' ' + ((r.json && r.json.resultCode) || '');
  } catch (e) { return 'netcancel error'; }
}
function safeCancel_(mode, tid, orderId, keys, reason) {
  try {
    const r = nicepayPost_(mode, '/v1/payments/' + encodeURIComponent(tid) + '/cancel', { reason: reason, orderId: orderId }, keys);
    return 'cancel ' + r.code + ' ' + ((r.json && r.json.resultCode) || '');
  } catch (e) { return 'cancel error'; }
}

function nicepayMethodLabel_(j) {
  const m = String(j.payMethod || '').toLowerCase();
  const map = { card: '신용카드', bank: '계좌이체', vbank: '가상계좌', naverpay: '네이버페이', kakaopay: '카카오페이',
                samsungpay: '삼성페이', payco: '페이코', ssgpay: 'SSGPAY', cellphone: '휴대폰' };
  let s = map[m] || m || '-';
  if (j.card && j.card.cardName) s += ' (' + j.card.cardName + ')';
  if (j.bank && j.bank.bankName) s += ' (' + j.bank.bankName + ')';
  return s;
}

// 2단계: 결제창 인증 결과(returnUrl) — 검증 후 승인
function handleNicepayReturn_(p, cfg) {
  try {
    return nicepayReturnInner_(p, cfg);
  } catch (err) {
    try { Logger.log('nicepay return error: ' + (err && err.stack || err)); } catch (_) {}
    return nicepayResultPage_('fail', { code: 'error', orderId: ORDER_ID_RE.test(String(p.orderId || '')) ? p.orderId : '' });
  }
}

function nicepayReturnInner_(p, cfg) {
  const orderId = String(p.orderId || '');
  if (!ORDER_ID_RE.test(orderId)) return nicepayResultPage_('fail', { code: 'unknown' });
  const o = findNicepayOrder_(orderId);
  if (!o || !o.intent) return nicepayResultPage_('fail', { code: 'unknown', orderId: orderId });
  const it = o.intent;
  const back = { orderId: orderId, amount: it.amount, product: it.product, option: it.option };
  if (o.status === 'PAID') return nicepayResultPage_('ok', back);                 // 새로고침·중복 전송
  if (o.status !== 'READY') return nicepayResultPage_('fail', Object.assign({ code: 'done' }, back));

  const keys = cfg.NICEPAY_KEYS[it.mode];
  if (!keys || !keys.secret || !NICEPAY_ENV[it.mode]) {
    updateNicepayOrder_(o, { status: 'CONFIG_ERROR', note: 'secret missing for ' + it.mode });
    return nicepayResultPage_('fail', Object.assign({ code: 'error' }, back));
  }

  const authCode = String(p.authResultCode || '');
  const authMsg = String(p.authResultMsg || '').slice(0, 100);
  if (authCode !== '0000') {
    updateNicepayOrder_(o, { status: 'AUTH_FAILED', note: (authCode + ' ' + authMsg).trim() });
    return nicepayResultPage_('fail', Object.assign({ code: 'auth', msg: authMsg }, back));
  }

  const tid = String(p.tid || '');
  const amountStr = String(p.amount || '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(tid)) {
    updateNicepayOrder_(o, { status: 'INVALID_RETURN', note: 'tid format' });
    return nicepayResultPage_('fail', Object.assign({ code: 'error' }, back));
  }
  // ① 금액 — 결제창에서 인증된 금액이 서버가 정한 금액과 같아야 승인
  if (!/^\d+$/.test(amountStr) || Number(amountStr) !== it.amount) {
    updateNicepayOrder_(o, { status: 'AMOUNT_MISMATCH', tid: tid, note: '인증금액 ' + amountStr + ' ≠ 주문금액 ' + it.amount + ' (승인 안 함)' });
    notifyAdminAlert_(cfg, '결제 금액 불일치 — 승인하지 않음', { orderId: orderId, expected: it.amount, actual: amountStr, mode: it.mode });
    return nicepayResultPage_('fail', Object.assign({ code: 'amount' }, back));
  }
  // ② 상점 키 + ③ 위변조 signature = hex(sha256(authToken + clientId + amount + secretKey))
  const sigOk = String(p.clientId || '') === keys.clientId && safeEqual_(
    sha256Hex_(String(p.authToken || '') + keys.clientId + amountStr + keys.secret),
    String(p.signature || '').toLowerCase());
  if (!sigOk) {
    updateNicepayOrder_(o, { status: 'SIGNATURE_MISMATCH', tid: tid, note: '위변조 검증 실패 (승인 안 함)' });
    notifyAdminAlert_(cfg, '결제 위변조 검증 실패 — 승인하지 않음', { orderId: orderId, mode: it.mode });
    return nicepayResultPage_('fail', Object.assign({ code: 'sign' }, back));
  }

  // ④ 승인 API
  let r;
  try {
    r = nicepayPost_(it.mode, '/v1/payments/' + encodeURIComponent(tid), { amount: it.amount }, keys);
  } catch (err) {
    const nc = safeNetCancel_(it.mode, orderId, keys);   // 응답을 못 받으면 망취소(1시간 이내)
    updateNicepayOrder_(o, { status: 'APPROVE_ERROR', tid: tid, note: '승인 응답 없음 → ' + nc });
    notifyAdminAlert_(cfg, '결제 승인 응답 없음 — 망취소 시도', { orderId: orderId, result: nc, mode: it.mode });
    return nicepayResultPage_('fail', Object.assign({ code: 'approve' }, back));
  }
  const j = r.json || {};
  if (r.code !== 200 || j.resultCode !== '0000') {
    updateNicepayOrder_(o, { status: 'APPROVE_FAILED', tid: tid,
      note: (r.code + ' ' + (j.resultCode || '') + ' ' + (j.resultMsg || '')).slice(0, 300) });
    return nicepayResultPage_('fail', Object.assign({ code: 'approve', msg: String(j.resultMsg || '').slice(0, 100) }, back));
  }
  // ⑤ 승인 응답 재확인 — 상태·금액·주문번호·signature(tid + amount + ediDate + secretKey)
  const respSigOk = !j.signature || safeEqual_(
    sha256Hex_(String(j.tid) + String(j.amount) + String(j.ediDate) + keys.secret), String(j.signature).toLowerCase());
  if (j.status !== 'paid' || Number(j.amount) !== it.amount || j.orderId !== orderId || !respSigOk) {
    const c = safeCancel_(it.mode, j.tid || tid, orderId, keys, '결제 검증 실패 자동 취소');
    updateNicepayOrder_(o, { status: 'CANCELLED_VERIFY', tid: j.tid || tid,
      note: '승인 응답 불일치(status ' + j.status + ', amount ' + j.amount + ') → ' + c });
    notifyAdminAlert_(cfg, '승인 응답 불일치 — 자동 취소', { orderId: orderId, status: j.status, amount: j.amount, cancel: c, mode: it.mode });
    return nicepayResultPage_('fail', Object.assign({ code: 'verify' }, back));
  }

  // ⑥ 완료 — 기록·메일
  const methodLabel = nicepayMethodLabel_(j);
  updateNicepayOrder_(o, { status: 'PAID', paidAt: new Date(), tid: j.tid, method: methodLabel,
    note: [j.approveNo ? '승인번호 ' + j.approveNo : '', j.receiptUrl || ''].filter(Boolean).join(' · ') });
  let cached = null;
  try { cached = JSON.parse(CacheService.getScriptCache().get('np_' + orderId) || 'null'); } catch (_) {}
  const clean = v => (v == null || v === 'null') ? '' : String(v);
  const buyer = (cached && cached.buyer) || { name: clean(j.buyerName), tel: clean(j.buyerTel), email: clean(j.buyerEmail), memo: '' };
  try { sendNicepayOrderMail_(cfg, orderId, it, j, buyer, methodLabel); } catch (e) { Logger.log('order mail: ' + e); }
  try { if (EMAIL_RE.test(buyer.email || '')) sendNicepayReceiptMail_(orderId, it, j, buyer, methodLabel); } catch (e) { Logger.log('receipt mail: ' + e); }
  return nicepayResultPage_('ok', back);
}

function escapeHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtWon_(n) { return new Intl.NumberFormat('ko-KR').format(Number(n) || 0); }
function orderFormUrl_(it, orderId) {
  return SITE_URL + '/shop.html?order=' + encodeURIComponent(it.product + ':' + it.option) + '&oid=' + encodeURIComponent(orderId);
}

// 결과 화면 — 사이트 pay-result.html 로 보낸다. 자동 이동이 막히면 버튼으로.
function nicepayResultPage_(result, info) {
  const q = ['r=' + (result === 'ok' ? 'ok' : 'fail')];
  if (info.orderId) q.push('o=' + encodeURIComponent(info.orderId));
  if (info.amount) q.push('a=' + encodeURIComponent(String(info.amount)));
  if (info.product) q.push('p=' + encodeURIComponent(info.product + ':' + info.option));
  if (info.code) q.push('c=' + encodeURIComponent(info.code));
  if (info.msg) q.push('m=' + encodeURIComponent(info.msg));
  const url = SITE_URL + '/pay-result.html?' + q.join('&');
  const ok = result === 'ok';
  const title = ok ? '결제가 완료됐습니다' : '결제가 완료되지 않았습니다';
  const desc = ok ? '영수증은 입력하신 이메일로 보내드렸습니다. 아래 버튼을 누르면 노아로 돌아갑니다.'
                  : (info.msg ? escapeHtml_(info.msg) : '결제가 진행되지 않았습니다. 다시 시도하시거나 010-6658-6482로 연락 주세요.');
  const html =
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><base target="_top">' +
    '<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#0f0d0a;color:#f3ead8;display:flex;min-height:100vh;align-items:center;justify-content:center}' +
    '.b{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:22px;margin:0 0 12px;color:' + (ok ? '#d9b97c' : '#f0a58a') + '}p{font-size:15px;line-height:1.6;color:#cfc4ad;margin:0 0 24px}' +
    'a{display:inline-block;padding:14px 28px;border-radius:10px;background:#c2a36b;color:#1a140b;font-weight:700;text-decoration:none}</style></head><body>' +
    '<div class="b"><h1>' + title + '</h1><p>' + desc + '</p>' +
    '<a href="' + escapeHtml_(url) + '" target="_top">노아로 돌아가기 →</a></div>' +
    '<script>try{window.top.location.replace(' + JSON.stringify(url) + ')}catch(e){}</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('노아 결제 결과')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sendNicepayOrderMail_(cfg, orderId, it, j, buyer, methodLabel) {
  if (!cfg.NOTIFY_EMAIL) return;
  const test = it.mode === 'sandbox';
  const subject = sanitizeHeader_(`[노아마케팅] ${test ? '[테스트] ' : ''}결제완료 — ${it.goods} · ${fmtWon_(it.amount)}원`);
  const body = [
    test ? '※ 나이스페이 테스트(샌드박스) 결제입니다. 실제 청구는 없습니다.\n' : '',
    `주문번호: ${orderId}`,
    `상품: ${describeIntent_(it)}`,
    `결제금액: ${fmtWon_(it.amount)}원 (VAT 포함)`,
    `결제수단: ${methodLabel}`,
    `승인번호: ${j.approveNo || '-'}`,
    `거래ID(tid): ${j.tid || '-'}`,
    `매출전표: ${j.receiptUrl || '-'}`,
    '',
    '──── 고객 정보 ────',
    `이름: ${sanitizeHeader_(buyer.name)}`,
    `연락처: ${sanitizeHeader_(buyer.tel)}`,
    `이메일: ${sanitizeHeader_(buyer.email)}`,
    `요청사항: ${String(buyer.memo || '-').slice(0, 500)}`,
    '',
    `작업 요청서(고객 안내용): ${orderFormUrl_(it, orderId)}`,
    `시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
  ].join('\n');
  MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, cc: cfg.ADMIN_EMAIL_CC, subject: subject, body: body });
}

function sendNicepayReceiptMail_(orderId, it, j, buyer, methodLabel) {
  const test = it.mode === 'sandbox';
  const subject = sanitizeHeader_(`[노아] ${test ? '[테스트] ' : ''}결제 완료 안내 — ${it.goods}`);
  const body = [
    `안녕하세요, ${sanitizeHeader_(buyer.name) || '고객'}님.`,
    '',
    test ? '※ 테스트 결제입니다. 실제 청구는 없습니다.\n' : '',
    '노아 결제가 정상 완료되었습니다.',
    '',
    `• 상품: ${describeIntent_(it)}`,
    `• 결제금액: ${fmtWon_(it.amount)}원 (VAT 포함)`,
    `• 주문번호: ${orderId}`,
    `• 결제수단: ${methodLabel}`,
    `• 결제일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    j.receiptUrl ? `• 매출전표: ${j.receiptUrl}` : '',
    '',
    '작업에 필요한 키워드·자료는 아래 작업 요청서로 보내 주세요.',
    orderFormUrl_(it, orderId),
    '',
    '영업일 내 담당자가 진행 안내를 드립니다. 세금계산서·현금영수증이 필요하시면 이 메일에 회신해 주세요.',
    '취소·환불 정책: ' + SITE_URL + '/terms.html#refund',
    '',
    '— 노아 · 010-6658-6482',
  ].join('\n');
  MailApp.sendEmail({ to: sanitizeHeader_(buyer.email), subject: subject, body: body });
}

// ═══════════════════════════════════════════════════════════════════════
//  reCAPTCHA v3 검증
// ═══════════════════════════════════════════════════════════════════════
function verifyRecaptcha_(token, secret) {
  if (!token) return false;
  try {
    const res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret, response: token },
      muteHttpExceptions: true,
    });
    const j = JSON.parse(res.getContentText());
    return !!j.success && (j.score == null || j.score >= 0.5);
  } catch(_) { return false; }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
