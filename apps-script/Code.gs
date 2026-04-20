/**
 * 노아마케팅그룹 — 문의 폼 수신 엔드포인트 (Google Apps Script)
 *
 * 배포 절차:
 *  1) Google Sheets에서 새 스프레드시트 생성
 *  2) 확장 프로그램 → Apps Script 클릭
 *  3) Code.gs에 이 파일 내용 전체 붙여넣기
 *  4) 아래 NOTIFY_EMAIL을 실제 알림 수신 이메일로 교체
 *  5) 우측 상단 "배포 → 새 배포" → 유형: 웹 앱
 *     - 실행 계정: "나"
 *     - 액세스 권한: "모든 사용자" (Anyone)
 *  6) 발급된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 복사
 *  7) js/script.js의 INQUIRY_WEBHOOK_URL 상수에 붙여넣기
 *
 * 주의: 코드 수정 후에는 "배포 관리 → 편집(연필) → 버전: 새 버전" 으로 재배포 필요.
 */

const SHEET_NAME = 'Inquiries';
const NOTIFY_EMAIL = 'noah@cccompany.kr'; // ← 알림 받을 이메일 주소로 교체

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const data = JSON.parse(raw);

    const sheet = getOrCreateSheet_();
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

    if (NOTIFY_EMAIL) {
      sendNotification_(data);
    }

    return jsonResponse_({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doGet() {
  // 헬스체크용
  return ContentService.createTextOutput('OK');
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
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

function sendNotification_(data) {
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
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: lines.join('\n'),
  });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
