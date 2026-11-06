/**
 * 노아 스토어 — 나이스페이 결제 (Server 승인 모델 · Basic 인증)
 * Apps Script 프로젝트 '노아폼 백엔드'에 Code.gs와 나란히 두는 파일입니다. 통째로 붙여 넣어도 됩니다.
 * 근거: github.com/nicepayments/nicepay-manual — api/payment-window-server.md, api/cancel.md
 *
 *  흐름: 상점 결제창 → nicepay-prepare(서버가 가격표로 금액 확정·주문 READY 기록)
 *        → 나이스페이 결제창(AUTHNICE.requestPay) → returnUrl(이 웹앱 ?action=nicepay-return, 폼 POST)
 *        → 주문·금액·clientId·signature 대조 → 승인 API → 승인 응답 재검증 → Orders 기록 + 알림·영수증 메일
 *        → 사이트 pay-result.html 로 이동. 승인 응답이 없으면 망취소, 응답이 어긋나면 자동 취소.
 *  Code.gs와 연결되는 곳: doPost(?action=nicepay-return, type:'nicepay-prepare'), doGet(?action=pay-status)
 *  Code.gs에서 빌려 쓰는 것: jsonResponse_, logEvent_, getOrCreateOrderSheet_, sanitizeCell_, sanitizeHeader_,
 *                            maskPhone_, maskEmail_, notifyAdminAlert_, EMAIL_RE
 *
 *  스크립트 속성(⚙ 프로젝트 설정 → 스크립트 속성):
 *       • NICEPAY_MODE                 = off | sandbox | live   (없으면 off = 결제 닫힘, 화면은 주문서로 대체)
 *       • NICEPAY_SANDBOX_SECRET_KEY   = 테스트 상점 시크릿 키      ← 대표님 직접 입력
 *       • NICEPAY_LIVE_SECRET_KEY      = 운영 상점 시크릿 키        ← 대표님 직접 입력
 *       • NICEPAY_TEST_TOKEN           = sandbox 시험 암호. shop.html?paytest=값 으로 연 탭만 결제창 사용
 *       • (선택) NICEPAY_SANDBOX_CLIENT_KEY / NICEPAY_LIVE_CLIENT_KEY — 아래 NICEPAY_CLIENT_KEYS 대신 쓸 때
 *  가격표: apps-script/shop-catalog.json → python3 .claude/build/catalog/build_catalog.py 가 아래 SHOP_CATALOG를 갱신
 */

// ── 고정값 ─────────────────────────────────────────────────────
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
const NP_SITE_URL = 'https://noahgroup.co.kr';
const NP_ORDER_ID_RE = /^NOAH-\d{14}-[0-9a-f]{8}$/;

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

