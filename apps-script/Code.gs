/**
 * 노아마케팅그룹 — 문의 폼 + 포트원 결제 검증 엔드포인트 (Google Apps Script)
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │                       📦 배포 절차                                 │
 * └───────────────────────────────────────────────────────────────────┘
 *  1) Google Sheets에서 새 스프레드시트 생성 → 이름 "노아_운영DB" 등
 *  2) 확장 프로그램 → Apps Script 클릭 → Code.gs에 이 파일 내용 전체 붙여넣기
 *  3) 아래 4개 상수를 실제 값으로 교체:
 *       - NOTIFY_EMAIL          : 알림 받을 이메일
 *       - PORTONE_V2_API_SECRET : 포트원 V2 API Secret (콘솔 → 내 결제 → API Keys)
 *       - PORTONE_STORE_ID      : 포트원 스토어 ID
 *  4) 저장 → 우측 상단 "배포 → 새 배포"
 *       - 유형: 웹 앱
 *       - 실행 계정: "나"
 *       - 액세스 권한: "모든 사용자" (Anyone)
 *  5) 발급된 웹 앱 URL을 복사 → js/script.js의 다음 두 상수에 동일 URL 붙여넣기:
 *       - INQUIRY_WEBHOOK_URL
 *       - PAYMENT_VERIFY_URL
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │                    💳 포트원 가입 & PG 연동 절차                    │
 * └───────────────────────────────────────────────────────────────────┘
 *  1) https://portone.io 가입 (사업자 등록증 필요)
 *  2) 콘솔 → 연동 → 결제 연동 → PG사 선택
 *       - 가장 빠른 조합: 토스페이먼츠 또는 KG이니시스 (카드결제 1~2주 심사)
 *  3) 심사 통과 후 "스토어 ID" · "채널 키" 발급
 *  4) js/script.js 하단:
 *       const PORTONE_STORE_ID    = 'store-xxxxxxxx-...';
 *       const PORTONE_CHANNEL_KEY = 'channel-key-xxxxxxxx-...';
 *  5) 포트원 콘솔 → API Keys 에서 V2 API Secret 발급 → 아래 PORTONE_V2_API_SECRET
 *
 * 💡 코드 수정 후에는 Apps Script에서 "배포 관리 → 편집(연필) → 새 버전" 으로 재배포 필수.
 */

const SHEET_INQUIRIES = 'Inquiries';
const SHEET_ORDERS    = 'Orders';
const NOTIFY_EMAIL    = 'noah@cccompany.kr';       // ← 교체

// ─── 포트원 V2 (결제 서버검증용) ─────────────────────────────
const PORTONE_V2_API_SECRET = '';                  // ← 교체 (포트원 V2 API Secret)
const PORTONE_STORE_ID      = '';                  // ← 교체 (스토어 ID)
// ────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const data = JSON.parse(raw);

    // 분기: type='payment' 이면 결제 검증, 그 외는 문의 접수
    if (data.type === 'payment') {
      return handlePayment_(data);
    }
    return handleInquiry_(data);
  } catch (err) {
    console.error(err);
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('OK');
}

// ══════════════════════════════════════════════════════════════
//  문의 접수 처리
// ══════════════════════════════════════════════════════════════
function handleInquiry_(data) {
  const sheet = getOrCreateInquirySheet_();
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.company || '',
    data.phone || '',
    data.email || '',
    data.interests || '',
    data.message || '',
    data.referrer || '',
    data.userAgent || '',
  ]);
  if (NOTIFY_EMAIL) sendInquiryMail_(data);
  return jsonResponse_({ ok: true });
}

function getOrCreateInquirySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_INQUIRIES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_INQUIRIES);
    sh.appendRow([
      '제출시각', '이름', '회사/브랜드', '연락처', '이메일',
      '관심항목', '문의내용', '유입경로', 'UserAgent',
    ]);
    sh.setFrozenRows(1);
    sh.getRange('A1:I1').setFontWeight('bold').setBackground('#0f1a3a').setFontColor('#ffffff');
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(7, 420);
  }
  return sh;
}

