/* 노아 스토어 결제창 — 나이스페이(Server 승인 모델).
   - 가격은 js/catalog.js(원본 apps-script/shop-catalog.json)에서 읽어 보여 주기만 합니다.
     실제 결제 금액은 Apps Script가 같은 가격표로 다시 계산해 정하고, 나이스페이 인증 금액과 대조한 뒤에만 승인합니다.
   - 결제가 닫혀 있으면(NICEPAY_MODE=off, 키 없음, 서버 응답 없음) 기존 주문서(js/order.js)로 넘깁니다.
   - 구매 링크: shop.html?buy=상품키-옵션키 (예: ?buy=brand-run-premium, ?buy=homepage, &qty=3)
   - 작업 요청서 링크(결제 후 메일·완료 화면): shop.html?order=상품키:옵션키&oid=주문번호
   - 테스트 결제(sandbox): shop.html?paytest=시험암호 로 연 탭에서만 결제창이 열립니다.
   script.js의 INQUIRY_WEBHOOK_URL · getRecaptchaToken_ · readHoneypot_ · readFormOpenedAt_ 를 씁니다. */
(() => {
'use strict';
const CAT = window.NOAH_CATALOG;
const modal = document.getElementById('checkoutModal');
const form = document.getElementById('checkoutForm');
if (!CAT || !modal || !form) return;

const API = typeof INQUIRY_WEBHOOK_URL === 'string' ? INQUIRY_WEBHOOK_URL : '';
const RETURN_URL = API ? API + '?action=nicepay-return' : '';
const ORDER_ID_RE = /^NOAH-\d{14}-[0-9a-f]{8}$/;
const $ = (id) => document.getElementById(id);
const won = (n) => new Intl.NumberFormat('ko-KR').format(n) + '원';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ga = (...a) => { if (typeof gtag === 'function') gtag(...a); };

// ── 시험 암호(?paytest=…) — 이 탭에만 기억하고 주소창에서는 지운다 ──────────────
const TEST_KEY = 'noahPayTest';
const params = new URLSearchParams(location.search);
if (params.has('paytest')) {
  try { sessionStorage.setItem(TEST_KEY, (params.get('paytest') || '').slice(0, 100)); } catch (_) {}
  params.delete('paytest');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
}
const testToken = () => { try { return sessionStorage.getItem(TEST_KEY) || ''; } catch (_) { return ''; } };

// ── 결제가 열려 있는지 (Apps Script ?action=pay-status) ───────────────────────
let statusP = null;
function payStatus() {
  if (statusP) return statusP;
  statusP = (async () => {
    if (!API) return 'off';
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(API + '?action=pay-status', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(timer);
      const j = await r.json();
      const m = j && j.ok ? j.mode : 'off';
      if (m === 'live') return 'live';
      if (m === 'sandbox' && testToken()) return 'sandbox';
    } catch (_) { /* 서버 응답 없음 → 주문서로 */ }
    return 'off';
  })();
  return statusP;
}

// ── 상품 카드의 옵션 버튼 ──────────────────────────────────────────────────
const payBtns = [...document.querySelectorAll('.sc-buy[data-pay]')];
payStatus().then((m) => { if (m !== 'off') payBtns.forEach((b) => { b.textContent = '구매하기'; }); });
payBtns.forEach((b) => b.addEventListener('click', async () => {
  const [pk, ok] = b.dataset.pay.split(':');
  b.disabled = true;
  const m = await payStatus();
  b.disabled = false;
  if (m === 'off') { window.NoahOrder?.open(b); return; }
  openCheckout(pk, ok, b);
}));

// ── 결제창 ────────────────────────────────────────────────────────────────
const sel = $('co-option');
const qtyIn = $('co-qty');
const extrasBox = $('coExtras');
const agreeAll = $('co-agree-all');
const agrees = [...form.querySelectorAll('[data-agree]')];
const submitBtn = $('coSubmit');
const submitLabel = $('coSubmitLabel');
let cur = null, opener = null, busy = false;

function product() { return cur && CAT.products[cur]; }
function option() { const p = product(); return p.options.find((o) => o.key === sel.value) || p.options[0]; }
function bounds() { const p = product(), o = option(); return { min: o.minQty || 1, max: p.maxQty }; }

function quote() {
  const p = product(), o = option(), { min, max } = bounds();
  let qty = parseInt(qtyIn.value, 10);
  if (!Number.isInteger(qty)) qty = min;
  qty = Math.min(max, Math.max(min, qty));
  const extras = [...extrasBox.querySelectorAll('input:checked')].map((i) => i.value);
  const ex = p.extras.filter((e) => extras.includes(e.key));
  const total = o.price * qty + ex.reduce((s, e) => s + e.price, 0);
  return { p, o, qty, extras: ex.map((e) => e.key), ex, total };
}

function render() {
  const { p, o, qty, ex, total } = quote();
  const { min, max } = bounds();
  if (String(qtyIn.value) !== String(qty) && document.activeElement !== qtyIn) qtyIn.value = qty;
  qtyIn.min = min; qtyIn.max = max;
  form.querySelector('[data-step="-1"]').disabled = qty <= min;
  form.querySelector('[data-step="1"]').disabled = qty >= max;
  $('coUnit').textContent = `(${p.unit} 단위)`;
  $('coQtyHelp').textContent = max === 1 ? '1개만 주문할 수 있습니다.' : `${min}~${max}${p.unit}` + (min > 1 ? ` · 이 옵션은 ${min}${p.unit}부터` : '');
  $('coDetail').textContent = `${o.detail} · 작업일 ${o.days}일 · 수정 ${o.revisions}`;
  const lines = [`<li><span>${esc(o.label)} ${won(o.price)} × ${qty}${esc(p.unit)}</span><span>${won(o.price * qty)}</span></li>`]
    .concat(ex.map((e) => `<li><span>+ ${esc(e.label)}</span><span>${won(e.price)}</span></li>`));
  $('coLines').innerHTML = lines.join('');
  $('coTotal').textContent = won(total);
  submitLabel.textContent = busy ? submitLabel.textContent : `${won(total)} 결제하기`;
  return total;
}

function showErr(msg, withOrderForm) {
  const box = $('coErr');
  box.textContent = msg;
  if (withOrderForm) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link-btn';
    b.style.cssText = 'margin-left:6px;text-decoration:underline;font-weight:700;color:inherit';
    b.textContent = '주문서로 접수하기 →';
    b.addEventListener('click', () => { const o = option(); close(); window.NoahOrder?.openSvc(o.svc, o.label, won(o.price)); });
    box.appendChild(b);
  }
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
}
function hideErr() { $('coErr').hidden = true; }
function setBusy(on, label) {
  busy = on;
  submitBtn.disabled = on;
  if (label) submitLabel.textContent = label;
  if (!on) render();
}

function openCheckout(pk, ok, from, qty) {
  const p = CAT.products[pk];
  if (!p) return false;
  cur = pk;
  opener = from || document.activeElement;
  $('checkout-title').textContent = p.name;
  $('coSub').textContent = '크몽과 같은 가격 · VAT 포함 · 결제 후 작업 요청서로 키워드·자료를 받습니다';
  sel.innerHTML = p.options.map((o) => `<option value="${esc(o.key)}">${esc(o.label)} — ${won(o.price)}</option>`).join('');
  sel.value = p.options.some((o) => o.key === ok) ? ok : p.options[0].key;
  extrasBox.innerHTML = p.extras.map((e) => `<label><input type="checkbox" value="${esc(e.key)}"><span>${esc(e.label)}<small>${esc(e.detail)}</small></span><em>+${won(e.price)}</em></label>`).join('');
  $('coExtrasWrap').hidden = !p.extras.length;
  const o = option();
  qtyIn.value = Math.max(o.minQty || 1, parseInt(qty, 10) || 1);
  agreeAll.checked = false;
  agrees.forEach((a) => { a.checked = false; });
  hideErr();
  busy = false;
  submitBtn.disabled = false;
  payStatus().then((m) => { $('coTest').hidden = m !== 'sandbox'; });
  const at = form.querySelector('input.form-opened-at');
  if (at) at.value = new Date().toISOString();
  render();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';
  setTimeout(() => sel.focus(), 60);
  const q = quote();
  ga('event', 'begin_checkout', { currency: 'KRW', value: q.total, items: [{ item_id: `${pk}:${q.o.key}`, item_name: p.name, item_variant: q.o.label, price: q.o.price, quantity: q.qty }] });
  return true;
}
function close() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  opener?.focus?.();
}

