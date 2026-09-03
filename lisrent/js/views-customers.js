// 고객 관리 (목록 / 상세 / 등록·수정 / 상담 이력)
(function () {
  const { sb, esc, badge, fmtDate, fmtDT, err, toast, openModal, modalHead, closeModal, formData, selectOptions } = App;

  // ---------- 목록 ----------
  App.viewCustomers = async function (main) {
    await App.loadProfiles();
    main.innerHTML = `
      <div class="page-head">
        <h1>고객 관리</h1>
        <div class="head-actions"><button class="btn btn-primary" id="btn-new-customer">+ 새 고객</button></div>
      </div>
      <div class="toolbar">
        <input type="search" id="cust-q" placeholder="이름 · 전화 · 상호 검색">
        <select id="cust-status">
          <option value="">전체 상태</option>
          ${Object.entries(App.LABELS.customerStatus).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}
        </select>
        <select id="cust-owner">
          <option value="">전체 담당</option>
          ${(App.state.cache.profiles || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>고객명</th><th>구분</th><th>연락처</th><th>상태</th><th>담당</th><th>등록일</th></tr></thead>
        <tbody id="cust-body"><tr><td colspan="6" class="empty-row">불러오는 중…</td></tr></tbody>
      </table></div>`;

    async function load() {
      let q = sb.from('customers').select('*').order('created_at', { ascending: false }).limit(300);
      const kw = document.getElementById('cust-q').value.trim();
      const st = document.getElementById('cust-status').value;
      const ow = document.getElementById('cust-owner').value;
      if (kw) q = q.or(`name.ilike.%${kw}%,phone.ilike.%${kw}%,company_name.ilike.%${kw}%`);
      if (st) q = q.eq('status', st);
      if (ow) q = q.eq('owner_id', ow);
      const { data, error } = await q;
      if (error) return err(error);
      document.getElementById('cust-body').innerHTML = (data || []).map((c) => `
        <tr class="clickable" onclick="location.hash='#/customers/${c.id}'">
          <td><strong>${esc(c.name)}</strong>${c.company_name ? ` <span style="color:var(--muted)">· ${esc(c.company_name)}</span>` : ''}</td>
          <td>${App.LABELS.customerType[c.type] || '-'}</td>
          <td>${esc(c.phone || '-')}</td>
          <td>${badge('customerStatus', c.status)}</td>
          <td>${esc(App.nameOf('profiles', c.owner_id))}</td>
          <td>${fmtDate(c.created_at)}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-row">고객이 없습니다. 새 고객을 등록해 보세요.</td></tr>';
    }
    let t;
    document.getElementById('cust-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
    document.getElementById('cust-status').addEventListener('change', load);
    document.getElementById('cust-owner').addEventListener('change', load);
    document.getElementById('btn-new-customer').onclick = () => customerForm(null, load);
    await load();
    if (sessionStorage.getItem('openNewCustomer')) { sessionStorage.removeItem('openNewCustomer'); customerForm(null, load); }
  };

  // ---------- 등록/수정 폼 ----------
  function customerForm(cust, onSaved) {
    const profiles = App.state.cache.profiles || [];
    const c = cust || {};
    const modal = openModal(`
      ${modalHead(cust ? '고객 정보 수정' : '새 고객 등록')}
      <form id="cust-form" class="form-grid">
        <label>구분<select name="type">
          <option value="individual" ${c.type !== 'corporate' ? 'selected' : ''}>개인</option>
          <option value="corporate" ${c.type === 'corporate' ? 'selected' : ''}>법인</option>
        </select></label>
        <label>고객명 *<input name="name" required value="${esc(c.name || '')}"></label>
        <label>연락처<input name="phone" value="${esc(c.phone || '')}" placeholder="010-0000-0000"></label>
        <label>이메일<input type="email" name="email" value="${esc(c.email || '')}"></label>
        <label>상호(법인)<input name="company_name" value="${esc(c.company_name || '')}"></label>
        <label>사업자번호<input name="biz_no" value="${esc(c.biz_no || '')}"></label>
        <label>상태<select name="status">
          ${Object.entries(App.LABELS.customerStatus).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}
        </select></label>
        <label>담당자<select name="owner_id">
          <option value="">미지정</option>
          ${selectOptions(profiles, 'id', (p) => p.name, c.owner_id || App.state.profile.id)}
        </select></label>
        <label class="full">주소<input name="address" value="${esc(c.address || '')}"></label>
        <label class="full">메모<textarea name="memo" rows="3">${esc(c.memo || '')}</textarea></label>
        <div class="form-actions full">
          <button type="button" class="btn" onclick="App.closeModal()">취소</button>
          <button type="submit" class="btn btn-primary">${cust ? '저장' : '등록'}</button>
        </div>
      </form>`);
    modal.querySelector('#cust-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = formData(e.target);
      try {
        if (cust) {
          const { error } = await sb.from('customers').update(payload).eq('id', cust.id);
          if (error) throw error;
          App.log('update', 'customers', cust.id, payload.name);
        } else {
          const { error } = await sb.from('customers').insert(payload);
          if (error) throw error;
          App.log('create', 'customers', '', payload.name);
        }
        closeModal(); toast('저장되었습니다'); onSaved && onSaved();
      } catch (ex) { err(ex); }
    });
  }
  App.customerForm = customerForm;

  // ---------- 상세 ----------
  App.viewCustomerDetail = async function (main, id) {
    await App.loadProfiles();
    const [{ data: c, error }, quotesRes, contractsRes, consultsRes] = await Promise.all([
      sb.from('customers').select('*').eq('id', id).single(),
      sb.from('quotes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      sb.from('contracts').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      sb.from('consultations').select('*').eq('customer_id', id).order('consulted_at', { ascending: false }),
    ]);
    if (error) return err(error);

    const quotes = quotesRes.data || [], contracts = contractsRes.data || [], consults = consultsRes.data || [];

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(c.name)} ${badge('customerStatus', c.status)}</h1>
          <div class="sub">${App.LABELS.customerType[c.type]} · 담당 ${esc(App.nameOf('profiles', c.owner_id))} · 등록 ${fmtDate(c.created_at)}</div>
        </div>
        <div class="head-actions">
          <a class="btn" href="#/customers">← 목록</a>
          <button class="btn" id="btn-edit-cust">정보 수정</button>
          <button class="btn btn-primary" id="btn-new-quote">+ 견적 작성</button>
        </div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="card">
            <h3>기본 정보</h3>
            <dl class="kv">
              <dt>연락처</dt><dd>${esc(c.phone || '-')}</dd>
              <dt>이메일</dt><dd>${esc(c.email || '-')}</dd>
              <dt>상호</dt><dd>${esc(c.company_name || '-')}</dd>
              <dt>사업자번호</dt><dd>${esc(c.biz_no || '-')}</dd>
              <dt>주소</dt><dd>${esc(c.address || '-')}</dd>
              <dt>메모</dt><dd>${esc(c.memo || '-')}</dd>
            </dl>
          </div>
          <div class="card">
            <h3>견적 (${quotes.length})</h3>
            <div style="overflow-x:auto"><table class="data">
              <thead><tr><th>번호</th><th>차량</th><th>상품</th><th class="num">월 납입료</th><th>상태</th><th>작성일</th></tr></thead>
              <tbody>${quotes.map((q) => `
                <tr class="clickable" onclick="location.hash='#/quotes/${q.id}'">
                  <td>#${q.quote_no}</td><td>${esc(q.vehicle_text)}</td>
                  <td>${App.LABELS.productType[q.product_type]}</td>
                  <td class="num">${App.won(q.monthly_payment)}</td>
                  <td>${badge('quoteStatus', q.status)}</td><td>${fmtDate(q.created_at)}</td>
                </tr>`).join('') || '<tr><td colspan="6" class="empty-row">견적이 없습니다</td></tr>'}</tbody>
            </table></div>
          </div>
          <div class="card">
            <h3>계약 (${contracts.length})</h3>
            <div style="overflow-x:auto"><table class="data">
              <thead><tr><th>번호</th><th>차량</th><th class="num">월 납입료</th><th>만기일</th><th>상태</th></tr></thead>
              <tbody>${contracts.map((ct) => `
                <tr class="clickable" onclick="location.hash='#/contracts/${ct.id}'">
                  <td>#${ct.contract_no}</td><td>${esc(ct.vehicle_text)}</td>
                  <td class="num">${App.won(ct.monthly_payment)}</td>
                  <td>${fmtDate(ct.end_date)}</td><td>${badge('contractStatus', ct.status)}</td>
                </tr>`).join('') || '<tr><td colspan="5" class="empty-row">계약이 없습니다</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>

        <div class="card">
          <h3>상담 이력 (${consults.length})</h3>
          <form id="consult-form" class="form-col">
            <textarea name="content" rows="3" required placeholder="상담 내용을 입력하세요"></textarea>
            <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">기록 추가</button></div>
          </form>
          <ul class="timeline">
            ${consults.map((cs) => `
              <li>
                <div class="t-meta">${fmtDT(cs.consulted_at)} · ${esc(App.nameOf('profiles', cs.user_id))}</div>
                ${esc(cs.content)}
              </li>`).join('') || '<li style="color:var(--muted)">상담 기록이 없습니다</li>'}
          </ul>
        </div>
      </div>`;

    document.getElementById('btn-edit-cust').onclick = () => customerForm(c, () => App.viewCustomerDetail(main, id));
    document.getElementById('btn-new-quote').onclick = () => {
      sessionStorage.setItem('quoteCustomer', id);
      location.hash = '#/quotes';
      sessionStorage.setItem('openNewQuote', '1');
    };
    document.getElementById('consult-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = e.target.content.value.trim();
      if (!content) return;
      const { error: e2 } = await sb.from('consultations').insert({ customer_id: id, user_id: App.state.user.id, content });
      if (e2) return err(e2);
      // 리드 상태였으면 상담중으로
      if (c.status === 'lead') await sb.from('customers').update({ status: 'consulting' }).eq('id', id);
      App.viewCustomerDetail(main, id);
    });
  };
})();
