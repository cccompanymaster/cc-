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
      'https://cccompanymaster.github.io').split(',').map(s => s.trim()).filter(Boolean),
  };
}

// 서버 권위적 가격 카탈로그 — 클라이언트의 expectedAmount는 참조만, 금액은 여기서 확정
const PRICE_CATALOG = {
  '상담 예약금':       { price: 50000,    fixed: true  },
  '기본 진단 패키지':  { price: 300000,   fixed: true  },
  '표준 월간 패키지':  { price: 1500000,  fixed: true  },
  '맞춤 견적 결제':    { price: null,     fixed: false, min: 50000, max: 10000000 },
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
      case 'payment':  return handlePayment_(data, cfg);
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

function doGet() {
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

  const sheet = getOrCreateInquirySheet_();
  sheet.appendRow([
    new Date(),
    sanitizeCell_(data.name),
    sanitizeCell_(data.company),
    sanitizeCell_(maskPhone_(data.phone)),
    sanitizeCell_(maskEmail_(data.email)),
    sanitizeCell_(data.interests),
    sanitizeCell_((data.message || '').slice(0, 5000)),
    sanitizeCell_((data.referrer || '').slice(0,120)),
    sanitizeCell_((data.userAgent || '').slice(0,120)),
    sanitizeCell_((data.clientIp || '').slice(0,45)),
  ]);
  if (cfg.NOTIFY_EMAIL) sendInquiryMail_(data, cfg);
  return jsonResponse_({ ok: true });
}

function getOrCreateInquirySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_INQUIRIES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_INQUIRIES);
    sh.appendRow(['제출시각','이름','회사/브랜드','연락처(마스킹)','이메일(마스킹)','관심항목','문의내용','유입경로','UserAgent','IP']);
    sh.setFrozenRows(1);
    sh.getRange('A1:J1').setFontWeight('bold').setBackground('#0f1a3a').setFontColor('#fff');
  }
  return sh;
}
function sendInquiryMail_(data, cfg) {
  const subject = sanitizeHeader_(`[노아마케팅] 신규 문의 — ${data.name || '(이름없음)'}`);
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
    '',
    `시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `유입: ${sanitizeHeader_(data.referrer) || '(direct)'}`,
  ].join('\n');
  MailApp.sendEmail({ to: cfg.NOTIFY_EMAIL, cc: cfg.ADMIN_EMAIL_CC, subject, body });
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
  }, { status: info.status, amount: info.amount?.total || 0, raw: info, note: 'webhook' });
  return jsonResponse_({ ok: true });
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
