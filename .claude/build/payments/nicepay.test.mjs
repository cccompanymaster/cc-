// Code.gs + Nicepay.gs 나이스페이 결제 로직 시험 — Google 서비스(시트·캐시·UrlFetch·메일)를 흉내 내고 실제 Code.gs를 그대로 실행합니다.
// 실행: node --test .claude/build/payments/nicepay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// Apps Script는 프로젝트의 .gs 파일들을 한 전역으로 실행한다 — Code.gs + Nicepay.gs 를 이어 붙여 같은 조건으로 시험
const CODE = ['Code.gs', 'Nicepay.gs'].map((f) => fs.readFileSync(path.join(ROOT, 'apps-script', f), 'utf8')).join('\n');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-script/shop-catalog.json'), 'utf8'));

const SANDBOX_CLIENT = 'S2_testclientkey000000000000000000';
const SECRET = 'testsecretkey0000000000000000000';
const TOKEN = 'paytest-123';
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// ── 가짜 Google 서비스 ───────────────────────────────────────────────────
class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  row(i) { while (this.sh.rows.length < i) this.sh.rows.push([]); return this.sh.rows[i - 1]; }
  getValue() { return (this.sh.rows[this.r - 1] || [])[this.c - 1] ?? ''; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sh.rows[this.r - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] ?? ''));
    }
    return out;
  }
  setValue(v) { this.row(this.r)[this.c - 1] = v; return this; }
  setValues(vs) { vs.forEach((rv, i) => rv.forEach((v, j) => { this.row(this.r + i)[this.c - 1 + j] = v; })); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
  createTextFinder(text) {
    const sh = this.sh; let whole = false;
    return {
      matchEntireCell(b) { whole = b; return this; },
      findNext() {
        for (let i = 0; i < sh.rows.length; i++) {
          const v = String(sh.rows[i][2] ?? '');
          if (whole ? v === text : v.includes(text)) return { getRow: () => i + 1 };
        }
        return null;
      },
    };
  }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.maxCols = 12; }
  appendRow(a) { this.rows.push(a.slice()); this.maxCols = Math.max(this.maxCols, a.length); }
  setFrozenRows() {} setColumnWidth() {}
  getLastRow() { return this.rows.length; }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return a === 'C:C' ? new Range(this, 1, 3, 1e6, 1) : new Range(this, 1, 1, 1, 12);
    return new Range(this, a, b, c || 1, d || 1);
  }
}

function makeEnv({ props = {}, fetch } = {}) {
  const sheets = {}, cache = new Map(), mails = [], fetches = [], logs = [];
  const ctx = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => (sheets[n] = new Sheet(n)),
    }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, v) => [...crypto.createHash('sha256').update(String(v), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (s) => Buffer.from(String(s), 'utf8').toString('base64'),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64url'),
      formatDate: (d) => d.toISOString().replace(/\D/g, '').slice(0, 14),
      getUuid: () => crypto.randomUUID(),
      newBlob() {}, base64Decode() {},
    },
    UrlFetchApp: {
      fetch(url, opts) {
        fetches.push({ url, opts });
        const r = fetch ? fetch(url, opts) : { code: 500, body: '{}' };
        if (r instanceof Error) throw r;
        return { getResponseCode: () => r.code, getContentText: () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) };
      },
    },
    MailApp: { sendEmail: (o) => mails.push(o) },
    HtmlService: { createHtmlOutput: (html) => ({ html, setTitle() { return this; }, addMetaTag() { return this; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) },
    Logger: { log: (s) => logs.push(s) },
    DriveApp: {},
  };
  vm.createContext(ctx);
  const api = vm.runInContext(CODE + '\n;({ doPost, doGet, computeQuote_, sha256Hex_, SHOP_CATALOG, trimBytes_ })', ctx);
  return { api, sheets, cache, mails, fetches, logs };
}

