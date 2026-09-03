// 기준정보(차종/금융사) · 수수료 정산 · 설정
(function () {
  const { sb, esc, won, badge, fmtDate, err, toast, openModal, modalHead, closeModal, formData } = App;

  // ========== 차종 마스터 ==========
  App.viewVehicles = async function (main) {
    App.clearCache('vehicles');
    const vehicles = await App.loadVehicles();
    main.innerHTML = `
      <div class="page-head">
        <h1>차종 마스터</h1>
        <div class="head-actions"><button class="btn btn-primary" id="btn-new-v">+ 차종 추가</button></div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>브랜드</th><th>모델</th><th>트림</th><th>연료</th><th class="num">차량가</th><th>사용</th><th></th></tr></thead>
        <tbody>
          ${vehicles.map((v) => `
            <tr>
              <td>${esc(v.brand)}</td><td><strong>${esc(v.model)}</strong></td><td>${esc(v.trim || '-')}</td>
              <td>${esc(v.fuel || '-')}</td><td class="num">${won(v.price)}</td>
              <td>${v.active ? '<span class="badge b-green">사용</span>' : '<span class="badge">중지</span>'}</td>
              <td><button class="btn btn-sm v-edit" data-id="${v.id}">수정</button></td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty-row">등록된 차종이 없습니다</td></tr>'}
        </tbody>
      </table></div>`;

    function form(v) {
      const modal = openModal(`
        ${modalHead(v ? '차종 수정' : '차종 추가')}
        <form id="v-form" class="form-grid">
          <label>브랜드 *<input name="brand" required value="${esc(v?.brand || '')}"></label>
          <label>모델 *<input name="model" required value="${esc(v?.model || '')}"></label>
          <label>트림<input name="trim" value="${esc(v?.trim || '')}"></label>
          <label>연료<select name="fuel">
            ${['가솔린', '디젤', '하이브리드', '전기', 'LPG'].map((f) => `<option ${v?.fuel === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select></label>
          <label>차량가(원) *<input type="number" name="price" required min="0" step="100000" value="${v?.price || ''}"></label>
          <label>사용 여부<select name="active">
            <option value="true" ${v?.active !== false ? 'selected' : ''}>사용</option>
            <option value="false" ${v?.active === false ? 'selected' : ''}>중지</option>
          </select></label>
          <div class="form-actions full">
            <button type="button" class="btn" onclick="App.closeModal()">취소</button>
            <button type="submit" class="btn btn-primary">저장</button>
          </div>
        </form>`);
      modal.querySelector('#v-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p = formData(e.target); p.active = p.active === 'true';
        try {
          const { error } = v
            ? await sb.from('vehicles').update(p).eq('id', v.id)
            : await sb.from('vehicles').insert(p);
          if (error) throw error;
          closeModal(); toast('저장되었습니다'); App.viewVehicles(main);
        } catch (ex) { err(ex); }
      });
    }
    document.getElementById('btn-new-v').onclick = () => form(null);
    main.querySelectorAll('.v-edit').forEach((b) => b.onclick = () => form(vehicles.find((v) => v.id === b.dataset.id)));
  };

  // ========== 금융사 ==========
  App.viewFinanciers = async function (main) {
    App.clearCache('financiers');
    const financiers = await App.loadFinanciers();
    main.innerHTML = `
      <div class="page-head">
        <h1>제휴 금융사</h1>
        <div class="head-actions"><button class="btn btn-primary" id="btn-new-f">+ 금융사 추가</button></div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>금융사</th><th>구분</th><th>담당자</th><th>연락처</th><th class="num">기본 이율</th><th class="num">수수료율</th><th>비고</th><th>사용</th><th></th></tr></thead>
        <tbody>
          ${financiers.map((f) => `
            <tr>
              <td><strong>${esc(f.name)}</strong></td>
              <td>${App.LABELS.financierType[f.type] || f.type}</td>
              <td>${esc(f.contact_name || '-')}</td><td>${esc(f.contact_phone || '-')}</td>
              <td class="num">${f.default_rate != null ? f.default_rate + '%' : '-'}</td>
              <td class="num">${f.commission_rate != null ? f.commission_rate + '%' : '-'}</td>
              <td style="white-space:normal">${esc(f.notes || '-')}</td>
              <td>${f.active ? '<span class="badge b-green">사용</span>' : '<span class="badge">중지</span>'}</td>
              <td><button class="btn btn-sm f-edit" data-id="${f.id}">수정</button></td>
            </tr>`).join('') || '<tr><td colspan="9" class="empty-row">등록된 금융사가 없습니다</td></tr>'}
        </tbody>
      </table></div>`;

    function form(f) {
      const modal = openModal(`
        ${modalHead(f ? '금융사 수정' : '금융사 추가')}
        <form id="f-form" class="form-grid">
          <label>금융사명 *<input name="name" required value="${esc(f?.name || '')}"></label>
          <label>구분<select name="type">
            ${Object.entries(App.LABELS.financierType).map(([k, v]) => `<option value="${k}" ${f?.type === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select></label>
          <label>담당자<input name="contact_name" value="${esc(f?.contact_name || '')}"></label>
          <label>연락처<input name="contact_phone" value="${esc(f?.contact_phone || '')}"></label>
          <label>기본 이율(%)<input type="number" name="default_rate" step="0.1" value="${f?.default_rate ?? ''}"></label>
          <label>수수료율(%)<input type="number" name="commission_rate" step="0.1" value="${f?.commission_rate ?? ''}"></label>
          <label class="full">비고<input name="notes" value="${esc(f?.notes || '')}"></label>
          <label>사용 여부<select name="active">
            <option value="true" ${f?.active !== false ? 'selected' : ''}>사용</option>
            <option value="false" ${f?.active === false ? 'selected' : ''}>중지</option>
          </select></label>
          <div class="form-actions full">
            <button type="button" class="btn" onclick="App.closeModal()">취소</button>
            <button type="submit" class="btn btn-primary">저장</button>
          </div>
        </form>`);
      modal.querySelector('#f-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p = formData(e.target); p.active = p.active === 'true';
        try {
          const { error } = f
            ? await sb.from('financiers').update(p).eq('id', f.id)
            : await sb.from('financiers').insert(p);
          if (error) throw error;
          closeModal(); toast('저장되었습니다'); App.viewFinanciers(main);
        } catch (ex) { err(ex); }
      });
    }
    document.getElementById('btn-new-f').onclick = () => form(null);
    main.querySelectorAll('.f-edit').forEach((b) => b.onclick = () => form(financiers.find((f) => f.id === b.dataset.id)));
  };

  // ========== 수수료 정산 ==========
  App.viewCommissions = async function (main) {
    await App.loadProfiles();
    const thisMonth = new Date().toISOString().slice(0, 7);
    main.innerHTML = `
      <div class="page-head">
        <div><h1>수수료 정산</h1><div class="sub">계약 전환 시 자동 생성됩니다. 지급률·금액을 조정한 뒤 정산 완료 처리하세요.</div></div>
        <div class="head-actions"><button class="btn" id="btn-csv">CSV 다운로드</button></div>
      </div>
      <div class="toolbar">
        <input type="month" id="cm-month" value="${thisMonth}">
        <select id="cm-settled">
          <option value="">전체</option><option value="false">미정산</option><option value="true">정산완료</option>
        </select>
        <div class="spacer"></div>
        <div id="cm-total" style="font-weight:700"></div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>계약</th><th>고객</th><th>차량</th><th>담당</th><th class="num">수수료 매출</th><th class="num">지급률</th><th class="num">지급액</th><th>상태</th><th></th></tr></thead>
        <tbody id="cm-body"><tr><td colspan="9" class="empty-row">불러오는 중…</td></tr></tbody>
      </table></div>`;

    let rows = [];
    async function load() {
      let q = sb.from('commissions').select('*, contracts(contract_no, vehicle_text, customers(name))')
        .order('created_at', { ascending: false });
      const m = document.getElementById('cm-month').value;
      const st = document.getElementById('cm-settled').value;
      if (m) q = q.eq('settle_month', m);
      if (st) q = q.eq('settled', st === 'true');
      const { data, error } = await q;
      if (error) return err(error);
      rows = data || [];
      const totBase = rows.reduce((s, r) => s + Number(r.base_amount || 0), 0);
      const totPay = rows.reduce((s, r) => s + Number(r.sales_amount || 0), 0);
      document.getElementById('cm-total').textContent = `매출 ${won(totBase)}원 · 지급 ${won(totPay)}원`;
      document.getElementById('cm-body').innerHTML = rows.map((r) => `
        <tr>
          <td><a href="#/contracts/${r.contract_id}">#${r.contracts?.contract_no ?? '-'}</a></td>
          <td>${esc(r.contracts?.customers?.name || '-')}</td>
          <td>${esc(r.contracts?.vehicle_text || '-')}</td>
          <td>${esc(App.nameOf('profiles', r.sales_id))}</td>
          <td class="num">${won(r.base_amount)}</td>
          <td class="num">${r.sales_rate}%</td>
          <td class="num"><strong>${won(r.sales_amount)}</strong></td>
          <td>${r.settled ? '<span class="badge b-green">정산완료</span>' : '<span class="badge b-amber">미정산</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm cm-edit" data-id="${r.id}">수정</button>
            ${!r.settled ? `<button class="btn btn-sm btn-primary cm-settle" data-id="${r.id}">정산 완료</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="9" class="empty-row">해당 월 정산 건이 없습니다</td></tr>';

      main.querySelectorAll('.cm-settle').forEach((b) => b.onclick = async () => {
        const { error } = await sb.from('commissions').update({ settled: true }).eq('id', b.dataset.id);
        if (error) return err(error);
        toast('정산 완료 처리되었습니다'); load();
      });
      main.querySelectorAll('.cm-edit').forEach((b) => b.onclick = () => {
        const r = rows.find((x) => x.id === b.dataset.id);
        const modal = openModal(`
          ${modalHead('정산 수정')}
          <form id="cm-form" class="form-grid">
            <label>수수료 매출(원)<input type="number" name="base_amount" value="${r.base_amount}" min="0" step="10000" id="cmf-base"></label>
            <label>지급률(%)<input type="number" name="sales_rate" value="${r.sales_rate}" min="0" max="100" step="1" id="cmf-rate"></label>
            <label>지급액(원)<input type="number" name="sales_amount" value="${r.sales_amount}" min="0" step="1000" id="cmf-amt"></label>
            <label>귀속월<input type="month" name="settle_month" value="${r.settle_month || ''}"></label>
            <label class="full">메모<input name="memo" value="${esc(r.memo || '')}"></label>
            <div class="form-actions full">
              <button type="button" class="btn" onclick="App.closeModal()">취소</button>
              <button type="submit" class="btn btn-primary">저장</button>
            </div>
          </form>`);
        const auto = () => {
          const base = +modal.querySelector('#cmf-base').value || 0;
          const rate = +modal.querySelector('#cmf-rate').value || 0;
          modal.querySelector('#cmf-amt').value = Math.round(base * rate / 100);
        };
        modal.querySelector('#cmf-base').addEventListener('input', auto);
        modal.querySelector('#cmf-rate').addEventListener('input', auto);
        modal.querySelector('#cm-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const { error } = await sb.from('commissions').update(formData(e.target)).eq('id', r.id);
          if (error) return err(error);
          closeModal(); toast('저장되었습니다'); load();
        });
      });
    }
    document.getElementById('cm-month').addEventListener('change', load);
    document.getElementById('cm-settled').addEventListener('change', load);
    document.getElementById('btn-csv').onclick = () => {
      const m = document.getElementById('cm-month').value || '전체';
      App.downloadCSV(`수수료정산_${m}.csv`, [
        ['계약번호', '고객', '차량', '담당', '수수료매출', '지급률(%)', '지급액', '귀속월', '정산상태', '메모'],
        ...rows.map((r) => [
          '#' + (r.contracts?.contract_no ?? ''), r.contracts?.customers?.name || '', r.contracts?.vehicle_text || '',
          App.nameOf('profiles', r.sales_id), r.base_amount, r.sales_rate, r.sales_amount,
          r.settle_month || '', r.settled ? '정산완료' : '미정산', r.memo || '',
        ]),
      ]);
    };
    await load();
  };

  // ========== 설정 ==========
  App.viewSettings = async function (main) {
    const me = App.state.profile;
    const isAdmin = me.role === 'admin';
    App.clearCache('profiles');
    const profiles = await App.loadProfiles();

    main.innerHTML = `
      <div class="page-head"><h1>설정</h1></div>
      <div class="detail-grid">
        <div class="card">
          <h3>사용자 관리 ${isAdmin ? '' : '<span style="font-size:12px;color:var(--muted)">(관리자만 변경 가능)</span>'}</h3>
          <div style="overflow-x:auto"><table class="data">
            <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th>상태</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
            <tbody>
              ${profiles.map((p) => `
                <tr>
                  <td><strong>${esc(p.name)}</strong>${p.id === me.id ? ' <span class="badge b-blue">나</span>' : ''}</td>
                  <td>${esc(p.email)}</td>
                  <td>${App.LABELS.role[p.role]}</td>
                  <td>${p.approved ? '<span class="badge b-green">승인</span>' : '<span class="badge b-amber">대기</span>'}</td>
                  ${isAdmin ? `<td style="white-space:nowrap">
                    ${!p.approved ? `<button class="btn btn-sm btn-primary u-approve" data-id="${p.id}">승인</button>` : ''}
                    ${p.id !== me.id ? `<button class="btn btn-sm u-role" data-id="${p.id}" data-role="${p.role}">${p.role === 'admin' ? '영업으로' : '관리자로'}</button>` : ''}
                    ${p.approved && p.id !== me.id ? `<button class="btn btn-sm btn-danger u-block" data-id="${p.id}">차단</button>` : ''}
                  </td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
        <div class="card">
          <h3>내 정보</h3>
          <form id="me-form" class="form-col">
            <label>이름<input name="name" value="${esc(me.name)}"></label>
            <label style="margin-top:10px">연락처<input name="phone" value="${esc(me.phone || '')}"></label>
            <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">저장</button></div>
          </form>
          <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
          <p style="font-size:12.5px;color:var(--muted)">
            데이터는 Supabase(리전: 서울)에 저장되며, 승인된 사용자만 접근할 수 있습니다.<br>
            비밀번호 재설정은 로그인 화면에서 관리자에게 문의하세요.
          </p>
        </div>
      </div>`;

    if (isAdmin) {
      main.querySelectorAll('.u-approve').forEach((b) => b.onclick = async () => {
        const { error } = await sb.from('profiles').update({ approved: true }).eq('id', b.dataset.id);
        if (error) return err(error);
        toast('승인되었습니다'); App.viewSettings(main);
      });
      main.querySelectorAll('.u-role').forEach((b) => b.onclick = async () => {
        const next = b.dataset.role === 'admin' ? 'sales' : 'admin';
        const { error } = await sb.from('profiles').update({ role: next }).eq('id', b.dataset.id);
        if (error) return err(error);
        toast('역할이 변경되었습니다'); App.viewSettings(main);
      });
      main.querySelectorAll('.u-block').forEach((b) => b.onclick = async () => {
        if (!confirm('이 사용자의 접근을 차단할까요?')) return;
        const { error } = await sb.from('profiles').update({ approved: false }).eq('id', b.dataset.id);
        if (error) return err(error);
        toast('차단되었습니다'); App.viewSettings(main);
      });
    }
    document.getElementById('me-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await sb.from('profiles').update(formData(e.target)).eq('id', me.id);
      if (error) return err(error);
      me.name = e.target.name.value;
      document.getElementById('side-user-name').textContent = me.name;
      toast('저장되었습니다');
    });
  };
})();
