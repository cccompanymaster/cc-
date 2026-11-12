/* 노아 스토어 주문서 — 상품별 입력 항목을 띄우고 문의 접수 경로(Apps Script)로 보낸다.
   script.js의 INQUIRY_WEBHOOK_URL · getRecaptchaToken_ · readHoneypot_ · fileToBase64_ 를 그대로 쓴다.
   첨부는 서버가 문서·ZIP만 받으므로, 고른 파일을 모두 ZIP 하나로 묶어 보낸다(1MB 이하). */
(() => {
'use strict';
const modal = document.getElementById('orderModal');
const form = document.getElementById('orderForm');
if (!modal || !form) return;

const MAX_BYTES = 1024 * 1024;
const KW = { t: 'text', n: 'keyword', l: '키워드', req: 1, max: 200, ph: '예: 송도 맛집, 송도 카페 (여러 개면 쉼표로)' };
const QTY = { t: 'number', n: 'qty', l: '수량', req: 1 };
const FILES = { t: 'file', n: 'files', l: '원고 · 사진 파일', help: '여러 파일을 한 번에 고르면 ZIP 하나로 묶어 보냅니다 · 합계 1MB까지 · 지금 없으면 주문 확인 때 보내셔도 됩니다' };
const REQ = { t: 'textarea', n: 'request', l: '요청사항', max: 1000 };
const BIZ = [
  { t: 'text', n: 'biz', l: '업체(서비스)명', req: 1, max: 100 },
  { t: 'text', n: 'addr', l: '주소 · 위치', max: 200 },
  { t: 'text', n: 'hours', l: '영업시간', req: 1, max: 100, ph: '예: 매일 11:00~21:00 (월요일 휴무)' },
  { t: 'text', n: 'bizTel', l: '연락처 (글에 넣을 번호)', req: 1, max: 40 },
  { t: 'textarea', n: 'links', l: '홈페이지 · 네이버 플레이스 · SNS 링크', max: 400, rows: 2 },
  { t: 'textarea', n: 'products', l: '대표 상품 · 서비스 (2~3가지)', req: 1, max: 400, rows: 3 },
  { t: 'textarea', n: 'event', l: '진행 중인 이벤트 · 혜택', max: 400, rows: 2 },
  { t: 'textarea', n: 'strength', l: '강점 · 차별점', req: 1, max: 400, rows: 3 },
  { t: 'text', n: 'target', l: '주요 고객층', req: 1, max: 200, ph: '예: 30~40대 직장인, 아이 동반 가족' },
];
const BIZ_NAME = { t: 'text', n: 'biz', l: '업체(서비스)명', req: 1, max: 100 };
const READY = { t: 'checks', n: 'ready', l: '원고 · 사진 준비 여부', o: ['원고 있음', '사진 있음', '원고 작성 필요'] };

const S = {
  'blog-dist': { title: '블로그 배포', f: [QTY, KW, FILES] },
  'rank-24h': { title: '블로그 상위노출 24시간 보장', f: [KW, READY] },
  'rank-25d': { title: '블로그 상위노출 25일 보장', f: [KW, READY] },
  'influencer': { title: '공식 인플루언서 블로그 배포', f: [QTY, KW, FILES,
    { t: 'check', n: 'cat', l: '인플루언서 카테고리 지정 (+20,000원)', more: { t: 'text', n: 'catName', l: '원하는 카테고리', max: 100, ph: '예: 푸드, 뷰티, 육아' } }] },
  'neighbor': { title: '블로그 이웃 늘리기', f: [
    { t: 'text', n: 'blogId', l: '네이버 아이디', req: 1, max: 100 },
    { t: 'password', n: 'blogPw', l: '비밀번호', req: 1, max: 100 },
    { t: 'note', l: '작업은 10:00~22:00 사이에 진행합니다. 이 시간에는 로그인 알림이 올 수 있습니다. 작업이 끝나면 비밀번호를 바꿔 주세요.' }] },
  'write': { title: '블로그용 원고 작성', f: [QTY, KW, ...BIZ,
    { t: 'textarea', n: 'direction', l: '포스팅 방향 요청사항', max: 400, rows: 3 },
    { t: 'radio', n: 'photo', l: '사진 자료 여부', req: 1, o: ['있음', '없음'] }, FILES] },
  'place-seo': { title: '플레이스 메타데이터 기반 SEO 전문 세팅', f: [
    { t: 'text', n: 'keyword', l: '희망 키워드', req: 1, max: 200, ph: '예: 송도 브런치, 송도 카페 (여러 개면 쉼표로)' },
    { t: 'text', n: 'place', l: '매장명 또는 플레이스 주소', max: 200, ph: '예: 노아카페 송도점 / naver.me/…' }] },
  'cafe': { title: '카페 배포형 · 노출용 게시글 발행', f: [QTY, KW, FILES, REQ] },
  'aeo': { title: 'AI 검색 최적화 (AEO)', f: BIZ },
  'press-img': { title: '언론홍보 이미지 제작', f: [QTY,
    { t: 'textarea', n: 'ref', l: '참고 내용', max: 1000, rows: 4, ph: '참고할 수 있는 브랜드 링크나, 나타내고자 하는 이미지 관련 내용을 서술해주세요. 미기재 시, 원고 맥락에 맞는 생성형 이미지로 발행됩니다. ex) 세금 관련 언론 > 돈과 저울 관련 참고 이미지 등.' },
    { ...FILES, l: '기사 원고 · 참고 이미지' }] },
  'daangn-story': { title: '당근 스토리(숏폼) 영상 제작', f: [
    { t: 'select', n: 'source', l: '영상 소스 보유 여부', req: 1, o: ['있음', '일부 있음', '없음'] },
    { t: 'select', n: 'vtype', l: '영상 타입', req: 1, o: ['실사', '캐릭터', '텍스트 기반', '기타 (요청사항에 적어 주세요)'] },
    { t: 'textarea', n: 'request', l: '추가 요청사항', req: 1, max: 1000, ph: '알리고자 하는 내용을 간단하게 기재해주세요!' },
    { ...FILES, l: '영상 · 사진 소스' }] },
  'brand-run': { title: '브랜드 블로그 운영 관리', f: [BIZ_NAME,
    { t: 'text', n: 'blog', l: '운영할 블로그 주소', max: 200, ph: '없으면 비워 두세요' }, REQ] },
  'exp': { title: '블로그 체험단 모집', f: [BIZ_NAME,
    { t: 'text', n: 'offer', l: '제공 상품 · 서비스', req: 1, max: 200 }, REQ] },
  'daangn-local': { title: '당근 동네생활 게시글 (바이럴)', f: [
    { t: 'textarea', n: 'request', l: '추가 요청사항', req: 1, max: 1000, ph: '알리고자 하는 내용을 간단하게 기재해주세요!' }] },
  'daangn-ad': { title: '당근마켓 비즈니스 광고대행', f: [BIZ_NAME,
    { t: 'text', n: 'profile', l: '당근 비즈프로필 주소', max: 200 }, REQ] },
  'homepage': { title: '템플릿형 홈페이지 제작', f: [BIZ_NAME,
    { t: 'text', n: 'ref', l: '참고 사이트 · 원하는 분위기', max: 300 }, REQ] },
};

const box = document.getElementById('orderFields');
const title = document.getElementById('order-modal-title');
const sub = document.getElementById('orderSub');
const ok = document.getElementById('orderSuccess');
const okDefault = ok.textContent;
const btn = document.getElementById('orderSubmit');
let cur = null, opener = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const star = (f) => (f.req ? ' <span>*</span>' : ' <em class="optional-hint">(선택)</em>');
const counter = (f) => (f.max >= 400 ? `<small class="of-count" data-for="of-${f.n}">0 / ${f.max.toLocaleString()}자</small>` : '');

function fieldHTML(f) {
  const id = `of-${f.n}`;
  const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  const ml = f.max ? ` maxlength="${f.max}"` : '';
  switch (f.t) {
    case 'note': return `<p class="of-note">${esc(f.l)}</p>`;
    case 'number': return `<div class="form-field"><label for="${id}">${f.l}${star(f)}</label><input type="number" id="${id}" name="${f.n}" min="1" step="1" value="1" inputmode="numeric"></div>`;
    case 'password': return `<div class="form-field"><label for="${id}">${f.l}${star(f)}</label><input type="password" id="${id}" name="${f.n}" autocomplete="new-password"${ml}></div>`;
    case 'text': return `<div class="form-field"><label for="${id}">${f.l}${star(f)}</label><input type="text" id="${id}" name="${f.n}"${ml}${ph}></div>`;
    case 'textarea': return `<div class="form-field"><label for="${id}">${f.l}${star(f)}</label><textarea id="${id}" name="${f.n}" rows="${f.rows || 4}"${ml}${ph}></textarea>${counter(f)}</div>`;
    case 'select': return `<div class="form-field"><label for="${id}">${f.l}${star(f)}</label><select id="${id}" name="${f.n}"><option value="">선택해 주세요</option>${f.o.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
    case 'radio':
    case 'checks': return `<fieldset class="form-field of-group"><legend>${f.l}${star(f)}</legend><div class="of-opts">${f.o.map((o) => `<label><input type="${f.t === 'radio' ? 'radio' : 'checkbox'}" name="${f.n}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></fieldset>`;
    case 'check': return `<div class="form-field"><label class="of-check"><input type="checkbox" id="${id}" name="${f.n}" value="예"> ${f.l}</label><div class="of-more" hidden>${fieldHTML(f.more)}</div></div>`;
    case 'file': return `<div class="form-field"><label for="${id}">${f.l} <em class="optional-hint">(선택)</em></label><input type="file" id="${id}" name="${f.n}" multiple><small class="of-help">${esc(f.help)}</small></div>`;
  }
  return '';
}

function open(btnEl) {
  openSvc(btnEl.dataset.svc, btnEl.dataset.opt || '', btnEl.closest('.st-tier')?.querySelector('.st-tier-price')?.textContent.trim() || '', '', btnEl);
}
// oid가 있으면 결제를 마친 주문의 '작업 요청서' — 결제 안내 문구 대신 주문번호를 붙인다.
function openSvc(key, opt, price, oid, from) {
  const svc = S[key];
  if (!svc) return false;
  cur = { key, svc, opt: svc.title.includes(opt) ? '' : opt, price: oid ? '' : price, oid: oid || '' };
  opener = from || document.activeElement;
  title.textContent = svc.title + (cur.oid ? ' 작업 요청서' : ' 주문서');
  sub.textContent = cur.oid
    ? `주문번호 ${cur.oid}${cur.opt ? ' · ' + cur.opt : ''} — 결제 상태와 보내 주신 내용을 확인한 후 일정을 안내합니다.`
    : [cur.opt, cur.price].filter(Boolean).join(' · ') + ' — 작성해 주시면 담당자가 확인 후 견적·결제 방법을 안내합니다.';
  box.innerHTML = svc.f.map(fieldHTML).join('');
  form.reset();
  form.hidden = false;
  ok.hidden = true;
  btn.disabled = false;
  const at = form.querySelector('input.form-opened-at');
  if (at) at.value = new Date().toISOString();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';
  setTimeout(() => form.querySelector('input:not([type=hidden]):not([tabindex="-1"]),select,textarea')?.focus(), 50);
  if (!cur.oid && typeof gtag === 'function') gtag('event', 'begin_checkout', { item_name: svc.title, item_variant: cur.opt });
  return true;
}
function close() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  opener?.focus();
}

// 결제 가능한 옵션(data-pay)은 js/checkout.js가 맡고, 결제가 닫혀 있으면 이 주문서로 넘겨준다.
document.querySelectorAll('.sc-buy[data-svc]:not([data-pay])').forEach((b) => b.addEventListener('click', () => open(b)));
window.NoahOrder = { open, openSvc };
modal.querySelector('.payment-modal-close').addEventListener('click', close);
modal.querySelector('.payment-modal-backdrop').addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
box.addEventListener('input', (e) => {
  const c = box.querySelector(`.of-count[data-for="${e.target.id}"]`);
  if (c) c.textContent = `${e.target.value.length.toLocaleString()} / ${Number(e.target.maxLength).toLocaleString()}자`;
});
box.addEventListener('change', (e) => {
  if (e.target.closest('.of-check')) e.target.closest('.form-field').querySelector('.of-more').hidden = !e.target.checked;
});

function loadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = () => (window.JSZip ? res(window.JSZip) : rej(new Error('jszip')));
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// 항목별 값 읽기 → [라벨, 값] 목록. 필수 누락이면 그 칸을 돌려준다.
function collect() {
  const rows = [];
  const flat = [];
  cur.svc.f.forEach((f) => { flat.push(f); if (f.more) flat.push(f.more); });
  for (const f of flat) {
    if (f.t === 'note' || f.t === 'file') continue;
    let v = '';
    if (f.t === 'checks' || f.t === 'radio') v = [...form.querySelectorAll(`input[name="${f.n}"]:checked`)].map((i) => i.value).join(', ');
    else if (f.t === 'check') v = form.querySelector(`#of-${f.n}`).checked ? '예' : '아니오';
    else {
      const el = form.querySelector(`#of-${f.n}`);
      if (!el || el.closest('.of-more')?.hidden) continue;
      v = el.value.trim();
      if (f.t === 'number' && !(parseInt(v, 10) >= 1)) return { bad: el, msg: `${f.l}을(를) 1 이상으로 입력해주세요.` };
    }
    if (f.req && !v) return { bad: form.querySelector(`[name="${f.n}"]`), msg: `${f.l}을(를) 입력해주세요.` };
    if (v) rows.push([f.l, v]);
  }
  return { rows };
}

let orderRequestId = '';
form.addEventListener('input', () => { orderRequestId = ''; });
form.addEventListener('reset', () => { orderRequestId = ''; });
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cur || btn.disabled) return;
  const got = collect();
  if (got.bad) { got.bad.focus(); alert(got.msg); return; }
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.trim();
  const email = form.elements.email.value.trim();
  if (!name) { form.elements.name.focus(); alert('이름을 입력해주세요.'); return; }
  if (!/^01[016789]\d{7,8}$/.test(phone.replace(/[^\d]/g, ''))) { form.elements.phone.focus(); alert('연락처를 형식에 맞게 입력해주세요.\n예: 010-1234-5678'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { form.elements.email.focus(); alert('이메일 형식이 올바르지 않습니다.\n예: you@example.com'); return; }
  if (!document.getElementById('od-privacy').checked) { alert('개인정보 수집·이용에 동의해주세요.'); return; }
  if (readHoneypot_(form)) return;

  const files = [...(form.querySelector('input[type=file]')?.files || [])];
  if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) { alert('첨부 파일은 합계 1MB까지 보낼 수 있습니다.'); return; }

  btn.disabled = true;
  const label = btn.innerHTML;
  btn.innerHTML = files.length ? '파일 묶는 중…' : '보내는 중…';
  try {
    let attachment = null;
    if (files.length) {
      const JSZip = await loadZip();
      const zip = new JSZip();
      files.forEach((f, i) => zip.file(`${i + 1}_${f.name}`, f));
      const blob = await zip.generateAsync({ type: 'blob' });
      if (blob.size > MAX_BYTES) throw new Error('too big');
      attachment = { name: `주문자료_${cur.key}.zip`, type: 'application/zip', size: blob.size, dataBase64: await fileToBase64_(blob) };
      btn.innerHTML = '보내는 중…';
    }
    const head = `${cur.oid ? '[작업 요청서 · 주문번호 ' + cur.oid + ']' : '[주문서]'} ${cur.svc.title}${cur.opt ? ' · ' + cur.opt : ''}${cur.price ? ' (' + cur.price + ')' : ''}`;
    const lines = got.rows.map(([k, v]) => `${k}: ${v}`);
    if (files.length) lines.push(`첨부: ${files.map((f) => f.name).join(', ')} (ZIP 1개로 묶음)`);
    const payload = {
      type: 'inquiry',
      name, phone, email,
      company: (form.querySelector('#of-biz')?.value || '').trim(),
      interests: `${cur.oid ? '[작업요청]' : '[주문]'} ${cur.svc.title}${cur.opt ? ' · ' + cur.opt : ''}`,
      message: [head, ...lines].join('\n').slice(0, 4900),
      attachment,
      referrer: ((window.NOAH_SRC && window.NOAH_SRC.text()) || document.referrer || '(direct)').slice(0, 480),  // 광고·검색·AI 등 들어온 경로 (js/attrib.js)
      requestId: orderRequestId || (orderRequestId = makeUUID_()),
      origin: location.origin,
      recaptchaToken: await getRecaptchaToken_(),
      formOpenedAt: readFormOpenedAt_(form),
      submittedAt: new Date().toISOString(),
    };
    const res = await fetch(INQUIRY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow', signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const receipt = await res.json();
    if (receipt.ok !== true || receipt.receiptId !== payload.requestId) throw new Error('unconfirmed');   // 서버 거절도 HTTP 200 — 본문으로 판단
    form.hidden = true;
    ok.textContent = cur.oid ? '✓ 작업 요청서가 접수됐습니다. 담당자가 확인 후 착수 일정을 안내드립니다.' : okDefault;
    ok.textContent += ' 접수번호: ' + receipt.receiptId;
    ok.hidden = false;
    if (!receipt.duplicate && typeof gtag === 'function') gtag('event', 'generate_lead', { method: 'order_form', item_name: cur.svc.title, item_variant: cur.opt });
  } catch (err) {
    console.error('[Order] 전송 실패:', err);
    if (typeof gtag === 'function') gtag('event', 'form_error', { form: 'order' });
    alert(err.message === 'too big'
      ? '파일을 묶은 크기가 1MB를 넘습니다. 사진 수를 줄여 다시 보내주세요.'
      : '주문서 전송 중 오류가 발생했습니다.\n잠시 후 다시 시도해주시거나 010-6658-6482로 연락 부탁드립니다.');
    btn.disabled = false;
  }
  btn.innerHTML = label;
});
})();