const SANDBOX_PROPS = {
  NICEPAY_MODE: 'sandbox', NICEPAY_SANDBOX_CLIENT_KEY: SANDBOX_CLIENT, NICEPAY_SANDBOX_SECRET_KEY: SECRET,
  NICEPAY_TEST_TOKEN: TOKEN, NOTIFY_EMAIL: 'admin@example.com',
};
const json = (out) => JSON.parse(out.text);
const prepareBody = (over = {}) => ({
  type: 'nicepay-prepare', origin: 'https://noahgroup.co.kr', testToken: TOKEN,
  product: 'brand-run', option: 'premium', qty: 2, extras: ['skin', 'thumb'], method: 'cardAndEasyPay',
  buyer: { name: '홍길동', phone: '010-1234-5678', email: 'buyer@example.com', memo: '빠른 진행 부탁' },
  agree: { privacy: true, refund: true, order: true },
  amount: 100, // 화면이 보낸 금액 — 서버는 무시해야 함
  ...over,
});
const post = (env, body) => env.api.doPost({ postData: { contents: JSON.stringify(body) }, parameter: {} });
const ret = (env, params) => env.api.doPost({ parameter: { action: 'nicepay-return', ...params }, postData: { contents: '' } });
function authParams(prep, over = {}) {
  const amount = String(over.amount ?? prep.amount);
  const authToken = 'NICEUNTT' + crypto.randomBytes(8).toString('hex').toUpperCase();
  return { authResultCode: '0000', authResultMsg: '인증 성공', tid: 'UT0000113m01012111051714341073', clientId: SANDBOX_CLIENT,
           orderId: prep.orderId, amount, authToken, signature: sha(authToken + SANDBOX_CLIENT + amount + SECRET), ...over };
}
function approveOk(body, orderId, amount) {
  const ediDate = '2026-11-06T13:00:00.000+0900';
  const tid = 'UT0000113m01012111051714341073';
  return { code: 200, body: { resultCode: '0000', resultMsg: '정상 처리되었습니다.', tid, orderId, ediDate, status: 'paid', amount,
    payMethod: 'card', approveNo: '000000', receiptUrl: 'https://npg.nicepay.co.kr/issue/x', card: { cardName: '삼성' },
    signature: sha(tid + amount + ediDate + SECRET), ...body } };
}
function orderRow(env, orderId) { return env.sheets.Orders.rows.find((r) => r[2] === orderId); }

// ── 시험 ────────────────────────────────────────────────────────────────
test('나이스페이 문서 예시 값으로 signature 공식 확인', () => {
  const { api } = makeEnv();
  assert.equal(api.sha256Hex_('NICEUNTTB06096FF8F653AA366E7EEED1101AAAE' + 'S2_af4543a0be4d49a98122e01ec2059a56' + '1004' + '9eb85607103646da9f9c02b128f2e5ee'),
    '99ea68bf15681741e793ece56ab87891b9bdc94cd54abdcb55b2884f4336155a');
  assert.equal(api.sha256Hex_('UT0000113m01012111051714341073' + '1004' + '2021-11-05T17:14:35.150+0900' + '9eb85607103646da9f9c02b128f2e5ee'),
    '63b251b31c909eebef1a9f4fcc19e77bdcb8f64fc1066a29670f8627186865cd');
});

test('서버 가격표 = shop-catalog.json = js/catalog.js', () => {
  const { api } = makeEnv();
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8'), ctx);
  for (const p of CATALOG.products) {
    const s = api.SHOP_CATALOG[p.key];
    const c = ctx.window.NOAH_CATALOG.products[p.key];
    assert.ok(s && c, p.key);
    for (const o of p.options) {
      assert.equal(s.options[o.key].price, o.price, `${p.key}:${o.key}`);
      assert.equal(c.options.find((x) => x.key === o.key).price, o.price);
    }
    for (const e of p.extras) {
      assert.equal(s.extras[e.key].price, e.price);
      assert.equal(c.extras.find((x) => x.key === e.key).price, e.price);
    }
  }
  assert.ok(!api.SHOP_CATALOG['store-review'] && !api.SHOP_CATALOG['map-traffic'], '구매평·리워드 제외');
});

