/**
 * CC컴퍼니 시트 개편 — 마스터시트 v2 + 광고주 보고 통합시트 자동 생성
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                           🚀 사용법                                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *  1) script.google.com 접속 → 새 프로젝트
 *  2) Code.gs 내용 전부 지우고 이 파일 전체 붙여넣기 → 저장
 *  3) 함수 선택 후 ▶ 실행:
 *       • createBothSheets()              — 두 시트 한꺼번에
 *       • createMasterSheetV2()           — 마스터시트만
 *       • createAdvertiserReportSheet()   — 광고주 보고 통합시트만
 *  4) 권한 승인 (드라이브에 시트 생성 권한 요청)
 *  5) 실행 로그(Ctrl+Enter)에 생성된 시트 URL 출력됨
 *  6) 결과: 메인 계정(cccompanymaster) 드라이브 루트에 신규 시트 두 개 생성
 *
 * ⚠️  원본 시트는 절대 건드리지 않음 — 신규 생성만 함
 *
 *  결과물:
 *    • [나만보기] CC컴퍼니 마스터시트 v2  (12개 탭)
 *    • [CC] 광고주 보고 통합시트          (8개 탭)
 *
 *  마음에 들면 사용자가 천천히 데이터 옮겨붙임. 옛 마스터시트와 병행 운영.
 */

// ═══════════════════════════════════════════════════════════════════════
//  스타일 상수
// ═══════════════════════════════════════════════════════════════════════
const STYLE = {
  HEADER_BG:    '#2E5984',  // 진한 파랑 - 메인 헤더
  HEADER_FG:    '#FFFFFF',  // 흰색 글씨
  SUBHEAD_BG:   '#D5E8F0',  // 연한 파랑 - 보조 헤더/소제목
  SUBHEAD_FG:   '#000000',
  ACCENT_BG:    '#F4F8FB',  // 매우 연한 파랑 - 강조 행
  WARN_BG:      '#FFE0E0',  // 미수금/연체 표시용
  GOOD_BG:      '#E0F4E0',  // 정상/완료 표시용
  FONT:         'Arial',
  HEADER_HEIGHT: 34,
  SUBHEAD_HEIGHT: 26,
};

// ═══════════════════════════════════════════════════════════════════════
//  공통 헬퍼
// ═══════════════════════════════════════════════════════════════════════

/** 메인 헤더 행 적용 (진한 파랑 배경 + 흰글씨 굵게) */
function applyHeaderRow_(sheet, headers, row) {
  row = row || 1;
  const range = sheet.getRange(row, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground(STYLE.HEADER_BG)
       .setFontColor(STYLE.HEADER_FG)
       .setFontWeight('bold')
       .setFontFamily(STYLE.FONT)
       .setFontSize(11)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setBorder(true, true, true, true, false, false);
  sheet.setRowHeight(row, STYLE.HEADER_HEIGHT);
}

/** 보조 헤더(소제목) 적용 (연한 파랑 배경 + 검정 굵게) */
function applySubHeader_(sheet, row, startCol, endCol, text) {
  const range = sheet.getRange(row, startCol, 1, endCol - startCol + 1);
  if (endCol > startCol) range.merge();
  range.setValue(text)
       .setBackground(STYLE.SUBHEAD_BG)
       .setFontColor(STYLE.SUBHEAD_FG)
       .setFontWeight('bold')
       .setFontFamily(STYLE.FONT)
       .setFontSize(11)
       .setHorizontalAlignment('left')
       .setVerticalAlignment('middle');
  sheet.setRowHeight(row, STYLE.SUBHEAD_HEIGHT);
}

/** 첫 행 freeze + 필터 활성화 */
function freezeAndFilter_(sheet, headerCols, headerRow) {
  headerRow = headerRow || 1;
  sheet.setFrozenRows(headerRow);
  const lastRow = Math.max(sheet.getLastRow(), headerRow + 1);
  // 기존 필터가 있으면 제거
  const existing = sheet.getFilter();
  if (existing) existing.remove();
  sheet.getRange(headerRow, 1, lastRow - headerRow + 1, headerCols).createFilter();
}

/** 드롭다운(데이터 검증) 적용 */
function setDropdown_(sheet, col, startRow, endRow, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(startRow, col, endRow - startRow + 1, 1).setDataValidation(rule);
}

/** 컬럼 너비 일괄 설정 */
function setColWidths_(sheet, widths) {
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

/** 시트 전체 기본 폰트 적용 */
function setBaseFont_(sheet) {
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
       .setFontFamily(STYLE.FONT)
       .setFontSize(10);
}

/** 통화(원) 포맷 */
function setCurrencyFormat_(sheet, col, startRow, endRow) {
  sheet.getRange(startRow, col, endRow - startRow + 1, 1)
       .setNumberFormat('#,##0"원"');
}

/** 퍼센트 포맷 */
function setPercentFormat_(sheet, col, startRow, endRow) {
  sheet.getRange(startRow, col, endRow - startRow + 1, 1)
       .setNumberFormat('0.0%');
}

/** 날짜 포맷 */
function setDateFormat_(sheet, col, startRow, endRow) {
  sheet.getRange(startRow, col, endRow - startRow + 1, 1)
       .setNumberFormat('yyyy-mm-dd');
}

/** 빈 행 100개 기본 추가 (사용자가 채울 수 있게) + 행 줄무늬 */
function setupBlankRows_(sheet, headerRow, headerCols, blankRows) {
  blankRows = blankRows || 100;
  const total = sheet.getMaxRows();
  const needed = headerRow + blankRows;
  if (total < needed) sheet.insertRowsAfter(total, needed - total);
  // 줄무늬 (alternating)
  const banding = sheet.getRange(headerRow, 1, blankRows + 1, headerCols);
  try {
    banding.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  } catch (e) {
    // 이미 banding이 있으면 무시
  }
}

/** 드롭다운 + 색 표시 (조건부 서식) */
function addStatusConditionalFormat_(sheet, col, startRow, endRow, mapping) {
  // mapping: { '값': '#색' }
  const rules = sheet.getConditionalFormatRules();
  const range = sheet.getRange(startRow, col, endRow - startRow + 1, 1);
  Object.keys(mapping).forEach(function(key) {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(key)
      .setBackground(mapping[key])
      .setRanges([range])
      .build();
    rules.push(rule);
  });
  sheet.setConditionalFormatRules(rules);
}

/** 시트 생성 + 기본 세팅까지 한 번에 */
function newSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
    const f = sheet.getFilter();
    if (f) f.remove();
  } else {
    sheet = ss.insertSheet(name);
  }
  setBaseFont_(sheet);
  return sheet;
}

// ╔═════════════════════════════════════════════════════════════════════╗
// ║                  📦 마스터시트 v2 — 12개 탭                          ║
// ║                  섹션 A: 회사 운영 허브 (Tab 1~5)                    ║
// ╚═════════════════════════════════════════════════════════════════════╝