modal.querySelector('.payment-modal-close').addEventListener('click', close);
modal.querySelector('.payment-modal-backdrop').addEventListener('click', close);
document.addEventListener('keydown', (e) => {
  if (!modal.classList.contains('open')) return;
  if (e.key === 'Escape') { close(); return; }
  if (typeof trapFocus === 'function') trapFocus(modal, e);
});
sel.addEventListener('change', () => { const o = option(); if (parseInt(qtyIn.value, 10) < (o.minQty || 1)) qtyIn.value = o.minQty; render(); });
qtyIn.addEventListener('input', render);
qtyIn.addEventListener('blur', () => { qtyIn.value = quote().qty; render(); });
form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  qtyIn.value = quote().qty + Number(b.dataset.step);
  qtyIn.value = quote().qty;
  render();
}));
extrasBox.addEventListener('change', render);
agreeAll.addEventListener('change', () => agrees.forEach((a) => { a.checked = agreeAll.checked; }));
agrees.forEach((a) => a.addEventListener('change', () => { agreeAll.checked = agrees.every((x) => x.checked); }));

// ── 나이스페이 JS SDK (서버가 알려 준 주소만, nicepay.co.kr 도메인만) ─────────────
const sdkLoads = {};
function loadSdk(url) {
  if (!/^https:\/\/([a-z0-9-]+\.)*nicepay\.co\.kr\//.test(url || '')) return Promise.reject(new Error('sdk url'));
  if (!sdkLoads[url]) {
    sdkLoads[url] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => (window.AUTHNICE ? res() : rej(new Error('AUTHNICE missing')));
      s.onerror = () => { delete sdkLoads[url]; rej(new Error('sdk load')); };
      document.head.appendChild(s);
    });
  }
  return sdkLoads[url];
}

