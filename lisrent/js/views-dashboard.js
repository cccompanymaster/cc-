// 대시보드
(function () {
  const { sb, esc, won, badge, fmtDate, dday, today, err } = App;

  App.viewDashboard = async function (main) {
    main.innerHTML = '<div class="page-head"><h1>대시보드</h1></div><p style="color:var(--muted)">불러오는 중…</p>';

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const in90 = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

    try {
      const [profiles, monthContracts, activeCnt, expiring, recent, sixMonth] = await Promise.all([
        App.loadProfiles(),
        sb.from('contracts').select('id, commission_amount, sales_id').gte('contract_date', monthStart).neq('status', 'canceled'),
        sb.from('contracts').select('id', { count: 'exact', head: true }).in('status', ['delivered', 'active']),
        sb.from('contracts').select('id, contract_no, vehicle_text, end_date, sales_id, customers(name)')
          .in('status', ['delivered', 'active']).not('end_date', 'is', null)
          .lte('end_date', in90).order('end_date').limit(8),
        sb.from('contracts').select('id, contract_no, vehicle_text, status, contract_date, monthly_payment, customers(name)')
          .order('created_at', { ascending: false }).limit(6),
        sb.from('contracts').select('contract_date').gte('contract_date', sixAgo).neq('status', 'canceled'),
      ]);
      for (const r of [monthContracts, expiring, recent, sixMonth]) if (r.error) throw r.error;

      const mc = monthContracts.data || [];
      const monthRevenue = mc.reduce((s, c) => s + Number(c.commission_amount || 0), 0);

      // 최근 6개월 계약 건수 (단일 시리즈)
      const buckets = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ key: d.toISOString().slice(0, 7), label: (d.getMonth() + 1) + '월', count: 0 });
      }
      (sixMonth.data || []).forEach((c) => {
        const b = buckets.find((b) => c.contract_date && c.contract_date.startsWith(b.key));
        if (b) b.count++;
      });
      const maxCnt = Math.max(1, ...buckets.map((b) => b.count));

      const expRows = (expiring.data || []).map((c) => {
        const d = dday(c.end_date);
        const cls = d <= 30 ? 'd30' : d <= 60 ? 'd60' : 'd90';
        return `<tr class="clickable" onclick="location.hash='#/contracts/${c.id}'">
          <td><span class="dot ${cls}"></span>D-${d}</td>
          <td>${esc(c.customers?.name || '-')}</td>
          <td>${esc(c.vehicle_text)}</td>
          <td>${fmtDate(c.end_date)}</td>
          <td>${esc(App.nameOf('profiles', c.sales_id))}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" class="empty-row">90일 내 만기 예정 계약이 없습니다</td></tr>';

      const recentRows = (recent.data || []).map((c) => `
        <tr class="clickable" onclick="location.hash='#/contracts/${c.id}'">
          <td>#${c.contract_no}</td>
          <td>${esc(c.customers?.name || '-')}</td>
          <td>${esc(c.vehicle_text)}</td>
          <td class="num">${won(c.monthly_payment)}</td>
          <td>${badge('contractStatus', c.status)}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty-row">아직 계약이 없습니다</td></tr>';

      main.innerHTML = `
        <div class="page-head">
          <div><h1>대시보드</h1><div class="sub">${today()} 기준</div></div>
          <div class="head-actions">
            <a class="btn" href="#/quotes" onclick="sessionStorage.setItem('openNewQuote','1')">+ 새 견적</a>
            <a class="btn btn-primary" href="#/customers" onclick="sessionStorage.setItem('openNewCustomer','1')">+ 새 고객</a>
          </div>
        </div>

        <div class="stat-row">
          <div class="stat-tile"><div class="label">이달 신규 계약</div><div class="value">${mc.length}<small>건</small></div></div>
          <div class="stat-tile"><div class="label">이달 수수료 매출</div><div class="value">${won(monthRevenue)}<small>원</small></div></div>
          <div class="stat-tile"><div class="label">운영중 계약</div><div class="value">${activeCnt.count ?? 0}<small>건</small></div></div>
          <div class="stat-tile"><div class="label">90일 내 만기</div><div class="value">${(expiring.data || []).length}<small>건</small></div></div>
        </div>

        <div class="dash-grid">
          <div class="card">
            <h3>월별 계약 건수 (최근 6개월)</h3>
            <div class="mini-bars">
              ${buckets.map((b) => `
                <div class="mini-bar" title="${b.key}: ${b.count}건">
                  <div class="v">${b.count}</div>
                  <div class="bar" style="height:${Math.round(b.count / maxCnt * 100)}%"></div>
                  <div class="m">${b.label}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="card">
            <h3>만기 임박 <a href="#/expiry" style="font-size:12.5px;font-weight:500;float:right">전체 보기 →</a></h3>
            <div style="overflow-x:auto"><table class="data">
              <thead><tr><th>D-day</th><th>고객</th><th>차량</th><th>만기일</th><th>담당</th></tr></thead>
              <tbody>${expRows}</tbody>
            </table></div>
          </div>
        </div>

        <div class="card">
          <h3>최근 계약 <a href="#/contracts" style="font-size:12.5px;font-weight:500;float:right">전체 보기 →</a></h3>
          <div style="overflow-x:auto"><table class="data">
            <thead><tr><th>번호</th><th>고객</th><th>차량</th><th class="num">월 납입료</th><th>상태</th></tr></thead>
            <tbody>${recentRows}</tbody>
          </table></div>
        </div>`;
    } catch (e) { err(e); }
  };
})();