// ───────────────────────────────────────────────────────────────────────
//  Tab 1. 🏠 대시보드 — 매일 아침 30초 안에 현황 파악
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab1Dashboard_(ss) {
  const sheet = newSheet_(ss, '🏠 대시보드');

  // 타이틀 행
  sheet.getRange('A1:F1').merge()
       .setValue('CC컴퍼니 마스터시트 v2 · 대시보드')
       .setBackground(STYLE.HEADER_BG)
       .setFontColor(STYLE.HEADER_FG)
       .setFontWeight('bold')
       .setFontSize(16)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setFontFamily(STYLE.FONT);
  sheet.setRowHeight(1, 44);

  // 업데이트 시각
  sheet.getRange('A2:F2').merge()
       .setValue('마지막 갱신: 수동 입력 (=NOW() 사용 시 자동)')
       .setFontColor('#666666')
       .setFontStyle('italic')
       .setHorizontalAlignment('center')
       .setFontFamily(STYLE.FONT);

  // 섹션 1 — 핵심 지표 (위젯 6개, 2열 x 3행)
  applySubHeader_(sheet, 4, 1, 6, '📊 핵심 지표 (이번 달)');

  const widgetsRow1 = [
    ['활성 광고주 수', '=COUNTIF(\'👥 광고주 마스터\'!G:G,"활성")', '이번 달 매출', '=SUMIFS(\'💰 매출\'!F:F,\'💰 매출\'!A:A,">="&EOMONTH(TODAY(),-1)+1,\'💰 매출\'!A:A,"<="&EOMONTH(TODAY(),0))'],
    ['이번 달 미수금', '=SUMIFS(\'💰 매출\'!F:F,\'💰 매출\'!B:B,"미입금",\'💰 매출\'!A:A,">="&EOMONTH(TODAY(),-1)+1,\'💰 매출\'!A:A,"<="&EOMONTH(TODAY(),0))', '이번 달 지출', '=SUMIFS(\'💸 지출\'!F:F,\'💸 지출\'!A:A,">="&EOMONTH(TODAY(),-1)+1,\'💸 지출\'!A:A,"<="&EOMONTH(TODAY(),0))'],
    ['누적 미수금 합계', '=SUMIF(\'💰 매출\'!B:B,"미입금",\'💰 매출\'!F:F)', '이번 달 순익(매출-지출)', '=E5-E7'],
  ];

  for (let i = 0; i < widgetsRow1.length; i++) {
    const r = 5 + i * 2;
    // 라벨 (A, D)
    sheet.getRange(r, 1).setValue(widgetsRow1[i][0])
         .setBackground(STYLE.SUBHEAD_BG).setFontWeight('bold').setFontFamily(STYLE.FONT);
    sheet.getRange(r, 4).setValue(widgetsRow1[i][2])
         .setBackground(STYLE.SUBHEAD_BG).setFontWeight('bold').setFontFamily(STYLE.FONT);
    // 값 (B:C 병합, E:F 병합)
    sheet.getRange(r, 2, 1, 2).merge().setFormula(widgetsRow1[i][1])
         .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('right')
         .setNumberFormat('#,##0"원"').setFontFamily(STYLE.FONT);
    sheet.getRange(r, 5, 1, 2).merge().setFormula(widgetsRow1[i][3])
         .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('right')
         .setNumberFormat('#,##0"원"').setFontFamily(STYLE.FONT);
    // 활성 광고주 수는 숫자 포맷 (원 X)
    if (i === 0) sheet.getRange(r, 2, 1, 2).setNumberFormat('0"개"');
    sheet.setRowHeight(r, 36);
  }

  // 섹션 2 — 이번 주/달 마감
  applySubHeader_(sheet, 11, 1, 6, '📅 다가오는 마감·일정 (수동 기입)');
  const deadlineHeaders = ['날짜', '광고주', '내용', '담당', '상태', '비고'];
  applyHeaderRow_(sheet, deadlineHeaders, 12);
  // 샘플 1줄
  sheet.getRange(13, 1, 1, 6).setValues([[
    new Date(), '예: 수만휘', '월간 보고서 발송', '성관', '진행중', ''
  ]]);
  setDateFormat_(sheet, 1, 13, 22);
  setDropdown_(sheet, 5, 13, 22, ['진행중', '완료', '대기', '지연']);

  // 섹션 3 — 빠른 링크
  applySubHeader_(sheet, 24, 1, 6, '🔗 빠른 링크 (시트 URL을 직접 붙여넣어)');
  const linkHeaders = ['이름', '용도', 'URL'];
  sheet.getRange(25, 1, 1, 3).setValues([linkHeaders])
       .setBackground(STYLE.HEADER_BG).setFontColor(STYLE.HEADER_FG)
       .setFontWeight('bold').setFontFamily(STYLE.FONT);
  const links = [
    ['[CC] 광고주 보고 통합시트', '광고주별 보고 한 번에', ''],
    ['[CC] 체험단 총괄', '체험단 모집/배포', ''],
    ['[CC] 건배포 총괄', '최적화블로그 배포', ''],
    ['[CC] 브랜드블로그 총괄', '브랜드블로그 운영', ''],
  ];
  sheet.getRange(26, 1, links.length, 3).setValues(links);

  // 섹션 4 — 최근 수정 시트 (수동 또는 향후 IMPORTRANGE)
  applySubHeader_(sheet, 32, 1, 6, '🕒 최근 수정 시트 (수동 갱신 또는 시트 인덱스 참조)');
  sheet.getRange(33, 1, 1, 4).setValues([['시트명', '수정일', 'PM', '메모']])
       .setBackground(STYLE.HEADER_BG).setFontColor(STYLE.HEADER_FG)
       .setFontWeight('bold').setFontFamily(STYLE.FONT);

  // 컬럼 너비
  setColWidths_(sheet, [180, 200, 280, 180, 100, 200]);

  sheet.setFrozenRows(1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 2. 🗂 시트 인덱스 — 모든 시트 위치 파악, 단일 진입점
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab2SheetIndex_(ss) {
  const sheet = newSheet_(ss, '🗂 시트 인덱스');

  const headers = ['분류', '시트명', '소유주체', '광고주/팀', '상품', '담당PM', '상태', '시트 링크', '마지막수정', '비고'];
  applyHeaderRow_(sheet, headers, 1);

  // 초기 샘플 데이터 (사용자가 채워나갈 수 있게 주요 시트 미리 등록)
  const samples = [
    ['00_마스터·운영총괄', '[나만보기] CC컴퍼니 마스터시트 v2', 'CC',          '본사',       '-',      '본인',    '활성',     '', '', '회사 운영 + 회계 + 개인 통합'],
    ['00_마스터·운영총괄', '[CC] 광고주 보고 통합시트',           'CC',          '본사',       '-',      '본인',    '활성',     '', '', '광고주별 보고 통합'],
    ['00_마스터·운영총괄', 'CC컴퍼니 운영총괄시트',               'CC',          '본사',       '-',      '본인',    '활성',     '', '', ''],
    ['00_마스터·운영총괄', '내부공유용 업무시트',                 'CC',          '본사',       '-',      '본인',    '활성',     '', '', ''],
    ['01_팀·부서운영',    '홍보팀 운영총괄시트',                 'CC',          '홍보팀',     '-',      '',        '활성',     '', '', ''],
    ['01_팀·부서운영',    '[CC] 브랜드블로그 총괄 내부용',        'CC',          '브랜드팀',   '브랜드블로그', '',  '활성',     '', '', ''],
    ['02_서비스총괄',    '[CC] 체험단 총괄',                    'CC',          '체험단팀',   '체험단', '',        '활성',     '', '', ''],
    ['02_서비스총괄',    '[CC] 건배포 총괄',                    'CC',          '배포팀',     '배포',   '',        '활성',     '', '', '4.2MB - 다이어트 필요'],
    ['02_서비스총괄',    '도급업체 총괄',                       'CC',          '본사',       '-',      '',        '활성',     '', '', ''],
    ['03-1_자동차·이동',  '[CC] 수만휘 마케팅총괄',              'CC',          '수만휘',     '통합',   '',        '활성',     '', '', ''],
    ['03-1_자동차·이동',  '[CC] 부싼카 블로그 마케팅총괄',        'CC',          '부싼카',     '브랜드블로그', '',  '활성',     '', '', ''],
    ['03-1_자동차·이동',  '[CC×가온] 도그마루 배포',             'CC×가온',     '도그마루',   '배포',   '',        '활성',     '', '', ''],
    ['03-1_자동차·이동',  '[CC] 도그마루 내부용',                'CC',          '도그마루',   '배포',   '',        '활성',     '', '', ''],
    ['03-1_자동차·이동',  '[CC] 디에스오토 마케팅',              'CC',          '디에스오토', '통합',   '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['03-1_자동차·이동',  '[CC] 카통령 마케팅',                  'CC',          '카통령',     '통합',   '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['03-2_의료·건강',   '[CC] 스포애니 마케팅총괄',             'CC',          '스포애니',   '통합',   '',        '활성',     '', '', ''],
    ['03-2_의료·건강',   '[CC] 웨이브히어링 보고',               'CC',          '웨이브히어링','상위노출','',       '활성',     '', '', ''],
    ['03-2_의료·건강',   '[CC] 벨라르셀 체험단',                 'CC',          '벨라르셀',   '체험단', '',        '활성',     '', '', ''],
    ['03-2_의료·건강',   '[CC] 세븐디테일링 마케팅',             'CC',          '세븐디테일링','통합',  '',        '일시중지', '', '', '2024.07부터 미수정'],
    ['03-3_부동산·분양',  '[CC] 호텔분양 TF',                    'CC',          '호텔분양',   '통합',   '',        '활성',     '', '', ''],
    ['03-4_F&B·기타',    '[CC] 한우전 마케팅총괄',              'CC',          '한우전',     '통합',   '',        '활성',     '', '', ''],
    ['03-4_F&B·기타',    '[CC] 프랑켄 체험단',                  'CC',          '프랑켄',     '체험단', '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['03-4_F&B·기타',    '[CC] 프랑켄 배포',                    'CC',          '프랑켄',     '배포',   '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['03-4_F&B·기타',    '[CC] 우리집 홈케어',                  'CC',          '우리집홈케어','통합',  '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['03-4_F&B·기타',    '[CC] 스캇나인 마케팅',                'CC',          '스캇나인',   '통합',   '',        '일시중지', '', '', ''],
    ['03-5_공구',         '리즈메디 인플루언서 공구 제안',         '광고주',      '리즈메디',   '공구',   '',        '활성',     '', '', '광고주 소유 - shortcut'],
    ['03-5_공구',         '모어그린 인플루언서 공구 제안',         '광고주',      '모어그린',   '공구',   '',        '활성',     '', '', '광고주 소유 - shortcut'],
    ['03-5_공구',         '에어리스노우 공구 단가표',             'CC',          '에어리스노우','공구',  '',        '활성',     '', '', '메인계정으로 이전 필요'],
    ['04_양식·템플릿',    '[CC] 콘텐츠마케팅 견적 양식',          'CC',          '-',         '-',      '',        '참조용',   '', '', 'ver.22 → 단일화'],
    ['05_거래처',         '하이소사이어티',                       '-',           '-',         '상위노출','',        '활성',     '', '', ''],
    ['05_거래처',         '세모 카페리스트',                       '-',           '-',         '카페침투','',        '활성',     '', '', '3개 시트 통합 필요'],
    ['05_거래처',         '정도커뮤니케이션',                      '-',           '-',         '원고대행','',       '활성',     '', '', ''],
    ['09-1_2020_여긴시절','여긴체험단 총괄 자료 (2020)',          'CC',          '-',         '-',      '',        '아카이브', '', '', '보존'],
    ['09-2_2023_종료',    '북촌손만두 총괄 (2023)',                'CC',          '북촌손만두', '체험단', '',        '아카이브', '', '', '보존'],
    ['09-3_빈시트·중복',  '빈 시트 5개 + 견적서 중복 2개',         'CC',          '-',         '-',      '',        '아카이브', '', '', ''],
  ];

  sheet.getRange(2, 1, samples.length, headers.length).setValues(samples);

  // 컬럼 너비
  setColWidths_(sheet, [160, 280, 110, 140, 110, 90, 90, 240, 110, 240]);

  // 분류 드롭다운 (모든 데이터 행)
  setDropdown_(sheet, 1, 2, 200, [
    '00_마스터·운영총괄', '01_팀·부서운영', '02_서비스총괄',
    '03-1_자동차·이동', '03-2_의료·건강', '03-3_부동산·분양',
    '03-4_F&B·기타', '03-5_공구',
    '04_양식·템플릿', '05_거래처', '06_프로젝트',
    '09-1_2020_여긴시절', '09-2_2023_종료', '09-3_빈시트·중복',
    '99_개인'
  ]);

  // 소유주체 드롭다운
  setDropdown_(sheet, 3, 2, 200, ['CC', 'CC×가온', '광고주', '거래처', '개인', '-']);

  // 상품 드롭다운
  setDropdown_(sheet, 5, 2, 200, ['브랜드블로그', '체험단', '상위노출', '공구', '통합', '배포', '카페침투', '원고대행', '-']);

  // 상태 드롭다운 + 색
  setDropdown_(sheet, 7, 2, 200, ['활성', '참조용', '일시중지', '종료', '아카이브']);
  addStatusConditionalFormat_(sheet, 7, 2, 200, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
    '아카이브': '#E0E0E0',
  });

  // 마지막수정 컬럼 날짜 포맷
  setDateFormat_(sheet, 9, 2, 200);

  setupBlankRows_(sheet, 1, headers.length, 200 - samples.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 3. 👥 광고주 마스터 — 광고주 한 줄, 모든 핵심 정보
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab3AdvertiserMaster_(ss) {
  const sheet = newSheet_(ss, '👥 광고주 마스터');

  const headers = [
    '광고주명', '업종', '담당PM', '진행 상품',
    '계약 시작일', '계약 종료일', '상태',
    '월 매출', '누적 매출', '미수금',
    '시트 링크', '통합 보고시트 탭', '비고'
  ];
  applyHeaderRow_(sheet, headers, 1);

  // 활성 광고주 30개+ 초기 데이터
  const advertisers = [
    // 자동차·이동
    ['수만휘',         '자동차',     '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['부싼카',         '자동차',     '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', ''],
    ['도그마루',       '자동차·반려', '', '배포',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', '가온 협업'],
    ['디에스오토',     '자동차',     '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['카통령',         '자동차',     '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['아우디',         '자동차',     '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', '대표님'],
    ['랜드로버',       '자동차',     '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', ''],
    ['벤츠 (박관용)',  '자동차',     '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', '대표님'],
    ['벤츠 (강명재)',  '자동차',     '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', '대표님'],
    // 의료·건강
    ['스포애니',       '운동·건강',  '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['웨이브히어링',   '의료',       '', '상위노출',                   '', '', '활성', '', '', '', '', '🔝 상위노출',     ''],
    ['벨라르셀',       '뷰티',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['세븐디테일링',   '뷰티',       '', '통합',                       '', '', '일시중지', '', '', '', '', '🎯 통합 마케팅', '2024.07~ 미수정'],
    ['리즈메디',       '의료',       '', '공구',                       '', '', '활성', '', '', '', '', '🛒 공동구매',     '광고주 시트'],
    ['모어그린',       '건강식품',   '', '공구',                       '', '', '활성', '', '', '', '', '🛒 공동구매',     '광고주 시트'],
    ['에어리스노우',   '가전',       '', '공구',                       '', '', '활성', '', '', '', '', '🛒 공동구매',     ''],
    // 부동산·분양
    ['호텔분양',       '분양',       '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', 'TF'],
    ['닥터하우징',     '분양',       '', '통합',                       '', '', '종료', '', '', '', '', '',                '2023 종료'],
    // F&B·기타
    ['한우전',         'F&B',        '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['프랑켄',         'F&B',        '', '체험단·배포',                '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['우리집홈케어',   '서비스',     '', '통합',                       '', '', '활성', '', '', '', '', '🎯 통합 마케팅', ''],
    ['스캇나인',       '기타',       '', '통합',                       '', '', '일시중지', '', '', '', '', '🎯 통합 마케팅', '2025.01~ 미수정'],
    ['셀앤수',         '기타',       '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', ''],
    ['EL엘린어학원',   '교육',       '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', ''],
    ['육아블로그',     '육아',       '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', '광고주 시트'],
    ['태아보험',       '보험',       '', '브랜드블로그',                '', '', '활성', '', '', '', '', '📝 브랜드블로그', ''],
    // 한방·뷰티 체험단
    ['다래',           '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['본디',           '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['365봄',          '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['하늘체',         '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['코스메르나',     '뷰티',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['베리웰',         '뷰티',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['솔담',           '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['다이즐',         '뷰티',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    ['다담',           '한방',       '', '체험단',                     '', '', '활성', '', '', '', '', '🎁 체험단',       ''],
    // 공구
    ['제이앤씨',       '기타',       '', '공구',                       '', '', '활성', '', '', '', '', '🛒 공동구매',     ''],
    ['오하이오',       '기타',       '', '공구',                       '', '', '활성', '', '', '', '', '🛒 공동구매',     ''],
  ];

  sheet.getRange(2, 1, advertisers.length, headers.length).setValues(advertisers);

  // 매출 자동 합산 수식 (월 매출 H, 누적 매출 I, 미수금 J)
  for (let i = 0; i < advertisers.length; i++) {
    const r = i + 2;
    sheet.getRange(r, 8).setFormula(
      `=IFERROR(SUMIFS('💰 매출'!F:F,'💰 매출'!C:C,A${r},'💰 매출'!A:A,">="&EOMONTH(TODAY(),-1)+1,'💰 매출'!A:A,"<="&EOMONTH(TODAY(),0)),0)`
    );
    sheet.getRange(r, 9).setFormula(
      `=IFERROR(SUMIF('💰 매출'!C:C,A${r},'💰 매출'!F:F),0)`
    );
    sheet.getRange(r, 10).setFormula(
      `=IFERROR(SUMIFS('💰 매출'!F:F,'💰 매출'!C:C,A${r},'💰 매출'!B:B,"미입금"),0)`
    );
  }

  // 컬럼 너비
  setColWidths_(sheet, [140, 100, 90, 130, 100, 100, 90, 110, 110, 110, 220, 150, 200]);

  // 드롭다운
  setDropdown_(sheet, 4, 2, 200, ['브랜드블로그', '체험단', '상위노출', '공구', '통합', '배포', '체험단·배포']);
  setDropdown_(sheet, 7, 2, 200, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 7, 2, 200, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });
  setDropdown_(sheet, 12, 2, 200, [
    '📝 브랜드블로그', '🎁 체험단', '🔝 상위노출',
    '🛒 공동구매', '🎯 통합 마케팅', '📤 건배포·수급', '-'
  ]);

  // 포맷
  setDateFormat_(sheet, 5, 2, 200);
  setDateFormat_(sheet, 6, 2, 200);
  setCurrencyFormat_(sheet, 8, 2, 200);
  setCurrencyFormat_(sheet, 9, 2, 200);
  setCurrencyFormat_(sheet, 10, 2, 200);

  // 미수금 30일 경과 빨간색 (J열에 미수금 > 0이고 계약시작일이 30일 이전이면)
  const rules = sheet.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($J2>0,$J2<>"")')
      .setBackground(STYLE.WARN_BG)
      .setRanges([sheet.getRange('J2:J200')])
      .build()
  );
  sheet.setConditionalFormatRules(rules);

  setupBlankRows_(sheet, 1, headers.length, 200 - advertisers.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 4. 🏢 거래처·도급업체 — 외주 파트너, 거래처 관리
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab4Vendors_(ss) {
  const sheet = newSheet_(ss, '🏢 거래처·도급업체');

  const headers = ['거래처명', '분류', '담당자', '연락처', '단가 정보', '거래 시작', '최근 거래일', '상태', '비고'];
  applyHeaderRow_(sheet, headers, 1);

  const vendors = [
    ['하이소사이어티',     '상위노출',  '', '', '', '', '', '활성',  ''],
    ['세모',              '카페침투',  '', '', '', '', '', '활성',  '카페리스트 3개 시트 통합 필요'],
    ['정도커뮤니케이션',   '원고대행',  '', '', '', '', '', '활성',  ''],
    ['민철',              '배포 외주',  '', '', '', '', '', '활성',  ''],
    ['가온',              '배포 협업',  '', '', '', '', '', '활성',  '도그마루 협업'],
  ];

  sheet.getRange(2, 1, vendors.length, headers.length).setValues(vendors);

  setColWidths_(sheet, [160, 110, 110, 140, 220, 110, 110, 90, 240]);

  setDropdown_(sheet, 2, 2, 100, ['상위노출', '카페침투', '원고대행', '배포 외주', '배포 협업', '디자인', '기타']);
  setDropdown_(sheet, 8, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 8, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });
  setDateFormat_(sheet, 6, 2, 100);
  setDateFormat_(sheet, 7, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - vendors.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 5. 📦 양식·템플릿 — 자주 쓰는 양식·견적서·가이드 위치
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab5Templates_(ss) {
  const sheet = newSheet_(ss, '📦 양식·템플릿');

  const headers = ['양식명', '용도', '마지막 수정', '링크', '비고'];
  applyHeaderRow_(sheet, headers, 1);

  const templates = [
    ['[CC] 콘텐츠마케팅 견적 양식 ver.22', '광고주 견적 발행',         '', '', '기존 ver.22 - 단일화 필요'],
    ['[CC] 브랜드블로그 관리 시트 양식',     '브랜드블로그 신규 광고주',  '', '', ''],
    ['[CC] 체험단 업무시트 양식',            '체험단 신규 캠페인',        '', '', ''],
    ['[CC] 한우전 체험단 가이드 양식',       '체험단 가이드 (광고주 doc)','', '', '광고주 소유 - shortcut'],
    ['[CC] 리즈메디 포스팅 가이드라인',      '인플루언서 포스팅 가이드',  '', '', '광고주 소유 - shortcut'],
    ['[CC] 단가표 통합본',                   '체험단·인플루언서 단가',    '', '', '신규 작성 필요'],
    ['[CC] 영업톡 모음',                     '체험단·리뷰어 모집 메시지', '', '', '광고주 보고 통합시트 Tab 8 참조'],
  ];

  sheet.getRange(2, 1, templates.length, headers.length).setValues(templates);

  setColWidths_(sheet, [260, 220, 110, 280, 220]);
  setDateFormat_(sheet, 3, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - templates.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ╔═════════════════════════════════════════════════════════════════════╗
// ║                  마스터시트 v2 — 섹션 B: 회계 (Tab 6~10)             ║
// ╚═════════════════════════════════════════════════════════════════════╝

// ───────────────────────────────────────────────────────────────────────
//  Tab 6. 💰 매출 — 단일 표 + 월 필터로 운영
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab6Revenue_(ss) {
  const sheet = newSheet_(ss, '💰 매출');

  const headers = [
    '날짜', '입금여부', '업체명', '내용',
    '입금일', '금액', '부가세', '합계', '순익',
    'PM', '메모'
  ];
  applyHeaderRow_(sheet, headers, 1);

  // 합계·부가세는 자동 계산 (금액 * 1.1, 합계 = 금액 + 부가세)
  // 샘플 1줄 (참고용 - 비워둬도 OK)
  sheet.getRange(2, 1, 1, headers.length).setValues([[
    new Date(), '미입금', '예시: 수만휘', '월간 마케팅 운영', '', 1500000, '=F2*0.1', '=F2+G2', '', '', ''
  ]]);

  // 자동 수식 행 100개 (G, H 자동)
  for (let r = 3; r <= 200; r++) {
    sheet.getRange(r, 7).setFormula(`=IF(F${r}="","",F${r}*0.1)`);
    sheet.getRange(r, 8).setFormula(`=IF(F${r}="","",F${r}+G${r})`);
  }

  // 컬럼 너비
  setColWidths_(sheet, [100, 90, 160, 240, 100, 110, 110, 120, 110, 90, 200]);

  // 드롭다운
  setDropdown_(sheet, 2, 2, 200, ['미입금', '입금완료', '지연']);
  addStatusConditionalFormat_(sheet, 2, 2, 200, {
    '미입금':   '#FFF3CD',
    '입금완료': STYLE.GOOD_BG,
    '지연':     STYLE.WARN_BG,
  });

  // 포맷
  setDateFormat_(sheet, 1, 2, 200);
  setDateFormat_(sheet, 5, 2, 200);
  setCurrencyFormat_(sheet, 6, 2, 200);
  setCurrencyFormat_(sheet, 7, 2, 200);
  setCurrencyFormat_(sheet, 8, 2, 200);
  setCurrencyFormat_(sheet, 9, 2, 200);

  // 합계 행 (201행)
  sheet.getRange(201, 1).setValue('합계').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 6).setFormula('=SUM(F2:F200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 7).setFormula('=SUM(G2:G200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 8).setFormula('=SUM(H2:H200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 9).setFormula('=SUM(I2:I200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);

  setupBlankRows_(sheet, 1, headers.length, 199);
  freezeAndFilter_(sheet, headers.length, 1);
}

// (Tab 7 starts below)
// ───────────────────────────────────────────────────────────────────────
//  Tab 7. 💸 지출 — 카드별 필터 가능
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab7Expenses_(ss) {
  const sheet = newSheet_(ss, '💸 지출');

  const headers = [
    '날짜', '구분', '업체명', '내용',
    '지출일', '금액', '매출세금', '합계',
    '카드', 'PM', '메모'
  ];
  applyHeaderRow_(sheet, headers, 1);

  // 자동 수식 (G = F * 0.1, H = F + G)
  for (let r = 2; r <= 200; r++) {
    sheet.getRange(r, 7).setFormula(`=IF(F${r}="","",F${r}*0.1)`);
    sheet.getRange(r, 8).setFormula(`=IF(F${r}="","",F${r}+G${r})`);
  }

  setColWidths_(sheet, [100, 110, 160, 240, 100, 110, 110, 120, 130, 90, 200]);

  // 드롭다운
  setDropdown_(sheet, 2, 2, 200, [
    '인건비', '도급비용', '거래처 결제', '사무용품', '소프트웨어',
    '광고비', '교통비', '식대', '기타', '정기지출'
  ]);
  setDropdown_(sheet, 9, 2, 200, [
    '신한딥드림', '롯데', '현대', '삼성', '하나', '기업', '카카오뱅크', '계좌이체', '현금'
  ]);

  // 포맷
  setDateFormat_(sheet, 1, 2, 200);
  setDateFormat_(sheet, 5, 2, 200);
  setCurrencyFormat_(sheet, 6, 2, 200);
  setCurrencyFormat_(sheet, 7, 2, 200);
  setCurrencyFormat_(sheet, 8, 2, 200);

  // 합계 행
  sheet.getRange(201, 1).setValue('합계').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 6).setFormula('=SUM(F2:F200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 7).setFormula('=SUM(G2:G200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(201, 8).setFormula('=SUM(H2:H200)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);

  setupBlankRows_(sheet, 1, headers.length, 199);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 8. 💳 카드 실적 관리 — 카드별 한도/실적 진행률
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab8CardPerformance_(ss) {
  const sheet = newSheet_(ss, '💳 카드 실적 관리');

  // 섹션 1 — 카드별 실적 추적
  applySubHeader_(sheet, 1, 1, 8, '💳 카드별 실적 추적');
  const headers1 = ['카드명', '월 한도', '전달 마감액', '이번달 실적', '진행률', '결제 예측', '결제일', '메모'];
  applyHeaderRow_(sheet, headers1, 2);

  const cards = [
    ['신한딥드림',   '', '', '', '', '', '25일', ''],
    ['롯데',         '', '', '', '', '', '13일', ''],
    ['현대',         '', '', '', '', '', '12일', ''],
    ['삼성',         '', '', '', '', '', '21일', ''],
    ['하나',         '', '', '', '', '', '15일', ''],
    ['기업',         '', '', '', '', '', '5일',  ''],
    ['카카오뱅크',   '', '', '', '', '', '-',    '체크카드'],
  ];
  sheet.getRange(3, 1, cards.length, headers1.length).setValues(cards);

  // 진행률 자동 (D / B)
  for (let r = 3; r <= 2 + cards.length; r++) {
    sheet.getRange(r, 5).setFormula(`=IFERROR(D${r}/B${r},"")`);
  }

  setCurrencyFormat_(sheet, 2, 3, 2 + cards.length);
  setCurrencyFormat_(sheet, 3, 3, 2 + cards.length);
  setCurrencyFormat_(sheet, 4, 3, 2 + cards.length);
  setPercentFormat_(sheet, 5, 3, 2 + cards.length);
  setCurrencyFormat_(sheet, 6, 3, 2 + cards.length);

  // 섹션 2 — 정기 결제 항목 (카드 자동출금)
  const sec2Row = 3 + cards.length + 2;
  applySubHeader_(sheet, sec2Row, 1, 8, '🔁 카드 자동출금 정기결제');
  const headers2 = ['항목', '카테고리', '카드', '금액', '결제일', '상태', '비고'];
  applyHeaderRow_(sheet, headers2, sec2Row + 1);

  const recurring = [
    ['사무실 관리비',  '관리비',  '', 150000, '매월 25일', '활성', ''],
    ['집 관리비',      '관리비',  '', 150000, '매월 25일', '활성', ''],
    ['LG 인터넷',      '통신비',  '', 28740,  '매월 15일', '활성', ''],
    ['LG 알뜰폰',      '통신비',  '', 24610,  '매월 15일', '활성', ''],
    ['KT 폰',          '통신비',  '', 82500,  '매월 15일', '활성', ''],
    ['아이폰 할부',    '통신비',  '', '',     '',          '활성', ''],
    ['클로드',         '구독료',  '', '',     '',          '활성', ''],
    ['힉스필드',       '구독료',  '', '',     '',          '활성', ''],
    ['하이아이피',     '구독료',  '', '',     '',          '활성', ''],
    ['망고보드',       '구독료',  '', '',     '',          '활성', ''],
    ['토스결제',       '구독료',  '', '',     '',          '활성', ''],
    ['주유',           '교통비',  '', '',     '',          '활성', ''],
  ];
  sheet.getRange(sec2Row + 2, 1, recurring.length, headers2.length).setValues(recurring);

  setCurrencyFormat_(sheet, 4, sec2Row + 2, sec2Row + 1 + recurring.length);
  setDropdown_(sheet, 2, sec2Row + 2, sec2Row + 1 + recurring.length, ['관리비', '통신비', '구독료', '교통비', '기타']);
  setDropdown_(sheet, 3, sec2Row + 2, sec2Row + 1 + recurring.length, ['신한딥드림', '롯데', '현대', '삼성', '하나', '기업', '카카오뱅크', '계좌이체']);
  setDropdown_(sheet, 6, sec2Row + 2, sec2Row + 1 + recurring.length, ['활성', '일시중지', '해지']);

  setColWidths_(sheet, [180, 110, 130, 130, 110, 130, 100, 200]);
  sheet.setFrozenRows(2);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 9. 📅 정기지출 — 월별 고정 지출 알림
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab9RecurringExpenses_(ss) {
  const sheet = newSheet_(ss, '📅 정기지출');

  applySubHeader_(sheet, 1, 1, 7, '📅 월별 고정 지출 (정기 결제 + 임대료 + 인건비 외 정기)');
  const headers = ['항목', '카테고리', '월 금액', '결제일', '결제 방식', '상태', '메모'];
  applyHeaderRow_(sheet, headers, 2);

  const items = [
    ['사무실 월세',    '임대료',  428000,  '매월 1일',  '계좌이체', '활성', ''],
    ['집 월세',        '임대료',  605000,  '매월 1일',  '계좌이체', '활성', ''],
    ['사무실 관리비',  '관리비',  150000,  '매월 25일', '카드',     '활성', ''],
    ['집 관리비',      '관리비',  150000,  '매월 25일', '카드',     '활성', ''],
    ['식대',           '식비',    500000,  '월 합산',   '카드/현금','활성', '월 약 50만'],
    ['LG 인터넷',      '통신비',  28740,   '매월 15일', '자동출금', '활성', ''],
    ['LG 알뜰폰',      '통신비',  24610,   '매월 15일', '자동출금', '활성', ''],
    ['KT 폰',          '통신비',  82500,   '매월 15일', '자동출금', '활성', ''],
    ['아이폰 할부',    '통신비',  '',      '매월',      '카드',     '활성', ''],
    ['클로드 구독',    '구독료',  '',      '매월',      '카드',     '활성', ''],
    ['힉스필드 구독',  '구독료',  '',      '매월',      '카드',     '활성', ''],
    ['하이아이피',     '구독료',  '',      '매월',      '카드',     '활성', ''],
    ['망고보드',       '구독료',  '',      '매월',      '카드',     '활성', ''],
    ['토스결제',       '구독료',  '',      '매월',      '카드',     '활성', ''],
  ];
  sheet.getRange(3, 1, items.length, headers.length).setValues(items);

  setCurrencyFormat_(sheet, 3, 3, 2 + items.length);

  // 합계 행
  const totalRow = 3 + items.length;
  sheet.getRange(totalRow, 1).setValue('월 정기지출 합계').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(totalRow, 3).setFormula(`=SUM(C3:C${totalRow - 1})`).setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);

  setDropdown_(sheet, 2, 3, 2 + items.length, ['임대료', '관리비', '식비', '통신비', '구독료', '교통비', '보험', '기타']);
  setDropdown_(sheet, 5, 3, 2 + items.length, ['계좌이체', '자동출금', '카드', '카드/현금']);
  setDropdown_(sheet, 6, 3, 2 + items.length, ['활성', '일시중지', '해지']);
  addStatusConditionalFormat_(sheet, 6, 3, 2 + items.length, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '해지':     '#E0E0E0',
  });

  setColWidths_(sheet, [200, 110, 130, 130, 130, 100, 240]);
  sheet.setFrozenRows(2);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 10. 👨‍💼 직원·정산 — 급여 + 외주 인력
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab10PayrollSettlement_(ss) {
  const sheet = newSheet_(ss, '👨‍💼 직원·정산');

  // 섹션 1 — 정규직 급여
  applySubHeader_(sheet, 1, 1, 7, '👨‍💼 정규직 급여');
  const headers1 = ['이름', '직책', '월 급여', '비상주 수당', '인건비 신고', '지급일', '메모'];
  applyHeaderRow_(sheet, headers1, 2);

  const payroll = [
    ['성관',  '', '', '', '', '매월', ''],
  ];
  sheet.getRange(3, 1, payroll.length, headers1.length).setValues(payroll);
  setCurrencyFormat_(sheet, 3, 3, 2 + payroll.length);
  setCurrencyFormat_(sheet, 4, 3, 2 + payroll.length);
  setDropdown_(sheet, 5, 3, 2 + payroll.length, ['신고함', '신고안함']);

  // 섹션 2 — 외주 인력 정산
  const sec2Row = 3 + payroll.length + 2;
  applySubHeader_(sheet, sec2Row, 1, 8, '🔧 외주 인력 정산');
  const headers2 = ['이름', '역할', '계산 방식', '단가', '이번달 작업량', '이번달 정산액', '지급 상태', '메모'];
  applyHeaderRow_(sheet, headers2, sec2Row + 1);

  const outsource = [
    ['민철', '배포 외주', '건당', '', '', '', '대기', ''],
  ];
  sheet.getRange(sec2Row + 2, 1, outsource.length, headers2.length).setValues(outsource);

  // 정산액 자동 (D * E)
  for (let i = 0; i < outsource.length; i++) {
    const r = sec2Row + 2 + i;
    sheet.getRange(r, 6).setFormula(`=IFERROR(D${r}*E${r},"")`);
  }
  setCurrencyFormat_(sheet, 4, sec2Row + 2, sec2Row + 1 + outsource.length);
  setCurrencyFormat_(sheet, 6, sec2Row + 2, sec2Row + 1 + outsource.length);
  setDropdown_(sheet, 3, sec2Row + 2, sec2Row + 1 + outsource.length, ['건당', '월정액', '시급', '프로젝트']);
  setDropdown_(sheet, 7, sec2Row + 2, sec2Row + 1 + outsource.length, ['대기', '지급완료', '보류']);
  addStatusConditionalFormat_(sheet, 7, sec2Row + 2, sec2Row + 1 + outsource.length, {
    '대기':     '#FFF3CD',
    '지급완료': STYLE.GOOD_BG,
    '보류':     STYLE.WARN_BG,
  });

  setColWidths_(sheet, [120, 130, 130, 110, 130, 130, 110, 200]);
  sheet.setFrozenRows(2);
}

// ╔═════════════════════════════════════════════════════════════════════╗
// ║                  마스터시트 v2 — 섹션 C: 개인 (Tab 11~12)            ║
// ╚═════════════════════════════════════════════════════════════════════╝

// ───────────────────────────────────────────────────────────────────────
//  Tab 11. 🏠 개인 가계부 — 회사 회계와 분리된 개인 지출
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab11PersonalLedger_(ss) {
  const sheet = newSheet_(ss, '🏠 개인 가계부');

  applySubHeader_(sheet, 1, 1, 7, '🏠 개인 지출 (회사와 분리)');
  const headers = ['날짜', '카테고리', '내용', '금액', '결제수단', '카드', '메모'];
  applyHeaderRow_(sheet, headers, 2);

  // 샘플 1줄
  sheet.getRange(3, 1, 1, headers.length).setValues([[
    new Date(), '쇼핑', '예시: 옷', 50000, '카드', '신한딥드림', ''
  ]]);

  setColWidths_(sheet, [100, 110, 240, 110, 110, 130, 200]);

  setDropdown_(sheet, 2, 3, 300, [
    '식대', '쇼핑', '운동', '영양제', '여행', '교통', '의료',
    '취미', '경조사', '미용', '기타'
  ]);
  setDropdown_(sheet, 5, 3, 300, ['카드', '계좌이체', '현금', '간편결제']);
  setDropdown_(sheet, 6, 3, 300, ['신한딥드림', '롯데', '현대', '삼성', '하나', '기업', '카카오뱅크', '-']);

  setDateFormat_(sheet, 1, 3, 300);
  setCurrencyFormat_(sheet, 4, 3, 300);

  // 합계 행 (300 + 1)
  sheet.getRange(301, 1).setValue('월 합계').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);
  sheet.getRange(301, 4).setFormula('=SUM(D3:D300)').setNumberFormat('#,##0"원"').setFontWeight('bold').setBackground(STYLE.SUBHEAD_BG);

  setupBlankRows_(sheet, 2, headers.length, 297);
  freezeAndFilter_(sheet, headers.length, 2);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 12. 🔐 계정·잔액·채무 — 카드 잔액, 채무 관계
// ───────────────────────────────────────────────────────────────────────
function buildMasterTab12AccountsAndDebt_(ss) {
  const sheet = newSheet_(ss, '🔐 계정·잔액·채무');

  // 경고 배너
  sheet.getRange('A1:F1').merge()
       .setValue('⚠️ 비밀번호는 여기 두지 말고 별도 비밀번호 관리자(Bitwarden 등) 사용 권장')
       .setBackground(STYLE.WARN_BG)
       .setFontWeight('bold')
       .setFontColor('#A03030')
       .setHorizontalAlignment('center')
       .setFontFamily(STYLE.FONT);
  sheet.setRowHeight(1, 32);

  // 섹션 1 — 카드/계좌 잔액
  applySubHeader_(sheet, 3, 1, 6, '💳 카드/계좌 잔액 추적');
  const headers1 = ['이름', '종류', '한도/잔액', '현재 사용액', '여유 금액', '메모'];
  applyHeaderRow_(sheet, headers1, 4);

  const accounts = [
    ['신한딥드림',   '신용카드', '', '', '', ''],
    ['롯데',         '신용카드', '', '', '', ''],
    ['현대',         '신용카드', '', '', '', ''],
    ['삼성',         '신용카드', '', '', '', ''],
    ['하나',         '신용카드', '', '', '', ''],
    ['기업',         '신용카드', '', '', '', ''],
    ['카카오뱅크',   '체크카드', '', '', '', ''],
  ];
  sheet.getRange(5, 1, accounts.length, headers1.length).setValues(accounts);

  // 여유 = 한도 - 사용
  for (let r = 5; r <= 4 + accounts.length; r++) {
    sheet.getRange(r, 5).setFormula(`=IFERROR(C${r}-D${r},"")`);
  }
  setCurrencyFormat_(sheet, 3, 5, 4 + accounts.length);
  setCurrencyFormat_(sheet, 4, 5, 4 + accounts.length);
  setCurrencyFormat_(sheet, 5, 5, 4 + accounts.length);
  setDropdown_(sheet, 2, 5, 4 + accounts.length, ['신용카드', '체크카드', '예금계좌', '적금', '대출']);

  // 섹션 2 — 채무 관계
  const sec2Row = 5 + accounts.length + 2;
  applySubHeader_(sheet, sec2Row, 1, 6, '🤝 채무 관계 (받을 돈 / 줄 돈)');
  const headers2 = ['이름', '구분', '금액', '발생일', '상환 예정일', '메모'];
  applyHeaderRow_(sheet, headers2, sec2Row + 1);

  const debts = [
    ['희건',  '받을 돈', '', '', '', ''],
    ['친구',  '줄 돈',   '', '', '', ''],
  ];
  sheet.getRange(sec2Row + 2, 1, debts.length, headers2.length).setValues(debts);
  setCurrencyFormat_(sheet, 3, sec2Row + 2, sec2Row + 1 + debts.length);
  setDateFormat_(sheet, 4, sec2Row + 2, sec2Row + 1 + debts.length);
  setDateFormat_(sheet, 5, sec2Row + 2, sec2Row + 1 + debts.length);
  setDropdown_(sheet, 2, sec2Row + 2, sec2Row + 1 + debts.length, ['받을 돈', '줄 돈', '완료']);
  addStatusConditionalFormat_(sheet, 2, sec2Row + 2, sec2Row + 1 + debts.length, {
    '받을 돈': '#FFF3CD',
    '줄 돈':   STYLE.WARN_BG,
    '완료':    STYLE.GOOD_BG,
  });

  setColWidths_(sheet, [140, 120, 130, 130, 130, 240]);
}

// ═══════════════════════════════════════════════════════════════════════
//  🚀 마스터시트 v2 메인 — 12개 탭 한 번에 생성
// ═══════════════════════════════════════════════════════════════════════
function createMasterSheetV2() {
  const filename = '[나만보기] CC컴퍼니 마스터시트 v2';
  const ss = SpreadsheetApp.create(filename);
  const defaultSheet = ss.getSheets()[0];

  // 탭 순서대로 생성 (Tab 3 → Tab 6/7 참조 수식이 있으므로 매출/지출 시트가 먼저 있어야 안전)
  // 그래도 createMasterSheetV2 종료 시점에 모두 존재하므로 순서는 가시성 위주
  buildMasterTab1Dashboard_(ss);
  buildMasterTab2SheetIndex_(ss);
  buildMasterTab3AdvertiserMaster_(ss);
  buildMasterTab4Vendors_(ss);
  buildMasterTab5Templates_(ss);
  buildMasterTab6Revenue_(ss);
  buildMasterTab7Expenses_(ss);
  buildMasterTab8CardPerformance_(ss);
  buildMasterTab9RecurringExpenses_(ss);
  buildMasterTab10PayrollSettlement_(ss);
  buildMasterTab11PersonalLedger_(ss);
  buildMasterTab12AccountsAndDebt_(ss);

  // 기본 "Sheet1" 제거
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  // 첫 화면을 대시보드로
  const dashboard = ss.getSheetByName('🏠 대시보드');
  if (dashboard) ss.setActiveSheet(dashboard);

  const url = ss.getUrl();
  Logger.log('✅ 마스터시트 v2 생성 완료');
  Logger.log('파일명: ' + filename);
  Logger.log('URL: ' + url);
  return url;
}

// ╔═════════════════════════════════════════════════════════════════════╗
// ║                  📦 광고주 보고 통합시트 — 8개 탭                    ║
// ╚═════════════════════════════════════════════════════════════════════╝

// ───────────────────────────────────────────────────────────────────────
//  Tab 1. 📊 종합 대시보드 — 모든 활성 광고주 한 줄씩 (상품별 그룹)
// ───────────────────────────────────────────────────────────────────────
function buildReportTab1Dashboard_(ss) {
  const sheet = newSheet_(ss, '📊 종합 대시보드');

  const headers = [
    '광고주명', '상품', '담당PM', '상태',
    '이번달 작업량', '누적 작업량', '이번달 매출',
    '다음 액션', '개별시트 링크'
  ];
  applyHeaderRow_(sheet, headers, 1);

  // 모든 활성 광고주 (상품별 정렬)
  const rows = [
    // 브랜드블로그
    ['아우디',         '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['랜드로버',       '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['벤츠 (박관용)',  '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['벤츠 (강명재)',  '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['셀앤수',         '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['EL엘린어학원',   '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['육아블로그',     '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['태아보험',       '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    ['부싼카',         '브랜드블로그',  '', '활성',     '', '', '', '', ''],
    // 체험단
    ['프랑켄',         '체험단',        '', '활성',     '', '', '', '', ''],
    ['벨라르셀',       '체험단',        '', '활성',     '', '', '', '', ''],
    ['다래',           '체험단',        '', '활성',     '', '', '', '', ''],
    ['본디',           '체험단',        '', '활성',     '', '', '', '', ''],
    ['365봄',          '체험단',        '', '활성',     '', '', '', '', ''],
    ['하늘체',         '체험단',        '', '활성',     '', '', '', '', ''],
    ['코스메르나',     '체험단',        '', '활성',     '', '', '', '', ''],
    ['베리웰',         '체험단',        '', '활성',     '', '', '', '', ''],
    ['솔담',           '체험단',        '', '활성',     '', '', '', '', ''],
    ['다이즐',         '체험단',        '', '활성',     '', '', '', '', ''],
    ['다담',           '체험단',        '', '활성',     '', '', '', '', ''],
    // 상위노출
    ['웨이브히어링',   '상위노출',      '', '활성',     '', '', '', '', ''],
    // 공구
    ['리즈메디',       '공구',          '', '활성',     '', '', '', '', ''],
    ['모어그린',       '공구',          '', '활성',     '', '', '', '', ''],
    ['에어리스노우',   '공구',          '', '활성',     '', '', '', '', ''],
    ['제이앤씨',       '공구',          '', '활성',     '', '', '', '', ''],
    ['오하이오',       '공구',          '', '활성',     '', '', '', '', ''],
    // 통합
    ['수만휘',         '통합',          '', '활성',     '', '', '', '', ''],
    ['한우전',         '통합',          '', '활성',     '', '', '', '', ''],
    ['호텔분양',       '통합',          '', '활성',     '', '', '', '', ''],
    ['카통령',         '통합',          '', '활성',     '', '', '', '', ''],
    ['디에스오토',     '통합',          '', '활성',     '', '', '', '', ''],
    ['도그마루',       '통합',          '', '활성',     '', '', '', '', ''],
    ['스포애니',       '통합',          '', '활성',     '', '', '', '', ''],
    ['세븐디테일링',   '통합',          '', '일시중지', '', '', '', '', ''],
    ['스캇나인',       '통합',          '', '일시중지', '', '', '', '', ''],
    ['우리집홈케어',   '통합',          '', '활성',     '', '', '', '', ''],
    // 배포
    ['프랑켄 (배포)',  '배포',          '', '활성',     '', '', '', '', ''],
    ['도그마루 (배포)','배포',          '', '활성',     '', '', '', '', ''],
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 110, 90, 90, 110, 110, 130, 240, 240]);

  setDropdown_(sheet, 2, 2, 200, ['브랜드블로그', '체험단', '상위노출', '공구', '통합', '배포']);
  setDropdown_(sheet, 4, 2, 200, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 200, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });
  setCurrencyFormat_(sheet, 7, 2, 200);

  setupBlankRows_(sheet, 1, headers.length, 200 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 2. 📝 브랜드블로그 — 발행 건수, 노출지수 추적
// ───────────────────────────────────────────────────────────────────────
function buildReportTab2BrandBlog_(ss) {
  const sheet = newSheet_(ss, '📝 브랜드블로그');

  const headers = [
    '광고주명', '시작일', '담당PM', '상태',
    '이번달 발행 건수', '누적 발행 건수', '평균 노출지수',
    '이번달 매출', '누적 매출', '미수금',
    '다음 액션', '개별시트 링크', '비고'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['아우디',         '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['랜드로버',       '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['벤츠 (박관용)',  '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['벤츠 (강명재)',  '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['셀앤수',         '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['EL엘린어학원',   '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['육아블로그',     '', '', '활성', '', '', '', '', '', '', '', '', '광고주 시트'],
    ['태아보험',       '', '', '활성', '', '', '', '', '', '', '', '', ''],
    ['부싼카',         '', '', '활성', '', '', '', '', '', '', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 100, 90, 90, 110, 110, 110, 130, 130, 110, 240, 240, 200]);

  setDropdown_(sheet, 4, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });

  setDateFormat_(sheet, 2, 2, 100);
  setCurrencyFormat_(sheet, 8, 2, 100);
  setCurrencyFormat_(sheet, 9, 2, 100);
  setCurrencyFormat_(sheet, 10, 2, 100);

  // 미수금 빨간색
  const rules = sheet.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($J2>0,$J2<>"")')
      .setBackground(STYLE.WARN_BG)
      .setRanges([sheet.getRange('J2:J100')])
      .build()
  );
  sheet.setConditionalFormatRules(rules);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 3. 🎁 체험단 — 모집/발행/완료율 추적
// ───────────────────────────────────────────────────────────────────────
function buildReportTab3Experience_(ss) {
  const sheet = newSheet_(ss, '🎁 체험단');

  const headers = [
    '광고주명', '시작일', '담당PM', '상태',
    '캠페인 종류', '이번달 모집 건수', '이번달 발행 건수', '완료율',
    '단가(회당)', '이번달 매출', '누적 매출',
    '다음 회차 일정', '개별시트 링크', '비고'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['프랑켄',     '', '', '활성', '배송', '', '', '', '', '', '', '', '', ''],
    ['벨라르셀',   '', '', '활성', '배송', '', '', '', '', '', '', '', '', ''],
    ['한우전',     '', '', '활성', '배송', '', '', '', '', '', '', '', '', ''],
    ['다래',       '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['본디',       '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['365봄',      '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['하늘체',     '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['코스메르나', '', '', '활성', '배송', '', '', '', '', '', '', '', '', '뷰티'],
    ['베리웰',     '', '', '활성', '배송', '', '', '', '', '', '', '', '', '뷰티'],
    ['솔담',       '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['다이즐',     '', '', '활성', '배송', '', '', '', '', '', '', '', '', '뷰티'],
    ['다담',       '', '', '활성', '방문', '', '', '', '', '', '', '', '', '한방'],
    ['187라벨',    '', '', '활성', '배송', '', '', '', '', '', '', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // 완료율 자동 (G/F)
  for (let i = 0; i < rows.length; i++) {
    const r = i + 2;
    sheet.getRange(r, 8).setFormula(`=IFERROR(G${r}/F${r},"")`);
  }

  setColWidths_(sheet, [140, 100, 90, 90, 110, 110, 110, 90, 110, 130, 130, 130, 240, 200]);

  setDropdown_(sheet, 4, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });
  setDropdown_(sheet, 5, 2, 100, ['방문', '배송', '방문/배송 혼합']);

  setDateFormat_(sheet, 2, 2, 100);
  setDateFormat_(sheet, 12, 2, 100);
  setPercentFormat_(sheet, 8, 2, 100);
  setCurrencyFormat_(sheet, 9, 2, 100);
  setCurrencyFormat_(sheet, 10, 2, 100);
  setCurrencyFormat_(sheet, 11, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// (Tab 4 starts below)
// ───────────────────────────────────────────────────────────────────────
//  Tab 4. 🔝 상위노출 — 키워드/순위 추적
// ───────────────────────────────────────────────────────────────────────
function buildReportTab4TopExposure_(ss) {
  const sheet = newSheet_(ss, '🔝 상위노출');

  const headers = [
    '광고주명', '시작일', '담당PM', '상태',
    '등록 키워드 수', '1위 노출 키워드', '평균 순위',
    '이번달 작업', '이번달 매출', '개별시트 링크'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['웨이브히어링',  '', '', '활성', '', '', '', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 100, 90, 90, 130, 130, 110, 130, 130, 240]);

  setDropdown_(sheet, 4, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });

  setDateFormat_(sheet, 2, 2, 100);
  setCurrencyFormat_(sheet, 9, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 5. 🛒 공동구매 — 인플루언서, 매출, 마진율
// ───────────────────────────────────────────────────────────────────────
function buildReportTab5GroupBuying_(ss) {
  const sheet = newSheet_(ss, '🛒 공동구매');

  const headers = [
    '광고주명', '시작일', '담당PM', '상태',
    '진행 인플루언서 수', '이번달 매출액', '마진율',
    '정산 상태', '다음 회차', '개별시트 링크'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['리즈메디',     '', '', '활성', '', '', '', '대기', '', ''],
    ['모어그린',     '', '', '활성', '', '', '', '대기', '', ''],
    ['에어리스노우', '', '', '활성', '', '', '', '대기', '', ''],
    ['제이앤씨',     '', '', '활성', '', '', '', '대기', '', ''],
    ['오하이오',     '', '', '활성', '', '', '', '대기', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 100, 90, 90, 130, 130, 90, 110, 130, 240]);

  setDropdown_(sheet, 4, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });
  setDropdown_(sheet, 8, 2, 100, ['대기', '진행중', '완료', '지연']);
  addStatusConditionalFormat_(sheet, 8, 2, 100, {
    '대기':   '#FFF3CD',
    '진행중': '#D5E8F0',
    '완료':   STYLE.GOOD_BG,
    '지연':   STYLE.WARN_BG,
  });

  setDateFormat_(sheet, 2, 2, 100);
  setDateFormat_(sheet, 9, 2, 100);
  setCurrencyFormat_(sheet, 6, 2, 100);
  setPercentFormat_(sheet, 7, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// (Tab 6 starts below)
// ───────────────────────────────────────────────────────────────────────
//  Tab 6. 🎯 통합 마케팅 — 다중 서비스 광고주
// ───────────────────────────────────────────────────────────────────────
function buildReportTab6Integrated_(ss) {
  const sheet = newSheet_(ss, '🎯 통합 마케팅');

  const headers = [
    '광고주명', '시작일', '담당PM', '상태',
    '진행 서비스', '이번달 매출', '누적 매출', '미수금',
    '다음 액션', '개별시트 링크', '비고'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['수만휘',         '', '', '활성',     '블로그+체험단+상위노출', '', '', '', '', '', ''],
    ['한우전',         '', '', '활성',     '블로그+체험단',          '', '', '', '', '', ''],
    ['호텔분양',       '', '', '활성',     '블로그+체험단',          '', '', '', '', '', 'TF'],
    ['부싼카',         '', '', '활성',     '블로그',                 '', '', '', '', '', ''],
    ['카통령',         '', '', '활성',     '블로그+상위노출',        '', '', '', '', '', ''],
    ['디에스오토',     '', '', '활성',     '블로그+체험단',          '', '', '', '', '', ''],
    ['도그마루',       '', '', '활성',     '배포',                   '', '', '', '', '', '가온 협업'],
    ['스포애니',       '', '', '활성',     '블로그+체험단',          '', '', '', '', '', ''],
    ['세븐디테일링',   '', '', '일시중지', '',                       '', '', '', '', '', '2024.07~ 미수정'],
    ['스캇나인',       '', '', '일시중지', '',                       '', '', '', '', '', '2025.01~ 미수정'],
    ['닥터하우징',     '', '', '종료',     '',                       '', '', '', '', '', '2023 종료'],
    ['우리집홈케어',   '', '', '활성',     '',                       '', '', '', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 100, 90, 90, 220, 130, 130, 110, 240, 240, 200]);

  setDropdown_(sheet, 4, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 4, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });

  setDateFormat_(sheet, 2, 2, 100);
  setCurrencyFormat_(sheet, 6, 2, 100);
  setCurrencyFormat_(sheet, 7, 2, 100);
  setCurrencyFormat_(sheet, 8, 2, 100);

  // 미수금 빨간색
  const rules = sheet.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($H2>0,$H2<>"")')
      .setBackground(STYLE.WARN_BG)
      .setRanges([sheet.getRange('H2:H100')])
      .build()
  );
  sheet.setConditionalFormatRules(rules);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 7. 📤 건배포·수급 — 최적화블로그 배포 받는 광고주
// ───────────────────────────────────────────────────────────────────────
function buildReportTab7Distribution_(ss) {
  const sheet = newSheet_(ss, '📤 건배포·수급');

  const headers = [
    '광고주명', '거래처', '상태',
    '이번달 배포 건수', '평균 단가', '매출', '정산일',
    '개별시트 링크'
  ];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['프랑켄',     'CC 직접', '활성', '', '', '', '', ''],
    ['도그마루',   '가온 협업', '활성', '', '', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 140, 90, 130, 110, 130, 110, 240]);

  setDropdown_(sheet, 3, 2, 100, ['활성', '일시중지', '종료']);
  addStatusConditionalFormat_(sheet, 3, 2, 100, {
    '활성':     STYLE.GOOD_BG,
    '일시중지': '#FFF3CD',
    '종료':     '#FFE0E0',
  });

  setCurrencyFormat_(sheet, 5, 2, 100);
  setCurrencyFormat_(sheet, 6, 2, 100);
  setDateFormat_(sheet, 7, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ───────────────────────────────────────────────────────────────────────
//  Tab 8. 📞 영업톡 모음 — 자주 쓰는 메시지 복붙용
// ───────────────────────────────────────────────────────────────────────
function buildReportTab8SalesScripts_(ss) {
  const sheet = newSheet_(ss, '📞 영업톡 모음');

  const headers = ['용도', '멘트 종류', '본문', '마지막 수정'];
  applyHeaderRow_(sheet, headers, 1);

  const rows = [
    ['거래처 영업톡',     '체험단 소개',           '(여기에 본문 붙여넣기)', ''],
    ['리뷰어 모집톡',     '한방 캠페인 모집',       '', ''],
    ['리뷰어 모집톡',     '뷰티 캠페인 모집',       '', ''],
    ['리뷰어 모집톡',     '배송형 캠페인 모집',     '', ''],
    ['리뷰어 모집톡',     '방문형 캠페인 모집',     '', ''],
    ['리뷰어 안내',       '선정 안내',             '', ''],
    ['리뷰어 안내',       '발행 가이드',           '', ''],
    ['리뷰어 안내',       '미발행 리마인드',        '', ''],
    ['거래처 영업톡',     '브랜드블로그 제안',      '', ''],
    ['거래처 영업톡',     '상위노출 제안',          '', ''],
    ['거래처 영업톡',     '공구 제안',              '', ''],
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  setColWidths_(sheet, [140, 180, 600, 110]);

  setDropdown_(sheet, 1, 2, 100, ['거래처 영업톡', '리뷰어 모집톡', '리뷰어 안내', '광고주 보고 멘트', '기타']);

  // 본문 셀 wrap
  sheet.getRange(2, 3, 99, 1).setWrap(true).setVerticalAlignment('top');

  setDateFormat_(sheet, 4, 2, 100);

  setupBlankRows_(sheet, 1, headers.length, 100 - rows.length);
  freezeAndFilter_(sheet, headers.length, 1);
}

// ═══════════════════════════════════════════════════════════════════════
//  🚀 광고주 보고 통합시트 메인 — 8개 탭 한 번에 생성
// ═══════════════════════════════════════════════════════════════════════
function createAdvertiserReportSheet() {
  const filename = '[CC] 광고주 보고 통합시트';
  const ss = SpreadsheetApp.create(filename);
  const defaultSheet = ss.getSheets()[0];

  buildReportTab1Dashboard_(ss);
  buildReportTab2BrandBlog_(ss);
  buildReportTab3Experience_(ss);
  buildReportTab4TopExposure_(ss);
  buildReportTab5GroupBuying_(ss);
  buildReportTab6Integrated_(ss);
  buildReportTab7Distribution_(ss);
  buildReportTab8SalesScripts_(ss);

  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  // 첫 화면을 종합 대시보드로
  const dashboard = ss.getSheetByName('📊 종합 대시보드');
  if (dashboard) ss.setActiveSheet(dashboard);

  const url = ss.getUrl();
  Logger.log('✅ 광고주 보고 통합시트 생성 완료');
  Logger.log('파일명: ' + filename);
  Logger.log('URL: ' + url);
  return url;
}

// ═══════════════════════════════════════════════════════════════════════
//  🎬 두 시트 한 번에 생성 (메인 진입점)
// ═══════════════════════════════════════════════════════════════════════
function createBothSheets() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🚀 CC컴퍼니 시트 개편 — 신규 시트 2개 생성 시작');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const masterUrl = createMasterSheetV2();
  Logger.log('');
  const reportUrl = createAdvertiserReportSheet();

  Logger.log('');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🎉 완료! 두 시트 모두 드라이브 루트에 생성됨');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 [나만보기] CC컴퍼니 마스터시트 v2');
  Logger.log('   ' + masterUrl);
  Logger.log('');
  Logger.log('📊 [CC] 광고주 보고 통합시트');
  Logger.log('   ' + reportUrl);
  Logger.log('');
  Logger.log('💡 다음 단계:');
  Logger.log('   1. 두 시트 열어서 확인');
  Logger.log('   2. 마음에 들면 천천히 데이터 옮겨붙이기');
  Logger.log('   3. 옛 마스터시트와 병행 운영');
  Logger.log('   4. 피드백 주면 추가 조정');

  return { master: masterUrl, report: reportUrl };
}