const PREP_ERR = {
  closed: '지금은 온라인 결제를 받을 수 없습니다.',
  agree: '필수 동의 항목을 확인해 주세요.',
  'invalid input': '이름·휴대폰·이메일을 다시 확인해 주세요.',
  'invalid order': '옵션·수량을 다시 확인해 주세요.',
  'too many requests': '요청이 많습니다. 1분 뒤 다시 시도해 주세요.',
  'daily limit exceeded': '오늘 결제 시도 횟수를 넘었습니다. 010-6658-6482로 연락 주세요.',
  captcha: '자동 입력 방지 확인에 실패했습니다. 새로고침한 뒤 다시 시도해 주세요.',
  busy: '잠시 후 다시 시도해 주세요.',
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy || !cur) return;
  hideErr();
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.replace(/\D/g, '');
  const email = form.elements.email.value.trim();
  const memo = form.elements.memo.value.trim();
  if (!name) { form.elements.name.focus(); showErr('주문자 이름을 입력해 주세요.'); return; }
  if (!/^01[016789]\d{7,8}$/.test(phone)) { form.elements.phone.focus(); showErr('휴대폰 번호를 확인해 주세요. 예: 010-1234-5678'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { form.elements.email.focus(); showErr('이메일을 확인해 주세요. 영수증을 이 주소로 보냅니다.'); return; }
  const off = agrees.find((a) => !a.checked);
  if (off) { off.focus(); showErr('필수 동의 항목에 모두 체크해 주세요.'); return; }
  if (typeof readHoneypot_ === 'function' && readHoneypot_(form)) return;

  const q = quote();
  if (q.total > CAT.maxOrderAmount) { showErr(`한 번에 ${won(CAT.maxOrderAmount)}까지 결제할 수 있습니다. 수량을 나눠 주세요.`); return; }
  const mode = await payStatus();
  if (mode === 'off') { showErr(PREP_ERR.closed, true); return; }
  const method = form.querySelector('input[name="method"]:checked')?.value || 'cardAndEasyPay';

  setBusy(true, '결제 준비 중…');
  let prep = null;
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // CORS preflight 회피
      redirect: 'follow',
      body: JSON.stringify({
        type: 'nicepay-prepare',
        product: cur, option: q.o.key, qty: q.qty, extras: q.extras, method,
        buyer: { name, phone, email, memo },
        agree: { privacy: true, refund: true, order: true },
        testToken: mode === 'sandbox' ? testToken() : '',
        origin: location.origin,
        recaptchaToken: typeof getRecaptchaToken_ === 'function' ? await getRecaptchaToken_() : '',
        formOpenedAt: typeof readFormOpenedAt_ === 'function' ? readFormOpenedAt_(form) : '',
        submittedAt: new Date().toISOString(),
      }),
    });
    prep = await res.json();
  } catch (_) {
    setBusy(false);
    showErr('결제 준비 중 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  if (!prep || !prep.ok || !ORDER_ID_RE.test(prep.orderId || '')) {
    setBusy(false);
    const code = prep && prep.error;
    showErr(PREP_ERR[code] || '결제를 준비하지 못했습니다. 잠시 후 다시 시도하시거나 010-6658-6482로 연락 주세요.', code === 'closed');
    return;
  }
  if (prep.amount !== q.total) {   // 화면 가격표가 서버와 다르면(가격 변경 직후) 결제하지 않고 새로고침 안내
    setBusy(false);
    showErr(`서버에서 확인한 결제 금액은 ${won(prep.amount)}입니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.`);
    return;
  }

  setBusy(true, '결제창 여는 중…');
  try {
    await loadSdk(prep.jsUrl);
  } catch (_) {
    setBusy(false);
    showErr('결제창을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
    return;
  }
  try { sessionStorage.setItem('noahPayLast', JSON.stringify({ o: prep.orderId, a: prep.amount, p: `${cur}:${q.o.key}`, q: q.qty })); } catch (_) {}
  ga('event', 'add_payment_info', { currency: 'KRW', value: prep.amount, payment_type: method });
  try {
    window.AUTHNICE.requestPay({
      clientId: prep.clientId,
      method: prep.method,
      orderId: prep.orderId,
      amount: prep.amount,
      goodsName: prep.goodsName,
      returnUrl: RETURN_URL,
      buyerName: name,
      buyerTel: phone,
      buyerEmail: email,
      fnError: (r) => {
        setBusy(false);
        showErr((r && (r.msg || r.errorMsg)) ? `결제가 진행되지 않았습니다 — ${r.msg || r.errorMsg}` : '결제가 취소됐습니다.');
        ga('event', 'checkout_cancel', { order_id: prep.orderId });
      },
    });
    // PC는 나이스페이 레이어가 이 창 위를 덮고, 모바일은 결제 페이지로 이동한다.
    // 레이어를 닫았는데 fnError가 오지 않는 경우에도 다시 시도할 수 있게 버튼을 풀어 둔다.
    submitLabel.textContent = '결제 진행 중…';
    setTimeout(() => { if (busy) setBusy(false); }, 2000);
  } catch (_) {
    setBusy(false);
    showErr('결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
});

// ── 링크로 열기: ?buy=… (결제창) · ?order=…&oid=… (작업 요청서) ───────────────
function parseKey(v) {
  v = String(v || '').trim().toLowerCase();
  let pk = v, ok = '';
  if (v.includes(':')) [pk, ok] = v.split(':');
  else if (!CAT.products[v]) { const i = v.lastIndexOf('-'); pk = v.slice(0, i); ok = v.slice(i + 1); }
  const p = CAT.products[pk];
  if (!p) return [];
  if (!p.options.some((o) => o.key === ok)) ok = p.options[0].key;
  return [pk, ok];
}
function scrollToCard(pk) {
  const card = document.getElementById(CAT.products[pk].card);
  if (card) card.scrollIntoView({ block: 'start' });
}
const buyParam = params.get('buy');
const orderParam = params.get('order');
if (buyParam) {
  const [pk, ok] = parseKey(buyParam);
  if (pk) {
    scrollToCard(pk);
    payStatus().then((m) => {
      if (m !== 'off') { openCheckout(pk, ok, null, params.get('qty')); return; }
      const btn = document.querySelector(`.sc-buy[data-pay="${pk}:${ok}"]`);
      if (btn) window.NoahOrder?.open(btn);
    });
  }
} else if (orderParam) {
  const [pk, ok] = parseKey(orderParam);
  if (pk) {
    const o = CAT.products[pk].options.find((x) => x.key === ok);
    const oid = (params.get('oid') || '').slice(0, 40);
    scrollToCard(pk);
    window.NoahOrder?.openSvc(o.svc, o.label, '', ORDER_ID_RE.test(oid) ? oid : '');
  }
}
})();
