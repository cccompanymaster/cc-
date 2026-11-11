/**
 * 노아마케팅그룹 — 문의·결제·웹훅 통합 엔드포인트 (Google Apps Script)
 * 보안 하드닝: OWASP Top 10 + 한국 개인정보보호법 대응 (결제는 Nicepay.gs)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                           📦 배포 절차                               │
 * └─────────────────────────────────────────────────────────────────────┘
 *  1) Google Sheets 새 스프레드시트 → 확장프로그램 → Apps Script
 *  2) Code.gs에 이 파일 전체 붙여넣기 → 저장
 *  3) Apps Script 좌측 톱니(⚙️) → 스크립트 속성 에 아래 값 등록 (하드코딩 금지):
 *       • NOTIFY_EMAIL              = 관리자 알림 이메일
 *       • ADMIN_EMAIL_CC            = (선택) 추가 수신자
 *       • RECAPTCHA_SECRET          = (선택) reCAPTCHA v3 서버 시크릿
 *       • ALLOWED_ORIGINS           = 쉼표구분: https://cccompanymaster.github.io,https://your-domain.kr
 *  4) 배포 → 새 배포 → 웹 앱 → 실행 "나", 액세스 "모든 사용자"
 *  5) 발급 URL → js/script.js 의 INQUIRY_WEBHOOK_URL, pay-result.html 의 API
 *  6) 코드 수정 후에는 "배포 관리 → 편집 → 새 버전" 으로 재배포 필수
 *
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │        💳 나이스페이 결제 → 같은 프로젝트의 Nicepay.gs (2026-11)        │
 * └─────────────────────────────────────────────────────────────────────┘
 *  나이스페이 코드는 전부 Nicepay.gs 한 파일에 있고, 이 파일에서는 세 곳만 연결합니다:
 *  doPost의 ?action=nicepay-return 분기 · type:'nicepay-prepare' 라우팅 · doGet의 ?action=pay-status.
 *  ⚠ 실제 배포본(Apps Script '노아폼 백엔드')의 Code.gs에는 noahhomepage.co.kr용
 *    consult·brochure·intake 처리가 더 들어 있습니다. 이 파일 전체를 붙여 넣으면 그 폼들이 멈춥니다.
 *    바꿀 때는 필요한 부분만 옮기세요. (Nicepay.gs는 통째로 붙여 넣어도 됩니다.)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                      🛡️ 적용된 보안 조치                             │
 * └─────────────────────────────────────────────────────────────────────┘
 *  • PropertiesService로 Secret 분리 (하드코딩 금지)
 *  • LockService로 동시성 race 방지
 *  • Sheet Formula Injection 방어 (=,+,-,@ prefix escape)
 *  • Email Header Injection 방어 (CRLF 제거·길이제한)
 *  • Origin/Referer 검증 (화이트리스트)
 *  • Rate Limiting (CacheService: IP·이메일·UA 복합)
 *  • 허니팟 필드 + 시간 기반 봇 탐지 (form open < 3s)
 *  • reCAPTCHA v3 검증 (시크릿 설정 시 자동 활성)
 *  • PII 마스킹 (휴대폰 중간 4자리, 카드 BIN 제거)
 *  • 에러 응답 정적화 (스택/내부 경로 노출 금지)
 */

// ═══════════════════════════════════════════════════════════════════════
//  설정 (PropertiesService 우선, 없으면 안전한 기본값)
// ═══════════════════════════════════════════════════════════════════════
function CFG_() {
  const p = PropertiesService.getScriptProperties();
  return {
    NOTIFY_EMAIL:          p.getProperty('NOTIFY_EMAIL') || '',
    ADMIN_EMAIL_CC:        p.getProperty('ADMIN_EMAIL_CC') || '',
    RECAPTCHA_SECRET:      p.getProperty('RECAPTCHA_SECRET') || '',
    ALLOWED_ORIGINS:       (p.getProperty('ALLOWED_ORIGINS') ||
      'https://cccompanymaster.github.io,https://noahgroup.co.kr,https://www.noahgroup.co.kr').split(',').map(s => s.trim()).filter(Boolean),
  };
}


const SHEET_INQUIRIES = 'Inquiries';
const SHEET_ORDERS    = 'Orders';
const SHEET_LOGS      = 'Logs';
const MIN_SUBMIT_MS   = 3000;          // 3초 미만 제출 = 봇
const RL_WINDOW_SEC   = 60;            // rate limit 윈도우
const RL_MAX_PER_MIN  = 5;             // 1분당 최대 시도
const RL_MAX_PER_DAY  = 50;            // 1일당 최대 시도
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
      return handleNicepayReturn_(e.parameter, CFG_());   // → Nicepay.gs
    }

    const raw = (e && e.postData && e.postData.contents) || '{}';
    if (raw.length > 45e6) return jsonResponse_({ ok: false, error: 'payload too large' });   // 첨부 30MB → base64 약 40MB
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
      case 'nicepay-prepare': return handleNicepayPrepare_(data, cfg);   // → Nicepay.gs
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
    const mode = nicepayActiveMode_(nicepayCfg_());   // → Nicepay.gs
    return jsonResponse_({ ok: true, mode: mode, testOnly: mode === 'sandbox' });
  }
  if (e && e.parameter && e.parameter.action === 'order-status') return npOrderStatus_(e.parameter.o);   // → Nicepay.gs
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
    sanitizeCell_((data.referrer || '').slice(0,480)),
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
