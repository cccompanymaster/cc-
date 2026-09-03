// 계약 관리 (목록 / 상세 / 상태 흐름 / 서류 첨부) + 만기 관리
(function () {
  const { sb, esc, won, wonU, badge, fmtDate, fmtDT, dday, err, toast, openModal, modalHead, closeModal } = App;

  const FLOW = { pending: 'review', review: 'approved', approved: 'delivered', delivered: 'active' };
  const FLOW_LABEL = { pending: '심사 접수', review: '승인 처리', approved: '출고 처리', delivered: '운영 전환' };

  // ---------- 목록 ----------
  App.viewContracts = async function (main) {
    await Promise.all([App.loadProfiles(), App.loadFinanciers()]);
    main.innerHTML = `
      <div class="page-head">
        <h1>계약 관리</h1>
        <div class="head-actions"><a class="btn btn-primary" href="#/quotes">견적에서 전환하기</a></div>
      </div>
      <div class="toolbar">
        <input type="search" id="ct-q" placeholder="고객명 · 차량 · 차량번호 검색">
        <select id="ct-status">
          <option value="">전체 상태</option>
          ${Object.entries(App.LABELS.contractStatus).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>번호</th><th>고객</th><th>차량</th><th>차량번호</th><th>상품</th><th class="num">월 납입료</th><th>계약일</th><th>만기일</th><th>상태</th><th>담당</th></tr></thead>
        <tbody id="ct-body"><tr><td colspan="10" class="empty-row">불러오는 중…</td></tr></tbody>
      </table></div>`;

    async function load() {
      let q = sb.from('contracts').select('*, customers(name)').order('created_at', { ascending: false }).limit(300);
      const st = document.getElementById('ct-status').value;
      const kw = document.getElementById('ct-q').value.trim();
      if (st) q = q.eq('status', st);
      if (kw) q = q.or(`vehicle_text.ilike.%${kw}%,plate_no.ilike.%${kw}%`);
      const { data, error } = await q;
      if (error) return err(error);
      let rows = data || [];
      if (kw) {
        // 고객명 검색은 클라이언트에서 병합 (조인 컬럼 or 필터 제약 회피)
        const kwLower = kw.toLowerCase();
        const byVehicle = new Set(rows.map((r) => r.id));
        const { data: byCust } = await sb.from('contracts').select('*, customers!inner(name)')
          .ilike('customers.name', `%${kw}%`).limit(100);
        (byCust || []).forEach((r) => { if (!byVehicle.has(r.id)) rows.push(r); });
        rows = rows.filter((r) =>
          (r.customers?.name || '').toLowerCase().includes(kwLower) ||
          (r.vehicle_text || '').toLowerCase().includes(kwLower) ||
          (r.plate_no || '').toLowerCase().includes(kwLower));
      }
      document.getElementById('ct-body').innerHTML = rows.map((r) => `
        <tr class="clickable" onclick="location.hash='#/contracts/${r.id}'">
          <td>#${r.contract_no}</td>
          <td><strong>${esc(r.customers?.name || '-')}</strong></td>
          <td>${esc(r.vehicle_text)}</td>
          <td>${esc(r.plate_no || '-')}</td>
          <td>${App.LABELS.productType[r.product_type]}</td>
          <td class="num">${won(r.monthly_payment)}</td>
          <td>${fmtDate(r.contract_date)}</td>
          <td>${fmtDate(r.end_date)}</td>
          <td>${badge('contractStatus', r.status)}</td>
          <td>${esc(App.nameOf('profiles', r.sales_id))}</td>
        </tr>`).join('') || '<tr><td colspan="10" class="empty-row">계약이 없습니다</td></tr>';
    }
    let t;
    document.getElementById('ct-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
    document.getElementById('ct-status').addEventListener('change', load);
    await load();
  };

  // ---------- 상세 ----------
  App.viewContractDetail = async function (main, id) {
    await Promise.all([App.loadProfiles(), App.loadFinanciers()]);
    const [{ data: c, error }, filesRes] = await Promise.all([
      sb.from('contracts').select('*, customers(id, name, phone)').eq('id', id).single(),
      sb.from('contract_files').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
    ]);
    if (error) return err(error);
    const files = filesRes.data || [];
    const d = dday(c.end_date);
    const isRunning = ['delivered', 'active'].includes(c.status);

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>계약 #${c.contract_no} ${badge('contractStatus', c.status)}
            ${c.end_result ? `<span class="badge b-purple">${App.LABELS.endResult[c.end_result]}</span>` : ''}</h1>
          <div class="sub">${esc(c.customers?.name)} · ${esc(c.vehicle_text)}
            ${isRunning && d != null ? ` · 만기 <strong>D-${d}</strong>` : ''}</div>
        </div>
        <div class="head-actions">
          <a class="btn" href="#/contracts">← 목록</a>
          <button class="btn" id="btn-edit-ct">정보 수정</button>
          ${FLOW[c.status] ? `<button class="btn btn-primary" id="btn-flow">${FLOW_LABEL[c.status]} →</button>` : ''}
          ${isRunning ? `<button class="btn" id="btn-end">만기 처리</button>` : ''}
          ${c.status === 'pending' || c.status === 'review' ? `<button class="btn btn-danger" id="btn-cancel">계약 취소</button>` : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="card">
            <h3>계약 정보</h3>
            <dl class="kv">
              <dt>고객</dt><dd><a href="#/customers/${c.customers?.id}">${esc(c.customers?.name)}</a> ${esc(c.customers?.phone || '')}</dd>
              <dt>차량</dt><dd>${esc(c.vehicle_text)} ${c.plate_no ? '(' + esc(c.plate_no) + ')' : ''}</dd>
              <dt>상품</dt><dd>${App.LABELS.productType[c.product_type]} · ${c.months}개월</dd>
              <dt>금융사</dt><dd>${esc(App.nameOf('financiers', c.financier_id))}</dd>
              <dt>차량가</dt><dd>${wonU(c.price)}</dd>
              <dt>월 납입료</dt><dd><strong>${wonU(c.monthly_payment)}</strong> (VAT 별도)</dd>
              <dt>보증금</dt><dd>${wonU(c.deposit)}</dd>
              <dt>선납금</dt><dd>${wonU(c.prepay)}</dd>
              <dt>잔존가치</dt><dd>${wonU(c.residual)}</dd>
              <dt>계약일</dt><dd>${fmtDate(c.contract_date)}</dd>
              <dt>출고일</dt><dd>${fmtDate(c.delivery_date)}</dd>
              <dt>만기일</dt><dd>${fmtDate(c.end_date)}</dd>
              <dt>보험 만기</dt><dd>${fmtDate(c.insurance_expiry)}</dd>
              <dt>금융사 수수료</dt><dd>${wonU(c.commission_amount)}</dd>
              <dt>담당</dt><dd>${esc(App.nameOf('profiles', c.sales_id))}</dd>
              <dt>비고</dt><dd>${esc(c.notes || '-')}</dd>
            </dl>
          </div>
        </div>
        <div class="card">
          <h3>계약 서류 (${files.length})</h3>
          <input type="file" id="ct-file" style="font-size:13px; margin-bottom:10px; width:100%">
          <ul class="file-list">
            ${files.map((f) => `
              <li>
                <a href="#" data-path="${esc(f.storage_path)}" class="file-dl">${esc(f.name)}</a>
                <span style="color:var(--muted);font-size:12px">${fmtDT(f.created_at)}</span>
              </li>`).join('') || '<li style="color:var(--muted);border:0">첨부된 서류가 없습니다 (계약서·신분증 등)</li>'}
          </ul>
        </div>
      </div>`;

    // 파일 업로드
    document.getElementById('ct-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) return toast('20MB 이하 파일만 업로드할 수 있습니다', true);
      // 스토리지 키는 ASCII만 허용 — 원본 파일명은 DB에 보관
      const ext = (file.name.match(/\.([A-Za-z0-9]+)$/) || [])[1] || 'bin';
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      try {
        const { error: e1 } = await sb.storage.from('contract-files').upload(path, file);
        if (e1) throw e1;
        const { error: e2 } = await sb.from('contract_files').insert({
          contract_id: id, name: file.name, storage_path: path, uploaded_by: App.state.user.id,
        });
        if (e2) throw e2;
        toast('업로드되었습니다'); App.viewContractDetail(main, id);
      } catch (ex) { err(ex); }
    });
    // 파일 다운로드 (서명 URL)
    main.querySelectorAll('.file-dl').forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const { data, error: e2 } = await sb.storage.from('contract-files').createSignedUrl(a.dataset.path, 120);
      if (e2) return err(e2);
      window.open(data.signedUrl, '_blank');
    }));

    // 상태 진행
    document.getElementById('btn-flow')?.addEventListener('click', async () => {
      const next = FLOW[c.status];
      const patch = { status: next };
      if (next === 'delivered' && !c.delivery_date) patch.delivery_date = App.today();
      try {
        const { error: e2 } = await sb.from('contracts').update(patch).eq('id', id);
        if (e2) throw e2;
        if (next === 'delivered' || next === 'active')
          await sb.from('customers').update({ status: 'active' }).eq('id', c.customer_id);
        App.log('update', 'contracts', id, '상태 → ' + next);
        toast('처리되었습니다'); App.viewContractDetail(main, id);
      } catch (ex) { err(ex); }
    });

    // 만기 처리
    document.getElementById('btn-end')?.addEventListener('click', () => endContract(c, () => App.viewContractDetail(main, id)));

    // 취소
    document.getElementById('btn-cancel')?.addEventListener('click', async () => {
      if (!confirm('이 계약을 취소 처리할까요?')) return;
      const { error: e2 } = await sb.from('contracts').update({ status: 'canceled' }).eq('id', id);
      if (e2) return err(e2);
      App.log('update', 'contracts', id, '계약 취소');
      App.viewContractDetail(main, id);
    });

    // 수정
    document.getElementById('btn-edit-ct').onclick = () => editContract(c, () => App.viewContractDetail(main, id));
  };

  // ---------- 수정 폼 ----------
  function editContract(c, onSaved) {
    const modal = openModal(`
      ${modalHead('계약 정보 수정')}
      <form id="cte-form" class="form-grid">
        <label>차량번호<input name="plate_no" value="${esc(c.plate_no || '')}"></label>
        <label>월 납입료(원)<input type="number" name="monthly_payment" value="${c.monthly_payment}" min="0" step="100"></label>
        <label>계약일<input type="date" name="contract_date" value="${c.contract_date || ''}"></label>
        <label>출고일<input type="date" name="delivery_date" value="${c.delivery_date || ''}"></label>
        <label>만기일<input type="date" name="end_date" value="${c.end_date || ''}"></label>
        <label>보험 만기<input type="date" name="insurance_expiry" value="${c.insurance_expiry || ''}"></label>
        <label>금융사 수수료(원)<input type="number" name="commission_amount" value="${c.commission_amount}" min="0" step="10000"></label>
        <label>담당자<select name="sales_id">
          ${App.selectOptions(App.state.cache.profiles || [], 'id', (p) => p.name, c.sales_id)}
        </select></label>
        <label class="full">비고<textarea name="notes" rows="2">${esc(c.notes || '')}</textarea></label>
        <div class="form-actions full">
          <button type="button" class="btn" onclick="App.closeModal()">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>`);
    modal.querySelector('#cte-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { error } = await sb.from('contracts').update(App.formData(e.target)).eq('id', c.id);
        if (error) throw error;
        App.log('update', 'contracts', c.id, '정보 수정');
        closeModal(); toast('저장되었습니다'); onSaved();
      } catch (ex) { err(ex); }
    });
  }

  // ---------- 만기 처리 ----------
  function endContract(c, onSaved) {
    const modal = openModal(`
      ${modalHead(`계약 #${c.contract_no} 만기 처리`)}
      <form id="end-form" class="form-col">
        <label>처리 결과<select name="end_result">
          <option value="renewal">재계약 (신규 견적으로 이어짐)</option>
          <option value="return">반납</option>
          <option value="purchase">고객 인수</option>
        </select></label>
        <label style="margin-top:10px">메모<textarea name="memo" rows="2" placeholder="처리 내용"></textarea></label>
        <div class="form-actions">
          <button type="button" class="btn" onclick="App.closeModal()">취소</button>
          <button type="submit" class="btn btn-primary">만기 처리</button>
        </div>
      </form>`);
    modal.querySelector('#end-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = App.formData(e.target);
      try {
        const { error } = await sb.from('contracts').update({
          status: 'ended', end_result: f.end_result,
          notes: [c.notes, f.memo ? '[만기] ' + f.memo : null].filter(Boolean).join('\n'),
        }).eq('id', c.id);
        if (error) throw error;
        await sb.from('customers').update({ status: f.end_result === 'renewal' ? 'consulting' : 'expired' }).eq('id', c.customer_id);
        App.log('update', 'contracts', c.id, '만기 처리: ' + f.end_result);
        closeModal(); toast('만기 처리되었습니다');
        if (f.end_result === 'renewal') {
          sessionStorage.setItem('quoteCustomer', c.customer_id);
          sessionStorage.setItem('openNewQuote', '1');
          location.hash = '#/quotes';
        } else onSaved();
      } catch (ex) { err(ex); }
    });
  }

  // ---------- 만기 관리 ----------
  App.viewExpiry = async function (main) {
    await App.loadProfiles();
    const in120 = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await sb.from('contracts')
      .select('*, customers(name, phone)')
      .in('status', ['delivered', 'active'])
      .not('end_date', 'is', null)
      .lte('end_date', in120)
      .order('end_date');
    if (error) return err(error);
    const rows = data || [];
    const overdue = rows.filter((c) => dday(c.end_date) < 0);
    const d30 = rows.filter((c) => { const d = dday(c.end_date); return d >= 0 && d <= 30; });
    const d60 = rows.filter((c) => { const d = dday(c.end_date); return d > 30 && d <= 60; });
    const d90p = rows.filter((c) => dday(c.end_date) > 60);

    const section = (title, list, cls) => `
      <div class="card">
        <h3><span class="dot ${cls}"></span>${title} (${list.length})</h3>
        <div style="overflow-x:auto"><table class="data">
          <thead><tr><th>D-day</th><th>고객</th><th>연락처</th><th>차량</th><th class="num">월 납입료</th><th>만기일</th><th>담당</th><th></th></tr></thead>
          <tbody>${list.map((c) => `
            <tr>
              <td><strong>${dday(c.end_date) < 0 ? 'D+' + (-dday(c.end_date)) : 'D-' + dday(c.end_date)}</strong></td>
              <td><a href="#/contracts/${c.id}">${esc(c.customers?.name || '-')}</a></td>
              <td>${esc(c.customers?.phone || '-')}</td>
              <td>${esc(c.vehicle_text)}</td>
              <td class="num">${won(c.monthly_payment)}</td>
              <td>${fmtDate(c.end_date)}</td>
              <td>${esc(App.nameOf('profiles', c.sales_id))}</td>
              <td><button class="btn btn-sm exp-end" data-id="${c.id}">만기 처리</button></td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty-row">해당 없음</td></tr>'}</tbody>
        </table></div>
      </div>`;

    main.innerHTML = `
      <div class="page-head">
        <div><h1>만기 관리</h1><div class="sub">운영중 계약의 만기 도래 현황 (120일 이내)</div></div>
      </div>
      ${overdue.length ? section('만기 경과 — 즉시 처리 필요', overdue, 'd30') : ''}
      ${section('D-30 이내', d30, 'd30')}
      ${section('D-31 ~ 60', d60, 'd60')}
      ${section('D-61 ~ 120', d90p, 'd90')}`;

    main.querySelectorAll('.exp-end').forEach((b) => b.addEventListener('click', () => {
      const c = rows.find((r) => r.id === b.dataset.id);
      endContract(c, () => App.viewExpiry(main));
    }));
  };
})();