test('견적 계산과 거부 규칙', () => {
  const { api } = makeEnv();
  assert.equal(api.computeQuote_('brand-run', 'premium', 2, ['skin', 'thumb']).amount, 499000 * 2 + 50000 + 10000);
  assert.equal(api.computeQuote_('blog-dist', 'standard', 10, ['fast']).amount, 110000 + 10000);
  assert.equal(api.computeQuote_('homepage', 'single', 1, []).amount, 199000);
  for (const [p, o, q, ex, why] of [
    ['nope', 'standard', 1, [], 'product'], ['brand-run', 'gold', 1, [], 'option'], ['brand-run', 'standard', 0, [], 'qty'],
    ['brand-run', 'standard', 13, [], 'qty'], ['brand-run', 'standard', 1.5, [], 'qty'], ['cafe', 'standard', 9, [], 'qty'],
    ['brand-run', 'standard', 1, ['skin', 'skin'], 'extras'], ['brand-run', 'standard', 1, ['fast'], 'extras'],
    ['homepage', 'single', 2, [], 'qty'], ['__proto__', 'standard', 1, [], 'product'],
  ]) assert.equal(api.computeQuote_(p, o, q, ex).error, why, `${p}:${o}:${q}`);
  assert.equal(api.computeQuote_('cafe', 'standard', 10, []).amount, 110000);
  assert.ok(Buffer.byteLength(api.trimBytes_('아주아주아주아주아주아주긴상품이름입니다정말로 STANDARD x12', 40), 'utf8') <= 60);
});

test('결제 상태: 기본 off, sandbox는 키·시험암호가 다 있어야 열림', () => {
  assert.equal(json(makeEnv().api.doGet({ parameter: { action: 'pay-status' } })).mode, 'off');
  const noTok = makeEnv({ props: { ...SANDBOX_PROPS, NICEPAY_TEST_TOKEN: '' } });
  assert.equal(json(noTok.api.doGet({ parameter: { action: 'pay-status' } })).mode, 'off');
  const noSecret = makeEnv({ props: { ...SANDBOX_PROPS, NICEPAY_SANDBOX_SECRET_KEY: '' } });
  assert.equal(json(noSecret.api.doGet({ parameter: { action: 'pay-status' } })).mode, 'off');
  assert.equal(json(makeEnv({ props: SANDBOX_PROPS }).api.doGet({ parameter: { action: 'pay-status' } })).mode, 'sandbox');
  assert.equal(makeEnv().api.doGet({ parameter: {} }).text, 'OK');
});

test('prepare: 닫힘·시험암호·동의·입력 검증', () => {
  assert.equal(json(post(makeEnv(), prepareBody())).error, 'closed');
  assert.equal(json(post(makeEnv({ props: SANDBOX_PROPS }), prepareBody({ testToken: 'wrong' }))).error, 'closed');
  assert.equal(json(post(makeEnv({ props: SANDBOX_PROPS }), prepareBody({ agree: { privacy: true, refund: false, order: true } }))).error, 'agree');
  assert.equal(json(post(makeEnv({ props: SANDBOX_PROPS }), prepareBody({ buyer: { name: '홍', phone: '1234', email: 'x' } }))).error, 'invalid input');
  assert.equal(json(post(makeEnv({ props: SANDBOX_PROPS }), prepareBody({ qty: 99 }))).error, 'invalid order');
});

