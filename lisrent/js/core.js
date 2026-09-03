// 공통 유틸 / 상태 / 데이터 헬퍼
window.App = (function () {
  const cfg = window.LISRENT_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const state = {
    user: null,       // supabase auth user
    profile: null,    // profiles row
    cache: {},        // financiers / vehicles / profiles
  };

  // ---------- 표시 라벨 ----------
  const LABELS = {
    customerStatus: {
      lead: ['리드', 'b-purple'], consulting: ['상담중', 'b-blue'], quoted: ['견적', 'b-blue'],
      contracted: ['계약', 'b-amber'], active: ['운영중', 'b-green'], expired: ['만기', 'b-red'], lost: ['종료', ''],
    },
    contractStatus: {
      pending: ['접수', ''], review: ['심사중', 'b-amber'], approved: ['승인', 'b-blue'],
      delivered: ['출고', 'b-blue'], active: ['운영중', 'b-green'], ended: ['만기종료', 'b-red'], canceled: ['취소', ''],
    },
    quoteStatus: {
      draft: ['작성중', ''], sent: ['발송', 'b-blue'], accepted: ['계약전환', 'b-green'], rejected: ['미성사', 'b-red'],
    },
    productType: { rent: '장기렌트', lease: '리스' },
    customerType: { individual: '개인', corporate: '법인' },
    endResult: { renewal: '재계약', return: '반납', purchase: '인수' },
    role: { admin: '관리자', sales: '영업' },
    financierType: { capital: '캐피탈', bank: '은행', rentcar: '렌터카', etc: '기타' },
  };

  function badge(map, key) {
    const [label, cls] = LABELS[map][key] || [key || '-', ''];
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  // ---------- 포맷 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => n == null || isNaN(n) ? '-' : Number(n).toLocaleString('ko-KR');
  const wonU = (n) => n == null || isNaN(n) ? '-' : Number(n).toLocaleString('ko-KR') + '원';
  const fmtDate = (d) => !d ? '-' : String(d).slice(0, 10);
  const fmtDT = (d) => !d ? '-' : new Date(d).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  const today = () => new Date().toISOString().slice(0, 10);
  function dday(dateStr) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
    return diff;
  }
  function addMonths(dateStr, months) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + Number(months));
    return d.toISOString().slice(0, 10);
  }

  // ---------- 월 납입료 계산 (참고용 간이 계산) ----------
  // 원리: (차량가 - 선납금 - 보증금)에서 만기 잔존가치를 할인 차감한 금액을 원리금 균등 상환
  function calcMonthly({ price, prepayPct = 0, depositPct = 0, residualPct = 0, rate = 7, months = 48 }) {
    price = Number(price) || 0; months = Number(months) || 1;
    const prepay = price * prepayPct / 100;
    const deposit = price * depositPct / 100;
    const residual = price * residualPct / 100;
    const base = price - prepay - deposit;
    const r = Number(rate) / 100 / 12;
    let pmt;
    if (r <= 0) pmt = (base - residual) / months;
    else pmt = (base - residual / Math.pow(1 + r, months)) * r / (1 - Math.pow(1 + r, -months));
    return Math.max(0, Math.round(pmt / 100) * 100); // 백원 단위 반올림
  }

  // ---------- 모달 ----------
  function openModal(html, { large = false } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal ${large ? 'modal-lg' : ''}">${html}</div></div>`;
    root.querySelector('.modal-back').addEventListener('mousedown', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    const closeBtn = root.querySelector('.modal-close');
    if (closeBtn) closeBtn.onclick = closeModal;
    return root.querySelector('.modal');
  }
  function modalHead(title) {
    return `<div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="modal-close" aria-label="닫기">&times;</button></div>`;
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  // ---------- 토스트 ----------
  function toast(msg, isErr = false) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), isErr ? 5000 : 2600);
  }
  function err(e) {
    console.error(e);
    toast('오류: ' + (e?.message || e), true);
  }

  // ---------- 데이터 로더 (캐시) ----------
  async function loadRef(name, query) {
    if (state.cache[name]) return state.cache[name];
    const { data, error } = await query();
    if (error) throw error;
    state.cache[name] = data;
    return data;
  }
  const loadFinanciers = () => loadRef('financiers', () => sb.from('financiers').select('*').order('name'));
  const loadVehicles = () => loadRef('vehicles', () => sb.from('vehicles').select('*').order('brand').order('model'));
  const loadProfiles = () => loadRef('profiles', () => sb.from('profiles').select('*').order('name'));
  const clearCache = (name) => { if (name) delete state.cache[name]; else state.cache = {}; };

  const nameOf = (list, id, field = 'name') => {
    const row = (state.cache[list] || []).find((r) => r.id === id);
    return row ? row[field] : '-';
  };

  // ---------- 감사 로그 ----------
  async function log(action, entity, entityId, detail) {
    try {
      await sb.from('activity_logs').insert({
        user_id: state.user?.id, action, entity, entity_id: String(entityId || ''), detail: detail || null,
      });
    } catch (_) { /* 로그 실패는 무시 */ }
  }

  // ---------- CSV 다운로드 ----------
  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- 폼 헬퍼 ----------
  function formData(formEl) {
    const o = {};
    new FormData(formEl).forEach((v, k) => { o[k] = v === '' ? null : v; });
    return o;
  }
  function selectOptions(list, valueKey, labelFn, selected) {
    return list.map((r) =>
      `<option value="${esc(r[valueKey])}" ${r[valueKey] === selected ? 'selected' : ''}>${esc(labelFn(r))}</option>`
    ).join('');
  }

  return {
    sb, state, LABELS, badge, esc, won, wonU, fmtDate, fmtDT, today, dday, addMonths,
    calcMonthly, openModal, modalHead, closeModal, toast, err,
    loadFinanciers, loadVehicles, loadProfiles, clearCache, nameOf, log,
    downloadCSV, formData, selectOptions,
    // app.js에서 채움
    logout: null, navigate: null, render: null,
  };
})();