// 나이스페이 설정 — 스크립트 속성(대표님이 직접 입력)에서 읽는다. 시크릿 키는 코드·저장소에 두지 않는다.
function nicepayCfg_() {
  const p = PropertiesService.getScriptProperties();
  const g = (k) => String(p.getProperty(k) || '').trim();
  return {
    MODE: (g('NICEPAY_MODE') || 'off').toLowerCase(),   // off | sandbox | live
    TEST_TOKEN: g('NICEPAY_TEST_TOKEN'),
    KEYS: {
      sandbox: { clientId: g('NICEPAY_SANDBOX_CLIENT_KEY') || NICEPAY_CLIENT_KEYS.sandbox, secret: g('NICEPAY_SANDBOX_SECRET_KEY') },
      live:    { clientId: g('NICEPAY_LIVE_CLIENT_KEY')    || NICEPAY_CLIENT_KEYS.live,    secret: g('NICEPAY_LIVE_SECRET_KEY') },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  나이스페이 결제 (Server 승인 모델 · Basic 인증)
//  근거: github.com/nicepayments/nicepay-manual — api/payment-window-server.md, api/cancel.md
// ═══════════════════════════════════════════════════════════════════════
const SHOP_MAX_AMOUNT = 10000000;
const NP_COLS = 14;   // Orders 시트: 기존 12칸 + 주문정보(JSON) + 모드

// 지금 결제를 받을 수 있는 모드. 키가 모자라면 'off'(화면은 주문서로 대체).
function nicepayActiveMode_(np) {
  const m = np.MODE;
  if (m !== 'sandbox' && m !== 'live') return 'off';
  const k = np.KEYS[m];
  if (!k || !k.clientId || !k.secret) return 'off';
  if (m === 'sandbox' && !np.TEST_TOKEN) return 'off';
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
  const np = nicepayCfg_();
  const mode = nicepayActiveMode_(np);
  if (mode === 'off') return jsonResponse_({ ok: false, error: 'closed' });
  if (mode === 'sandbox' && !safeEqual_(String(data.testToken || ''), np.TEST_TOKEN)) {
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

  const keys = np.KEYS[mode];
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
    return nicepayResultPage_('fail', { code: 'error', orderId: NP_ORDER_ID_RE.test(String(p.orderId || '')) ? p.orderId : '' });
  }
}

function nicepayReturnInner_(p, cfg) {
  const orderId = String(p.orderId || '');
  if (!NP_ORDER_ID_RE.test(orderId)) return nicepayResultPage_('fail', { code: 'unknown' });
  const o = findNicepayOrder_(orderId);
  if (!o || !o.intent) return nicepayResultPage_('fail', { code: 'unknown', orderId: orderId });
  const it = o.intent;
  const back = { orderId: orderId, amount: it.amount, product: it.product, option: it.option };
  if (o.status === 'PAID') return nicepayResultPage_('ok', back);                 // 새로고침·중복 전송
  if (o.status !== 'READY') return nicepayResultPage_('fail', Object.assign({ code: 'done' }, back));

  const keys = nicepayCfg_().KEYS[it.mode];
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

function npEscapeHtml_(s) {   // Code.gs의 escapeHtml_와 이름이 겹치지 않게 따로 둠
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtWon_(n) { return new Intl.NumberFormat('ko-KR').format(Number(n) || 0); }
function orderFormUrl_(it, orderId) {
  return NP_SITE_URL + '/shop.html?order=' + encodeURIComponent(it.product + ':' + it.option) + '&oid=' + encodeURIComponent(orderId);
}

// 결과 화면 — 사이트 pay-result.html 로 보낸다. 자동 이동이 막히면 버튼으로.
function nicepayResultPage_(result, info) {
  const q = ['r=' + (result === 'ok' ? 'ok' : 'fail')];
  if (info.orderId) q.push('o=' + encodeURIComponent(info.orderId));
  if (info.amount) q.push('a=' + encodeURIComponent(String(info.amount)));
  if (info.product) q.push('p=' + encodeURIComponent(info.product + ':' + info.option));
  if (info.code) q.push('c=' + encodeURIComponent(info.code));
  if (info.msg) q.push('m=' + encodeURIComponent(info.msg));
  const url = NP_SITE_URL + '/pay-result.html?' + q.join('&');
  const ok = result === 'ok';
  const title = ok ? '결제가 완료됐습니다' : '결제가 완료되지 않았습니다';
  const desc = ok ? '영수증은 입력하신 이메일로 보내드렸습니다. 아래 버튼을 누르면 노아로 돌아갑니다.'
                  : (info.msg ? npEscapeHtml_(info.msg) : '결제가 진행되지 않았습니다. 다시 시도하시거나 010-6658-6482로 연락 주세요.');
  const html =
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><base target="_top">' +
    '<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#0f0d0a;color:#f3ead8;display:flex;min-height:100vh;align-items:center;justify-content:center}' +
    '.b{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:22px;margin:0 0 12px;color:' + (ok ? '#d9b97c' : '#f0a58a') + '}p{font-size:15px;line-height:1.6;color:#cfc4ad;margin:0 0 24px}' +
    'a{display:inline-block;padding:14px 28px;border-radius:10px;background:#c2a36b;color:#1a140b;font-weight:700;text-decoration:none}</style></head><body>' +
    '<div class="b"><h1>' + title + '</h1><p>' + desc + '</p>' +
    '<a href="' + npEscapeHtml_(url) + '" target="_top">노아로 돌아가기 →</a></div>' +
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
    '취소·환불 정책: ' + NP_SITE_URL + '/terms.html#refund',
    '',
    '— 노아 · 010-6658-6482',
  ].join('\n');
  MailApp.sendEmail({ to: sanitizeHeader_(buyer.email), subject: subject, body: body });
}