test('prepare: 금액은 서버가 정하고 주문을 READY로 기록', () => {
  const env = makeEnv({ props: SANDBOX_PROPS });
  const r = json(post(env, prepareBody()));
  assert.equal(r.ok, true);
  assert.equal(r.amount, 499000 * 2 + 60000);
  assert.equal(r.clientId, SANDBOX_CLIENT);
  assert.match(r.orderId, /^NOAH-\d{14}-[0-9a-f]{8}$/);
  assert.equal(r.jsUrl, 'https://pay.nicepay.co.kr/v1/js/');
  assert.ok(!JSON.stringify(r).includes(SECRET), '시크릿 키가 응답에 없음');
  const row = orderRow(env, r.orderId);
  assert.equal(row[1], 'READY');
  assert.equal(row[4], r.amount);
  assert.equal(row[6], '010-****-5678');
  assert.equal(row[13], 'sandbox');
  assert.equal(JSON.parse(row[12]).amount, r.amount);
});

test('return: 정상 결제 → 승인 API 호출 → PAID·메일·완료 화면', () => {
  let prep;
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: (url, opts) => approveOk({}, prep.orderId, prep.amount) });
  prep = json(post(env, prepareBody()));
  const out = ret(env, authParams(prep));
  assert.equal(env.fetches.length, 1);
  const f = env.fetches[0];
  assert.equal(f.url, 'https://sandbox-api.nicepay.co.kr/v1/payments/UT0000113m01012111051714341073');
  assert.equal(f.opts.headers.Authorization, 'Basic ' + Buffer.from(SANDBOX_CLIENT + ':' + SECRET).toString('base64'));
  assert.deepEqual(JSON.parse(f.opts.payload), { amount: prep.amount });
  assert.equal(orderRow(env, prep.orderId)[1], 'PAID');
  assert.match(out.html, /pay-result\.html\?r=ok&o=NOAH-/);
  assert.equal(env.mails.length, 2);
  assert.match(env.mails[0].subject, /\[테스트\] 결제완료/);
  assert.equal(env.mails[1].to, 'buyer@example.com');
  assert.ok(!env.mails.some((m) => m.body.includes(SECRET)));
  // 같은 결과를 다시 보내도(새로고침) 다시 승인하지 않음
  const again = ret(env, authParams(prep));
  assert.equal(env.fetches.length, 1);
  assert.match(again.html, /r=ok/);
});

test('return: 화면에서 금액을 바꾼 결제는 승인하지 않음', () => {
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: () => assert.fail('승인 API를 부르면 안 됨') });
  const prep = json(post(env, prepareBody()));
  const out = ret(env, authParams(prep, { amount: '1000' }));   // 서명까지 맞춘 위조 금액
  assert.equal(env.fetches.length, 0);
  assert.equal(orderRow(env, prep.orderId)[1], 'AMOUNT_MISMATCH');
  assert.match(out.html, /r=fail.*c=amount/);
  assert.match(env.mails[0].subject, /금액 불일치/);
});

test('return: signature 위조 · 다른 clientId는 승인하지 않음', () => {
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: () => assert.fail('승인 API를 부르면 안 됨') });
  const p1 = json(post(env, prepareBody()));
  ret(env, authParams(p1, { signature: 'f'.repeat(64) }));
  assert.equal(orderRow(env, p1.orderId)[1], 'SIGNATURE_MISMATCH');
  const p2 = json(post(env, prepareBody()));
  const a = authParams(p2); a.clientId = 'S2_other';
  ret(env, a);
  assert.equal(orderRow(env, p2.orderId)[1], 'SIGNATURE_MISMATCH');
  assert.equal(env.fetches.length, 0);
});

test('return: 인증 실패·취소는 실패 화면, 승인 안 함', () => {
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: () => assert.fail('승인 API를 부르면 안 됨') });
  const prep = json(post(env, prepareBody()));
  const out = ret(env, { authResultCode: 'U310', authResultMsg: '사용자가 결제를 취소하였습니다.', orderId: prep.orderId, clientId: SANDBOX_CLIENT, amount: String(prep.amount) });
  assert.equal(orderRow(env, prep.orderId)[1], 'AUTH_FAILED');
  assert.match(out.html, /r=fail.*c=auth/);
  assert.match(out.html, /사용자가 결제를 취소하였습니다/);
});

