// 견적 관리 (목록 / 작성 계산기 / 상세·견적서 출력 / 계약 전환)
(function () {
  const { sb, esc, won, wonU, badge, fmtDate, err, toast, openModal, modalHead, closeModal, calcMonthly } = App;

  // ---------- 목록 ----------
  App.viewQuotes = async function (main) {
    await Promise.all([App.loadProfiles(), App.loadFinanciers(), App.loadVehicles()]);
    main.innerHTML = `
      <div class="page-head">
        <h1>견적 관리</h1>
        <div class="head-actions"><button class="btn btn-primary" id="btn-new-quote">+ 새 견적</button></div>
      </div>
      <div class="toolbar">
        <select id="q-status">
          <option value="">전체 상태</option>
          ${Object.entries(App.LABELS.quoteStatus).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>번호</th><th>고객</th><th>차량</th><th>상품</th><th>기간</th><th class="num">월 납입료</th><th>금융사</th><th>상태</th><th>작성일</th></tr></thead>
        <tbody id="q-body"><tr><td colspan="9" class="empty-row">불러오는 중…</td></tr></tbody>
      </table></div>`;

    async function load() {
      let q = sb.from('quotes').select('*, customers(name)').order('created_at', { ascending: false }).limit(300);
      const st = document.getElementById('q-status').value;
      if (st) q = q.eq('status', st);
      const { data, error } = await q;
      if (error) return err(error);
      document.getElementById('q-body').innerHTML = (data || []).map((r) => `
        <tr class="clickable" onclick="location.hash='#/quotes/${r.id}'">
          <td>#${r.quote_no}</td>
          <td><strong>${esc(r.customers?.name || '-')}</strong></td>
          <td>${esc(r.vehicle_text)}</td>
          <td>${App.LABELS.productType[r.product_type]}</td>
          <td>${r.months}개월</td>
          <td class="num">${won(r.monthly_payment)}</td>
          <td>${esc(App.nameOf('financiers', r.financier_id))}</td>
          <td>${badge('quoteStatus', r.status)}</td>
          <td>${fmtDate(r.created_at)}</td>
        </tr>`).join('') || '<tr><td colspan="9" class="empty-row">견적이 없습니다</td></tr>';
    }
    document.getElementById('q-status').addEventListener('change', load);
    document.getElementById('btn-new-quote').onclick = () => quoteForm(load);
    await load();
    if (sessionStorage.getItem('openNewQuote')) { sessionStorage.removeItem('openNewQuote'); quoteForm(load); }
  };

  // ---------- 작성 (계산기) ----------
  async function quoteForm(onSaved) {
    const [financiers, vehicles] = [App.state.cache.financiers || [], App.state.cache.vehicles || []];
    const { data: customers } = await sb.from('customers').select('id, name, phone').order('name').limit(500);
    const presetCustomer = sessionStorage.getItem('quoteCustomer') || '';
    sessionStorage.removeItem('quoteCustomer');

    const modal = openModal(`
      ${modalHead('새 견적 작성')}
      <form id="quote-form" class="form-grid">
        <label class="full">고객 *<select name="customer_id" required>
          <option value="">선택하세요</option>
          ${(customers || []).map((c) => `<option value="${c.id}" ${c.id === presetCustomer ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' (' + esc(c.phone) + ')' : ''}</option>`).join('')}
        </select></label>
        <label class="full">차종 선택 (마스터)<select name="vehicle_id" id="qf-vehicle">
          <option value="">직접 입력</option>
          ${vehicles.filter((v) => v.active).map((v) => `<option value="${v.id}" data-price="${v.price}" data-name="${esc(v.brand + ' ' + v.model + (v.trim ? ' ' + v.trim : ''))}">${esc(v.brand)} ${esc(v.model)} ${esc(v.trim || '')} — ${won(v.price)}원</option>`).join('')}
        </select></label>
        <label>차량명 *<input name="vehicle_text" id="qf-vtext" required placeholder="예: 그랜저 2.5"></label>
        <label>차량가(원) *<input type="number" name="price" id="qf-price" required min="0" step="10000"></label>
        <label>상품<select name="product_type">
          <option value="rent">장기렌트</option><option value="lease">리스</option>
        </select></label>
        <label>금융사<select name="financier_id" id="qf-fin">
          <option value="">선택</option>
          ${financiers.filter((f) => f.active).map((f) => `<option value="${f.id}" data-rate="${f.default_rate ?? ''}">${esc(f.name)}</option>`).join('')}
        </select></label>
        <label>계약기간<select name="months" id="qf-months">
          <option>24</option><option>36</option><option value="48" selected>48</option><option>60</option>
        </select></label>
        <label>이율(%)<input type="number" name="rate" id="qf-rate" value="7" step="0.1" min="0"></label>
        <label>보증금(%)<input type="number" name="deposit_pct" id="qf-dep" value="0" step="5" min="0" max="50"></label>
        <label>선납금(%)<input type="number" name="prepay_pct" id="qf-pre" value="0" step="5" min="0" max="50"></label>
        <label>잔가율(%)<input type="number" name="residual_pct" id="qf-res" value="40" step="1" min="0" max="70"></label>
        <label class="full">비고<input name="notes"></label>
        <div class="full">
          <div class="calc-result"><span class="label">예상 월 납입료 (VAT 별도)</span><span class="amount" id="qf-monthly">0원</span></div>
          <p class="calc-note">간이 계산 참고용입니다. 실제 납입료는 금융사 심사 조건에 따라 달라질 수 있습니다.</p>
        </div>
        <div class="form-actions full">
          <button type="button" class="btn" onclick="App.closeModal()">취소</button>
          <button type="submit" class="btn btn-primary">견적 저장</button>
        </div>
      </form>`, { large: true });

    const $ = (id) => modal.querySelector(id);
    let monthly = 0;
    function recalc() {
      monthly = calcMonthly({
        price: +$('#qf-price').value || 0,
        prepayPct: +$('#qf-pre').value || 0,
        depositPct: +$('#qf-dep').value || 0,
        residualPct: +$('#qf-res').value || 0,
        rate: +$('#qf-rate').value || 0,
        months: +$('#qf-months').value || 48,
      });
      $('#qf-monthly').textContent = wonU(monthly);
    }
    ['#qf-price', '#qf-rate', '#qf-dep', '#qf-pre', '#qf-res', '#qf-months'].forEach((id) =>
      $(id).addEventListener('input', recalc));
    $('#qf-vehicle').addEventListener('change', (e) => {
      const opt = e.target.selectedOptions[0];
      if (opt && opt.value) {
        $('#qf-vtext').value = opt.dataset.name;
        $('#qf-price').value = opt.dataset.price;
      }
      recalc();
    });
    $('#qf-fin').addEventListener('change', (e) => {
      const r = e.target.selectedOptions[0]?.dataset.rate;
      if (r) { $('#qf-rate').value = r; recalc(); }
    });

    modal.querySelector('#quote-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      recalc();
      const payload = App.formData(e.target);
      payload.monthly_payment = monthly;
      payload.created_by = App.state.user.id;
      try {
        const { data, error } = await sb.from('quotes').insert(payload).select('id').single();
        if (error) throw error;
        // 고객 상태 갱신 (리드/상담중 → 견적)
        await sb.from('customers').update({ status: 'quoted' })
          .eq('id', payload.customer_id).in('status', ['lead', 'consulting']);
        App.log('create', 'quotes', data.id, payload.vehicle_text);
        closeModal(); toast('견적이 저장되었습니다');
        location.hash = '#/quotes/' + data.id;
        onSaved && onSaved();
      } catch (ex) { err(ex); }
    });
  }

  // ---------- 상세 ----------
  App.viewQuoteDetail = async function (main, id) {
    await Promise.all([App.loadProfiles(), App.loadFinanciers()]);
    const { data: q, error } = await sb.from('quotes').select('*, customers(id, name, phone, company_name)').eq('id', id).single();
    if (error) return err(error);
    const finName = App.nameOf('financiers', q.financier_id);

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>견적 #${q.quote_no} ${badge('quoteStatus', q.status)}</h1>
          <div class="sub">${esc(q.customers?.name)} · ${fmtDate(q.created_at)} 작성 · 작성자 ${esc(App.nameOf('profiles', q.created_by))}</div>
        </div>
        <div class="head-actions">
          <a class="btn" href="#/quotes">← 목록</a>
          <button class="btn" id="btn-print">견적서 출력</button>
          ${q.status !== 'accepted' ? `
            <button class="btn" id="btn-sent" ${q.status === 'sent' ? 'disabled' : ''}>발송 처리</button>
            <button class="btn btn-danger" id="btn-reject">미성사</button>
            <button class="btn btn-primary" id="btn-convert">계약 전환 →</button>` : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div class="card">
          <h3>견적 내용</h3>
          <dl class="kv">
            <dt>고객</dt><dd><a href="#/customers/${q.customers?.id}">${esc(q.customers?.name)}</a> ${esc(q.customers?.phone || '')}</dd>
            <dt>차량</dt><dd>${esc(q.vehicle_text)}</dd>
            <dt>차량가</dt><dd>${wonU(q.price)}</dd>
            <dt>상품</dt><dd>${App.LABELS.productType[q.product_type]}</dd>
            <dt>금융사</dt><dd>${esc(finName)}</dd>
            <dt>계약기간</dt><dd>${q.months}개월</dd>
            <dt>보증금</dt><dd>${q.deposit_pct}% (${wonU(q.price * q.deposit_pct / 100)})</dd>
            <dt>선납금</dt><dd>${q.prepay_pct}% (${wonU(q.price * q.prepay_pct / 100)})</dd>
            <dt>잔가율</dt><dd>${q.residual_pct}%</dd>
            <dt>이율</dt><dd>${q.rate}%</dd>
            <dt>비고</dt><dd>${esc(q.notes || '-')}</dd>
          </dl>
          <div class="calc-result"><span class="label">월 납입료 (VAT 별도)</span><span class="amount">${wonU(q.monthly_payment)}</span></div>
        </div>
        <div class="card">
          <h3>다음 단계</h3>
          <p style="font-size:13px;color:var(--ink2)">
            고객에게 견적서를 출력·전달한 뒤 <strong>발송 처리</strong>하세요.<br><br>
            고객이 진행을 결정하면 <strong>계약 전환</strong>으로 계약 건을 생성합니다. 차량번호·출고일은 계약에서 입력합니다.
          </p>
        </div>
      </div>`;

    document.getElementById('btn-print')?.addEventListener('click', () => printQuote(q, finName));
    document.getElementById('btn-sent')?.addEventListener('click', async () => {
      const { error: e2 } = await sb.from('quotes').update({ status: 'sent' }).eq('id', id);
      if (e2) return err(e2);
      toast('발송 처리되었습니다'); App.viewQuoteDetail(main, id);
    });
    document.getElementById('btn-reject')?.addEventListener('click', async () => {
      if (!confirm('이 견적을 미성사 처리할까요?')) return;
      const { error: e2 } = await sb.from('quotes').update({ status: 'rejected' }).eq('id', id);
      if (e2) return err(e2);
      App.viewQuoteDetail(main, id);
    });
    document.getElementById('btn-convert')?.addEventListener('click', () => convertToContract(q));
  };

  // ---------- 견적서 출력 ----------
  function printQuote(q, finName) {
    const root = document.getElementById('print-root');
    root.innerHTML = `
      <div class="print-sheet">
        <h1>견 적 서</h1>
        <table>
          <tr><th>견적번호</th><td>Q-${q.quote_no}</td><th>견적일</th><td>${fmtDate(q.created_at)}</td></tr>
          <tr><th>고객명</th><td>${esc(q.customers?.name || '')}</td><th>연락처</th><td>${esc(q.customers?.phone || '-')}</td></tr>
        </table>
        <table>
          <tr><th>차량</th><td colspan="3">${esc(q.vehicle_text)}</td></tr>
          <tr><th>차량가격</th><td>${wonU(q.price)}</td><th>상품구분</th><td>${App.LABELS.productType[q.product_type]}</td></tr>
          <tr><th>금융사</th><td>${esc(finName)}</td><th>계약기간</th><td>${q.months}개월</td></tr>
          <tr><th>보증금</th><td>${q.deposit_pct}% (${wonU(q.price * q.deposit_pct / 100)})</td><th>선납금</th><td>${q.prepay_pct}% (${wonU(q.price * q.prepay_pct / 100)})</td></tr>
          <tr><th>만기 잔가율</th><td>${q.residual_pct}%</td><th>적용 이율</th><td>연 ${q.rate}%</td></tr>
          <tr><th>월 납입료</th><td colspan="3" class="p-amount">${wonU(q.monthly_payment)} (VAT 별도)</td></tr>
        </table>
        ${q.notes ? `<table><tr><th>비고</th><td>${esc(q.notes)}</td></tr></table>` : ''}
        <p class="p-foot">본 견적은 참고용이며, 실제 조건은 금융사 심사 결과에 따라 달라질 수 있습니다. 견적 유효기간: 발행일로부터 7일</p>
      </div>`;
    window.print();
  }

  // ---------- 계약 전환 ----------
  function convertToContract(q) {
    const modal = openModal(`
      ${modalHead('계약 전환')}
      <form id="cv-form" class="form-grid">
        <label>계약일 *<input type="date" name="contract_date" required value="${App.today()}"></label>
        <label>출고(인도) 예정일<input type="date" name="delivery_date"></label>
        <label>차량번호<input name="plate_no" placeholder="12가3456"></label>
        <label>금융사 수수료(원)<input type="number" name="commission_amount" min="0" step="10000" value="${Math.round(q.price * 0.05 / 10000) * 10000}"></label>
        <div class="form-actions full">
          <button type="button" class="btn" onclick="App.closeModal()">취소</button>
          <button type="submit" class="btn btn-primary">계약 생성</button>
        </div>
      </form>`);
    modal.querySelector('#cv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = App.formData(e.target);
      const endDate = App.addMonths(f.contract_date, q.months);
      try {
        const { data: ct, error } = await sb.from('contracts').insert({
          quote_id: q.id, customer_id: q.customer_id, financier_id: q.financier_id,
          sales_id: q.created_by || App.state.user.id,
          product_type: q.product_type, vehicle_text: q.vehicle_text, plate_no: f.plate_no,
          price: q.price, months: q.months, monthly_payment: q.monthly_payment,
          deposit: q.price * q.deposit_pct / 100, prepay: q.price * q.prepay_pct / 100,
          residual: q.price * q.residual_pct / 100,
          contract_date: f.contract_date, delivery_date: f.delivery_date, end_date: endDate,
          commission_amount: +f.commission_amount || 0, status: 'pending',
        }).select('id, contract_no').single();
        if (error) throw error;
        await sb.from('quotes').update({ status: 'accepted' }).eq('id', q.id);
        await sb.from('customers').update({ status: 'contracted' }).eq('id', q.customer_id);
        // 수수료 정산 행 자동 생성 (지급률 기본 50%)
        const base = +f.commission_amount || 0;
        await sb.from('commissions').insert({
          contract_id: ct.id, sales_id: q.created_by || App.state.user.id,
          base_amount: base, sales_rate: 50, sales_amount: Math.round(base * 0.5),
          settle_month: String(f.contract_date).slice(0, 7),
        });
        App.log('create', 'contracts', ct.id, '견적 #' + q.quote_no + ' 전환');
        closeModal(); toast(`계약 #${ct.contract_no} 이(가) 생성되었습니다`);
        location.hash = '#/contracts/' + ct.id;
      } catch (ex) { err(ex); }
    });
  }
})();