function sendInquiryMail_(data) {
  const subject = `[노아마케팅] 신규 문의 — ${data.name || '(이름없음)'}`;
  const lines = [
    `이름: ${data.name || '-'}`,
    `회사/브랜드: ${data.company || '-'}`,
    `연락처: ${data.phone || '-'}`,
    `이메일: ${data.email || '-'}`,
    `관심항목: ${data.interests || '-'}`,
    '',
    '───── 문의 내용 ─────',
    data.message || '-',
    '─────────────────',
    '',
    `제출 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `유입 경로: ${data.referrer || '(direct)'}`,
  ];
  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject, body: lines.join('\n') });
}

// ══════════════════════════════════════════════════════════════
//  결제 검증 & 주문 기록 (포트원 V2)
// ══════════════════════════════════════════════════════════════
function handlePayment_(data) {
  const { paymentId, expectedAmount, orderName, customer = {} } = data;

  // 1) 필수 검증
  if (!paymentId || !expectedAmount) {
    return jsonResponse_({ ok: false, error: 'missing paymentId or expectedAmount' });
  }
  if (!PORTONE_V2_API_SECRET) {
    // 포트원 미설정 시에도 시트에는 주문 시도 기록 — 수동 확인용
    recordOrder_(data, { status: 'UNVERIFIED', message: 'API secret not configured' });
    return jsonResponse_({ ok: false, error: 'server verification disabled' });
  }

  // 2) 포트원 V2 REST API 로 결제 상태 조회
  const url = `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: `PortOne ${PORTONE_V2_API_SECRET}` },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) {
    recordOrder_(data, { status: 'VERIFY_ERROR', message: `HTTP ${code}: ${body}` });
    return jsonResponse_({ ok: false, error: `portone api ${code}` });
  }

  const info = JSON.parse(body);
  const paid = info.status === 'PAID';
  const realAmount = Number(info.amount?.total || info.amount?.paid || 0);
  const amountMatches = paid && realAmount === Number(expectedAmount);

  if (!amountMatches) {
    recordOrder_(data, {
      status: paid ? 'AMOUNT_MISMATCH' : info.status,
      message: `expected ${expectedAmount}, got ${realAmount}`,
      raw: info,
    });
    return jsonResponse_({
      ok: false,
      error: paid ? 'amount mismatch' : `status ${info.status}`,
    });
  }

  // 3) 검증 성공 — 시트 기록 + 고객/담당자 이메일
  recordOrder_(data, { status: 'PAID', raw: info, amount: realAmount });
  sendOrderMail_(data, info);
  if (customer.email) sendReceiptMail_(customer.email, data, info);

  return jsonResponse_({ ok: true, status: 'PAID' });
}

function getOrCreateOrderSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ORDERS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ORDERS);
    sh.appendRow([
      '결제시각', '상태', '주문ID', '상품명', '금액',
      '이름', '연락처', '이메일', '메모',
      'PG 거래ID', '결제수단', 'Raw',
    ]);
    sh.setFrozenRows(1);
    sh.getRange('A1:L1').setFontWeight('bold').setBackground('#8a5e2e').setFontColor('#ffffff');
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(3, 200);
    sh.setColumnWidth(12, 400);
  }
  return sh;
}

function recordOrder_(data, result) {
  const sheet = getOrCreateOrderSheet_();
  const cust = data.customer || {};
  const raw = result.raw || {};
  sheet.appendRow([
    new Date(),
    result.status || 'UNKNOWN',
    data.paymentId || '',
    data.orderName || '',
    result.amount ?? data.expectedAmount ?? '',
    cust.name || '',
    cust.phone || '',
    cust.email || '',
    cust.memo || '',
    raw.pgTxId || raw.pg?.pgTxId || '',
    raw.method?.type || raw.method || '',
    JSON.stringify(raw).slice(0, 4000),
  ]);
}

function sendOrderMail_(data, info) {
  if (!NOTIFY_EMAIL) return;
  const cust = data.customer || {};
  const amount = new Intl.NumberFormat('ko-KR').format(info.amount?.total || 0);
  const subject = `[노아마케팅] 결제 완료 — ${data.orderName || ''} · ${amount}원`;
  const lines = [
    `주문명: ${data.orderName || '-'}`,
    `금액: ${amount}원`,
    `주문ID: ${data.paymentId}`,
    `결제수단: ${info.method?.type || '-'}`,
    '',
    '──── 고객 정보 ────',
    `이름: ${cust.name || '-'}`,
    `연락처: ${cust.phone || '-'}`,
    `이메일: ${cust.email || '-'}`,
    `메모: ${cust.memo || '-'}`,
    '',
    `결제 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
  ];
  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject, body: lines.join('\n') });
}

function sendReceiptMail_(email, data, info) {
  const amount = new Intl.NumberFormat('ko-KR').format(info.amount?.total || 0);
  const subject = `[노아마케팅그룹] 결제 확인 영수증 — ${data.orderName || ''}`;
  const body = [
    `안녕하세요, ${data.customer?.name || '고객'}님.`,
    '',
    '노아마케팅그룹 결제가 정상 완료되었습니다.',
    '',
    `• 상품: ${data.orderName || '-'}`,
    `• 결제금액: ${amount}원`,
    `• 주문번호: ${data.paymentId}`,
    `• 결제수단: ${info.method?.type || '-'}`,
    `• 결제일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    '',
    '영업일 내 담당자가 프로젝트 시작에 관한 안내를 드립니다.',
    '세금계산서·현금영수증이 필요하시면 회신 주세요.',
    '',
    '— 노아마케팅그룹 ·  010-6658-6482',
  ].join('\n');
  MailApp.sendEmail({ to: email, subject, body });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