test('return: 승인 거절 → APPROVE_FAILED', () => {
  let prep;
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: () => ({ code: 200, body: { resultCode: 'F112', resultMsg: '한도초과' } }) });
  prep = json(post(env, prepareBody()));
  const out = ret(env, authParams(prep));
  assert.equal(orderRow(env, prep.orderId)[1], 'APPROVE_FAILED');
  assert.match(out.html, /c=approve/);
});

test('return: 승인 응답을 못 받으면 망취소', () => {
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: (url) => (url.endsWith('/netcancel') ? { code: 200, body: { resultCode: '0000' } } : new Error('timeout')) });
  const prep = json(post(env, prepareBody()));
  ret(env, authParams(prep));
  assert.equal(env.fetches[1].url, 'https://sandbox-api.nicepay.co.kr/v1/payments/netcancel');
  assert.deepEqual(JSON.parse(env.fetches[1].opts.payload), { orderId: prep.orderId });
  assert.equal(orderRow(env, prep.orderId)[1], 'APPROVE_ERROR');
});

test('return: 승인 응답 금액이 다르면 자동 취소', () => {
  let prep;
  const env = makeEnv({ props: SANDBOX_PROPS, fetch: (url) => (url.endsWith('/cancel')
    ? { code: 200, body: { resultCode: '0000' } } : approveOk({}, prep.orderId, 1000)) });
  prep = json(post(env, prepareBody()));
  ret(env, authParams(prep));
  assert.match(env.fetches[1].url, /\/v1\/payments\/UT0000113m01012111051714341073\/cancel$/);
  assert.equal(orderRow(env, prep.orderId)[1], 'CANCELLED_VERIFY');
});

test('return: 모르는 주문번호', () => {
  const env = makeEnv({ props: SANDBOX_PROPS });
  assert.match(ret(env, { orderId: 'NOAH-20261106000000-deadbeef', authResultCode: '0000' }).html, /c=unknown/);
  assert.match(ret(env, { orderId: '<script>', authResultCode: '0000' }).html, /c=unknown/);
});

test('live 모드는 운영 도메인·운영 키 사용', () => {
  let prep;
  const props = { NICEPAY_MODE: 'live', NICEPAY_LIVE_CLIENT_KEY: 'R2_live', NICEPAY_LIVE_SECRET_KEY: 'livesecret' };
  const env = makeEnv({ props, fetch: (url, opts) => {
    const ediDate = 'x'; const tid = 'UT0000113m01012111051714341073';
    return { code: 200, body: { resultCode: '0000', status: 'paid', tid, ediDate, amount: prep.amount, orderId: prep.orderId, payMethod: 'card',
      signature: sha(tid + prep.amount + ediDate + 'livesecret') } };
  } });
  prep = json(post(env, prepareBody({ testToken: undefined })));
  assert.equal(prep.ok, true);
  assert.match(prep.jsUrl, /^https:\/\/pay\.nicepay\.co\.kr\//);
  const authToken = 'T';
  ret(env, { authResultCode: '0000', tid: 'UT0000113m01012111051714341073', clientId: 'R2_live', orderId: prep.orderId,
             amount: String(prep.amount), authToken, signature: sha(authToken + 'R2_live' + prep.amount + 'livesecret') });
  assert.equal(env.fetches[0].url, 'https://api.nicepay.co.kr/v1/payments/UT0000113m01012111051714341073');
  assert.equal(orderRow(env, prep.orderId)[1], 'PAID');
  assert.ok(!env.mails[0].subject.includes('테스트'));
});

test('기존 문의 접수 경로는 그대로 동작', () => {
  const env = makeEnv({ props: { NOTIFY_EMAIL: 'admin@example.com' } });
  const out = json(post(env, { type: 'inquiry', name: '김노아', phone: '010-1111-2222', message: '문의합니다', origin: 'https://noahgroup.co.kr' }));
  assert.equal(out.ok, true);
  assert.equal(env.sheets.Inquiries.rows.length, 2);
});
